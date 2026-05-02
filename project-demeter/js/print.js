// Project Demeter — Print/PDF report module.
// Opens a new window with a self-contained light-theme HTML report,
// rasterizes the single-tier heatmap SVG to a PNG (2x) via offscreen
// canvas, embeds it as a base64 <img>, then triggers window.print()
// once the image has loaded. The popup window has no app dependencies;
// all layout, fonts, and content are inlined so the print pipeline is
// reliable across browsers and survives offline.
//
// Snapshot is the input. The live APP state is never read here — the
// frozen snapshot built by report.buildSnapshot() carries everything
// the print needs. That keeps the customer-facing artifact stable
// against further edits in the editor.

import {
  CHECKLIST_GROUPS,
  C9_DETAIL,
  getItemState,
  defaultItemState
} from './checklist.js';

import {
  STAGES,
  stageBand,
  calcVPD,
  toC,
  rhForVpd
} from './math.js';

import { computeViabilityLabel, manufacturerSanitize } from './report.js';
import { buildHeatmapLayer } from './heatmap.js';
import {
  SVG_NS,
  viewBoxFor,
  createCanvasSVG,
  buildGridLayer,
  buildAxisLayer
} from './ciab.js';

// Base CSS pixel width of the rasterized heatmap before the 2x upscale.
// Fits comfortably inside an 8.5" page at 96 dpi (~720 px wide content
// area after page margins).
const RASTER_BASE_PX = 720;
const RASTER_SCALE   = 2;
const LEAF_OFFSET_C  = 2;

const VIABILITY_BLURB = {
  COMMISSIONED: 'All evaluated items pass and commissioning is verified.',
  FUNCTIONAL:   'All evaluated items pass; commissioning evidence not retrieved.',
  DEFICIENT:    'One or more Critical or High items failed.',
  'NOT VERIFIED': 'Critical or High items remain open without evaluation.'
};

const FAIL_DOMAIN_WORD = {
  A: 'distribution',
  B: 'equipment',
  C: 'controls/sensing',
  D: 'envelope',
  E: 'pressurization',
  F: 'heat-rejection',
  G: 'design/commissioning'
};

// ── Public entry ───────────────────────────────────────────────────────────

export async function openPrintReport(snapshot) {
  if (!snapshot) return;

  // Open the popup synchronously inside the click context so popup
  // blockers see the user gesture. We swap in the full report once the
  // heatmap PNG is ready.
  const w = window.open('', '_blank');
  if (!w) {
    alert('Popup blocked - allow popups to print this report.');
    return;
  }
  writeDoc(w, buildLoadingHtml());

  let heatmapDataUrl = '';
  try {
    if (snapshot.mapData && snapshot.mapData.mapMode !== 'multi') {
      heatmapDataUrl = await rasterizeHeatmap(snapshot);
    }
  } catch (e) {
    console.error('Heatmap rasterization failed:', e);
    heatmapDataUrl = '';
  }

  writeDoc(w, buildPrintHtml(snapshot, heatmapDataUrl));
}

function writeDoc(win, html) {
  win.document.open();
  win.document.write(html);
  win.document.close();
}

// ── Heatmap rasterization ──────────────────────────────────────────────────

async function rasterizeHeatmap(snapshot) {
  const md = snapshot.mapData || {};
  const len = md.roomLen;
  const wid = md.roomWid;
  if (!Number.isFinite(len) || !Number.isFinite(wid) || len <= 0 || wid <= 0) {
    return '';
  }

  const svg = buildPrintMapSvg(snapshot);
  // Set explicit pixel size for the rasterizer; without it, some
  // browsers default to 0×0 when loading an SVG via <img src=data:>.
  const vb = parseViewBox(svg.getAttribute('viewBox'));
  const baseW = RASTER_BASE_PX;
  const baseH = Math.max(1, Math.round(RASTER_BASE_PX * (vb.h / vb.w)));
  svg.setAttribute('width',  String(baseW));
  svg.setAttribute('height', String(baseH));

  // Serialize and embed as a data URL. `unescape(encodeURIComponent(...))`
  // would be needed for btoa with non-ASCII; the SVG is ASCII-only.
  const xml = new XMLSerializer().serializeToString(svg);
  const xmlWithDecl = '<?xml version="1.0" encoding="UTF-8"?>' + xml;
  const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xmlWithDecl);

  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  canvas.width  = baseW * RASTER_SCALE;
  canvas.height = baseH * RASTER_SCALE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  // White background so any transparency in the SVG (gridlines, axis)
  // prints clean instead of letting the page color through.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  return canvas.toDataURL('image/png');
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload  = () => resolve(img);
    img.onerror = (e) => reject(e || new Error('image load failed'));
    img.src = src;
  });
}

function parseViewBox(s) {
  const parts = String(s || '').trim().split(/\s+/).map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
    return { x: 0, y: 0, w: 1, h: 1 };
  }
  return { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
}

// ── Print SVG builder ──────────────────────────────────────────────────────
// Self-contained SVG: inlined <style> for shared rules (legend, axis,
// gridlines, void text), inline fill/stroke on per-element shapes.
// No reliance on the page's app.css — the rasterizer loads this SVG as
// an Image and ignores external stylesheets.

const PRINT_MAP_CSS = `
  .pm-grid__room { fill: #ffffff; stroke: #b8b6b1; stroke-width: 0.04; }
  .pm-grid__line { stroke: #d8d6d1; stroke-width: 0.025; }
  .pm-axis__label {
    fill: #5e5c58;
    font-family: 'Share Tech Mono', ui-monospace, Menlo, Consolas, monospace;
  }
  .pm-legend-bg {
    fill: rgba(255,255,255,0.92);
    stroke: #b8b6b1;
    stroke-width: 0.04;
  }
  .pm-legend-glyph,
  .pm-legend-text {
    fill: #1c1c1c;
    font-family: 'Share Tech Mono', ui-monospace, Menlo, Consolas, monospace;
  }
  .pm-void-head {
    fill: #b62d2d;
    font-family: 'Rajdhani', system-ui, sans-serif;
    font-weight: 700;
    letter-spacing: 0.2em;
  }
  .pm-void-sub {
    fill: #5e5c58;
    font-family: 'Share Tech Mono', ui-monospace, Menlo, Consolas, monospace;
  }
`;

function buildPrintMapSvg(snapshot) {
  const md = snapshot.mapData || {};
  const len = md.roomLen;
  const wid = md.roomWid;
  const c9  = !!(snapshot.computed && snapshot.computed.c9Failed);
  const stage = stageBand(snapshot.metadata ? snapshot.metadata.stage : 0);

  const vb  = viewBoxFor(len, wid, 2.4, 1.6);
  const svg = createCanvasSVG(vb, { className: 'pm-svg' });
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');

  // Inline <style> for shared rules + legend/void-overlay glyphs.
  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = PRINT_MAP_CSS;
  svg.appendChild(style);

  // Defs — dead-zone hatch pattern (light-theme).
  svg.appendChild(buildPrintDefs());

  // Bottom → top: room/grid, axis, zones, heatmap, ducts, equipment,
  // registers, sensors. The heatmap module already paints cells with
  // inline fill attributes and draws its own embedded legend / void
  // overlay (those use class names that match PRINT_MAP_CSS above).
  svg.appendChild(buildGridLayer(len, wid, {
    layerClass: 'pm-grid',
    roomClass:  'pm-grid__room',
    lineClass:  'pm-grid__line'
  }));
  svg.appendChild(buildAxisLayer(len, wid, {
    layerClass: 'pm-axis',
    labelClass: 'pm-axis__label'
  }));
  svg.appendChild(buildPrintZonesLayer(md));
  svg.appendChild(reclassHeatmap(buildHeatmapLayer({
    sensors: md.sensors,
    zones:   md.zones,
    len,
    wid,
    stage,
    voided:  c9
  })));
  svg.appendChild(buildPrintDuctsLayer(md));
  svg.appendChild(buildPrintEquipmentLayer(md));
  svg.appendChild(buildPrintRegistersLayer(md));
  svg.appendChild(buildPrintSensorsLayer(md, stage, c9));
  return svg;
}

