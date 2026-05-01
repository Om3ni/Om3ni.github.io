// Project Demeter — Map Module
// Single-tier room layout: grid, equipment modules, ducts, registers,
// canopy zones, dead zones. Pure render-from-state. All mutations route
// back through the api.setState provided by app.js.
//
// SVG uses a feet-based viewBox so all coordinates are stored in feet
// and rendered without conversion. Stroke widths stay constant in pixels
// via vector-effect="non-scaling-stroke". Cascade rules: deleting an
// equipment module removes its child ducts and any registers auto-placed
// from those ducts; deleting a duct removes its auto-placed register.
// Independently-placed registers (ductId === null) live on their own.

import { stageBand } from './math.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// ── Constants ─────────────────────────────────────────────────────────
const DEFAULT_EQUIPMENT_W_FT = 3;
const DEFAULT_EQUIPMENT_H_FT = 3;
const VIEWBOX_MARGIN_LEFT_FT = 2.4;   // user-space margin reserved for axis labels
const VIEWBOX_MARGIN_TOP_FT  = 1.6;
const HANDLE_RADIUS_FT       = 0.45;  // hit-test radius for resize handles
const ZONE_MIN_DRAG_FT       = 0.5;   // zone gesture must drag this far to commit
const REGISTER_RADIUS_FT     = 0.55;  // visual size of register symbol
const DECODER_VPD_MAX        = 2.0;   // full-scale of the decoder bar (kPa)

const UNIT_TYPES   = ['', 'Evolution split', 'Compressor Wall', 'Other'];
const REHEAT_TYPES = ['', 'modulating', 'on-off', 'none'];

// ── Module-level state ────────────────────────────────────────────────
let _api = null;             // { getState, setState, setUI } injected from app.js
let _gesture = null;         // active drag/draw gesture
let _renderedPanelKey = null;// 'type:id' currently materialized in edit-panel DOM

// ── Init ──────────────────────────────────────────────────────────────
export function initMap(api) {
  _api = api;

  // Dimension inputs
  const lenInput = document.querySelector('[data-map-dim="len"]');
  const widInput = document.querySelector('[data-map-dim="wid"]');
  if (lenInput) lenInput.addEventListener('input', () => commitDimension('roomLen', lenInput.value));
  if (widInput) widInput.addEventListener('input', () => commitDimension('roomWid', widInput.value));

  // Tool palette — each button declares its tool (and optionally an equipment placement type)
  document.querySelectorAll('[data-map-tool]').forEach((btn) => {
    btn.addEventListener('click', () => selectTool(btn.dataset.mapTool, btn.dataset.eqPlace));
  });

  // Snap selector
  document.querySelectorAll('[data-snap]').forEach((btn) => {
    btn.addEventListener('click', () => _api.setUI({ nudgeStep: Number(btn.dataset.snap) }));
  });

  // Canvas pointer events (registered on the wrapper, dispatched on the live <svg>)
  const wrap = document.getElementById('map-canvas-wrap');
  if (wrap) {
    wrap.addEventListener('pointerdown',   onCanvasPointerDown);
    wrap.addEventListener('pointermove',   onCanvasPointerMove);
    wrap.addEventListener('pointerup',     onCanvasPointerUp);
    wrap.addEventListener('pointercancel', onCanvasPointerCancel);
  }
}

// ── Public render entry point ─────────────────────────────────────────
export function renderMap() {
  if (!_api) return;
  const APP = _api.getState();

  renderDimensions(APP);
  renderToolPalette(APP);
  renderSnapSelector(APP);
  renderHelpHint(APP);
  renderCanvas(APP);
  renderEditPanel(APP);
  renderDecoderBar(APP);
}

// ── Dimensions row ────────────────────────────────────────────────────
function renderDimensions(APP) {
  const lenInput = document.querySelector('[data-map-dim="len"]');
  const widInput = document.querySelector('[data-map-dim="wid"]');
  if (lenInput) {
    const v = (APP.roomLen == null) ? '' : String(APP.roomLen);
    if (lenInput.value !== v && document.activeElement !== lenInput) lenInput.value = v;
  }
  if (widInput) {
    const v = (APP.roomWid == null) ? '' : String(APP.roomWid);
    if (widInput.value !== v && document.activeElement !== widInput) widInput.value = v;
  }
}

// ── Tool palette ──────────────────────────────────────────────────────
function renderToolPalette(APP) {
  const ready = roomReady(APP);

  document.querySelectorAll('[data-map-tool]').forEach((btn) => {
    const tool   = btn.dataset.mapTool;
    const place  = btn.dataset.eqPlace || null;

    let active = (APP.activeTool === tool);
    // Equipment buttons share the 'equipment' tool and disambiguate via placement type
    if (tool === 'equipment' && place) {
      active = active && (APP.equipmentPlacementType === place);
    }

    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));

    // 'select' is always available; everything else needs valid dimensions
    btn.disabled = !ready && tool !== 'select';
  });
}

