// Project Demeter — Heatmap Module
// Pure SVG <g> builder. No DOM access on import; only inside the exported
// builder. Renders a 1ft × 1ft grid of cells colored by IDW-interpolated
// VPD against the active stage band, plus an embedded legend that survives
// SVG → PNG rasterization (Phase 7 print pipeline).

import { calcVPD, toC, idwInterpolate } from './math.js';
import { SVG_NS } from './ciab.js';

const CELL_FT = 1;
const CELL_OPACITY = 0.55;
const LEAF_OFFSET_C = 2;

// Color stops (RGB tuples). Lerped piecewise based on how far the cell's
// VPD sits below or above the stage band.
const TEAL_DEEP  = [40, 130, 140];
const TEAL_EDGE  = [78, 201, 176];
const GREEN_FILL = [111, 200, 118];
const RED_EDGE   = [224, 96,  96];
const RED_DEEP   = [180, 40,  40];

// Saturation distance in kPa: cell VPD this far below band.vpdMin (or
// above band.vpdMax) reaches the deep end of the ramp. Past that it stays
// pinned. Picked to make typical room deltas (0.1–0.3 kPa) read clearly
// without saturating instantly.
const RAMP_SATURATION = 0.4;

export function buildHeatmapLayer({ sensors, zones, len, wid, stage }) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-heatmap');

  const sensorValues = [];
  for (const s of (sensors || [])) {
    if (!Number.isFinite(s.tdb) || !Number.isFinite(s.rh)) continue;
    const vpd = calcVPD(toC(s.tdb), s.rh, LEAF_OFFSET_C);
    if (!Number.isFinite(vpd)) continue;
    sensorValues.push({ xFt: s.xFt, yFt: s.yFt, value: vpd });
  }
  if (sensorValues.length === 0) return g;

  const deadZones = (zones || []).filter((z) => z.type === 'dead').map(zoneRect);

  const cols = Math.floor(len);
  const rows = Math.floor(wid);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const centerX = cx + CELL_FT / 2;
      const centerY = cy + CELL_FT / 2;

      const cell = document.createElementNS(SVG_NS, 'rect');
      cell.setAttribute('x', String(cx));
      cell.setAttribute('y', String(cy));
      cell.setAttribute('width',  String(CELL_FT));
      cell.setAttribute('height', String(CELL_FT));

      if (pointInAnyRect(centerX, centerY, deadZones)) {
        cell.setAttribute('class', 'map-heatmap__cell map-heatmap__cell--dead');
        g.appendChild(cell);
        continue;
      }

      const vpd = idwInterpolate(centerX, centerY, sensorValues, 2);
      if (!Number.isFinite(vpd)) {
        g.appendChild(cell);
        continue;
      }
      const rgb = colorForVpd(vpd, stage);
      cell.setAttribute('class', 'map-heatmap__cell');
      cell.setAttribute('fill', `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
      cell.setAttribute('fill-opacity', String(CELL_OPACITY));
      g.appendChild(cell);
    }
  }

  g.appendChild(buildLegend(len, wid));
  return g;
}

function colorForVpd(vpd, stage) {
  if (!stage) return GREEN_FILL;
  if (vpd >= stage.vpdMin && vpd <= stage.vpdMax) return GREEN_FILL;
  if (vpd < stage.vpdMin) {
    const t = clamp01((stage.vpdMin - vpd) / RAMP_SATURATION);
    return lerpRgb(TEAL_EDGE, TEAL_DEEP, t);
  }
  const t = clamp01((vpd - stage.vpdMax) / RAMP_SATURATION);
  return lerpRgb(RED_EDGE, RED_DEEP, t);
}

function lerpRgb(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t)
  ];
}

function clamp01(n) {
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

function zoneRect(z) {
  const x1 = Math.min(z.x1Ft ?? 0, z.x2Ft ?? 0);
  const x2 = Math.max(z.x1Ft ?? 0, z.x2Ft ?? 0);
  const y1 = Math.min(z.y1Ft ?? 0, z.y2Ft ?? 0);
  const y2 = Math.max(z.y1Ft ?? 0, z.y2Ft ?? 0);
  return { x1, y1, x2, y2 };
}

function pointInAnyRect(x, y, rects) {
  for (const r of rects) {
    if (x >= r.x1 && x <= r.x2 && y >= r.y1 && y <= r.y2) return true;
  }
  return false;
}

// Anchor the legend near the bottom-right corner of the room. Width and
// height in user units (ft). A translucent backing rect keeps the symbols
// legible over any heatmap color.
function buildLegend(len, wid) {
  const W = 3.8;
  const H = 1.5;
  const x0 = Math.max(0, len - W - 0.2);
  const y0 = Math.max(0, wid - H - 0.2);

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-heatmap__legend');
  g.setAttribute('transform', `translate(${x0} ${y0})`);

  const bg = document.createElementNS(SVG_NS, 'rect');
  bg.setAttribute('class', 'map-heatmap__legend-bg');
  bg.setAttribute('x', '0');
  bg.setAttribute('y', '0');
  bg.setAttribute('width',  String(W));
  bg.setAttribute('height', String(H));
  bg.setAttribute('rx', '0.1');
  g.appendChild(bg);

  const rows = [
    { glyph: '●', text: 'Measured (sensor point)' },
    { glyph: '▦', text: 'Inferred (interpolated)' },
    { glyph: '▨', text: 'Not evaluated (dead zone)' }
  ];
  rows.forEach((r, i) => {
    const y = 0.4 + i * 0.4;
    const glyph = document.createElementNS(SVG_NS, 'text');
    glyph.setAttribute('class', 'map-heatmap__legend-glyph');
    glyph.setAttribute('x', '0.18');
    glyph.setAttribute('y', String(y));
    glyph.setAttribute('font-size', '0.45');
    glyph.textContent = r.glyph;
    g.appendChild(glyph);

    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'map-heatmap__legend-text');
    t.setAttribute('x', '0.65');
    t.setAttribute('y', String(y));
    t.setAttribute('font-size', '0.4');
    t.textContent = r.text;
    g.appendChild(t);
  });
  return g;
}