// Rewrite class names on the heatmap module's nodes from .map-heatmap__*
// to .pm-* so the inline PRINT_MAP_CSS picks them up. Cells keep their
// inline fill; only the legend and void-overlay text need styling.
function reclassHeatmap(g) {
  const map = {
    'map-heatmap__legend-bg':    'pm-legend-bg',
    'map-heatmap__legend-glyph': 'pm-legend-glyph',
    'map-heatmap__legend-text':  'pm-legend-text',
    'map-heatmap__void-head':    'pm-void-head',
    'map-heatmap__void-sub':     'pm-void-sub'
  };
  const all = g.querySelectorAll('[class]');
  for (const el of all) {
    const cls = el.getAttribute('class') || '';
    let next = cls;
    for (const [from, to] of Object.entries(map)) {
      if (cls.includes(from)) next = next.replace(from, to);
    }
    if (next !== cls) el.setAttribute('class', next);
  }
  return g;
}

function buildPrintDefs() {
  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <pattern id="pm-dead-hatch" patternUnits="userSpaceOnUse"
             width="0.7" height="0.7" patternTransform="rotate(45)">
      <rect width="0.7" height="0.7" fill="rgba(0,0,0,0.04)" />
      <line x1="0" y1="0" x2="0" y2="0.7" stroke="rgba(0,0,0,0.30)" stroke-width="0.07" />
    </pattern>
  `;
  return defs;
}

function buildPrintZonesLayer(md) {
  const g = document.createElementNS(SVG_NS, 'g');
  for (const z of (md.zones || [])) {
    const r = rectFromCorners(z);
    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(r.x));
    rect.setAttribute('y', String(r.y));
    rect.setAttribute('width',  String(r.w));
    rect.setAttribute('height', String(r.h));
    if (z.type === 'dead') {
      rect.setAttribute('fill',   'url(#pm-dead-hatch)');
      rect.setAttribute('stroke', 'rgba(0,0,0,0.40)');
      rect.setAttribute('stroke-width',     '0.05');
      rect.setAttribute('stroke-dasharray', '0.25 0.25');
    } else {
      rect.setAttribute('fill',   'rgba(111,200,118,0.10)');
      rect.setAttribute('stroke', '#3aa346');
      rect.setAttribute('stroke-width',     '0.06');
      rect.setAttribute('stroke-dasharray', '0.4 0.25');
    }
    g.appendChild(rect);

    if (z.label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(r.x + 0.3));
      t.setAttribute('y', String(r.y + 0.9));
      t.setAttribute('font-size', '0.6');
      t.setAttribute('fill', '#3a3a3a');
      t.setAttribute('font-family', "'Share Tech Mono', monospace");
      t.textContent = z.label;
      g.appendChild(t);
    }
  }
  return g;
}

function buildPrintDuctsLayer(md) {
  const g = document.createElementNS(SVG_NS, 'g');
  const equipById = byId(md.equipmentModules);
  for (const d of (md.ducts || [])) {
    const eq = equipById[d.equipmentId];
    const stroke = (eq && eq.type === 'return') ? '#1f8c79' : '#c46a08';
    const a = ductOriginPoint(d, eq);
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(d.x2Ft));
    line.setAttribute('y2', String(d.y2Ft));
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', '0.18');
    line.setAttribute('stroke-linecap', 'round');
    g.appendChild(line);
  }
  return g;
}

function buildPrintEquipmentLayer(md) {
  const g = document.createElementNS(SVG_NS, 'g');
  for (const m of (md.equipmentModules || [])) {
    const isReturn = m.type === 'return';
    const fill   = isReturn ? 'rgba(78,201,176,0.18)'  : 'rgba(232,130,10,0.18)';
    const stroke = isReturn ? '#1f8c79'                : '#c46a08';

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(m.xFt));
    rect.setAttribute('y', String(m.yFt));
    rect.setAttribute('width',  String(m.wFt));
    rect.setAttribute('height', String(m.hFt));
    rect.setAttribute('fill',   fill);
    rect.setAttribute('stroke', stroke);
    rect.setAttribute('stroke-width', '0.08');
    g.appendChild(rect);

    const glyph = document.createElementNS(SVG_NS, 'text');
    glyph.setAttribute('x', String(m.xFt + 0.3));
    glyph.setAttribute('y', String(m.yFt + 1.0));
    glyph.setAttribute('font-size', '0.9');
    glyph.setAttribute('font-weight', '700');
    glyph.setAttribute('fill', stroke);
    glyph.setAttribute('font-family', "'Rajdhani', system-ui, sans-serif");
    glyph.textContent = isReturn ? 'R' : 'S';
    g.appendChild(glyph);

    if (m.label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(m.xFt + m.wFt / 2));
      t.setAttribute('y', String(m.yFt + m.hFt / 2 + 0.25));
      t.setAttribute('font-size', '0.7');
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('fill', '#1c1c1c');
      t.setAttribute('font-family', "'Share Tech Mono', monospace");
      t.textContent = m.label;
      g.appendChild(t);
    }
  }
  return g;
}

function buildPrintRegistersLayer(md) {
  const g = document.createElementNS(SVG_NS, 'g');
  const ductsById = byId(md.ducts);
  const equipById = byId(md.equipmentModules);
  const REG_R = 0.4;

  for (const r of (md.registers || [])) {
    const parentDuct = r.ductId ? ductsById[r.ductId] : null;
    const parentEq   = parentDuct ? equipById[parentDuct.equipmentId] : null;
    const isReturn = parentEq ? parentEq.type === 'return' : false;
    const stroke = isReturn ? '#1f8c79' : '#c46a08';

    const wrap = document.createElementNS(SVG_NS, 'g');
    wrap.setAttribute('transform', `translate(${r.xFt} ${r.yFt})`);

    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('r', String(REG_R));
    c.setAttribute('fill',   '#ffffff');
    c.setAttribute('stroke', stroke);
    c.setAttribute('stroke-width', '0.06');
    wrap.appendChild(c);

    const lh = document.createElementNS(SVG_NS, 'line');
    lh.setAttribute('x1', String(-REG_R));
    lh.setAttribute('x2', String( REG_R));
    lh.setAttribute('y1', '0');
    lh.setAttribute('y2', '0');
    lh.setAttribute('stroke', stroke);
    lh.setAttribute('stroke-width', '0.05');
    wrap.appendChild(lh);

    const lv = document.createElementNS(SVG_NS, 'line');
    lv.setAttribute('x1', '0');
    lv.setAttribute('x2', '0');
    lv.setAttribute('y1', String(-REG_R));
    lv.setAttribute('y2', String( REG_R));
    lv.setAttribute('stroke', stroke);
    lv.setAttribute('stroke-width', '0.05');
    wrap.appendChild(lv);

    if (r.label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(REG_R + 0.2));
      t.setAttribute('y', '0.15');
      t.setAttribute('font-size', '0.55');
      t.setAttribute('fill', '#3a3a3a');
      t.setAttribute('font-family', "'Share Tech Mono', monospace");
      t.textContent = r.label;
      wrap.appendChild(t);
    }
    g.appendChild(wrap);
  }
  return g;
}

function buildPrintSensorsLayer(md, stage, voided) {
  const g = document.createElementNS(SVG_NS, 'g');
  const SENSOR_R = 0.3;
  const sensors = md.sensors || [];

  sensors.forEach((s, i) => {
    const status = voided ? 'unread' : sensorStatus(s, stage);
    let fill;
    switch (status) {
      case 'low':  fill = '#3a9b87'; break;
      case 'in':   fill = '#3aa346'; break;
      case 'high': fill = '#b62d2d'; break;
      default:     fill = '#a09e9a';
    }

    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('cx', String(s.xFt));
    c.setAttribute('cy', String(s.yFt));
    c.setAttribute('r',  String(SENSOR_R));
    c.setAttribute('fill',   fill);
    c.setAttribute('stroke', '#ffffff');
    c.setAttribute('stroke-width', '0.05');
    g.appendChild(c);

    const idx = document.createElementNS(SVG_NS, 'text');
    idx.setAttribute('x', String(s.xFt + SENSOR_R + 0.18));
    idx.setAttribute('y', String(s.yFt - 0.05));
    idx.setAttribute('font-size', '0.55');
    idx.setAttribute('fill', '#1c1c1c');
    idx.setAttribute('font-family', "'Share Tech Mono', monospace");
    idx.textContent = `S${i + 1}`;
    g.appendChild(idx);

    const v = sensorVPD(s);
    if (Number.isFinite(v) && !voided) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('x', String(s.xFt + SENSOR_R + 0.18));
      t.setAttribute('y', String(s.yFt + 0.45));
      t.setAttribute('font-size', '0.45');
      t.setAttribute('fill', '#5e5c58');
      t.setAttribute('font-family', "'Share Tech Mono', monospace");
      t.textContent = `${v.toFixed(2)} kPa`;
      g.appendChild(t);
    }
  });
  return g;
}

// ── Map helpers (private) ──────────────────────────────────────────────────

function rectFromCorners(c) {
  const x = Math.min(c.x1Ft ?? 0, c.x2Ft ?? 0);
  const y = Math.min(c.y1Ft ?? 0, c.y2Ft ?? 0);
  const w = Math.abs((c.x2Ft ?? 0) - (c.x1Ft ?? 0));
  const h = Math.abs((c.y2Ft ?? 0) - (c.y1Ft ?? 0));
  return { x, y, w, h };
}

function byId(arr) {
  const map = Object.create(null);
  for (const el of (arr || [])) {
    if (el && el.id != null) map[el.id] = el;
  }
  return map;
}

// Duct origin = center of parent equipment module if known, else (x1,y1).
function ductOriginPoint(duct, eq) {
  if (eq && Number.isFinite(eq.xFt) && Number.isFinite(eq.wFt)) {
    return { x: eq.xFt + eq.wFt / 2, y: eq.yFt + eq.hFt / 2 };
  }
  return { x: duct.x1Ft ?? 0, y: duct.y1Ft ?? 0 };
}

function sensorVPD(s) {
  if (!s) return null;
  if (!Number.isFinite(s.tdb) || !Number.isFinite(s.rh)) return null;
  return calcVPD(toC(s.tdb), s.rh, LEAF_OFFSET_C);
}

function sensorStatus(s, stage) {
  const v = sensorVPD(s);
  if (!Number.isFinite(v)) return 'unread';
  if (!stage) return 'in';
  if (v < stage.vpdMin) return 'low';
  if (v > stage.vpdMax) return 'high';
  return 'in';
}

// ── HTML builders ──────────────────────────────────────────────────────────

function buildLoadingHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Project Demeter - Report</title>
  <style>
    body { font-family: ui-monospace, Menlo, Consolas, monospace;
           background: #f4f3ef; color: #1c1c1c;
           display: flex; align-items: center; justify-content: center;
           height: 100vh; margin: 0; }
    .loading { text-align: center; }
    .loading h1 { font-family: system-ui, sans-serif; color: #c46a08;
                  letter-spacing: 0.2em; font-size: 18px; margin: 0 0 8px; }
  </style>
</head>
<body>
  <div class="loading">
    <h1>PROJECT DEMETER</h1>
    <p>Preparing print report&hellip;</p>
  </div>
</body>
</html>`;
}