function renderSnapSelector(APP) {
  document.querySelectorAll('[data-snap]').forEach((btn) => {
    const v = Number(btn.dataset.snap);
    const active = approxEq(v, APP.nudgeStep);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function renderHelpHint(APP) {
  const hint = document.getElementById('map-tool-hint');
  if (!hint) return;
  hint.textContent = toolHint(APP);
}

function toolHint(APP) {
  if (!roomReady(APP)) return 'Enter room length and width to enable layout tools.';
  switch (APP.activeTool) {
    case 'equipment':
      return `Tap on the canvas to drop a ${APP.equipmentPlacementType === 'return' ? 'Return' : 'Supply'} module.`;
    case 'register': return 'Tap on the canvas to drop a register.';
    case 'canopy':   return 'Drag on the canvas to draw a canopy zone.';
    case 'dead':     return 'Drag on the canvas to draw a dead zone.';
    case 'duct':     return 'Tap on the canvas to drop a register and run a duct from the selected equipment.';
    case 'select':
    default:         return 'Tap an element to select; drag handles to resize.';
  }
}

// ── Decoder bar (relocated from app.js) ───────────────────────────────
function renderDecoderBar(APP) {
  const stage   = stageBand(APP.stage);
  const stageEl = document.getElementById('decoder-stage');
  const rangeEl = document.getElementById('decoder-range');
  const trackEl = document.getElementById('decoder-track');
  if (!stageEl || !rangeEl || !trackEl) return;

  if (!stage) {
    stageEl.textContent = '—';
    rangeEl.textContent = '—';
    trackEl.style.removeProperty('--band-min');
    trackEl.style.removeProperty('--band-max');
    return;
  }
  const minPct = (stage.vpdMin / DECODER_VPD_MAX) * 100;
  const maxPct = (stage.vpdMax / DECODER_VPD_MAX) * 100;
  stageEl.textContent = stage.label;
  rangeEl.textContent = `${stage.vpdMin.toFixed(2)} – ${stage.vpdMax.toFixed(2)} kPa`;
  trackEl.style.setProperty('--band-min', `${minPct}%`);
  trackEl.style.setProperty('--band-max', `${maxPct}%`);
}

// ── Canvas (SVG) ──────────────────────────────────────────────────────
function renderCanvas(APP) {
  const wrap = document.getElementById('map-canvas-wrap');
  const empty = document.getElementById('map-empty');
  if (!wrap) return;

  if (!roomReady(APP)) {
    wrap.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }
  if (empty) empty.hidden = true;

  const len = APP.roomLen;
  const wid = APP.roomWid;
  const vbX = -VIEWBOX_MARGIN_LEFT_FT;
  const vbY = -VIEWBOX_MARGIN_TOP_FT;
  const vbW = len + VIEWBOX_MARGIN_LEFT_FT + 0.4;
  const vbH = wid + VIEWBOX_MARGIN_TOP_FT + 0.4;

  // Single SVG rebuilt each render — element counts are small (tens, not
  // thousands), and a fresh innerHTML avoids the bookkeeping of patching.
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('id', 'map-svg');
  svg.setAttribute('class', 'map-svg');
  svg.setAttribute('viewBox', `${vbX} ${vbY} ${vbW} ${vbH}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.style.aspectRatio = `${vbW} / ${vbH}`;

  // Defs — crosshatch pattern for dead zones
  svg.appendChild(buildDefs());

  // Layer order, bottom → top
  svg.appendChild(buildGridLayer(len, wid));
  svg.appendChild(buildAxisLayer(len, wid));
  svg.appendChild(buildZonesLayer(APP));
  svg.appendChild(buildDuctsLayer(APP));
  svg.appendChild(buildEquipmentLayer(APP));
  svg.appendChild(buildRegistersLayer(APP));
  svg.appendChild(buildOverlayLayer(APP));

  wrap.innerHTML = '';
  wrap.appendChild(svg);
}

function buildDefs() {
  const defs = document.createElementNS(SVG_NS, 'defs');
  defs.innerHTML = `
    <pattern id="dead-hatch" patternUnits="userSpaceOnUse" width="0.7" height="0.7" patternTransform="rotate(45)">
      <rect width="0.7" height="0.7" fill="rgba(255,255,255,0.04)" />
      <line x1="0" y1="0" x2="0" y2="0.7" stroke="rgba(255,255,255,0.30)" stroke-width="0.07" />
    </pattern>
  `;
  return defs;
}

function buildGridLayer(len, wid) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-grid');

  // Room outline
  const room = document.createElementNS(SVG_NS, 'rect');
  room.setAttribute('class', 'map-grid__room');
  room.setAttribute('x', '0');
  room.setAttribute('y', '0');
  room.setAttribute('width', String(len));
  room.setAttribute('height', String(wid));
  g.appendChild(room);

  // Grid lines per spec: 5 ft if longest dim > 20 ft, else 2 ft
  const step = Math.max(len, wid) > 20 ? 5 : 2;
  for (let x = step; x < len; x += step) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'map-grid__line');
    line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x));
    line.setAttribute('y1', '0');       line.setAttribute('y2', String(wid));
    g.appendChild(line);
  }
  for (let y = step; y < wid; y += step) {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', 'map-grid__line');
    line.setAttribute('x1', '0');       line.setAttribute('x2', String(len));
    line.setAttribute('y1', String(y)); line.setAttribute('y2', String(y));
    g.appendChild(line);
  }
  return g;
}

function buildAxisLayer(len, wid) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-axis');
  const step = Math.max(len, wid) > 20 ? 5 : 2;

  for (let x = 0; x <= len; x += step) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'map-axis__label');
    t.setAttribute('x', String(x));
    t.setAttribute('y', '-0.4');
    t.setAttribute('font-size', '0.7');
    t.setAttribute('text-anchor', 'middle');
    t.textContent = String(x);
    g.appendChild(t);
  }
  for (let y = 0; y <= wid; y += step) {
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'map-axis__label');
    t.setAttribute('x', '-0.5');
    t.setAttribute('y', String(y));
    t.setAttribute('font-size', '0.7');
    t.setAttribute('text-anchor', 'end');
    t.setAttribute('dominant-baseline', 'middle');
    t.textContent = String(y);
    g.appendChild(t);
  }
  return g;
}

function buildZonesLayer(APP) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-zones');
  for (const z of APP.zones || []) {
    g.appendChild(buildZone(APP, z));
  }
  return g;
}

function buildZone(APP, z) {
  const r = rectFromCorners(z);
  const isSel = (APP.selectedType === 'zone' && APP.selectedId === z.id);
  const el = document.createElementNS(SVG_NS, 'rect');
  el.setAttribute('class', `map-zone map-zone--${z.type}${isSel ? ' is-selected' : ''}`);
  el.setAttribute('x', String(r.x));
  el.setAttribute('y', String(r.y));
  el.setAttribute('width',  String(r.w));
  el.setAttribute('height', String(r.h));
  el.dataset.hit = `zone:${z.id}`;
  if (z.type === 'dead') el.setAttribute('fill', 'url(#dead-hatch)');

  if (z.label) {
    const wrap = document.createElementNS(SVG_NS, 'g');
    wrap.appendChild(el);
    const t = document.createElementNS(SVG_NS, 'text');
    t.setAttribute('class', 'map-zone__label');
    t.setAttribute('x', String(r.x + 0.3));
    t.setAttribute('y', String(r.y + 0.9));
    t.setAttribute('font-size', '0.6');
    t.textContent = z.label;
    wrap.appendChild(t);
    return wrap;
  }
  return el;
}

function buildDuctsLayer(APP) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-ducts');
  const equipById = byId(APP.equipmentModules);

  for (const d of APP.ducts || []) {
    const a = ductOriginPoint(d, equipById);
    const isSel = (APP.selectedType === 'duct' && APP.selectedId === d.id);
    const eq = equipById[d.equipmentId];
    const cls = `map-duct map-duct--${eq ? eq.type : 'supply'}${isSel ? ' is-selected' : ''}`;

    // Transparent fat hit zone for finger targets — visual line below it
    // stays at design weight. Drawn first so the visible line paints on top.
    const hit = document.createElementNS(SVG_NS, 'line');
    hit.setAttribute('class', 'map-duct__hit');
    hit.setAttribute('x1', String(a.x));
    hit.setAttribute('y1', String(a.y));
    hit.setAttribute('x2', String(d.x2Ft));
    hit.setAttribute('y2', String(d.y2Ft));
    hit.dataset.hit = `duct:${d.id}`;
    g.appendChild(hit);

    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', cls);
    line.setAttribute('x1', String(a.x));
    line.setAttribute('y1', String(a.y));
    line.setAttribute('x2', String(d.x2Ft));
    line.setAttribute('y2', String(d.y2Ft));
    g.appendChild(line);
  }
  return g;
}

function buildEquipmentLayer(APP) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-equipment');

  for (const m of APP.equipmentModules || []) {
    const isSel = (APP.selectedType === 'equipment' && APP.selectedId === m.id);
    const wrap = document.createElementNS(SVG_NS, 'g');
    wrap.setAttribute('class', `map-equip map-equip--${m.type}${isSel ? ' is-selected' : ''}`);

    const rect = document.createElementNS(SVG_NS, 'rect');
    rect.setAttribute('x', String(m.xFt));
    rect.setAttribute('y', String(m.yFt));
    rect.setAttribute('width',  String(m.wFt));
    rect.setAttribute('height', String(m.hFt));
    rect.setAttribute('class', 'map-equip__body');
    rect.dataset.hit = `equipment:${m.id}`;
    wrap.appendChild(rect);

    // S/R glyph in the corner
    const glyph = document.createElementNS(SVG_NS, 'text');
    glyph.setAttribute('class', 'map-equip__glyph');
    glyph.setAttribute('x', String(m.xFt + 0.3));
    glyph.setAttribute('y', String(m.yFt + 1.0));
    glyph.setAttribute('font-size', '0.9');
    glyph.textContent = (m.type === 'return') ? 'R' : 'S';
    wrap.appendChild(glyph);

    if (m.label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('class', 'map-equip__label');
      t.setAttribute('x', String(m.xFt + m.wFt / 2));
      t.setAttribute('y', String(m.yFt + m.hFt / 2 + 0.25));
      t.setAttribute('font-size', '0.7');
      t.setAttribute('text-anchor', 'middle');
      t.textContent = m.label;
      wrap.appendChild(t);
    }
    g.appendChild(wrap);
  }
  return g;
}

function buildRegistersLayer(APP) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-registers');
  const ductsById = byId(APP.ducts);
  const equipById = byId(APP.equipmentModules);

  for (const r of APP.registers || []) {
    const isSel = (APP.selectedType === 'register' && APP.selectedId === r.id);
    const parentDuct = r.ductId ? ductsById[r.ductId] : null;
    const parentEq   = parentDuct ? equipById[parentDuct.equipmentId] : null;
    const tone = parentEq ? parentEq.type : 'supply';

    const wrap = document.createElementNS(SVG_NS, 'g');
    wrap.setAttribute('class', `map-register map-register--${tone}${isSel ? ' is-selected' : ''}`);
    wrap.setAttribute('transform', `translate(${r.xFt} ${r.yFt})`);

    const sym = document.createElementNS(SVG_NS, 'g');
    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('class', 'map-register__ring');
    c.setAttribute('r', String(REGISTER_RADIUS_FT));
    sym.appendChild(c);
    // Crosshair inside the ring
    const lh = document.createElementNS(SVG_NS, 'line');
    lh.setAttribute('class', 'map-register__cross');
    lh.setAttribute('x1', String(-REGISTER_RADIUS_FT));
    lh.setAttribute('x2', String( REGISTER_RADIUS_FT));
    lh.setAttribute('y1', '0'); lh.setAttribute('y2', '0');
    sym.appendChild(lh);
    const lv = document.createElementNS(SVG_NS, 'line');
    lv.setAttribute('class', 'map-register__cross');
    lv.setAttribute('x1', '0'); lv.setAttribute('x2', '0');
    lv.setAttribute('y1', String(-REGISTER_RADIUS_FT));
    lv.setAttribute('y2', String( REGISTER_RADIUS_FT));
    sym.appendChild(lv);
    sym.dataset.hit = `register:${r.id}`;
    wrap.appendChild(sym);

    if (r.label) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('class', 'map-register__label');
      t.setAttribute('x', String(REGISTER_RADIUS_FT + 0.2));
      t.setAttribute('y', '0.15');
      t.setAttribute('font-size', '0.55');
      t.textContent = r.label;
      wrap.appendChild(t);
    }
    g.appendChild(wrap);
  }
  return g;
}

function buildOverlayLayer(APP) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-overlay');

  // Selection handles for the currently selected element
  const sel = currentSelection(APP);
  if (sel) {
    if (sel.type === 'equipment' || sel.type === 'zone') {
      const r = (sel.type === 'equipment')
        ? { x: sel.el.xFt, y: sel.el.yFt, w: sel.el.wFt, h: sel.el.hFt }
        : rectFromCorners(sel.el);
      addRectHandles(g, sel.type, sel.el.id, r);
    } else if (sel.type === 'duct') {
      const equipById = byId(APP.equipmentModules);
      const a = ductOriginPoint(sel.el, equipById);
      addDuctHandles(g, sel.el.id, a, { x: sel.el.x2Ft, y: sel.el.y2Ft });
    } else if (sel.type === 'register') {
      addPointHandle(g, 'register', sel.el.id, sel.el.xFt, sel.el.yFt);
    }
  }

  // In-progress zone draw preview
  if (_gesture && _gesture.kind === 'draw-zone') {
    const r = rectFromCorners({
      x1Ft: _gesture.origin.x,
      y1Ft: _gesture.origin.y,
      x2Ft: _gesture.current.x,
      y2Ft: _gesture.current.y
    });
    const preview = document.createElementNS(SVG_NS, 'rect');
    preview.setAttribute('class', `map-zone-preview map-zone-preview--${_gesture.zoneType}`);
    preview.setAttribute('x', String(r.x));
    preview.setAttribute('y', String(r.y));
    preview.setAttribute('width', String(r.w));
    preview.setAttribute('height', String(r.h));
    g.appendChild(preview);
  }

  // In-progress duct preview
  if (_gesture && _gesture.kind === 'draw-duct') {
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('class', `map-duct-preview map-duct-preview--${_gesture.ductTone}`);
    line.setAttribute('x1', String(_gesture.origin.x));
    line.setAttribute('y1', String(_gesture.origin.y));
    line.setAttribute('x2', String(_gesture.current.x));
    line.setAttribute('y2', String(_gesture.current.y));
    g.appendChild(line);
  }
  return g;
}

function addRectHandles(layer, type, id, r) {
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
    h.setAttribute('class', 'map-handle');
    h.setAttribute('x', String(p.x - HANDLE_RADIUS_FT/2));
    h.setAttribute('y', String(p.y - HANDLE_RADIUS_FT/2));
    h.setAttribute('width', String(HANDLE_RADIUS_FT));
    h.setAttribute('height', String(HANDLE_RADIUS_FT));
    h.dataset.hit = `handle:${type}:${id}:${p.k}`;
    layer.appendChild(h);
  }
}

function addDuctHandles(layer, id, a, b) {
  // Endpoint A (equipment side) is bound and not draggable from here —
  // moving it requires moving the parent equipment module. Visual marker only.
  const aMark = document.createElementNS(SVG_NS, 'circle');
  aMark.setAttribute('class', 'map-handle map-handle--bound');
  aMark.setAttribute('cx', String(a.x));
  aMark.setAttribute('cy', String(a.y));
  aMark.setAttribute('r', String(HANDLE_RADIUS_FT/2));
  layer.appendChild(aMark);

  const bH = document.createElementNS(SVG_NS, 'circle');
  bH.setAttribute('class', 'map-handle');
  bH.setAttribute('cx', String(b.x));
  bH.setAttribute('cy', String(b.y));
  bH.setAttribute('r', String(HANDLE_RADIUS_FT/2 + 0.05));
  bH.dataset.hit = `handle:duct:${id}:b`;
  layer.appendChild(bH);
}

function addPointHandle(layer, type, id, x, y) {
  const h = document.createElementNS(SVG_NS, 'circle');
  h.setAttribute('class', 'map-handle map-handle--point');
  h.setAttribute('cx', String(x));
  h.setAttribute('cy', String(y));
  h.setAttribute('r', String(HANDLE_RADIUS_FT));
  h.dataset.hit = `handle:${type}:${id}:move`;
  layer.appendChild(h);
}

// ── Pointer event handlers ────────────────────────────────────────────
function onCanvasPointerDown(e) {
  if (e.button != null && e.button !== 0) return;
  const APP = _api.getState();
  if (!roomReady(APP)) return;

  const wrap = e.currentTarget;            // stable; SVG inside is rebuilt on render
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  const pt = svgPointFromEvent(svg, e);

  // If outside the room rectangle (in the axis-label margin), ignore
  if (pt.x < -0.1 || pt.y < -0.1 || pt.x > APP.roomLen + 0.1 || pt.y > APP.roomWid + 0.1) return;

  const inside = clampToRoom(pt, APP);
  const snapped = snapPoint(inside, APP.nudgeStep);

  const hit = decodeHit(e.target);
  const tool = APP.activeTool;

  // Handle hits always start a resize/drag, regardless of tool — once an
  // element is selected, manipulating its handles is the natural action.
  if (hit && hit.kind === 'handle') {
    startHandleGesture(wrap, e, hit, inside, APP);
    return;
  }

  // Body-of-element hits in select tool start a move drag and select
  if (tool === 'select' && hit && hit.kind !== 'handle') {
    selectAndStartMove(wrap, e, hit, inside, APP);
    return;
  }

  // Tool-driven actions
  switch (tool) {
    case 'equipment': {
      placeEquipment(snapped, APP);
      e.preventDefault();
      return;
    }
    case 'register': {
      placeIndependentRegister(snapped, APP);
      e.preventDefault();
      return;
    }
    case 'duct': {
      placeDuctAndRegister(snapped, APP);
      e.preventDefault();
      return;
    }
    case 'canopy':
    case 'dead':   {
      _gesture = {
        kind: 'draw-zone', zoneType: tool,
        origin: snapped, current: snapped, pointerId: e.pointerId
      };
      wrap.setPointerCapture?.(e.pointerId);
      _api.setUI({ selectedId: null, selectedType: null });
      e.preventDefault();
      return;
    }
    case 'select':
    default: {
      // Click on empty canvas in select tool: deselect
      _api.setUI({ selectedId: null, selectedType: null });
      return;
    }
  }
}

function onCanvasPointerMove(e) {
  if (!_gesture || _gesture.pointerId !== e.pointerId) return;
  // Re-look-up the live SVG: it may have been replaced by a render between
  // pointerdown and now. Pointer capture sits on the wrap so the move keeps
  // dispatching here even when the cursor leaves the SVG bounds.
  const svg = document.getElementById('map-svg');
  if (!svg) return;
  const APP = _api.getState();
  const raw = svgPointFromEvent(svg, e);
  const inside = clampToRoom(raw, APP);
  const snapped = snapPoint(inside, APP.nudgeStep);
  _gesture.current = snapped;

  switch (_gesture.kind) {
    case 'draw-zone':
      // Re-render the overlay layer to update the preview
      renderCanvas(APP);
      break;
    case 'move-equipment':
      applyMoveEquipment(_gesture, snapped);
      break;
    case 'move-zone':
      applyMoveZone(_gesture, snapped);
      break;
    case 'move-register':
      applyMoveRegister(_gesture, snapped);
      break;
    case 'move-duct':
      applyMoveDuct(_gesture, snapped);
      break;
    case 'resize-equipment':
      applyResizeEquipment(_gesture, snapped, APP.nudgeStep);
      break;
    case 'resize-zone':
      applyResizeZone(_gesture, snapped, APP.nudgeStep);
      break;
    case 'duct-endpoint':
      applyDuctEndpoint(_gesture, snapped);
      break;
  }
}

function onCanvasPointerUp(e) {
  if (!_gesture || _gesture.pointerId !== e.pointerId) return;
  e.currentTarget?.releasePointerCapture?.(e.pointerId);

  const APP = _api.getState();
  const g = _gesture;
  _gesture = null;

  if (g.kind === 'draw-zone') {
    const x1 = Math.min(g.origin.x, g.current.x);
    const x2 = Math.max(g.origin.x, g.current.x);
    const y1 = Math.min(g.origin.y, g.current.y);
    const y2 = Math.max(g.origin.y, g.current.y);
    if ((x2 - x1) < ZONE_MIN_DRAG_FT || (y2 - y1) < ZONE_MIN_DRAG_FT) {
      // Stray tap: discard
      renderCanvas(APP);
      return;
    }
    const z = {
      id: newId('zn'),
      type: g.zoneType,
      x1Ft: x1, y1Ft: y1, x2Ft: x2, y2Ft: y2,
      label: ''
    };
    _api.setState({
      zones: [...(APP.zones || []), z],
      selectedId: z.id, selectedType: 'zone',
      activeTool: 'select'
    });
    return;
  }
  // For all other gesture types, the move/resize handlers wrote setState
  // incrementally; nothing to commit on release. Re-render to clear hover state.
  renderCanvas(APP);
}

function onCanvasPointerCancel(e) {
  if (!_gesture || _gesture.pointerId !== e.pointerId) return;
  _gesture = null;
  renderCanvas(_api.getState());
}

// ── Tool-driven placements ────────────────────────────────────────────
function placeEquipment(pt, APP) {
  const w = DEFAULT_EQUIPMENT_W_FT;
  const h = DEFAULT_EQUIPMENT_H_FT;
  // Center the dropped module on the tap point, clamped to the room
  let x = pt.x - w/2;
  let y = pt.y - h/2;
  x = clamp(x, 0, APP.roomLen - w);
  y = clamp(y, 0, APP.roomWid - h);
  x = snapValue(x, APP.nudgeStep);
  y = snapValue(y, APP.nudgeStep);

  const m = {
    id: newId('eq'),
    type: APP.equipmentPlacementType === 'return' ? 'return' : 'supply',
    xFt: x, yFt: y, wFt: w, hFt: h,
    label: '',
    model: '', serial: '',
    unitType: '', reheatType: '',
    commissioningPresent: false, internetConnected: false
  };
  _api.setState({
    equipmentModules: [...(APP.equipmentModules || []), m],
    selectedId: m.id, selectedType: 'equipment',
    activeTool: 'select'
  });
}

function placeIndependentRegister(pt, APP) {
  const r = {
    id: newId('rg'),
    ductId: null,
    xFt: pt.x, yFt: pt.y,
    label: ''
  };
  _api.setState({
    registers: [...(APP.registers || []), r],
    selectedId: r.id, selectedType: 'register',
    activeTool: 'select'
  });
}

function placeDuctAndRegister(pt, APP) {
  // Source must be a selected equipment module — set when user clicked "Add Duct Run"
  const eq = (APP.selectedType === 'equipment')
    ? (APP.equipmentModules || []).find((m) => m.id === APP.selectedId)
    : null;

  // If no equipment is selected, fall back to most recent module
  const source = eq || (APP.equipmentModules || []).slice(-1)[0];
  if (!source) {
    _api.setUI({ activeTool: 'select' });
    return;
  }
  const a = equipmentCenter(source);
  const d = {
    id: newId('dt'),
    equipmentId: source.id,
    x1Ft: a.x, y1Ft: a.y,
    x2Ft: pt.x, y2Ft: pt.y
  };
  const r = {
    id: newId('rg'),
    ductId: d.id,
    xFt: pt.x, yFt: pt.y,
    label: ''
  };
  _api.setState({
    ducts:     [...(APP.ducts || []), d],
    registers: [...(APP.registers || []), r],
    selectedId: source.id, selectedType: 'equipment',
    activeTool: 'select'
  });
}

// ── Select / move dispatch ────────────────────────────────────────────
function selectAndStartMove(wrap, e, hit, pt, APP) {
  const patch = { selectedId: hit.id, selectedType: hit.type, activeTool: 'select' };
  _api.setUI(patch);

  switch (hit.type) {
    case 'equipment': {
      const m = (APP.equipmentModules || []).find((x) => x.id === hit.id);
      if (!m) return;
      _gesture = {
        kind: 'move-equipment', pointerId: e.pointerId,
        id: m.id,
        offset: { x: pt.x - m.xFt, y: pt.y - m.yFt },
        initial: { x: m.xFt, y: m.yFt }
      };
      wrap.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    case 'zone': {
      const z = (APP.zones || []).find((x) => x.id === hit.id);
      if (!z) return;
      const r = rectFromCorners(z);
      _gesture = {
        kind: 'move-zone', pointerId: e.pointerId,
        id: z.id,
        offset: { x: pt.x - r.x, y: pt.y - r.y },
        size: { w: r.w, h: r.h }
      };
      wrap.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    case 'register': {
      const r = (APP.registers || []).find((x) => x.id === hit.id);
      if (!r) return;
      _gesture = {
        kind: 'move-register', pointerId: e.pointerId,
        id: r.id,
        offset: { x: pt.x - r.xFt, y: pt.y - r.yFt }
      };
      wrap.setPointerCapture?.(e.pointerId);
      e.preventDefault();
      return;
    }
    case 'duct': {
      // Click on duct line selects it; movement happens via the B-end handle
      return;
    }
  }
}

function startHandleGesture(wrap, e, hit, pt, APP) {
  const [, kind, type, id, knob] = hit.raw.split(':');
  void kind;
  // Hit format: 'handle:<type>:<id>:<knob>'
  if (type === 'equipment') {
    const m = (APP.equipmentModules || []).find((x) => x.id === id);
    if (!m) return;
    _api.setUI({ selectedId: id, selectedType: 'equipment', activeTool: 'select' });
    _gesture = {
      kind: 'resize-equipment', pointerId: e.pointerId,
      id, knob,
      initial: { x: m.xFt, y: m.yFt, w: m.wFt, h: m.hFt }
    };
  } else if (type === 'zone') {
    const z = (APP.zones || []).find((x) => x.id === id);
    if (!z) return;
    const r = rectFromCorners(z);
    _api.setUI({ selectedId: id, selectedType: 'zone', activeTool: 'select' });
    _gesture = {
      kind: 'resize-zone', pointerId: e.pointerId,
      id, knob,
      initial: { x: r.x, y: r.y, w: r.w, h: r.h }
    };
  } else if (type === 'duct' && knob === 'b') {
    _api.setUI({ selectedId: id, selectedType: 'duct', activeTool: 'select' });
    _gesture = {
      kind: 'duct-endpoint', pointerId: e.pointerId, id
    };
  } else if (type === 'register' && knob === 'move') {
    const r = (APP.registers || []).find((x) => x.id === id);
    if (!r) return;
    _api.setUI({ selectedId: id, selectedType: 'register', activeTool: 'select' });
    _gesture = {
      kind: 'move-register', pointerId: e.pointerId, id,
      offset: { x: pt.x - r.xFt, y: pt.y - r.yFt }
    };
  }
  wrap.setPointerCapture?.(e.pointerId);
  e.preventDefault();
}

// ── Live drag updaters ────────────────────────────────────────────────
function applyMoveEquipment(g, snapped) {
  const APP = _api.getState();
  const m = (APP.equipmentModules || []).find((x) => x.id === g.id);
  if (!m) return;

  let nx = snapped.x - g.offset.x;
  let ny = snapped.y - g.offset.y;
  nx = clamp(snapValue(nx, APP.nudgeStep), 0, APP.roomLen - m.wFt);
  ny = clamp(snapValue(ny, APP.nudgeStep), 0, APP.roomWid - m.hFt);
  if (approxEq(nx, m.xFt) && approxEq(ny, m.yFt)) return;

  const dx = nx - m.xFt;
  const dy = ny - m.yFt;
  applyEquipmentDelta(APP, m.id, dx, dy);
}

function applyEquipmentDelta(APP, equipId, dx, dy) {
  // Move the equipment, then translate child duct origins and any registers
  // that ride at those duct origins. Registers tied to a duct's terminus
  // (B endpoint) stay where the user placed them (the duct end has not moved).
  const equipmentModules = (APP.equipmentModules || []).map((m) =>
    m.id === equipId ? { ...m, xFt: m.xFt + dx, yFt: m.yFt + dy } : m
  );
  const ducts = (APP.ducts || []).map((d) =>
    d.equipmentId === equipId
      ? { ...d, x1Ft: d.x1Ft + dx, y1Ft: d.y1Ft + dy }
      : d
  );
  _api.setState({ equipmentModules, ducts });
}

function applyMoveZone(g, snapped) {
  const APP = _api.getState();
  const z = (APP.zones || []).find((x) => x.id === g.id);
  if (!z) return;

  let nx = snapped.x - g.offset.x;
  let ny = snapped.y - g.offset.y;
  nx = clamp(snapValue(nx, APP.nudgeStep), 0, APP.roomLen - g.size.w);
  ny = clamp(snapValue(ny, APP.nudgeStep), 0, APP.roomWid - g.size.h);
  const r = rectFromCorners(z);
  if (approxEq(nx, r.x) && approxEq(ny, r.y)) return;

  const updated = {
    ...z,
    x1Ft: nx, y1Ft: ny,
    x2Ft: nx + g.size.w, y2Ft: ny + g.size.h
  };
  _api.setState({
    zones: APP.zones.map((x) => x.id === z.id ? updated : x)
  });
}

function applyMoveRegister(g, snapped) {
  const APP = _api.getState();
  const r = (APP.registers || []).find((x) => x.id === g.id);
  if (!r) return;
  let nx = snapValue(snapped.x - g.offset.x, APP.nudgeStep);
  let ny = snapValue(snapped.y - g.offset.y, APP.nudgeStep);
  nx = clamp(nx, 0, APP.roomLen);
  ny = clamp(ny, 0, APP.roomWid);
  if (approxEq(nx, r.xFt) && approxEq(ny, r.yFt)) return;

  // If the register is bound to a duct, move the duct's B endpoint with it
  let registers = APP.registers.map((x) => x.id === r.id ? { ...x, xFt: nx, yFt: ny } : x);
  let ducts = APP.ducts;
  if (r.ductId) {
    ducts = APP.ducts.map((d) => d.id === r.ductId ? { ...d, x2Ft: nx, y2Ft: ny } : d);
  }
  _api.setState({ registers, ducts });
}

function applyMoveDuct(g, snapped) {
  // Body-of-line drag is not supported directly; ducts are moved at endpoints.
  void g; void snapped;
}

function applyResizeEquipment(g, snapped, step) {
  const APP = _api.getState();
  const m = (APP.equipmentModules || []).find((x) => x.id === g.id);
  if (!m) return;

  const r = resizeRect(g.initial, g.knob, snapped, step, {
    minW: 0.5, minH: 0.5,
    maxX: APP.roomLen, maxY: APP.roomWid
  });
  if (!r) return;
  if (approxEq(r.x, m.xFt) && approxEq(r.y, m.yFt) &&
      approxEq(r.w, m.wFt) && approxEq(r.h, m.hFt)) return;

  const dx = r.x - m.xFt;
  const dy = r.y - m.yFt;
  // Equipment duct-origin tracks the equipment center, so any size change
  // shifts the origin by half the size delta. Treat as a delta on the center.
  const oldCenter = { x: m.xFt + m.wFt/2, y: m.yFt + m.hFt/2 };
  const newCenter = { x: r.x + r.w/2,     y: r.y + r.h/2     };
  const cdx = newCenter.x - oldCenter.x;
  const cdy = newCenter.y - oldCenter.y;
  void dx; void dy;

  const equipmentModules = APP.equipmentModules.map((x) =>
    x.id === m.id ? { ...x, xFt: r.x, yFt: r.y, wFt: r.w, hFt: r.h } : x
  );
  const ducts = APP.ducts.map((d) =>
    d.equipmentId === m.id ? { ...d, x1Ft: d.x1Ft + cdx, y1Ft: d.y1Ft + cdy } : d
  );
  _api.setState({ equipmentModules, ducts });
}

function applyResizeZone(g, snapped, step) {
  const APP = _api.getState();
  const z = (APP.zones || []).find((x) => x.id === g.id);
  if (!z) return;

  const r = resizeRect(g.initial, g.knob, snapped, step, {
    minW: 0.5, minH: 0.5,
    maxX: APP.roomLen, maxY: APP.roomWid
  });
  if (!r) return;

  const updated = {
    ...z,
    x1Ft: r.x, y1Ft: r.y,
    x2Ft: r.x + r.w, y2Ft: r.y + r.h
  };
  _api.setState({
    zones: APP.zones.map((x) => x.id === z.id ? updated : x)
  });
}

function applyDuctEndpoint(g, snapped) {
  const APP = _api.getState();
  const d = (APP.ducts || []).find((x) => x.id === g.id);
  if (!d) return;
  const nx = clamp(snapValue(snapped.x, APP.nudgeStep), 0, APP.roomLen);
  const ny = clamp(snapValue(snapped.y, APP.nudgeStep), 0, APP.roomWid);
  if (approxEq(nx, d.x2Ft) && approxEq(ny, d.y2Ft)) return;

  const ducts = APP.ducts.map((x) => x.id === d.id ? { ...x, x2Ft: nx, y2Ft: ny } : x);
  // Drag any registers riding at this duct's terminus along with it
  const registers = APP.registers.map((r) =>
    r.ductId === d.id ? { ...r, xFt: nx, yFt: ny } : r
  );
  _api.setState({ ducts, registers });
}

// Resize math: given the original rect and the dragged knob, compute new bounds.
// Knobs: 'tl','tr','bl','br','t','b','l','r'.
function resizeRect(init, knob, snapped, step, opts) {
  let x = init.x, y = init.y, w = init.w, h = init.h;
  const px = clamp(snapValue(snapped.x, step), 0, opts.maxX);
  const py = clamp(snapValue(snapped.y, step), 0, opts.maxY);

  if (knob.includes('l')) { const right = x + w; x = Math.min(px, right - opts.minW); w = right - x; }
  if (knob.includes('r')) {                   w = Math.max(opts.minW, px - x); }
  if (knob.includes('t')) { const bottom = y + h; y = Math.min(py, bottom - opts.minH); h = bottom - y; }
  if (knob.includes('b')) {                   h = Math.max(opts.minH, py - y); }

  return { x, y, w, h };
}

// ── Edit panel ────────────────────────────────────────────────────────
function renderEditPanel(APP) {
  const panel = document.getElementById('map-edit-panel');
  const body  = document.getElementById('edit-panel-body');
  const title = document.getElementById('edit-panel-title');
  const delBtn = document.getElementById('edit-panel-delete');
  if (!panel || !body || !title || !delBtn) return;

  const sel = currentSelection(APP);
  if (!sel) {
    panel.hidden = true;
    body.innerHTML = '';
    _renderedPanelKey = null;
    return;
  }
  panel.hidden = false;

  const key = `${sel.type}:${sel.el.id}`;
  if (key !== _renderedPanelKey) {
    _renderedPanelKey = key;
    title.textContent = panelTitle(sel);
    body.innerHTML = '';
    body.appendChild(buildPanelForm(sel));
    delBtn.onclick = () => deleteSelection(sel);
    wirePanelInputs(body, sel);
  } else {
    syncPanelInputs(body, sel);
  }
}

function panelTitle(sel) {
  switch (sel.type) {
    case 'equipment': return `Equipment ${sel.el.type === 'return' ? 'Return' : 'Supply'}`;
    case 'zone':      return sel.el.type === 'dead' ? 'Dead Zone' : 'Canopy Zone';
    case 'duct':      return 'Duct Run';
    case 'register':  return sel.el.ductId ? 'Register (auto)' : 'Register';
    default:          return 'Element';
  }
}

function buildPanelForm(sel) {
  const wrap = document.createElement('div');
  wrap.className = 'edit-panel__grid';
  switch (sel.type) {
    case 'equipment': return buildEquipmentForm(wrap, sel.el);
    case 'zone':      return buildZoneForm(wrap, sel.el);
    case 'duct':      return buildDuctForm(wrap, sel.el);
    case 'register':  return buildRegisterForm(wrap, sel.el);
  }
  return wrap;
}

function buildEquipmentForm(wrap, m) {
  wrap.innerHTML = `
    <label class="edit-row"><span>X (ft)</span><input type="number" step="0.5" data-bind="xFt"></label>
    <label class="edit-row"><span>Y (ft)</span><input type="number" step="0.5" data-bind="yFt"></label>
    <label class="edit-row"><span>W (ft)</span><input type="number" step="0.5" min="0.5" data-bind="wFt"></label>
    <label class="edit-row"><span>H (ft)</span><input type="number" step="0.5" min="0.5" data-bind="hFt"></label>
    <label class="edit-row edit-row--wide"><span>Label</span><input type="text" data-bind="label"></label>
    <fieldset class="edit-row edit-row--wide">
      <legend>Type</legend>
      <div class="toggle-group">
        <button type="button" class="toggle" data-set-type="supply">Supply</button>
        <button type="button" class="toggle" data-set-type="return">Return</button>
      </div>
    </fieldset>
    <label class="edit-row edit-row--wide"><span>Model</span><input type="text" data-bind="model"></label>
    <label class="edit-row"><span>Serial</span><input type="text" data-bind="serial"></label>
    <label class="edit-row"><span>Unit type</span>
      <select data-bind="unitType">${UNIT_TYPES.map((t) => `<option value="${t}">${t || '— select —'}</option>`).join('')}</select>
    </label>
    <label class="edit-row"><span>Reheat</span>
      <select data-bind="reheatType">${REHEAT_TYPES.map((t) => `<option value="${t}">${t || '— select —'}</option>`).join('')}</select>
    </label>
    <label class="edit-row edit-row--check"><input type="checkbox" data-bind="commissioningPresent"><span>Commissioning report present</span></label>
    <label class="edit-row edit-row--check"><input type="checkbox" data-bind="internetConnected"><span>Internet-connected</span></label>
    <div class="edit-row edit-row--wide">
      <button type="button" class="btn btn--ghost" data-action="add-duct">+ Add Duct Run</button>
    </div>
  `;
  syncEquipmentInputs(wrap, m);
  return wrap;
}

function buildZoneForm(wrap, z) {
  const r = rectFromCorners(z);
  wrap.dataset.rect = JSON.stringify(r); // used for syncing
  wrap.innerHTML = `
    <label class="edit-row"><span>X (ft)</span><input type="number" step="0.5" data-bind="x"></label>
    <label class="edit-row"><span>Y (ft)</span><input type="number" step="0.5" data-bind="y"></label>
    <label class="edit-row"><span>W (ft)</span><input type="number" step="0.5" min="0.5" data-bind="w"></label>
    <label class="edit-row"><span>H (ft)</span><input type="number" step="0.5" min="0.5" data-bind="h"></label>
    <label class="edit-row edit-row--wide"><span>Label</span><input type="text" data-bind="label"></label>
  `;
  syncZoneInputs(wrap, z);
  return wrap;
}

function buildDuctForm(wrap, d) {
  wrap.innerHTML = `
    <div class="edit-row edit-row--wide edit-row--note">A — equipment side (moves with parent module)</div>
    <label class="edit-row"><span>X1 (ft)</span><input type="number" step="0.5" data-bind="x1Ft" disabled></label>
    <label class="edit-row"><span>Y1 (ft)</span><input type="number" step="0.5" data-bind="y1Ft" disabled></label>
    <div class="edit-row edit-row--wide edit-row--note">B — terminal end</div>
    <label class="edit-row"><span>X2 (ft)</span><input type="number" step="0.5" data-bind="x2Ft"></label>
    <label class="edit-row"><span>Y2 (ft)</span><input type="number" step="0.5" data-bind="y2Ft"></label>
  `;
  syncDuctInputs(wrap, d);
  return wrap;
}

function buildRegisterForm(wrap, r) {
  wrap.innerHTML = `
    <label class="edit-row"><span>X (ft)</span><input type="number" step="0.5" data-bind="xFt"></label>
    <label class="edit-row"><span>Y (ft)</span><input type="number" step="0.5" data-bind="yFt"></label>
    <label class="edit-row edit-row--wide"><span>Label</span><input type="text" data-bind="label"></label>
    <div class="edit-row edit-row--wide edit-row--note">${r.ductId ? 'Auto-placed at duct terminus.' : 'Independent (no parent duct).'}</div>
  `;
  syncRegisterInputs(wrap, r);
  return wrap;
}

function wirePanelInputs(body, sel) {
  const inputs = body.querySelectorAll('[data-bind]');
  inputs.forEach((el) => {
    const evt = (el.type === 'checkbox') ? 'change' : 'input';
    el.addEventListener(evt, () => onPanelInput(sel, el));
  });

  // Equipment type S/R toggles
  body.querySelectorAll('[data-set-type]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const APP = _api.getState();
      const m = (APP.equipmentModules || []).find((x) => x.id === sel.el.id);
      if (!m) return;
      const newType = btn.dataset.setType;
      if (m.type === newType) return;
      _api.setState({
        equipmentModules: APP.equipmentModules.map((x) =>
          x.id === m.id ? { ...x, type: newType } : x
        )
      });
    });
  });

  // Add Duct Run button
  const addDuct = body.querySelector('[data-action="add-duct"]');
  if (addDuct) {
    addDuct.addEventListener('click', () => {
      _api.setUI({ activeTool: 'duct' });
    });
  }
}

function onPanelInput(sel, el) {
  const APP = _api.getState();
  const bind = el.dataset.bind;
  let value;
  if (el.type === 'checkbox') {
    value = el.checked;
  } else if (el.type === 'number') {
    if (el.value === '') return; // user is mid-edit
    const n = Number(el.value);
    if (!Number.isFinite(n)) return;
    value = n;
  } else {
    value = el.value;
  }

  if (sel.type === 'equipment') {
    const m = (APP.equipmentModules || []).find((x) => x.id === sel.el.id);
    if (!m) return;
    let updated = { ...m, [bind]: value };
    // Numeric clamping
    if (bind === 'xFt') updated.xFt = clamp(updated.xFt, 0, APP.roomLen - m.wFt);
    if (bind === 'yFt') updated.yFt = clamp(updated.yFt, 0, APP.roomWid - m.hFt);
    if (bind === 'wFt') updated.wFt = clamp(updated.wFt, 0.5, APP.roomLen - m.xFt);
    if (bind === 'hFt') updated.hFt = clamp(updated.hFt, 0.5, APP.roomWid - m.yFt);
    // Maintain duct origins on equipment move/resize via input
    const oldCenter = { x: m.xFt + m.wFt/2, y: m.yFt + m.hFt/2 };
    const newCenter = { x: updated.xFt + updated.wFt/2, y: updated.yFt + updated.hFt/2 };
    const cdx = newCenter.x - oldCenter.x;
    const cdy = newCenter.y - oldCenter.y;
    const equipmentModules = APP.equipmentModules.map((x) => x.id === m.id ? updated : x);
    const ducts = APP.ducts.map((d) =>
      d.equipmentId === m.id ? { ...d, x1Ft: d.x1Ft + cdx, y1Ft: d.y1Ft + cdy } : d
    );
    _api.setState({ equipmentModules, ducts });
    return;
  }

  if (sel.type === 'zone') {
    const z = (APP.zones || []).find((x) => x.id === sel.el.id);
    if (!z) return;
    const r = rectFromCorners(z);
    const next = { ...r };
    if (bind === 'x') next.x = clamp(value, 0, APP.roomLen - r.w);
    if (bind === 'y') next.y = clamp(value, 0, APP.roomWid - r.h);
    if (bind === 'w') next.w = clamp(value, 0.5, APP.roomLen - r.x);
    if (bind === 'h') next.h = clamp(value, 0.5, APP.roomWid - r.y);
    let updated;
    if (bind === 'label') {
      updated = { ...z, label: value };
    } else {
      updated = { ...z, x1Ft: next.x, y1Ft: next.y, x2Ft: next.x + next.w, y2Ft: next.y + next.h };
    }
    _api.setState({ zones: APP.zones.map((x) => x.id === z.id ? updated : x) });
    return;
  }

  if (sel.type === 'duct') {
    const d = (APP.ducts || []).find((x) => x.id === sel.el.id);
    if (!d) return;
    if (bind !== 'x2Ft' && bind !== 'y2Ft') return;
    let nx = d.x2Ft, ny = d.y2Ft;
    if (bind === 'x2Ft') nx = clamp(value, 0, APP.roomLen);
    if (bind === 'y2Ft') ny = clamp(value, 0, APP.roomWid);
    const ducts = APP.ducts.map((x) => x.id === d.id ? { ...x, x2Ft: nx, y2Ft: ny } : x);
    const registers = APP.registers.map((r) =>
      r.ductId === d.id ? { ...r, xFt: nx, yFt: ny } : r
    );
    _api.setState({ ducts, registers });
    return;
  }

  if (sel.type === 'register') {
    const r = (APP.registers || []).find((x) => x.id === sel.el.id);
    if (!r) return;
    let nx = r.xFt, ny = r.yFt, label = r.label;
    if (bind === 'xFt')   nx = clamp(value, 0, APP.roomLen);
    if (bind === 'yFt')   ny = clamp(value, 0, APP.roomWid);
    if (bind === 'label') label = value;
    const updated = { ...r, xFt: nx, yFt: ny, label };
    let registers = APP.registers.map((x) => x.id === r.id ? updated : x);
    let ducts = APP.ducts;
    if (r.ductId && (bind === 'xFt' || bind === 'yFt')) {
      ducts = APP.ducts.map((d) => d.id === r.ductId ? { ...d, x2Ft: nx, y2Ft: ny } : d);
    }
    _api.setState({ registers, ducts });
    return;
  }
}

function syncPanelInputs(body, sel) {
  switch (sel.type) {
    case 'equipment': syncEquipmentInputs(body, sel.el); break;
    case 'zone':      syncZoneInputs(body, sel.el); break;
    case 'duct':      syncDuctInputs(body, sel.el); break;
    case 'register':  syncRegisterInputs(body, sel.el); break;
  }
}

function syncEquipmentInputs(body, m) {
  setInputVal(body, 'xFt', m.xFt);
  setInputVal(body, 'yFt', m.yFt);
  setInputVal(body, 'wFt', m.wFt);
  setInputVal(body, 'hFt', m.hFt);
  setInputVal(body, 'label', m.label || '');
  setInputVal(body, 'model', m.model || '');
  setInputVal(body, 'serial', m.serial || '');
  setInputVal(body, 'unitType', m.unitType || '');
  setInputVal(body, 'reheatType', m.reheatType || '');
  setInputVal(body, 'commissioningPresent', !!m.commissioningPresent);
  setInputVal(body, 'internetConnected', !!m.internetConnected);
  body.querySelectorAll('[data-set-type]').forEach((btn) => {
    const active = (btn.dataset.setType === m.type);
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
}

function syncZoneInputs(body, z) {
  const r = rectFromCorners(z);
  setInputVal(body, 'x', r.x);
  setInputVal(body, 'y', r.y);
  setInputVal(body, 'w', r.w);
  setInputVal(body, 'h', r.h);
  setInputVal(body, 'label', z.label || '');
}

function syncDuctInputs(body, d) {
  setInputVal(body, 'x1Ft', d.x1Ft);
  setInputVal(body, 'y1Ft', d.y1Ft);
  setInputVal(body, 'x2Ft', d.x2Ft);
  setInputVal(body, 'y2Ft', d.y2Ft);
}

function syncRegisterInputs(body, r) {
  setInputVal(body, 'xFt', r.xFt);
  setInputVal(body, 'yFt', r.yFt);
  setInputVal(body, 'label', r.label || '');
}

function setInputVal(body, bind, value) {
  const el = body.querySelector(`[data-bind="${bind}"]`);
  if (!el) return;
  if (document.activeElement === el) return; // don't fight a typing user
  if (el.type === 'checkbox') {
    if (el.checked !== !!value) el.checked = !!value;
    return;
  }
  const v = (typeof value === 'number') ? roundForInput(value) : String(value ?? '');
  if (el.value !== v) el.value = v;
}

function roundForInput(n) {
  // Trim trailing zeros without losing precision on snap-aligned values
  return String(Math.round(n * 1000) / 1000);
}

// ── Cascade-aware delete ──────────────────────────────────────────────
function deleteSelection(sel) {
  const APP = _api.getState();
  switch (sel.type) {
    case 'equipment': return deleteEquipment(APP, sel.el.id);
    case 'duct':      return deleteDuct(APP, sel.el.id);
    case 'register':  return deleteRegister(APP, sel.el.id);
    case 'zone':      return deleteZone(APP, sel.el.id);
  }
}

function deleteEquipment(APP, id) {
  const ductIds = (APP.ducts || []).filter((d) => d.equipmentId === id).map((d) => d.id);
  const ductIdSet = new Set(ductIds);
  _api.setState({
    equipmentModules: (APP.equipmentModules || []).filter((m) => m.id !== id),
    ducts:            (APP.ducts || []).filter((d) => !ductIdSet.has(d.id)),
    registers:        (APP.registers || []).filter((r) => !r.ductId || !ductIdSet.has(r.ductId)),
    selectedId: null, selectedType: null
  });
}

function deleteDuct(APP, id) {
  _api.setState({
    ducts:     (APP.ducts || []).filter((d) => d.id !== id),
    registers: (APP.registers || []).filter((r) => r.ductId !== id),
    selectedId: null, selectedType: null
  });
}

function deleteRegister(APP, id) {
  _api.setState({
    registers: (APP.registers || []).filter((r) => r.id !== id),
    selectedId: null, selectedType: null
  });
}

function deleteZone(APP, id) {
  _api.setState({
    zones: (APP.zones || []).filter((z) => z.id !== id),
    selectedId: null, selectedType: null
  });
}

// ── Helpers ───────────────────────────────────────────────────────────
function roomReady(APP) {
  return Number.isFinite(APP.roomLen) && APP.roomLen > 0
      && Number.isFinite(APP.roomWid) && APP.roomWid > 0;
}

function newId(prefix) {
  const rand = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${rand}`;
}

function approxEq(a, b, tol = 1e-6) { return Math.abs(a - b) <= tol; }
function clamp(n, lo, hi) { return Math.min(Math.max(n, lo), hi); }
function snapValue(n, step) {
  if (!step || step <= 0) return n;
  return Math.round(n / step) * step;
}
function snapPoint(p, step) { return { x: snapValue(p.x, step), y: snapValue(p.y, step) }; }
function clampToRoom(p, APP) {
  return {
    x: clamp(p.x, 0, APP.roomLen),
    y: clamp(p.y, 0, APP.roomWid)
  };
}

function rectFromCorners(z) {
  const x = Math.min(z.x1Ft ?? 0, z.x2Ft ?? 0);
  const y = Math.min(z.y1Ft ?? 0, z.y2Ft ?? 0);
  const w = Math.abs((z.x2Ft ?? 0) - (z.x1Ft ?? 0));
  const h = Math.abs((z.y2Ft ?? 0) - (z.y1Ft ?? 0));
  return { x, y, w, h };
}

function equipmentCenter(m) { return { x: m.xFt + m.wFt/2, y: m.yFt + m.hFt/2 }; }

function ductOriginPoint(d, equipById) {
  const eq = equipById[d.equipmentId];
  if (!eq) return { x: d.x1Ft, y: d.y1Ft };
  return equipmentCenter(eq);
}

function byId(list) {
  const out = {};
  for (const x of (list || [])) out[x.id] = x;
  return out;
}

function decodeHit(target) {
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

function svgPointFromEvent(svg, e) {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const local = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
  return { x: local.x, y: local.y };
}

function currentSelection(APP) {
  if (!APP.selectedType || !APP.selectedId) return null;
  let el = null;
  switch (APP.selectedType) {
    case 'equipment': el = (APP.equipmentModules || []).find((x) => x.id === APP.selectedId); break;
    case 'duct':      el = (APP.ducts || []).find((x) => x.id === APP.selectedId); break;
    case 'register':  el = (APP.registers || []).find((x) => x.id === APP.selectedId); break;
    case 'zone':      el = (APP.zones || []).find((x) => x.id === APP.selectedId); break;
  }
  if (!el) return null;
  return { type: APP.selectedType, el };
}
