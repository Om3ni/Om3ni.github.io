// CIAB — CAD-in-a-Box
// Reusable SVG canvas primitives for room/element builders. Pure helpers
// plus SVG node factories. No state, no domain knowledge: the consumer
// composes these into a tool. First consumer is Project Demeter; designed
// to be lifted into other layout tools (electrical, plumbing, mechanical
// equipment selection, etc.) as the catalog of tools grows.
//
// Conventions:
// - All math operates on plain numbers. Units (ft, in, mm) live in the
//   consumer's mind. ciab does not know or care.
// - All builders accept an `opts` object that lets the consumer pass in
//   class names, font sizes, handle sizes, etc. Sensible defaults are
//   provided so a new consumer can get a working canvas with no opts.
// - data-hit attributes encode the consumer's element type and id:
//     - "<type>:<id>"          for element bodies / lines
//     - "handle:<type>:<id>:<knob>"  for selection/resize handles
//   The consumer's pointer dispatch reads these via decodeHit().

export const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Geometry helpers ──────────────────────────────────────────────────
export function approxEq(a, b, tol = 1e-6) { return Math.abs(a - b) <= tol; }
export function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }

export function snapValue(n, step) {
  if (!step || step <= 0) return n;
  return Math.round(n / step) * step;
}
export function snapPoint(p, step) {
  return { x: snapValue(p.x, step), y: snapValue(p.y, step) };
}

// Clamp a point inside a box. box: { minX?, minY?, maxX, maxY }
// (minX/minY default to 0, since most layout canvases start at the origin).
export function clampToBox(p, box) {
  return {
    x: clamp(p.x, box.minX ?? 0, box.maxX),
    y: clamp(p.y, box.minY ?? 0, box.maxY)
  };
}

// Rect from two opposing corners stored as { x1Ft, y1Ft, x2Ft, y2Ft }.
// (Field names are historical from Demeter; the values are unit-agnostic.)
export function rectFromCorners(c) {
  const x = Math.min(c.x1Ft ?? 0, c.x2Ft ?? 0);
  const y = Math.min(c.y1Ft ?? 0, c.y2Ft ?? 0);
  const w = Math.abs((c.x2Ft ?? 0) - (c.x1Ft ?? 0));
  const h = Math.abs((c.y2Ft ?? 0) - (c.y1Ft ?? 0));
  return { x, y, w, h };
}

// Compute new rect bounds from initial bounds, the dragged knob, and the
// snapped pointer position. Knobs are short strings:
//   corners: 'tl','tr','bl','br'
//   edges:   't','b','l','r'
// opts: { minW, minH, maxX, maxY, minX?, minY? }
export function resizeRect(init, knob, snapped, step, opts) {
  let x = init.x, y = init.y, w = init.w, h = init.h;
  const px = clamp(snapValue(snapped.x, step), opts.minX ?? 0, opts.maxX);
  const py = clamp(snapValue(snapped.y, step), opts.minY ?? 0, opts.maxY);
  if (knob.includes('l')) { const right  = x + w; x = Math.min(px, right - opts.minW);  w = right  - x; }
  if (knob.includes('r')) {                        w = Math.max(opts.minW, px - x); }
  if (knob.includes('t')) { const bottom = y + h; y = Math.min(py, bottom - opts.minH); h = bottom - y; }
  if (knob.includes('b')) {                        h = Math.max(opts.minH, py - y); }
  return { x, y, w, h };
}

// Compute SVG viewBox for a layout area of size (len × wid) plus margins.
// `pad` is extra space on the bottom/right so handles at the room edge
// aren't clipped by the SVG boundary.
export function viewBoxFor(len, wid, marginLeft = 2.4, marginTop = 1.6, pad = 0.4) {
  return {
    x: -marginLeft,
    y: -marginTop,
    w: len + marginLeft + pad,
    h: wid + marginTop + pad
  };
}

// ── DOM helpers ───────────────────────────────────────────────────────
// Convert a pointer event's clientX/Y into the SVG's user-space coords.
// Caller passes the live <svg>; if the SVG is rebuilt mid-gesture, the
// caller is responsible for re-fetching it.
export function svgPointFromEvent(svg, e) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

// Walk up the DOM looking for a data-hit attribute and decode it.
// See header comment for hit-string format.
export function decodeHit(target) {
  let el = target;
  while (el && el.dataset && !el.dataset.hit) el = el.parentNode;
  if (!el || !el.dataset || !el.dataset.hit) return null;
  const raw = el.dataset.hit;
  const parts = raw.split(':');
  if (parts[0] === 'handle') {
    return { kind: 'handle', type: parts[1], id: parts[2], knob: parts[3], raw };
  }
  return { kind: parts[0], type: parts[0], id: parts[1], raw };
}