function buildPrintHtml(snap, heatmapDataUrl) {
  const m = snap.metadata || {};
  const md = snap.mapData || {};
  const c = snap.computed || {};
  const c9 = !!c.c9Failed;
  const v  = c.viability || 'NOT VERIFIED';
  const vLabel = computeViabilityLabel({ checklistState: snap.checklistState }) || v;

  const sections = [
    sectionTitle(snap),
    sectionSiteInfo(snap),
    sectionMeasured(snap),
    sectionViability(snap, vLabel),
    sectionTargetRH(snap),
    sectionRoomMap(snap, heatmapDataUrl),
    sectionEquipment(snap),
    sectionChecklist(snap),
    sectionFailures(snap),
    sectionRetests(snap),
    sectionFinalAssessment(snap, vLabel),
    sectionNarrative(snap),
    sectionFooter(snap)
  ].join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Project Demeter - ${esc(joinMeta(m))}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;700&family=Share+Tech+Mono&display=swap" />
  <style>${PRINT_DOC_CSS}</style>
</head>
<body>
  <main class="doc">
${sections}
  </main>
  <script>
    (function() {
      // Wait for the heatmap image (if any) to finish layout/decode before
      // calling print(); otherwise some browsers print the placeholder.
      var imgs = document.images;
      var pending = 0;
      var done = false;
      function maybePrint() {
        if (done) return;
        if (pending > 0) return;
        done = true;
        // Tiny defer so layout/font swap settles, then print.
        setTimeout(function() { window.print(); }, 80);
      }
      for (var i = 0; i < imgs.length; i++) {
        var im = imgs[i];
        if (!im.complete) {
          pending++;
          im.addEventListener('load',  function() { pending--; maybePrint(); });
          im.addEventListener('error', function() { pending--; maybePrint(); });
        }
      }
      if (pending === 0) maybePrint();
    })();
  </script>
</body>
</html>`;
}

// ── Section renderers (HTML strings) ───────────────────────────────────────

function sectionTitle(snap) {
  const m = snap.metadata || {};
  const ts = formatTimestamp(snap.generatedAt);
  const head = [m.customer, m.facility, m.room].filter(Boolean).join(' &middot; ');
  return `
  <header class="title-block">
    <div class="title-block__brand">
      <h1 class="title-block__title">PROJECT DEMETER</h1>
      <div class="title-block__sub">VPD Survey Report</div>
    </div>
    <div class="title-block__meta">
      <div>${esc(head) || '&mdash;'}</div>
      <div class="title-block__ts">${esc(ts)}</div>
    </div>
  </header>`;
}

function sectionSiteInfo(snap) {
  const m = snap.metadata || {};
  const stage = stageBand(m.stage);
  const lights = m.lights === 'transition' ? 'TRANSITION'
               : (m.lights || 'on').toUpperCase();
  const transitionNote = m.lights === 'transition'
    ? `<p class="note note--warn">State note: lights in sunrise/sunset transition; see Final Assessment caveat.</p>`
    : '';
  const rows = [
    ['Customer',         m.customer],
    ['Facility',         m.facility],
    ['Room',             m.room],
    ['Equipment Model',  m.equipmentModel],
    ['Equipment Serial', m.equipmentSerial],
    ['Equipment Notes',  m.equipmentNotes],
    ['Growth Stage',     stage ? stage.label : null],
    ['Lights Cycle',     lights],
    ['Technician',       m.tech],
    ['Date',             m.date]
  ].map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v) || '&mdash;'}</td></tr>`).join('');

  return sec('Site Information', `
    <table class="kv">${rows}</table>
    ${transitionNote}
  `);
}

function sectionMeasured(snap) {
  const m = snap.computed && snap.computed.measuredVPD;
  if (snap.computed && snap.computed.c9Failed) {
    return sec('Measured Environmental State', `
      <div class="void-block">
        <div class="void-block__head">VOID</div>
        <p class="void-block__sub">Sensor validity not established. Reported VPD values cannot be assumed to represent canopy conditions. See C9 in Site Checklist.</p>
      </div>
    `);
  }
  if (!m || !m.withReadingsCount) {
    return sec('Measured Environmental State', `
      <p class="muted">Insufficient sensor data to characterize measured state.</p>
    `);
  }
  const status = vpdStatusLabel(m.mean, m.band);
  const statusClass =
    status === 'IN RANGE' ? 'badge--ok'
    : status === 'LOW'    ? 'badge--low'
    : status === 'HIGH'   ? 'badge--high'
    : 'badge--mute';

  const rangeFlag = (m.range > 0.3)
    ? `<span class="badge badge--warn">WIDE</span> investigate airflow balance`
    : '';
  const pct = m.withReadingsCount > 0
    ? Math.round(100 * m.inRangeCount / m.withReadingsCount) : 0;

  return sec('Measured Environmental State', `
    <div class="vpd-hero">
      <div class="vpd-hero__value">${num(m.mean, 2)} <span class="vpd-hero__unit">kPa</span></div>
      <div class="vpd-hero__badges">
        <span class="badge ${statusClass}">${esc(status)}</span>
        ${m.band ? `<span class="badge badge--mute">target ${num(m.band.vpdMin, 2)}&ndash;${num(m.band.vpdMax, 2)} kPa (${esc(m.band.label)})</span>` : ''}
      </div>
    </div>
    ${buildVpdStrip(m)}
    <table class="kv kv--compact">
      <tr><th>Spatial Range</th><td>${num(m.range, 2)} kPa ${rangeFlag}</td></tr>
      <tr><th>In-Range Sensors</th><td>${m.inRangeCount}/${m.withReadingsCount} (${pct}%)</td></tr>
      <tr><th>Min / Mean / Max</th><td>${num(m.min, 2)} / ${num(m.mean, 2)} / ${num(m.max, 2)} kPa</td></tr>
    </table>
  `);
}

