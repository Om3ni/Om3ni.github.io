// Project Demeter — Heatmap Module
// Pure SVG <g> builder. No DOM access on import; only inside the exported
// builder. Renders a half-foot grid of cells colored by IDW-interpolated
// VPD against the active stage band, then runs a Gaussian blur over the
// live cells so the cell-to-cell steps read as a continuous gradient.
// Mathematically still IDW; the blur is presentation only. Dead-zone
// cells render in a separate unblurred subgroup so their boundary stays
// crisp. An embedded legend survives SVG → PNG rasterization (Phase 7).

import { calcVPD, toC, idwInterpolate } from './math.js';
import { SVG_NS } from './ciab.js';

const CELL_FT = 0.5;
const CELL_OPACITY = 0.55;
const LEAF_OFFSET_C = 2;
// Blur stdDev in feet (filter primitiveUnits="userSpaceOnUse"). At 0.5
// the effective blur radius (~3 sigma) covers ~3 cells at CELL_FT=0.5,
// smoothing the grid into a continuous field without smearing past the
// scale at which a technician reasons about VPD distribution.
const BLUR_STDDEV_FT = 0.5;

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

  // Per-render unique ids so multiple instances on a page do not collide.
  const uid = Math.random().toString(36).slice(2, 9);
  const filterId = `hm-blur-${uid}`;
  const clipId   = `hm-clip-${uid}`;
  g.appendChild(buildDefs(filterId, clipId, len, wid));

  const liveCells = document.createElementNS(SVG_NS, 'g');
  liveCells.setAttribute('class', 'map-heatmap__cells');
  liveCells.setAttribute('filter',    `url(#${filterId})`);
  liveCells.setAttribute('clip-path', `url(#${clipId})`);

  const deadCells = document.createElementNS(SVG_NS, 'g');
  deadCells.setAttribute('class', 'map-heatmap__cells map-heatmap__cells--dead');
  deadCells.setAttribute('clip-path', `url(#${clipId})`);

  const cols = Math.ceil(len / CELL_FT);
  const rows = Math.ceil(wid / CELL_FT);

  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const x = cx * CELL_FT;
      const y = cy * CELL_FT;
      const centerX = x + CELL_FT / 2;
      const centerY = y + CELL_FT / 2;

      const cell = document.createElementNS(SVG_NS, 'rect');
      cell.setAttribute('x', String(x));
      cell.setAttribute('y', String(y));
      cell.setAttribute('width',  String(CELL_FT));
      cell.setAttribute('height', String(CELL_FT));

      if (pointInAnyRect(centerX, centerY, deadZones)) {
        cell.setAttribute('class', 'map-heatmap__cell map-heatmap__cell--dead');
        deadCells.appendChild(cell);
        continue;
      }

      const vpd = idwInterpolate(centerX, centerY, sensorValues, 2);
      if (!Number.isFinite(vpd)) continue;
      const rgb = colorForVpd(vpd, stage);
      cell.setAttribute('class', 'map-heatmap__cell');
      cell.setAttribute('fill', `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`);
      cell.setAttribute('fill-opacity', String(CELL_OPACITY));
      liveCells.appendChild(cell);
    }
  }

  g.appendChild(liveCells);
  g.appendChild(deadCells);
  g.appendChild(buildLegend(len, wid));
  return g;
}

function buildDefs(filterId, clipId, len, wid) {
  const defs = document.createElementNS(SVG_NS, 'defs');

  // Pad the filter region by ~3 stdDev so the blur of edge cells does
  // not clip prematurely; the clip-path bounds the final visible result
  // back to the room rectangle.
  const pad = BLUR_STDDEV_FT * 3;
  const filter = document.createElementNS(SVG_NS, 'filter');
  filter.setAttribute('id', filterId);
  filter.setAttribute('filterUnits',     'userSpaceOnUse');
  filter.setAttribute('primitiveUnits',  'userSpaceOnUse');
  filter.setAttribute('x',      String(-pad));
  filter.setAttribute('y',      String(-pad));
  filter.setAttribute('width',  String(len + pad * 2));
  filter.setAttribute('height', String(wid + pad * 2));
  const blur = document.createElementNS(SVG_NS, 'feGaussianBlur');
  blur.setAttribute('stdDeviation', String(BLUR_STDDEV_FT));
  filter.appendChild(blur);
  defs.appendChild(filter);

  const clip = document.createElementNS(SVG_NS, 'clipPath');
  clip.setAttribute('id', clipId);
  clip.setAttribute('clipPathUnits', 'userSpaceOnUse');
  const rect = document.createElementNS(SVG_NS, 'rect');
  rect.setAttribute('x', '0');
  rect.setAttribute('y', '0');
  rect.setAttribute('width',  String(len));
  rect.setAttribute('height', String(wid));
  clip.appendChild(rect);
  defs.appendChild(clip);

  return defs;
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