// Stable-ish ID generator. `prefix` is a short kind tag (e.g. 'eq', 'zn').
export function newId(prefix = 'el') {
  const rand = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

// ── SVG factories ─────────────────────────────────────────────────────
// Build the root <svg> element with the given viewBox and a matching
// inline aspect-ratio so CSS `width: 100%; height: auto` produces correct
// intrinsic sizing across browsers (some choke on aspect-ratio inferred
// from viewBox alone in flex contexts).
export function createCanvasSVG(viewBox, opts = {}) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  if (opts.id) svg.setAttribute('id', opts.id);
  if (opts.className) svg.setAttribute('class', opts.className);
  svg.setAttribute('viewBox', `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.aspectRatio = `${viewBox.w} / ${viewBox.h}`;
  return svg;
}

// Build a grid layer: optional bounding rect + interior gridlines at `step`.
// Default step heuristic: 5 if the longer side is > 20 user-units, else 2.
// opts: { step, drawRoom, layerClass, roomClass, lineClass }
export function buildGridLayer(len, wid, opts = {}) {
  const {
    step       = Math.max(len, wid) > 20 ? 5 : 2,
    drawRoom   = true,
    layerClass = 'ciab-grid',
    roomClass  = 'ciab-grid__room',
    lineClass  = 'ciab-grid__line'
  } = opts;

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', layerClass);

  if (drawRoom) {
    const room = document.createElementNS(SVG_NS, 'rect');
    room.setAttribute('class', roomClass);
    room.setAttribute('x', '0');
    room.setAttribute('y', '0');
    room.setAttribute('width', String(len));
    room.setAttribute('height', String(wid));
    g.appendChild(room);
  }

  for (let x = step; x < len; x += step) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', lineClass);
    line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x));
    line.setAttribute('y1', '0');       line.setAttribute('y2', String(wid));
    g.appendChild(line);
  }
  for (let y = step; y < wid; y += step) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', lineClass);
    line.setAttribute('x1', '0');       line.setAttribute('x2', String(len));
    line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
    g.appendChild(line);
  }
  return g;
}

// Build axis labels along the top and left edges, every `step`.
// Font size is in user-space units (no CSS unit) so labels scale with viewBox.
// opts: { step, fontSize, layerClass, labelClass, topPad, leftPad }
export function buildAxisLayer(len, wid, opts = {}) {
  const {
    step       = Math.max(len, wid) > 20 ? 5 : 2,
    fontSize   = 0.7,
    layerClass = 'ciab-axis',
    labelClass = 'ciab-axis__label',
    topPad     = 0.4,
    leftPad    = 0.5
  } = opts;

  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', layerClass);

  for (let x = 0; x <= len; x += step) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', labelClass);
    t.setAttribute('x', String(x));
    t.setAttribute('y', String(-topPad));
    t.setAttribute('font-size', String(fontSize));
    t.setAttribute('text-anchor', 'middle');
    t.textContent = String(x);
    g.appendChild(t);
  }
  for (let y = 0; y <= wid; y += step) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', labelClass);
    t.setAttribute('x', String(-leftPad));
    t.setAttribute('y', String(y));
    t.setAttribute('font-size', String(fontSize));
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('dominant-baseline', 'middle');
    t.textContent = String(y);
    g.appendChild(t);
  }
  return g;
}

// 8-knob rectangle handles (4 corners + 4 edge midpoints).
// data-hit format: handle:<type>:<id>:<knob>.
// opts: { handleSize, handleClass }
export function buildRectHandles(layer, type, id, r, opts = {}) {
  const { handleSize = 0.45, handleClass = 'ciab-handle' } = opts;
  const hh = handleSize / 2;
  const points = [
    { k: 'tl', x: r.x,         y: r.y         },
    { k: 'tr', x: r.x + r.w,   y: r.y         },
    { k: 'bl', x: r.x,         y: r.y + r.h   },
    { k: 'br', x: r.x + r.w,   y: r.y + r.h   },
    { k: 't',  x: r.x + r.w/2, y: r.y         },
    { k: 'b',  x: r.x + r.w/2, y: r.y + r.h   },
    { k: 'l',  x: r.x,         y: r.y + r.h/2 },
    { k: 'r',  x: r.x + r.w,   y: r.y + r.h/2 }
  ];
  for (const p of points) {
    const h = document.createElementNS(SVG_NS, 'rect');
    h.setAttribute('class', handleClass);
    h.setAttribute('x', String(p.x - hh));
    h.setAttribute('y', String(p.y - hh));
    h.setAttribute('width', String(handleSize));
    h.setAttribute('height', String(handleSize));
    h.dataset.hit = `handle:${type}:${id}:${p.k}`;
    layer.appendChild(h);
  }
}

// Single circular handle for points (registers, sensors, vertices).
// opts: { handleSize, handleClass, knob }
export function buildPointHandle(layer, type, id, x, y, opts = {}) {
  const {
    handleSize  = 0.45,
    handleClass = 'ciab-handle ciab-handle--point',
    knob        = 'move'
  } = opts;
  const h = document.createElementNS(SVG_NS, 'circle');
  h.setAttribute('class', handleClass);
  h.setAttribute('cx', String(x));
  h.setAttribute('cy', String(y));
  h.setAttribute('r', String(handleSize));
  h.dataset.hit = `handle:${type}:${id}:${knob}`;
  layer.appendChild(h);
}

// Visual-only marker for a bound (non-draggable) endpoint — e.g. a duct
// endpoint tied to a parent equipment module. No data-hit, smaller than
// a real handle.
export function buildBoundMarker(layer, x, y, opts = {}) {
  const {
    size      = 0.22,
    className = 'ciab-handle ciab-handle--bound'
  } = opts;
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('class', className);
  c.setAttribute('cx', String(x));
  c.setAttribute('cy', String(y));
  c.setAttribute('r', String(size));
  layer.appendChild(c);
}