// VPD target decoder strip — inline SVG, vector (no rasterization).
// Mirrors the live Map-tab decoder bar: full 0-2.0 kPa scale with the
// stage band rendered as a green segment between teal (too low) and
// red (too high), tick marks + labels below, and a needle/arrow showing
// where the mean measured VPD lands. Hidden when no band or no
// readings; the surrounding section already shows the kPa value.
const VPD_STRIP_MAX = 2.0;

function buildVpdStrip(m) {
  if (!m || !m.band) return '';
  if (!Number.isFinite(m.mean)) return '';
  const band = m.band;

  // viewBox in arbitrary units; CSS scales the SVG to container width.
  const VB_W = 400, VB_H = 60;
  const PAD_X = 12;
  const TRACK_Y = 10;
  const TRACK_H = 14;
  const TRACK_W = VB_W - PAD_X * 2;
  const xAt = (kPa) => PAD_X + (Math.min(Math.max(kPa, 0), VPD_STRIP_MAX) / VPD_STRIP_MAX) * TRACK_W;

  const x0    = xAt(0);
  const xLow  = xAt(band.vpdMin);
  const xHigh = xAt(band.vpdMax);
  const xMax  = xAt(VPD_STRIP_MAX);

  // Solid segments: teal (low) | green (in-range) | red (high).
  const segLow  = `<rect x="${x0}" y="${TRACK_Y}" width="${xLow - x0}"   height="${TRACK_H}" fill="#9ed5c8" />`;
  const segIn   = `<rect x="${xLow}" y="${TRACK_Y}" width="${xHigh - xLow}" height="${TRACK_H}" fill="#bce4be" />`;
  const segHigh = `<rect x="${xHigh}" y="${TRACK_Y}" width="${xMax - xHigh}" height="${TRACK_H}" fill="#f1b9b9" />`;
  const trackBorder = `<rect x="${x0}" y="${TRACK_Y}" width="${xMax - x0}" height="${TRACK_H}" fill="none" stroke="#5e5c58" stroke-width="0.4" />`;
  const bandBorder = `<rect x="${xLow}" y="${TRACK_Y}" width="${xHigh - xLow}" height="${TRACK_H}" fill="none" stroke="#3aa346" stroke-width="0.8" />`;

  // Ticks every 0.5 kPa.
  const ticks = [];
  const labels = [];
  for (let v = 0; v <= VPD_STRIP_MAX + 1e-9; v += 0.5) {
    const x = xAt(v);
    ticks.push(`<line x1="${x}" y1="${TRACK_Y + TRACK_H}" x2="${x}" y2="${TRACK_Y + TRACK_H + 3}" stroke="#5e5c58" stroke-width="0.5" />`);
    const label = (v === VPD_STRIP_MAX) ? `${v.toFixed(1)} kPa` : v.toFixed(1);
    labels.push(`<text x="${x}" y="${TRACK_Y + TRACK_H + 10}" font-size="6" text-anchor="middle" fill="#5e5c58" font-family="'Share Tech Mono', monospace">${label}</text>`);
  }

  // Needle: arrow under the bar pointing at the mean VPD position.
  const needleX = xAt(m.mean);
  const needleColor =
    m.mean < band.vpdMin ? '#1f8c79' :
    m.mean > band.vpdMax ? '#b62d2d' : '#3aa346';
  const ny0 = TRACK_Y + TRACK_H + 14;
  const ny1 = ny0 + 6;
  const needle = `
    <polygon points="${needleX},${ny0} ${needleX - 4},${ny1 + 4} ${needleX + 4},${ny1 + 4}" fill="${needleColor}" stroke="#1c1c1c" stroke-width="0.3" />
    <text x="${needleX}" y="${ny1 + 12}" font-size="6" text-anchor="middle" fill="#1c1c1c" font-family="'Share Tech Mono', monospace">mean ${m.mean.toFixed(2)} kPa</text>
  `;

  return `
    <figure class="vpd-strip" aria-label="VPD target decoder">
      <figcaption class="vpd-strip__caption">VPD Target &mdash; ${esc(band.label)} (${num(band.vpdMin, 2)}&ndash;${num(band.vpdMax, 2)} kPa)</figcaption>
      <svg viewBox="0 0 ${VB_W} ${VB_H + 14}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid meet">
        ${segLow}${segIn}${segHigh}
        ${bandBorder}
        ${trackBorder}
        ${ticks.join('')}
        ${labels.join('')}
        ${needle}
      </svg>
    </figure>
  `;
}

function sectionViability(snap, vLabel) {
  const v = snap.computed && snap.computed.viability;
  const cls =
    v === 'COMMISSIONED' ? 'badge--ok'
    : v === 'FUNCTIONAL'   ? 'badge--ok'
    : v === 'DEFICIENT'    ? 'badge--high'
    : 'badge--warn';

  const c9 = !!(snap.computed && snap.computed.c9Failed);
  const m  = snap.computed && snap.computed.measuredVPD;

  let vpdState;
  if (c9) {
    vpdState = 'reported as VOID (sensor validity not established)';
  } else if (m && m.withReadingsCount >= 1) {
    const st = vpdStatusLabel(m.mean, m.band);
    vpdState = st === 'IN RANGE' ? 'within target VPD range'
             : st === 'LOW'      ? 'below target VPD range'
             : st === 'HIGH'     ? 'above target VPD range'
             : 'not characterized';
  } else {
    vpdState = 'not characterized';
  }

  let para = `The room is currently ${vpdState}, however system viability is ${(snap.computed && snap.computed.viability) || 'NOT VERIFIED'}.`;
  const groups = (snap.computed && snap.computed.failureGroupKeys) || [];
  if (groups.length) {
    const words = groups.map((k) => FAIL_DOMAIN_WORD[k]).filter(Boolean);
    para += ` Measured conditions cannot be assumed stable due to ${words.join(', ')}.`;
  }
  const transition = (snap.metadata && snap.metadata.lights === 'transition')
    ? `<p class="note">Survey performed during sunrise/sunset transition; measured values reflect a non-steady-state period.</p>`
    : '';

  return sec('System Viability', `
    <div class="viability">
      <span class="badge ${cls} badge--lg">${esc(vLabel)}</span>
      <span class="viability__blurb">${esc(VIABILITY_BLURB[v] || '')}</span>
    </div>
    <p>${esc(para)}</p>
    ${transition}
  `);
}

function sectionTargetRH(snap) {
  const sensors = (snap.mapData && snap.mapData.sensors) || [];
  const unitF = !!(snap.metadata && snap.metadata.unitF !== false);
  const tdbs = sensors.map((s) => s.tdb).filter((t) => Number.isFinite(t));
  const meanT = tdbs.length ? tdbs.reduce((a, b) => a + b, 0) / tdbs.length : null;
  const meanTC = (meanT == null) ? null : (unitF ? toC(meanT) : meanT);

  const rows = STAGES.map((stg) => {
    const targetVpd = (stg.vpdMin + stg.vpdMax) / 2;
    let rhStr = '&mdash;';
    if (Number.isFinite(meanTC)) {
      const rh = rhForVpd(meanTC, targetVpd, LEAF_OFFSET_C);
      if (Number.isFinite(rh)) rhStr = `${rh.toFixed(0)}%`;
    }
    return `<tr>
      <td>${esc(stg.label)}</td>
      <td>${num(stg.vpdMin, 2)}&ndash;${num(stg.vpdMax, 2)}</td>
      <td>${num(targetVpd, 2)}</td>
      <td>${rhStr}</td>
    </tr>`;
  }).join('');

  const tdbLabel = Number.isFinite(meanT)
    ? (unitF ? `${meanT.toFixed(1)} &deg;F` : `${meanT.toFixed(1)} &deg;C`)
    : 'not available';

  return sec('Target RH by Stage', `
    <p class="muted">Target RH at mean measured dry-bulb (${tdbLabel}), 2 &deg;C leaf offset.</p>
    <table class="grid">
      <thead><tr><th>Stage</th><th>VPD band (kPa)</th><th>Midpoint</th><th>Target RH</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `);
}

function sectionRoomMap(snap, heatmapDataUrl) {
  const md = snap.mapData || {};
  if (md.mapMode === 'multi') return sectionRoomMapMulti(snap);

  const c = snap.computed || {};
  const m = c.measuredVPD;
  const len = Number.isFinite(md.roomLen) ? md.roomLen : null;
  const wid = Number.isFinite(md.roomWid) ? md.roomWid : null;
  const dim = (len && wid) ? `${num(len, 1)} ft &times; ${num(wid, 1)} ft` : 'not entered';

  const facts = `
    <table class="kv kv--compact">
      <tr><th>Room Dimensions</th><td>${esc(dim)}</td></tr>
      <tr><th>Sensor Count</th><td>${(md.sensors || []).length}</td></tr>
      <tr><th>Canopy Area</th><td>${num(c.canopyArea, 1)} sq ft</td></tr>
      <tr><th>Mean Sensor Spacing</th><td>${
        Number.isFinite(c.meanSensorSpacing)
          ? `${num(c.meanSensorSpacing, 2)} ft (mean nearest-neighbor)`
          : '&mdash;'
      }</td></tr>
      <tr><th>Sensor Density</th><td>${
        Number.isFinite(c.sensorsPer100SqFt)
          ? `${num(c.sensorsPer100SqFt, 2)} sensors per 100 sq ft`
          : '&mdash;'
      }</td></tr>
      <tr><th>Airflow Confidence</th><td>${esc(md.airflowConfidence || 'UNKNOWN')}</td></tr>
    </table>
  `;

  const heatmapBlock = heatmapDataUrl
    ? `<figure class="heatmap"><img src="${heatmapDataUrl}" alt="Room heatmap" /></figure>`
    : `<p class="muted">No heatmap available (room dimensions not entered).</p>`;

  let vpdSummary = '';
  if (m && m.withReadingsCount >= 1) {
    const flag = m.range > 0.3
      ? ` <span class="badge badge--warn">WIDE distribution &mdash; investigate airflow balance</span>`
      : '';
    vpdSummary = `
      <table class="kv kv--compact">
        <tr><th>Min / Mean / Max</th><td>${num(m.min, 2)} / ${num(m.mean, 2)} / ${num(m.max, 2)} kPa</td></tr>
        <tr><th>Range</th><td>${num(m.range, 2)} kPa${flag}</td></tr>
      </table>
    `;
  }

  const sensorTable = buildSensorTable(snap);
  const coverage = (md.coverageNotes || '').trim();
  const coverageBlock = coverage
    ? `<div class="coverage"><h4>Sensor coverage notes</h4><p>${escMultiline(coverage)}</p></div>`
    : `<div class="coverage"><h4>Sensor coverage notes</h4><p class="muted">(no notes)</p></div>`;

  return sec('Room Map', `
    ${heatmapBlock}
    ${facts}
    ${vpdSummary}
    ${sensorTable}
    ${coverageBlock}
  `);
}

function sectionRoomMapMulti(snap) {
  const md = snap.mapData || {};
  const ts = md.tierSensors || {};
  const tierKeys = Object.keys(ts).sort((a, b) => Number(a) - Number(b));
  const unitF = !!(snap.metadata && snap.metadata.unitF !== false);
  const band = stageBand(snap.metadata && snap.metadata.stage);

  const tierBlocks = tierKeys.map((t) => {
    const arr = Array.isArray(ts[t]) ? ts[t] : [];
    const rows = arr.map((s, i) => {
      const label = s.label || `T${t}-S${i + 1}`;
      const pos   = (s.position || 'mid').toUpperCase();
      const vpd   = sensorVPD(s);
      const status = Number.isFinite(vpd) && band ? vpdStatusLabel(vpd, band) : '&mdash;';
      return `<tr>
        <td>${esc(label)}</td>
        <td>${esc(pos)}</td>
        <td>${tempCell(s.tdb, unitF)}</td>
        <td>${Number.isFinite(s.rh) ? `${num(s.rh, 0)}%` : '&mdash;'}</td>
        <td>${Number.isFinite(vpd) ? `${num(vpd, 2)} kPa` : '&mdash;'}</td>
        <td>${esc(status)}</td>
        <td>${Number.isFinite(vpd) ? 'Measured' : 'Not Verified'}</td>
      </tr>`;
    }).join('') || `<tr><td colspan="7" class="muted">(no sensors recorded for this tier)</td></tr>`;

    const vpds = arr.map(sensorVPD).filter(Number.isFinite);
    let summary = '';
    if (vpds.length) {
      const min = Math.min(...vpds);
      const max = Math.max(...vpds);
      const mean = vpds.reduce((a, b) => a + b, 0) / vpds.length;
      const range = max - min;
      let inR = 0;
      if (band) for (const v of vpds) if (v >= band.vpdMin && v <= band.vpdMax) inR++;
      const wide = range > 0.3
        ? ` <span class="badge badge--warn">WIDE</span> within-tier gradient`
        : '';
      summary = `<p class="muted">Summary: in-range ${inR}/${vpds.length} &middot; mean ${num(mean, 2)} kPa &middot; range ${num(range, 2)} kPa${wide}</p>`;
    }

    return `
      <div class="tier">
        <h4>Tier ${esc(t)}</h4>
        <table class="grid">
          <thead><tr><th>Point</th><th>Pos</th><th>Temp</th><th>RH</th><th>VPD</th><th>Status</th><th>Basis</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        ${summary}
      </div>`;
  }).join('') || `<p class="muted">Multi-tier mode: no per-tier sensors recorded.</p>`;

  return sec('Room Map (Multi-Tier)', `
    <table class="kv kv--compact">
      <tr><th>Tier Count</th><td>${esc(md.tierCount)}</td></tr>
      <tr><th>Lighting</th><td>${esc((md.lighting || 'led').toUpperCase())}</td></tr>
    </table>
    ${tierBlocks}
    <div class="tier-limit-note">
      <p>Spatial distribution within tiers is partially evaluated via head/middle/tail position tagging but no floor-plan map is rendered. Each tier is treated as an independent environmental zone.</p>
      <p><strong>AGIQ:</strong> Multi-tier rooms must be sensed independently per tier &mdash; tiers are supplied by different equipment and may experience different conditions.</p>
    </div>
  `);
}

function buildSensorTable(snap) {
  const md = snap.mapData || {};
  const sensors = md.sensors || [];
  const unitF = !!(snap.metadata && snap.metadata.unitF !== false);
  const stage = stageBand(snap.metadata && snap.metadata.stage);
  const cs = snap.checklistState || {};
  const c9State = getItemState(cs, 'C9');

  if (!sensors.length) {
    return `<p class="muted">No sensors recorded.</p>`;
  }

  const rows = sensors.map((s, i) => {
    const label = s.label || `S${i + 1}`;
    const xy = `(${num(s.xFt, 1)}, ${num(s.yFt, 1)})`;
    const v = sensorVPD(s);
    const status = Number.isFinite(v) && stage ? vpdStatusLabel(v, stage) : '&mdash;';
    const basis = Number.isFinite(v)
      ? (c9State.evidenceBasis || 'Measured')
      : 'Not Verified';
    return `<tr>
      <td>${esc(label)}</td>
      <td>${xy}</td>
      <td>${tempCell(s.tdb, unitF)}</td>
      <td>${Number.isFinite(s.rh) ? `${num(s.rh, 0)}%` : '&mdash;'}</td>
      <td>${Number.isFinite(v) ? `${num(v, 2)} kPa` : '&mdash;'}</td>
      <td>${esc(status)}</td>
      <td>${esc(basis)}</td>
    </tr>`;
  }).join('');

  return `<table class="grid">
    <thead><tr><th>Point</th><th>Pos (X,Y)</th><th>Temp</th><th>RH</th><th>VPD</th><th>Status</th><th>Basis</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function sectionEquipment(snap) {
  const md = snap.mapData || {};
  const mods = md.equipmentModules || [];
  if (!mods.length) {
    return sec('Equipment Layout', `<p class="muted">No equipment modules placed.</p>`);
  }
  const rows = mods.map((m, i) => {
    const id = m.label || `EQ-${i + 1}`;
    const type = (m.type === 'return') ? 'Return' : 'Supply';
    const pos  = `(${num(m.xFt, 1)}, ${num(m.yFt, 1)})`;
    const size = `${num(m.wFt, 1)} &times; ${num(m.hFt, 1)}`;
    const basis = (m.model || m.serial || m.unitType || m.reheatType) ? 'Observed' : 'Inferred';
    return `<tr>
      <td>${esc(id)}</td>
      <td><span class="badge ${type === 'Supply' ? 'badge--supply' : 'badge--return'}">${type}</span></td>
      <td>${pos}</td>
      <td>${size}</td>
      <td>${esc(m.model)  || '&mdash;'}</td>
      <td>${esc(m.serial) || '&mdash;'}</td>
      <td>${esc(m.unitType)    || '&mdash;'}</td>
      <td>${esc(m.reheatType)  || '&mdash;'}</td>
      <td>${m.commissioningPresent ? 'yes' : 'no'}</td>
      <td>${m.internetConnected   ? 'yes' : 'no'}</td>
      <td>${esc(basis)}</td>
    </tr>`;
  }).join('');

  const ducts = md.ducts || [];
  const regs  = md.registers || [];
  const equipById = byId(mods);

  const ductRows = ducts.length ? ducts.map((d, i) => {
    const parent = equipById[d.equipmentId];
    const parentLabel = parent ? (parent.label || `EQ-${mods.indexOf(parent) + 1}`) : 'unknown';
    const parentType  = parent ? (parent.type === 'return' ? 'Return' : 'Supply') : '&mdash;';
    return `<tr>
      <td>D-${i + 1}</td>
      <td>${esc(parentLabel)}</td>
      <td>${esc(parentType)}</td>
      <td>(${num(d.x2Ft, 1)}, ${num(d.y2Ft, 1)})</td>
    </tr>`;
  }).join('') : '';

  const regRows = regs.length ? regs.map((r, i) => {
    const id = r.label || `R-${i + 1}`;
    const tag = r.ductId
      ? `auto from D-${ducts.findIndex((d) => d.id === r.ductId) + 1}`
      : 'independent';
    return `<tr>
      <td>${esc(id)}</td>
      <td>(${num(r.xFt, 1)}, ${num(r.yFt, 1)})</td>
      <td>${esc(tag)}</td>
    </tr>`;
  }).join('') : '';

  return sec('Equipment Layout', `
    <table class="grid">
      <thead><tr>
        <th>Module</th><th>Type</th><th>Pos</th><th>Size</th>
        <th>Model</th><th>Serial</th><th>Unit Type</th><th>Reheat</th>
        <th>Comm.</th><th>Net</th><th>Basis</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${ductRows ? `
    <h4>Duct Runs</h4>
    <table class="grid">
      <thead><tr><th>ID</th><th>From</th><th>Type</th><th>Terminus</th></tr></thead>
      <tbody>${ductRows}</tbody>
    </table>` : ''}
    ${regRows ? `
    <h4>Registers</h4>
    <table class="grid">
      <thead><tr><th>ID</th><th>Pos</th><th>Source</th></tr></thead>
      <tbody>${regRows}</tbody>
    </table>` : ''}
  `);
}

function sectionChecklist(snap) {
  const cs = snap.checklistState || {};
  const groupsHtml = CHECKLIST_GROUPS.map((g) => {
    const itemsHtml = g.items.map((it) => {
      const st = cs[it.id] || defaultItemState();
      const status = (st.status || 'open').toUpperCase();
      const cls = st.status === 'pass' ? 'badge--ok'
                : st.status === 'fail' ? 'badge--high'
                : st.status === 'na'   ? 'badge--mute'
                : 'badge--warn';
      const basis = st.evidenceBasis || 'Not Verified';
      const note = (st.note || '').trim();

      let extra = '';
      if (it.id === 'C9') {
        extra = `
          <div class="cl-item__c9">
            <p><strong>Failure mode:</strong> ${esc(C9_DETAIL.failureMode)}</p>
            <p><strong>Method:</strong> ${esc(C9_DETAIL.method)}</p>
            <p><strong>Field note required on fail:</strong> ${esc(C9_DETAIL.fieldNoteOnFail)}</p>
          </div>
        `;
      }

      return `
        <li class="cl-item">
          <div class="cl-item__head">
            <span class="cl-item__id">${esc(it.id)}</span>
            <span class="cl-item__name">${sescape(it.name)}</span>
            <span class="cl-item__pri">${esc(it.priority)}</span>
            <span class="badge ${cls}">${esc(status === 'NA' ? 'N/A' : status)}</span>
            <span class="cl-item__basis">Basis: ${esc(basis)}</span>
          </div>
          ${note
            ? `<p class="cl-item__note">${escMultiline(note)}</p>`
            : `<p class="cl-item__note muted">(no field note)</p>`
          }
          ${extra}
        </li>
      `;
    }).join('');

    return `
      <section class="cl-group">
        <h3>${sescape(g.title)}</h3>
        <ol class="cl-items">${itemsHtml}</ol>
      </section>
    `;
  }).join('');

  return sec('Site Checklist', groupsHtml);
}

function sectionFailures(snap) {
  const fails = (snap.computed && snap.computed.failedItems) || [];
  if (!fails.length) {
    return sec('Failure Mode Summary', `<p class="muted">No failures recorded.</p>`);
  }
  const blocks = fails.map((f) => {
    const existing = (f.note && f.note.trim()) ? f.note.trim() : '(observed by technician on site)';
    const required = `Must be true that ${manufacturerSanitize(f.name || '')}.`;
    return `
      <article class="fail">
        <header class="fail__head">
          <span class="fail__mark">&times;</span>
          <span class="fail__id">${esc(f.id)}</span>
          <span class="fail__name">${sescape(f.name)}</span>
          <span class="badge badge--high">${esc(f.priority)}</span>
        </header>
        <table class="kv kv--compact">
          <tr><th>Existing Condition</th><td>${escMultiline(existing)}</td></tr>
          <tr><th>Required Condition</th><td>${esc(required)}</td></tr>
          <tr><th>Impact</th><td>${sescapeMultiline(f.fail || '&mdash;')}</td></tr>
          <tr><th>Basis</th><td>${esc(f.evidenceBasis || 'Not Verified')}</td></tr>
          <tr><th>Field Note</th><td>${escMultiline(f.note || '&mdash;')}</td></tr>
        </table>
      </article>
    `;
  }).join('');
  return sec('Failure Mode Summary', blocks);
}

function sectionRetests(snap) {
  const fails = (snap.computed && snap.computed.failedItems) || [];
  if (!fails.length) {
    return sec('Retest Requirements', `<p class="muted">No failures recorded. No retests required.</p>`);
  }
  const failedIds = new Set(fails.map((f) => f.id));
  const groups = new Set(fails.map((f) => f.group));
  const items = [];

  if (groups.has('A')) items.push(['Distribution (Group A) failures',
    'Full spatial remap required.', 'Measured']);
  if (failedIds.has('C4') || failedIds.has('C5') || failedIds.has('C6'))
    items.push(['Sensor placement (C4-C6) failures',
      'Re-measure at canopy height with corrected housing/location.', 'Measured']);
  if (failedIds.has('C9')) items.push(['Sensor validity (C9) failure',
    'Correct sensor housing or location, then re-validate against aspirated reference under operating conditions before re-measuring room state. Room VPD measurements taken prior to C9 correction are void and cannot inform viability assessment.', 'Measured']);
  if (failedIds.has('C1') || failedIds.has('C2') || failedIds.has('C3')
      || failedIds.has('C7') || failedIds.has('C8'))
    items.push(['Control sequence (C1-C3 / C7-C8) failures',
      'Test lights-on and lights-off cycle independently.', 'Observed']);
  if (groups.has('E')) items.push(['Pressurization (Group E) failures',
    'Verify full pressure cascade.', 'Measured']);
  if (groups.has('B')) items.push(['Equipment / documentation (Group B) failures',
    'Verification required before further action - retrieve commissioning report / submittals / equipment data plates.', 'Documented']);
  if (groups.has('F')) items.push(['Heat rejection (Group F) failures',
    'Inspect outdoor heat rejection device clearances and economizer seals.', 'Observed']);
  if (groups.has('G')) items.push(['Design / commissioning (Group G) failures',
    'Confirm original sizing inputs and unit-per-room redundancy.', 'Documented']);
  if (groups.has('D')) items.push(['Envelope (Group D) failures',
    'Inspect envelope continuity, seals, penetrations.', 'Observed']);

  const rows = items.map(([head, body, basis]) => `
    <article class="retest">
      <h4>${esc(head)}</h4>
      <p>${esc(body)}</p>
      <p class="muted">Min basis on retest: ${esc(basis)}</p>
    </article>
  `).join('');
  return sec('Retest Requirements', rows);
}

function sectionFinalAssessment(snap, vLabel) {
  const c = snap.computed || {};
  const m = c.measuredVPD;
  const c9 = !!c.c9Failed;
  const groups = c.failureGroupKeys || [];
  const transition = (snap.metadata && snap.metadata.lights === 'transition');

  let measuredCondHtml;
  let conclusion;
  let nextAction;

  if (c9) {
    measuredCondHtml = `<strong>VOID</strong> &mdash; sensor validity not established. Reported VPD values cannot be assumed to represent canopy conditions.`;
    conclusion = 'The system viability assessment stands independently of measured state. Sensor validity must be established before room conditions can be evaluated. See C9 retest requirements.';
    nextAction = 'Correct sensor validity per C9, re-validate, re-measure room state, then evaluate measured environmental state.';
  } else if (m && m.withReadingsCount >= 1) {
    const status = vpdStatusLabel(m.mean, m.band);
    const word = status === 'IN RANGE' ? 'in range'
               : status === 'LOW'      ? 'below target'
               : status === 'HIGH'     ? 'above target'
               : 'not characterized';
    measuredCondHtml = `Mean VPD ${num(m.mean, 2)} kPa, ${esc(word)}, spatial range ${num(m.range, 2)} kPa.`;
    let para = `The room is currently ${
      word === 'in range' ? 'within target VPD range'
      : word === 'below target' ? 'below target VPD range'
      : word === 'above target' ? 'above target VPD range'
      : 'not characterized'
    }, however system viability is ${c.viability || 'NOT VERIFIED'}.`;
    if (groups.length) {
      const words = groups.map((k) => FAIL_DOMAIN_WORD[k]).filter(Boolean);
      para += ` Measured conditions cannot be assumed stable due to ${words.join(', ')}.`;
    } else {
      para += ' No failure modes recorded.';
    }
    conclusion = para;
    nextAction = 'Correct system deficiencies and retest under operating load.';
  } else {
    measuredCondHtml = 'Insufficient sensor data to characterize measured state.';
    conclusion = `Measured state could not be characterized. System viability is ${c.viability || 'NOT VERIFIED'}.`;
    nextAction = 'Place sensors with valid readings and retest under operating load.';
  }

  const transitionNote = transition
    ? `<p class="note">Survey performed during sunrise/sunset transition. Steady-state evaluation requires re-survey during stable lights-on or lights-off period.</p>`
    : '';

  return sec('Final Assessment', `
    <table class="kv kv--compact">
      <tr><th>Measured Condition</th><td>${measuredCondHtml}</td></tr>
      <tr><th>System Condition</th><td>${esc(vLabel)}</td></tr>
    </table>
    <h4>Conclusion</h4>
    <p>${esc(conclusion)}</p>
    <h4>Recommended Next Action</h4>
    <p>${esc(nextAction)}</p>
    ${transitionNote}
  `);
}

function sectionNarrative(snap) {
  const text = (snap.metadata && snap.metadata.narrative) || '';
  if (!text.trim()) {
    return sec('Field Narrative', `<p class="muted">(no narrative)</p>`, 'narrative');
  }
  return sec('Field Narrative', `<div class="narrative">${escMultiline(text)}</div>`, 'narrative');
}

function sectionFooter(snap) {
  const ts = formatTimestamp(snap.generatedAt);
  return `
  <footer class="doc-footer">
    <span>&copy; Michael Seth Aaron &middot; Project Demeter</span>
    <span class="doc-footer__ts">Generated ${esc(ts)}</span>
  </footer>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sec(title, body, modCls) {
  const cls = modCls ? ` section--${modCls}` : '';
  return `
  <section class="section${cls}">
    <h2 class="section__head">${esc(title)}</h2>
    <div class="section__body">
      ${body}
    </div>
  </section>`;
}

function joinMeta(m) {
  return [m.customer, m.facility, m.room].filter(Boolean).join(' / ') || 'Survey';
}

function vpdStatusLabel(vpd, band) {
  if (!Number.isFinite(vpd) || !band) return '--';
  if (vpd < band.vpdMin) return 'LOW';
  if (vpd > band.vpdMax) return 'HIGH';
  return 'IN RANGE';
}

function num(n, digits) {
  if (!Number.isFinite(n)) return '&mdash;';
  return n.toFixed(digits);
}

function tempCell(t, unitF) {
  if (!Number.isFinite(t)) return '&mdash;';
  return unitF ? `${t.toFixed(1)} &deg;F` : `${t.toFixed(1)} &deg;C`;
}

function esc(v) {
  if (v == null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escMultiline(v) {
  return esc(v).replace(/\r?\n/g, '<br>');
}

// Sanitize-then-escape pipeline for checklist-sourced strings (group
// titles, item names, failure-mode descriptions). The print HTML is the
// customer-facing artifact, so AGIQ references in the source data get
// neutralized before HTML-escaping. User-entered content (notes,
// narrative, labels) is *not* run through this — it's the technician's
// own words.
function sescape(v) {
  return esc(manufacturerSanitize(v == null ? '' : v));
}

function sescapeMultiline(v) {
  return escMultiline(manufacturerSanitize(v == null ? '' : v));
}

function formatTimestamp(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  let h = d.getHours();
  const mm = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mmStr = String(mm).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} - ${h}:${mmStr} ${ampm}`;
}

// ── Print document stylesheet ──────────────────────────────────────────────

const PRINT_DOC_CSS = `
  :root {
    --fg: #1c1c1c;
    --fg-dim: #5e5c58;
    --fg-mute: #7e7c78;
    --bg: #ffffff;
    --surface: #f7f6f2;
    --border: #c8c6c1;
    --orange: #c46a08;
    --orange-hi: #e8820a;
    --teal: #1f8c79;
    --green: #3aa346;
    --red: #b62d2d;
    --warn: #c4880b;
    --font-ui: 'Rajdhani', system-ui, sans-serif;
    --font-data: 'Share Tech Mono', ui-monospace, Menlo, Consolas, monospace;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    background: #ececea;
    color: var(--fg);
    font-family: var(--font-data);
    font-size: 11.5px;
    line-height: 1.45;
  }
  .doc {
    max-width: 8.5in;
    margin: 0.4in auto;
    padding: 0.4in;
    background: var(--bg);
    box-shadow: 0 0 0 1px var(--border);
  }
  h1, h2, h3, h4 {
    font-family: var(--font-ui);
    font-weight: 600;
    margin: 0;
    color: var(--fg);
  }
  p { margin: 4px 0 8px; }
  .muted { color: var(--fg-mute); }

  /* Title block */
  .title-block {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    background: #1c1c1c;
    color: #f4f3ef;
    padding: 14px 18px;
    margin-bottom: 18px;
  }
  .title-block__title {
    color: var(--orange-hi);
    font-size: 22px;
    letter-spacing: 0.2em;
    margin: 0;
  }
  .title-block__sub {
    font-family: var(--font-data);
    color: #d4d2cd;
    font-size: 11px;
    margin-top: 2px;
    letter-spacing: 0.05em;
  }
  .title-block__meta {
    text-align: right;
    font-family: var(--font-data);
    font-size: 11px;
    color: #d4d2cd;
  }
  .title-block__ts { color: #b4b2ad; margin-top: 2px; }

  /* Section frame — sections are allowed to flow across pages; the
     atomic break-avoid lives on smaller units (heatmap, checklist
     items, fail blocks, etc.) so a tall Site Checklist doesn't bump
     to a fresh page wholesale and leave the prior page blank. */
  .section {
    margin-bottom: 16px;
  }
  .section__head {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--orange);
    border-bottom: 1px solid var(--border);
    padding-bottom: 4px;
    margin-bottom: 8px;
    /* Don't orphan a section header at the bottom of a page. */
    page-break-after: avoid;
    break-after: avoid;
  }
  .section__body { font-size: 11.5px; }

  /* Tables */
  table { border-collapse: collapse; width: 100%; }
  table.kv th {
    width: 28%;
    text-align: left;
    color: var(--fg-dim);
    font-family: var(--font-data);
    font-weight: 400;
    padding: 3px 8px 3px 0;
    vertical-align: top;
  }
  table.kv td {
    padding: 3px 0;
    vertical-align: top;
  }
  table.kv--compact th, table.kv--compact td { padding: 2px 6px 2px 0; }

  table.grid { margin-top: 6px; font-size: 11px; }
  table.grid th, table.grid td {
    border: 1px solid var(--border);
    padding: 3px 6px;
    text-align: left;
    vertical-align: top;
  }
  table.grid th {
    background: var(--surface);
    font-family: var(--font-ui);
    font-weight: 600;
    color: var(--fg-dim);
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 2px;
    font-family: var(--font-data);
    font-size: 10px;
    line-height: 1.4;
    border: 1px solid var(--border);
    background: var(--surface);
    color: var(--fg-dim);
    letter-spacing: 0.05em;
    white-space: nowrap;
  }
  .badge--lg { font-size: 12px; padding: 2px 10px; }
  .badge--ok    { background: #e7f3e8; color: var(--green); border-color: #a6d2ad; }
  .badge--warn  { background: #fbf1d9; color: var(--warn);  border-color: #d8c388; }
  .badge--high  { background: #f7dede; color: var(--red);   border-color: #dca7a7; }
  .badge--low   { background: #def0eb; color: var(--teal);  border-color: #93cabd; }
  .badge--mute  { background: var(--surface); color: var(--fg-mute); }
  .badge--supply{ background: #fbe6cf; color: var(--orange); border-color: #e6b787; }
  .badge--return{ background: #d6efe9; color: var(--teal);   border-color: #93cabd; }

  /* VPD hero */
  .vpd-hero {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .vpd-hero__value {
    font-family: var(--font-ui);
    font-size: 32px;
    font-weight: 700;
    color: var(--fg);
    line-height: 1;
  }
  .vpd-hero__unit {
    font-size: 16px;
    font-weight: 500;
    color: var(--fg-dim);
  }
  .vpd-hero__badges { display: inline-flex; gap: 6px; flex-wrap: wrap; }

  .vpd-strip {
    margin: 4px 0 8px;
    padding: 0;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .vpd-strip__caption {
    font-family: var(--font-data);
    font-size: 10.5px;
    color: var(--fg-dim);
    margin: 0 0 2px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .vpd-strip svg {
    width: 100%;
    max-width: 460px;
    height: auto;
    display: block;
  }

  .void-block {
    border: 2px dashed var(--red);
    padding: 14px;
    background: #fbf2f2;
  }
  .void-block__head {
    font-family: var(--font-ui);
    font-size: 24px;
    font-weight: 700;
    letter-spacing: 0.2em;
    color: var(--red);
  }
  .void-block__sub { color: var(--fg-dim); margin: 6px 0 0; }

  .viability {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }
  .viability__blurb { color: var(--fg-dim); font-size: 11px; }

  /* Heatmap figure */
  .heatmap {
    margin: 0 0 10px;
    text-align: center;
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .heatmap img {
    max-width: 100%;
    height: auto;
    border: 1px solid var(--border);
  }

  .coverage h4 { margin: 8px 0 2px; font-size: 11.5px; color: var(--fg-dim); }

  /* Checklist */
  .cl-group { margin-bottom: 8px; }
  .cl-group h3 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--fg-dim);
    border-bottom: 1px dashed var(--border);
    padding-bottom: 2px;
    margin: 6px 0;
    /* Group title stays with at least the first item below it. */
    page-break-after: avoid;
    break-after: avoid;
  }
  .cl-items { list-style: none; padding: 0; margin: 0; }
  .cl-item {
    padding: 4px 0;
    border-bottom: 1px dotted var(--border);
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .cl-item__head {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 11px;
  }
  .cl-item__id   { font-family: var(--font-data); color: var(--orange); min-width: 24px; }
  .cl-item__name { flex: 1 1 50%; }
  .cl-item__pri  { color: var(--fg-mute); font-size: 10px; }
  .cl-item__basis{ color: var(--fg-mute); font-size: 10px; }
  .cl-item__note { margin: 2px 0 0; padding-left: 28px; font-size: 11px; color: var(--fg-dim); }
  .cl-item__c9 {
    margin: 4px 0 0;
    padding: 6px 8px;
    background: var(--surface);
    border-left: 3px solid var(--orange);
    font-size: 10.5px;
  }
  .cl-item__c9 p { margin: 2px 0; }

  /* Failures */
  .fail { margin: 6px 0; page-break-inside: avoid; }
  .fail__head {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    padding: 4px 8px;
    border-left: 3px solid var(--red);
  }
  .fail__mark { color: var(--red); font-weight: 700; }
  .fail__id   { font-family: var(--font-data); color: var(--orange); }
  .fail__name { flex: 1; }

  /* Retests */
  .retest { margin: 4px 0 8px; page-break-inside: avoid; }
  .retest h4 { font-size: 11.5px; color: var(--fg); margin: 0 0 2px; }

  /* Tier */
  .tier { margin-top: 8px; page-break-inside: avoid; }
  .tier h4 { font-size: 11.5px; margin: 4px 0; color: var(--fg-dim); }

  /* Narrative */
  .section--narrative .narrative {
    border-left: 3px solid var(--orange);
    padding: 4px 10px;
    background: var(--surface);
  }

  .note {
    border-left: 2px solid var(--warn);
    padding: 4px 8px;
    background: #fbf6e8;
    color: var(--fg-dim);
    font-size: 11px;
  }
  .note--warn { border-left-color: var(--orange); background: #fbeed9; }

  .tier-limit-note {
    margin-top: 8px;
    padding: 6px 10px;
    border-left: 2px solid var(--fg-mute);
    background: var(--surface);
    color: var(--fg-dim);
    font-size: 11px;
    page-break-inside: avoid;
  }
  .tier-limit-note p { margin: 0 0 4px; }
  .tier-limit-note p:last-child { margin-bottom: 0; }
  .tier-limit-note strong { color: var(--fg); }

  .doc-footer {
    margin-top: 14px;
    padding-top: 6px;
    border-top: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
    color: var(--fg-mute);
    font-size: 10.5px;
  }

  /* Print */
  @media print {
    @page { size: Letter; margin: 0.5in; }
    html, body { background: #ffffff; }
    .doc {
      max-width: none;
      margin: 0;
      padding: 0;
      box-shadow: none;
    }
    /* Keep tight, atomic units on a single page; let the parent
       section flow. Tables can split between rows. */
    .heatmap, .void-block, .vpd-hero, .vpd-strip,
    .cl-item, .fail, .retest, .tier {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .section__head, .cl-group h3, h4 {
      page-break-after: avoid;
      break-after: avoid;
    }
    table.grid thead { display: table-header-group; }
    .badge { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .title-block, .badge--ok, .badge--warn, .badge--high, .badge--low,
    .badge--supply, .badge--return, .void-block, .note, .fail__head,
    .cl-item__c9, .narrative, .heatmap img, table.grid th,
    .vpd-strip svg {
      print-color-adjust: exact;
      -webkit-print-color-adjust: exact;
    }
  }
`;
