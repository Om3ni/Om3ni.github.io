// Project Demeter — Map Module
// Single-tier room layout: grid, equipment modules, ducts, registers,
// canopy zones, dead zones. Pure render-from-state. All mutations route
// back through the api.setState provided by app.js.
//
// The portable canvas chassis (geometry, SVG factories, hit-test, IDs)
// lives in ciab.js — this module provides the Demeter-specific body kit
// (S/R coloring, structured equipment fields, cascade rules, decoder bar).
//
// SVG uses a feet-based viewBox so all coordinates are stored in feet
// and rendered without conversion. Stroke widths stay constant in pixels
// via vector-effect="non-scaling-stroke". Cascade rules: deleting an
// equipment module removes its child ducts and any registers auto-placed
// from those ducts; deleting a duct removes its auto-placed register.
// Independently-placed registers (ductId === null) live on their own.

import {
  stageBand, calcVPD, toC,
  canopyArea, meanNearestNeighborDistance
} from './math.js';
import {
  SVG_NS,
  approxEq, clamp, snapValue, snapPoint, clampToBox,
  rectFromCorners, resizeRect, viewBoxFor,
  svgPointFromEvent, decodeHit, newId,
  createCanvasSVG, buildGridLayer, buildAxisLayer,
  buildRectHandles, buildPointHandle, buildBoundMarker
} from './ciab.js';
import { buildHeatmapLayer } from './heatmap.js';
import { c9Failed } from './checklist.js';

// ── Constants ─────────────────────────────────────────────────────────
const DEFAULT_EQUIPMENT_W_FT = 3;
const DEFAULT_EQUIPMENT_H_FT = 3;
const VIEWBOX_MARGIN_LEFT_FT = 2.4;   // user-space margin reserved for axis labels
const VIEWBOX_MARGIN_TOP_FT  = 1.6;
const HANDLE_RADIUS_FT       = 0.45;  // hit-test radius for resize handles
const ZONE_MIN_DRAG_FT       = 0.5;   // zone gesture must drag this far to commit
const REGISTER_RADIUS_FT     = 0.55;  // visual size of register symbol
const SENSOR_RADIUS_FT       = 0.45;  // visual size of sensor dot
const DECODER_VPD_MAX        = 2.0;   // full-scale of the decoder bar (kPa)
const LEAF_OFFSET_C          = 2;     // leaf cooler than air (cultivation default)
const RANGE_FLAG_KPA         = 0.3;   // wide-distribution threshold (spec §Spatial Summary)

const UNIT_TYPES   = ['', 'Evolution split', 'Compressor Wall', 'Other'];
const REHEAT_TYPES = ['', 'modulating', 'on-off', 'none'];

const MIN_TIERS = 2;
const MAX_TIERS = 6;
const POSITION_LABEL = { head: 'Head', mid: 'Middle', tail: 'Tail' };

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

  // Nudge pad — moves the current selection by APP.nudgeStep in N/S/E/W
  document.querySelectorAll('[data-nudge]').forEach((btn) => {
    btn.addEventListener('click', () => nudgeSelected(btn.dataset.nudge));
  });

  // Canvas pointer events (registered on the wrapper, dispatched on the live <svg>)
  const wrap = document.getElementById('map-canvas-wrap');
  if (wrap) {
    wrap.addEventListener('pointerdown',   onCanvasPointerDown);
    wrap.addEventListener('pointermove',   onCanvasPointerMove);
    wrap.addEventListener('pointerup',     onCanvasPointerUp);
    wrap.addEventListener('pointercancel', onCanvasPointerCancel);
  }

  const coverage = document.getElementById('coverage-notes');
  if (coverage) {
    coverage.addEventListener('input', (e) => {
      _api.setState({ coverageNotes: e.target.value });
    });
  }

  document.querySelectorAll('#airflow-group [data-airflow]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _api.setState({ airflowConfidence: btn.dataset.airflow });
    });
  });

  // Mode toggle (Single Tier / Multi Tier).
  document.querySelectorAll('[data-map-mode]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const next = btn.dataset.mapMode;
      if (!next || (_api.getState().mapMode === next)) return;
      // Drop any active selection on switch — single-tier selectedId is
      // meaningless in multi-tier and vice versa.
      _api.setState({
        mapMode: next,
        selectedId: null,
        selectedType: null
      });
    });
  });

  // Tier count (multi-tier).
  const tierCountSel = document.getElementById('tier-count');
  if (tierCountSel) {
    tierCountSel.addEventListener('change', () => {
      const n = clamp(Number(tierCountSel.value) || MIN_TIERS, MIN_TIERS, MAX_TIERS);
      _api.setState({ tierCount: n });
    });
  }

  // Lighting type (multi-tier).
  document.querySelectorAll('[data-lighting]').forEach((btn) => {
    btn.addEventListener('click', () => {
      _api.setState({ lighting: btn.dataset.lighting });
    });
  });
}

// Dimension input → APP.roomLen / APP.roomWid. Empty or non-positive
// values clear the dimension (back to null) so the canvas hides.
function commitDimension(field, raw) {
  const trimmed = String(raw ?? '').trim();
  if (trimmed === '') {
    _api.setState({ [field]: null });
    return;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) {
    _api.setState({ [field]: null });
    return;
  }
  _api.setState({ [field]: n });
}

// Tool palette click. eqPlace is set on the S/R sub-buttons under the
// equipment tool; for all other tools it's undefined and ignored. The
// Duct tool intentionally preserves selection — it needs a source
// equipment module to draw from, so clearing on tool-switch would force
// the user to re-select before every duct run.
function selectTool(name, eqPlace) {
  if (!name) return;
  const patch = { activeTool: name };
  if (name !== 'duct') {
    patch.selectedId = null;
    patch.selectedType = null;
  }
  if (eqPlace) patch.equipmentPlacementType = eqPlace;
  _api.setUI(patch);
  _gesture = null;
}

// ── Public render entry point ─────────────────────────────────────────
export function renderMap() {
  if (!_api) return;
  const APP = _api.getState();

  renderModeToggle(APP);
  renderModeWrappers(APP);

  if (APP.mapMode === 'multi') {
    renderTierConfig(APP);
    renderTierGroups(APP);
  } else {
    renderDimensions(APP);
    renderToolPalette(APP);
    renderSnapSelector(APP);
    renderHelpHint(APP);
    renderCanvas(APP);
    renderEditPanel(APP);
    renderSensorTable(APP);
    renderSpatialSummary(APP);
  }

  renderDecoderBar(APP);
}

// ── Mode toggle / wrapper visibility ──────────────────────────────────
function renderModeToggle(APP) {
  const mode = APP.mapMode || 'single';
  document.querySelectorAll('[data-map-mode]').forEach((btn) => {
    const active = btn.dataset.mapMode === mode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function renderModeWrappers(APP) {
  const single = document.getElementById('map-single');
  const multi  = document.getElementById('map-multi');
  const isMulti = APP.mapMode === 'multi';
  if (single) single.hidden = isMulti;
  if (multi)  multi.hidden  = !isMulti;
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
    case 'sensor':   return 'Tap on the canvas to drop a sensor.';
    case 'canopy':   return 'Drag on the canvas to draw a canopy zone.';
    case 'dead':     return 'Drag on the canvas to draw a dead zone.';
    case 'duct':
      if (APP.selectedType === 'equipment' && APP.selectedId) {
        return 'Tap on the canvas to run a duct from the selected equipment; tap another equipment module to re-target.';
      }
      return 'Select an equipment module first — taps in Duct mode draw from it.';
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
  const needle  = document.getElementById('decoder-needle');
  if (!stageEl || !rangeEl || !trackEl) return;

  if (!stage) {
    stageEl.textContent = '—';
    rangeEl.textContent = '—';
    trackEl.style.removeProperty('--band-min');
    trackEl.style.removeProperty('--band-max');
    if (needle) needle.hidden = true;
    return;
  }
  const minPct = (stage.vpdMin / DECODER_VPD_MAX) * 100;
  const maxPct = (stage.vpdMax / DECODER_VPD_MAX) * 100;
  stageEl.textContent = stage.label;
  rangeEl.textContent = `${stage.vpdMin.toFixed(2)} – ${stage.vpdMax.toFixed(2)} kPa`;
  trackEl.style.setProperty('--band-min', `${minPct}%`);
  trackEl.style.setProperty('--band-max', `${maxPct}%`);

  // Live needle: mean VPD across sensors with readings. Hidden when no
  // readings exist or C9 fail invalidates measured state.
  if (needle) {
    const stats = c9Failed(APP.checklistState) ? null : getMeasuredVPDStats(APP);
    if (!stats) {
      needle.hidden = true;
    } else {
      const pct = clamp((stats.mean / DECODER_VPD_MAX) * 100, 0, 100);
      const status =
        stats.mean < stage.vpdMin ? 'low' :
        stats.mean > stage.vpdMax ? 'high' : 'in';
      needle.hidden = false;
      needle.dataset.status = status;
      needle.style.setProperty('--needle-pct', `${pct}%`);
      needle.title = `Mean VPD ${stats.mean.toFixed(2)} kPa`;
    }
  }
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
  const vb  = viewBoxFor(len, wid, VIEWBOX_MARGIN_LEFT_FT, VIEWBOX_MARGIN_TOP_FT);

  // Single SVG rebuilt each render — element counts are small (tens, not
  // thousands), and a fresh innerHTML avoids the bookkeeping of patching.
  const svg = createCanvasSVG(vb, { id: 'map-svg', className: 'map-svg' });

  // Defs — crosshatch pattern for dead zones (Demeter-specific decoration)
  svg.appendChild(buildDefs());

  // Layer order, bottom → top. Grid + axis come from ciab; everything
  // above is domain-specific (S/R coloring, structured fields, etc.).
  svg.appendChild(buildGridLayer(len, wid, {
    layerClass: 'map-grid',
    roomClass:  'map-grid__room',
    lineClass:  'map-grid__line'
  }));
  svg.appendChild(buildAxisLayer(len, wid, {
    layerClass: 'map-axis',
    labelClass: 'map-axis__label'
  }));
  // C9 fail invalidates measured environmental state per spec — heatmap
  // and per-sensor VPD classifications are interpretations of that state,
  // so they go gray on the Map tab too. Raw temp/RH stay visible: the
  // technician needs them to do the C9 reference comparison.
  const voided = c9Failed(APP.checklistState);

  svg.appendChild(buildZonesLayer(APP));
  svg.appendChild(buildHeatmapLayer({
    sensors: APP.sensors,
    zones:   APP.zones,
    len:     APP.roomLen,
    wid:     APP.roomWid,
    stage:   stageBand(APP.stage),
    voided
  }));
  svg.appendChild(buildDuctsLayer(APP));
  svg.appendChild(buildEquipmentLayer(APP));
  svg.appendChild(buildRegistersLayer(APP));
  svg.appendChild(buildSensorsLayer(APP, voided));
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

function buildSensorsLayer(APP, voided) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', `map-sensors${voided ? ' is-voided' : ''}`);
  const stage = stageBand(APP.stage);
  const sensors = APP.sensors || [];

  sensors.forEach((s, i) => {
    const isSel = (APP.selectedType === 'sensor' && APP.selectedId === s.id);
    const status = voided ? 'unread' : sensorStatus(s, stage);
    const wrap = document.createElementNS(SVG_NS, 'g');
    wrap.setAttribute('class', `map-sensor map-sensor--${status}${isSel ? ' is-selected' : ''}`);

    const c = document.createElementNS(SVG_NS, 'circle');
    c.setAttribute('class', 'map-sensor__dot');
    c.setAttribute('cx', String(s.xFt));
    c.setAttribute('cy', String(s.yFt));
    c.setAttribute('r', String(SENSOR_RADIUS_FT));
    c.dataset.hit = `sensor:${s.id}`;
    wrap.appendChild(c);

    const idx = document.createElementNS(SVG_NS, 'text');
    idx.setAttribute('class', 'map-sensor__label');
    idx.setAttribute('x', String(s.xFt + SENSOR_RADIUS_FT + 0.18));
    idx.setAttribute('y', String(s.yFt - 0.05));
    idx.setAttribute('font-size', '0.55');
    idx.textContent = `S${i + 1}`;
    wrap.appendChild(idx);

    const v = sensorVPD(s);
    if (Number.isFinite(v)) {
      const t = document.createElementNS(SVG_NS, 'text');
      t.setAttribute('class', 'map-sensor__vpd');
      t.setAttribute('x', String(s.xFt + SENSOR_RADIUS_FT + 0.18));
      t.setAttribute('y', String(s.yFt + 0.45));
      t.setAttribute('font-size', '0.45');
      t.textContent = `${v.toFixed(2)} kPa`;
      wrap.appendChild(t);
    }
    g.appendChild(wrap);
  });
  return g;
}

function buildOverlayLayer(APP) {
  const g = document.createElementNS(SVG_NS, 'g');
  g.setAttribute('class', 'map-overlay');

  // Selection handles for the currently selected element. Domain class
  // names are passed through so the existing CSS rules (.map-handle,
  // .map-handle--bound, .map-handle--point) keep applying.
  const sel = currentSelection(APP);
  if (sel) {
    if (sel.type === 'equipment' || sel.type === 'zone') {
      const r = (sel.type === 'equipment')
        ? { x: sel.el.xFt, y: sel.el.yFt, w: sel.el.wFt, h: sel.el.hFt }
        : rectFromCorners(sel.el);
      buildRectHandles(g, sel.type, sel.el.id, r, {
        handleSize: HANDLE_RADIUS_FT,
        handleClass: 'map-handle'
      });
    } else if (sel.type === 'duct') {
      const equipById = byId(APP.equipmentModules);
      const a = ductOriginPoint(sel.el, equipById);
      buildBoundMarker(g, a.x, a.y, {
        size: HANDLE_RADIUS_FT / 2,
        className: 'map-handle map-handle--bound'
      });
      buildPointHandle(g, 'duct', sel.el.id, sel.el.x2Ft, sel.el.y2Ft, {
        knob: 'b',
        handleSize: HANDLE_RADIUS_FT / 2 + 0.05,
        handleClass: 'map-handle'
      });
    } else if (sel.type === 'register') {
      buildPointHandle(g, 'register', sel.el.id, sel.el.xFt, sel.el.yFt, {
        handleSize: HANDLE_RADIUS_FT,
        handleClass: 'map-handle map-handle--point'
      });
    } else if (sel.type === 'sensor') {
      buildPointHandle(g, 'sensor', sel.el.id, sel.el.xFt, sel.el.yFt, {
        handleSize: HANDLE_RADIUS_FT,
        handleClass: 'map-handle map-handle--point'
      });
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
    case 'sensor': {
      placeSensor(snapped, APP);
      e.preventDefault();
      return;
    }
    case 'duct': {
      // Tapping another equipment module while the Duct tool is active
      // re-targets the source instead of dropping a duct — saves the user
      // from leaving the tool, picking Select, switching equipment, and
      // coming back. Handle hits already returned earlier.
      if (hit && hit.kind !== 'handle' && hit.type === 'equipment') {
        _api.setUI({ selectedId: hit.id, selectedType: 'equipment' });
        e.preventDefault();
        return;
      }
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
    case 'move-sensor':
      applyMoveSensor(_gesture, snapped);
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

function placeSensor(pt, APP) {
  const s = {
    id: newId('sn'),
    xFt: pt.x, yFt: pt.y,
    tdb: null, rh: null
  };
  _api.setState({
    sensors: [...(APP.sensors || []), s],
    selectedId: s.id, selectedType: 'sensor',
    activeTool: 'select'
  });
}

function placeDuctAndRegister(pt, APP) {
  // Source is the currently selected equipment module. The Duct tool's
  // hint tells the user to select one first; if they didn't, this is a
  // no-op so a stray tap doesn't drop a phantom duct from nowhere.
  const source = (APP.selectedType === 'equipment')
    ? (APP.equipmentModules || []).find((m) => m.id === APP.selectedId)
    : null;
  if (!source) return;

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
  // Drop back to Select after each placement so a stray double-tap
  // can't bloom an accidental fan of ducts. Equipment stays selected,
  // so adding another run is one tap on the Duct tool away.
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
    case 'sensor': {
      const s = (APP.sensors || []).find((x) => x.id === hit.id);
      if (!s) return;
      _gesture = {
        kind: 'move-sensor', pointerId: e.pointerId,
        id: s.id,
        offset: { x: pt.x - s.xFt, y: pt.y - s.yFt }
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
  } else if (type === 'sensor' && knob === 'move') {
    const s = (APP.sensors || []).find((x) => x.id === id);
    if (!s) return;
    _api.setUI({ selectedId: id, selectedType: 'sensor', activeTool: 'select' });
    _gesture = {
      kind: 'move-sensor', pointerId: e.pointerId, id,
      offset: { x: pt.x - s.xFt, y: pt.y - s.yFt }
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

function applyMoveSensor(g, snapped) {
  const APP = _api.getState();
  const s = (APP.sensors || []).find((x) => x.id === g.id);
  if (!s) return;
  let nx = snapValue(snapped.x - g.offset.x, APP.nudgeStep);
  let ny = snapValue(snapped.y - g.offset.y, APP.nudgeStep);
  nx = clamp(nx, 0, APP.roomLen);
  ny = clamp(ny, 0, APP.roomWid);
  if (approxEq(nx, s.xFt) && approxEq(ny, s.yFt)) return;
  _api.setState({
    sensors: APP.sensors.map((x) => x.id === s.id ? { ...x, xFt: nx, yFt: ny } : x)
  });
}

// ── Nudge dispatch ────────────────────────────────────────────────────
// Single entry point for the on-screen D-pad. Each tap moves the current
// selection by APP.nudgeStep in one cardinal direction. For ducts only
// the B (terminal) endpoint moves — the A endpoint is bound to the
// parent equipment. For zones/equipment/registers the whole element moves.
function nudgeSelected(direction) {
  const APP = _api.getState();
  const sel = currentSelection(APP);
  if (!sel) return;
  const step = (Number.isFinite(APP.nudgeStep) && APP.nudgeStep > 0) ? APP.nudgeStep : 0.5;
  let dx = 0, dy = 0;
  if (direction === 'n') dy = -step;
  if (direction === 's') dy =  step;
  if (direction === 'w') dx = -step;
  if (direction === 'e') dx =  step;
  if (dx === 0 && dy === 0) return;

  switch (sel.type) {
    case 'equipment': nudgeEquipment(APP, sel.el, dx, dy); break;
    case 'zone':      nudgeZone(APP, sel.el, dx, dy); break;
    case 'duct':      nudgeDuctEnd(APP, sel.el, dx, dy); break;
    case 'register':  nudgeRegister(APP, sel.el, dx, dy); break;
    case 'sensor':    nudgeSensor(APP, sel.el, dx, dy); break;
  }
}

function nudgeEquipment(APP, m, dx, dy) {
  const newX = clamp(m.xFt + dx, 0, APP.roomLen - m.wFt);
  const newY = clamp(m.yFt + dy, 0, APP.roomWid - m.hFt);
  if (approxEq(newX, m.xFt) && approxEq(newY, m.yFt)) return;
  applyEquipmentDelta(APP, m.id, newX - m.xFt, newY - m.yFt);
}

function nudgeZone(APP, z, dx, dy) {
  const r = rectFromCorners(z);
  const newX = clamp(r.x + dx, 0, APP.roomLen - r.w);
  const newY = clamp(r.y + dy, 0, APP.roomWid - r.h);
  if (approxEq(newX, r.x) && approxEq(newY, r.y)) return;
  const updated = {
    ...z,
    x1Ft: newX, y1Ft: newY,
    x2Ft: newX + r.w, y2Ft: newY + r.h
  };
  _api.setState({ zones: APP.zones.map((x) => x.id === z.id ? updated : x) });
}

function nudgeDuctEnd(APP, d, dx, dy) {
  const nx = clamp(d.x2Ft + dx, 0, APP.roomLen);
  const ny = clamp(d.y2Ft + dy, 0, APP.roomWid);
  if (approxEq(nx, d.x2Ft) && approxEq(ny, d.y2Ft)) return;
  const ducts = APP.ducts.map((x) => x.id === d.id ? { ...x, x2Ft: nx, y2Ft: ny } : x);
  const registers = APP.registers.map((r) =>
    r.ductId === d.id ? { ...r, xFt: nx, yFt: ny } : r
  );
  _api.setState({ ducts, registers });
}

function nudgeRegister(APP, r, dx, dy) {
  const nx = clamp(r.xFt + dx, 0, APP.roomLen);
  const ny = clamp(r.yFt + dy, 0, APP.roomWid);
  if (approxEq(nx, r.xFt) && approxEq(ny, r.yFt)) return;
  const registers = APP.registers.map((x) => x.id === r.id ? { ...x, xFt: nx, yFt: ny } : x);
  let ducts = APP.ducts;
  if (r.ductId) {
    ducts = APP.ducts.map((d) => d.id === r.ductId ? { ...d, x2Ft: nx, y2Ft: ny } : d);
  }
  _api.setState({ registers, ducts });
}

function nudgeSensor(APP, s, dx, dy) {
  const nx = clamp(s.xFt + dx, 0, APP.roomLen);
  const ny = clamp(s.yFt + dy, 0, APP.roomWid);
  if (approxEq(nx, s.xFt) && approxEq(ny, s.yFt)) return;
  const sensors = APP.sensors.map((x) => x.id === s.id ? { ...x, xFt: nx, yFt: ny } : x);
  _api.setState({ sensors });
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

// ── Edit panel ────────────────────────────────────────────────────────
function renderEditPanel(APP) {
  const panel = document.getElementById('map-edit-panel');
  const body  = document.getElementById('edit-panel-body');
  const title = document.getElementById('edit-panel-title');
  const delBtn = document.getElementById('edit-panel-delete');
  const stepEl = document.getElementById('map-nudge-step');
  if (!panel || !body || !title || !delBtn) return;

  const sel = currentSelection(APP);
  if (!sel) {
    panel.hidden = true;
    body.innerHTML = '';
    _renderedPanelKey = null;
    return;
  }
  panel.hidden = false;
  if (stepEl) stepEl.textContent = `${APP.nudgeStep} ft`;

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
    case 'sensor':    return sensorPanelTitle(sel.el);
    default:          return 'Element';
  }
}

function sensorPanelTitle(s) {
  const APP = _api.getState();
  const i = (APP.sensors || []).findIndex((x) => x.id === s.id);
  return `Sensor ${i >= 0 ? `S${i + 1}` : ''}`.trim();
}

function buildPanelForm(sel) {
  const wrap = document.createElement('div');
  wrap.className = 'edit-panel__grid';
  switch (sel.type) {
    case 'equipment': return buildEquipmentForm(wrap, sel.el);
    case 'zone':      return buildZoneForm(wrap, sel.el);
    case 'duct':      return buildDuctForm(wrap, sel.el);
    case 'register':  return buildRegisterForm(wrap, sel.el);
    case 'sensor':    return buildSensorForm(wrap, sel.el);
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

function buildSensorForm(wrap, s) {
  wrap.innerHTML = `
    <label class="edit-row"><span>X (ft)</span><input type="number" step="0.5" data-bind="xFt"></label>
    <label class="edit-row"><span>Y (ft)</span><input type="number" step="0.5" data-bind="yFt"></label>
    <label class="edit-row"><span>Temp (&deg;F)</span><input type="number" step="0.1" inputmode="decimal" data-bind="tdb"></label>
    <label class="edit-row"><span>RH (%)</span><input type="number" step="0.1" min="0" max="100" inputmode="decimal" data-bind="rh"></label>
    <div class="edit-row edit-row--wide edit-row--note">VPD <span class="edit-row__vpd" data-sensor-vpd>&mdash;</span></div>
  `;
  syncSensorInputs(wrap, s);
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

}

function onPanelInput(sel, el) {
  const APP = _api.getState();
  const bind = el.dataset.bind;

  // Sensor reading inputs accept blank → null so a user can clear a value.
  // Position inputs (xFt/yFt) still treat blank as mid-edit.
  if (sel.type === 'sensor' && (bind === 'tdb' || bind === 'rh')) {
    onSensorReadingInput(APP, sel.el, bind, el.value);
    return;
  }

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

  if (sel.type === 'sensor') {
    const s = (APP.sensors || []).find((x) => x.id === sel.el.id);
    if (!s) return;
    let nx = s.xFt, ny = s.yFt;
    if (bind === 'xFt') nx = clamp(value, 0, APP.roomLen);
    if (bind === 'yFt') ny = clamp(value, 0, APP.roomWid);
    if (approxEq(nx, s.xFt) && approxEq(ny, s.yFt)) return;
    _api.setState({
      sensors: APP.sensors.map((x) => x.id === s.id ? { ...x, xFt: nx, yFt: ny } : x)
    });
    return;
  }
}

function onSensorReadingInput(APP, sensor, bind, raw) {
  const s = (APP.sensors || []).find((x) => x.id === sensor.id);
  if (!s) return;
  const trimmed = String(raw ?? '').trim();
  let value;
  if (trimmed === '') {
    value = null;
  } else {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    value = (bind === 'rh') ? clamp(n, 0, 100) : n;
  }
  if (s[bind] === value) return;
  _api.setState({
    sensors: APP.sensors.map((x) => x.id === s.id ? { ...x, [bind]: value } : x)
  });
}

function syncPanelInputs(body, sel) {
  switch (sel.type) {
    case 'equipment': syncEquipmentInputs(body, sel.el); break;
    case 'zone':      syncZoneInputs(body, sel.el); break;
    case 'duct':      syncDuctInputs(body, sel.el); break;
    case 'register':  syncRegisterInputs(body, sel.el); break;
    case 'sensor':    syncSensorInputs(body, sel.el); break;
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

function syncSensorInputs(body, s) {
  setInputVal(body, 'xFt', s.xFt);
  setInputVal(body, 'yFt', s.yFt);
  setSensorReadingInput(body, 'tdb', s.tdb);
  setSensorReadingInput(body, 'rh',  s.rh);

  const APP = _api.getState();
  const stage = stageBand(APP.stage);
  const status = sensorStatus(s, stage);
  const vpdEl = body.querySelector('[data-sensor-vpd]');
  if (vpdEl) {
    const v = sensorVPD(s);
    vpdEl.classList.remove('is-low', 'is-in', 'is-high', 'is-unread');
    if (Number.isFinite(v)) {
      const tag = (status === 'low')  ? 'LOW'
                : (status === 'high') ? 'HIGH'
                : (status === 'in')   ? 'IN RANGE' : '';
      vpdEl.textContent = `${v.toFixed(2)} kPa  ${tag}`.trim();
      vpdEl.classList.add(`is-${status}`);
    } else {
      vpdEl.textContent = '—';
      vpdEl.classList.add('is-unread');
    }
  }
}

// Reading inputs allow blank — typing user shouldn't be reset to a stored
// number while clearing the field. setInputVal writes '' when value is null,
// which would clobber an in-progress edit. This variant skips writes when
// the input is focused or when the stored value is null and the input is empty.
function setSensorReadingInput(body, bind, value) {
  const el = body.querySelector(`[data-bind="${bind}"]`);
  if (!el) return;
  if (document.activeElement === el) return;
  if (value == null) {
    if (el.value !== '') el.value = '';
    return;
  }
  const v = roundForInput(value);
  if (el.value !== v) el.value = v;
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
    case 'sensor':    return deleteSensor(APP, sel.el.id);
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

function deleteSensor(APP, id) {
  _api.setState({
    sensors: (APP.sensors || []).filter((s) => s.id !== id),
    selectedId: null, selectedType: null
  });
}

// ── Domain helpers ────────────────────────────────────────────────────
// (Pure geometry / DOM helpers live in ciab.js. Items below depend on
//  Demeter's state shape or domain rules and stay here.)
function roomReady(APP) {
  return Number.isFinite(APP.roomLen) && APP.roomLen > 0
      && Number.isFinite(APP.roomWid) && APP.roomWid > 0;
}

// Clamp a point inside the current room. Thin wrapper over ciab.clampToBox
// so callers don't have to assemble the box themselves on every call.
function clampToRoom(p, APP) {
  return clampToBox(p, { maxX: APP.roomLen, maxY: APP.roomWid });
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

// ── Sensor helpers ────────────────────────────────────────────────────
function sensorVPD(s) {
  if (!Number.isFinite(s?.tdb) || !Number.isFinite(s?.rh)) return null;
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

// ── Sensor readings table ─────────────────────────────────────────────
function renderSensorTable(APP) {
  const body = document.getElementById('sensor-table-body');
  if (!body) return;
  const sensors = APP.sensors || [];
  const stage = stageBand(APP.stage);

  if (sensors.length === 0) {
    body.innerHTML = '<div class="sensor-table__empty">No sensors placed.</div>';
    return;
  }

  const focused = document.activeElement;
  const focusInfo = readSensorTableFocus(focused);
  const voided = c9Failed(APP.checklistState);

  body.innerHTML = '';
  sensors.forEach((s, i) => {
    const isSel = (APP.selectedType === 'sensor' && APP.selectedId === s.id);
    const status = voided ? 'unread' : sensorStatus(s, stage);
    const v = sensorVPD(s);

    const row = document.createElement('div');
    row.className = `sensor-table__row${isSel ? ' is-selected' : ''}`;
    row.dataset.sensorId = s.id;
    row.innerHTML = `
      <span class="sensor-table__label">S${i + 1}</span>
      <input type="number" step="0.1" inputmode="decimal" data-sensor-bind="tdb" aria-label="Temperature (°F)">
      <input type="number" step="0.1" min="0" max="100" inputmode="decimal" data-sensor-bind="rh" aria-label="Relative humidity (%)">
      <span class="sensor-table__vpd is-${status}">${Number.isFinite(v) ? v.toFixed(2) : '—'}</span>
      <button type="button" class="btn btn--ghost btn--quiet btn--danger sensor-table__del" data-sensor-del>Delete</button>
    `;
    const tdbEl = row.querySelector('[data-sensor-bind="tdb"]');
    const rhEl  = row.querySelector('[data-sensor-bind="rh"]');
    if (s.tdb != null && document.activeElement !== tdbEl) tdbEl.value = roundForInput(s.tdb);
    if (s.rh  != null && document.activeElement !== rhEl)  rhEl.value  = roundForInput(s.rh);

    tdbEl.addEventListener('input', (e) => {
      onSensorReadingInput(_api.getState(), s, 'tdb', e.target.value);
    });
    rhEl.addEventListener('input', (e) => {
      onSensorReadingInput(_api.getState(), s, 'rh', e.target.value);
    });
    row.addEventListener('pointerdown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.closest('[data-sensor-del]')) return;
      _api.setUI({ selectedId: s.id, selectedType: 'sensor' });
    });
    row.querySelector('[data-sensor-del]').addEventListener('click', () => {
      deleteSensor(_api.getState(), s.id);
    });

    body.appendChild(row);
  });

  restoreSensorTableFocus(body, focusInfo);
}

function readSensorTableFocus(el) {
  if (!el || !el.dataset || !el.dataset.sensorBind) return null;
  const row = el.closest('.sensor-table__row');
  if (!row) return null;
  return {
    id: row.dataset.sensorId,
    bind: el.dataset.sensorBind,
    selStart: el.selectionStart,
    selEnd:   el.selectionEnd
  };
}

function restoreSensorTableFocus(body, info) {
  if (!info) return;
  const row = body.querySelector(`[data-sensor-id="${info.id}"]`);
  if (!row) return;
  const el = row.querySelector(`[data-sensor-bind="${info.bind}"]`);
  if (!el) return;
  el.focus();
  try { el.setSelectionRange(info.selStart, info.selEnd); } catch (_) {}
}

// ── Spatial summary ───────────────────────────────────────────────────
function renderSpatialSummary(APP) {
  const facts  = document.getElementById('spatial-facts');
  const vpdBox = document.getElementById('spatial-vpd');
  const cov    = document.getElementById('coverage-notes');
  const grp    = document.getElementById('airflow-group');

  const sensors = APP.sensors || [];

  if (facts) {
    if (sensors.length === 0) {
      facts.hidden = true;
      facts.innerHTML = '';
    } else {
      facts.hidden = false;
      const area = canopyArea(APP.zones);
      const spacing = meanNearestNeighborDistance(sensors);
      const perHundred = (area > 0) ? (sensors.length / area) * 100 : null;
      facts.innerHTML = `
        <div class="spatial-fact"><span class="spatial-fact__label">Sensors</span><span class="spatial-fact__value">${sensors.length}</span></div>
        <div class="spatial-fact"><span class="spatial-fact__label">Canopy area</span><span class="spatial-fact__value">${area.toFixed(1)} sq ft</span></div>
        <div class="spatial-fact"><span class="spatial-fact__label">Mean spacing</span><span class="spatial-fact__value">${spacing == null ? '—' : `${spacing.toFixed(1)} ft`}</span></div>
        <div class="spatial-fact"><span class="spatial-fact__label">Per 100 sq ft</span><span class="spatial-fact__value">${perHundred == null ? '—' : perHundred.toFixed(1)}</span></div>
      `;
    }
  }

  if (vpdBox) {
    const voided = c9Failed(APP.checklistState);
    const stats = getMeasuredVPDStats(APP);
    if (voided) {
      vpdBox.hidden = false;
      vpdBox.classList.remove('is-wide-range');
      vpdBox.classList.add('is-voided');
      vpdBox.innerHTML = `
        <div class="spatial-vpd__void">
          <strong>VOID</strong>
          <span>Sensor validity not established. Reported VPD values cannot be assumed to represent canopy conditions. See C9.</span>
        </div>
      `;
    } else if (!stats || stats.count < 2) {
      vpdBox.hidden = true;
      vpdBox.innerHTML = '';
      vpdBox.classList.remove('is-wide-range', 'is-voided');
    } else {
      vpdBox.classList.remove('is-voided');
      vpdBox.hidden = false;
      const pct = stats.count > 0 ? Math.round((stats.inRangeCount / stats.count) * 100) : 0;
      const wide = stats.range > RANGE_FLAG_KPA;
      vpdBox.classList.toggle('is-wide-range', wide);
      const flag = wide
        ? '<div class="spatial-vpd__flag">Wide distribution — investigate airflow balance.</div>'
        : '';
      vpdBox.innerHTML = `
        <div class="spatial-vpd__row">
          <div class="spatial-fact"><span class="spatial-fact__label">Min</span><span class="spatial-fact__value">${stats.min.toFixed(2)} kPa</span></div>
          <div class="spatial-fact"><span class="spatial-fact__label">Mean</span><span class="spatial-fact__value">${stats.mean.toFixed(2)} kPa</span></div>
          <div class="spatial-fact"><span class="spatial-fact__label">Max</span><span class="spatial-fact__value">${stats.max.toFixed(2)} kPa</span></div>
          <div class="spatial-fact"><span class="spatial-fact__label">Range</span><span class="spatial-fact__value">${stats.range.toFixed(2)} kPa</span></div>
          <div class="spatial-fact"><span class="spatial-fact__label">In range</span><span class="spatial-fact__value">${stats.inRangeCount} / ${stats.count} (${pct}%)</span></div>
        </div>
        ${flag}
      `;
    }
  }

  if (cov && document.activeElement !== cov) {
    const v = APP.coverageNotes || '';
    if (cov.value !== v) cov.value = v;
  }

  if (grp) {
    grp.querySelectorAll('[data-airflow]').forEach((btn) => {
      const active = (btn.dataset.airflow === APP.airflowConfidence);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-checked', String(active));
    });
  }
}

// ── Multi-tier UI ─────────────────────────────────────────────────────
function tierLabel(t, count) {
  if (count === 2) return t === 1 ? 'Top' : 'Bottom';
  if (count === 3) {
    if (t === 1) return 'Top';
    if (t === 2) return 'Middle';
    return 'Bottom';
  }
  return `T${t}`;
}

function activeTierSensors(APP) {
  const ts = APP.tierSensors || {};
  const count = clamp(Number(APP.tierCount) || MIN_TIERS, MIN_TIERS, MAX_TIERS);
  const out = [];
  for (let t = 1; t <= count; t++) {
    const arr = Array.isArray(ts[t]) ? ts[t] : [];
    for (const s of arr) out.push(s);
  }
  return out;
}

function renderTierConfig(APP) {
  const sel = document.getElementById('tier-count');
  if (sel) {
    const want = String(clamp(Number(APP.tierCount) || MIN_TIERS, MIN_TIERS, MAX_TIERS));
    if (sel.value !== want && document.activeElement !== sel) sel.value = want;
  }
  const lighting = APP.lighting || 'led';
  document.querySelectorAll('[data-lighting]').forEach((btn) => {
    const active = btn.dataset.lighting === lighting;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', String(active));
  });
}

function renderTierGroups(APP) {
  const root = document.getElementById('tier-groups');
  if (!root) return;

  const focusInfo = readTierFocus(document.activeElement);
  const tierCount = clamp(Number(APP.tierCount) || MIN_TIERS, MIN_TIERS, MAX_TIERS);
  const stage = stageBand(APP.stage);
  const voided = c9Failed(APP.checklistState);
  const ts = APP.tierSensors || {};
  // Preserve open/closed state across renders so a typing user doesn't
  // see the active group collapse mid-keystroke.
  const openState = readTierOpenState(root);

  root.innerHTML = '';
  for (let t = 1; t <= tierCount; t++) {
    const list = Array.isArray(ts[t]) ? ts[t] : [];
    root.appendChild(buildTierGroup(t, tierCount, list, stage, voided, openState));
  }
  restoreTierFocus(root, focusInfo);
}

function readTierOpenState(root) {
  const map = {};
  for (const det of root.querySelectorAll('details.tier-group')) {
    map[det.dataset.tier] = det.open;
  }
  return map;
}

function buildTierGroup(t, count, list, stage, voided, openState) {
  const det = document.createElement('details');
  det.className = 'tier-group';
  det.dataset.tier = String(t);
  // Default open on first render; preserve user's prior open/closed choice.
  det.open = (openState && (String(t) in openState)) ? openState[String(t)] : true;

  const summary = document.createElement('summary');
  summary.className = 'tier-group__head';
  const countLabel = list.length === 1 ? '1 sensor' : `${list.length} sensors`;
  const subLabel = (count <= 3) ? `T${t}` : '';
  summary.innerHTML = `
    <span class="tier-group__title">${tierLabel(t, count)}${
      subLabel ? ` <span class="tier-group__sub">(${subLabel})</span>` : ''
    }</span>
    <span class="tier-group__count">${countLabel}</span>
  `;
  det.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'tier-group__body';

  const head = document.createElement('div');
  head.className = 'tier-rows__head';
  head.innerHTML = `
    <span>Point</span>
    <span>Position</span>
    <span>Temp (°F)</span>
    <span>RH (%)</span>
    <span>VPD (kPa)</span>
    <span></span>
  `;
  body.appendChild(head);

  if (list.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'tier-rows__empty';
    empty.textContent = 'No sensors yet — tap + Sensor to add.';
    body.appendChild(empty);
  } else {
    const rows = document.createElement('div');
    rows.className = 'tier-rows';
    for (let i = 0; i < list.length; i++) {
      rows.appendChild(buildTierSensorRow(t, i, list[i], stage, voided));
    }
    body.appendChild(rows);
  }

  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'btn btn--ghost tier-add';
  add.textContent = '+ Sensor';
  add.dataset.tier = String(t);
  add.addEventListener('click', () => addTierSensor(t));
  body.appendChild(add);

  // Per-tier summary: in-range / mean / min / max / range, with
  // within-tier-gradient flag when range exceeds the spec threshold.
  // Under C9 fail the measured state is VOID — per-tier VPD aggregates
  // are still part of measured state, so they're suppressed here. The
  // header bar carries the VOID statement; per-row VPD is already
  // greyed by the voided flag in buildTierSensorRow.
  const vpds = [];
  let inR = 0;
  for (const s of list) {
    const v = sensorVPD(s);
    if (!Number.isFinite(v)) continue;
    vpds.push(v);
    if (stage && v >= stage.vpdMin && v <= stage.vpdMax) inR++;
  }
  if (!voided && vpds.length >= 1) {
    const min  = Math.min(...vpds);
    const max  = Math.max(...vpds);
    const mean = vpds.reduce((a, b) => a + b, 0) / vpds.length;
    const range = max - min;
    const wide = range > RANGE_FLAG_KPA;
    const sumDiv = document.createElement('div');
    sumDiv.className = 'tier-summary' + (wide ? ' is-wide-range' : '');
    sumDiv.innerHTML = `
      <div class="tier-summary__row">
        <span class="tier-summary__cell"><b>${inR}</b>/${vpds.length} in range</span>
        <span class="tier-summary__cell">min ${min.toFixed(2)}</span>
        <span class="tier-summary__cell">mean ${mean.toFixed(2)}</span>
        <span class="tier-summary__cell">max ${max.toFixed(2)}</span>
        <span class="tier-summary__cell">range ${range.toFixed(2)} kPa</span>
      </div>
      ${wide ? '<p class="tier-summary__flag">Within-tier gradient — supply-end vs return-end imbalance suspected.</p>' : ''}
    `;
    body.appendChild(sumDiv);
  }

  det.appendChild(body);
  return det;
}

function buildTierSensorRow(t, i, s, stage, voided) {
  const row = document.createElement('div');
  row.className = 'tier-row';
  row.dataset.tier = String(t);
  row.dataset.sensorId = s.id;

  const v = sensorVPD(s);
  const status = voided ? 'unread' : sensorStatus(s, stage);

  row.innerHTML = `
    <span class="tier-row__label">T${t}&middot;S${i + 1}</span>
    <select class="tier-row__pos" data-tier-bind="position" aria-label="Position on tier">
      <option value="head">Head</option>
      <option value="mid">Middle</option>
      <option value="tail">Tail</option>
    </select>
    <input type="number" step="0.1" inputmode="decimal" data-tier-bind="tdb" aria-label="Temperature">
    <input type="number" step="0.1" min="0" max="100" inputmode="decimal" data-tier-bind="rh" aria-label="Relative humidity (%)">
    <span class="tier-row__vpd is-${status}">${Number.isFinite(v) ? v.toFixed(2) : '—'}</span>
    <button type="button" class="btn btn--ghost btn--quiet btn--danger tier-row__del">Delete</button>
  `;

  const sel = row.querySelector('[data-tier-bind="position"]');
  sel.value = s.position || 'mid';
  sel.addEventListener('change', () => setTierSensorField(t, s.id, 'position', sel.value));

  const tdbEl = row.querySelector('[data-tier-bind="tdb"]');
  const rhEl  = row.querySelector('[data-tier-bind="rh"]');
  if (Number.isFinite(s.tdb) && document.activeElement !== tdbEl) tdbEl.value = roundForInput(s.tdb);
  if (Number.isFinite(s.rh)  && document.activeElement !== rhEl)  rhEl.value  = roundForInput(s.rh);

  tdbEl.addEventListener('input', (e) => onTierReadingInput(t, s.id, 'tdb', e.target.value));
  rhEl.addEventListener('input',  (e) => onTierReadingInput(t, s.id, 'rh',  e.target.value));

  row.querySelector('.tier-row__del').addEventListener('click', () => deleteTierSensor(t, s.id));
  return row;
}

function addTierSensor(t) {
  const APP = _api.getState();
  const all = { ...(APP.tierSensors || {}) };
  const list = Array.isArray(all[t]) ? all[t].slice() : [];
  list.push({ id: newId(), position: 'mid', tdb: null, rh: null });
  all[t] = list;
  _api.setState({ tierSensors: all });
}

function deleteTierSensor(t, id) {
  const APP = _api.getState();
  const all = { ...(APP.tierSensors || {}) };
  const list = (Array.isArray(all[t]) ? all[t] : []).filter((s) => s.id !== id);
  all[t] = list;
  _api.setState({ tierSensors: all });
}

function setTierSensorField(t, id, field, value) {
  const APP = _api.getState();
  const all = { ...(APP.tierSensors || {}) };
  const list = (Array.isArray(all[t]) ? all[t] : []).map((s) =>
    s.id === id ? { ...s, [field]: value } : s
  );
  if (list === all[t]) return;
  all[t] = list;
  _api.setState({ tierSensors: all });
}

function onTierReadingInput(t, id, field, raw) {
  const trimmed = String(raw ?? '').trim();
  let value;
  if (trimmed === '') {
    value = null;
  } else {
    const n = Number(trimmed);
    if (!Number.isFinite(n)) return;
    value = (field === 'rh') ? clamp(n, 0, 100) : n;
  }
  setTierSensorField(t, id, field, value);
}

function readTierFocus(el) {
  if (!el || !el.dataset || !el.dataset.tierBind) return null;
  const row = el.closest('.tier-row');
  if (!row) return null;
  return {
    tier: row.dataset.tier,
    id:   row.dataset.sensorId,
    bind: el.dataset.tierBind,
    selStart: el.selectionStart,
    selEnd:   el.selectionEnd
  };
}

function restoreTierFocus(root, info) {
  if (!info) return;
  const row = root.querySelector(`.tier-row[data-tier="${info.tier}"][data-sensor-id="${info.id}"]`);
  if (!row) return;
  const el = row.querySelector(`[data-tier-bind="${info.bind}"]`);
  if (!el) return;
  el.focus();
  // Selects don't support setSelectionRange; only attempt on inputs.
  if (typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(info.selStart, info.selEnd); } catch (_) {}
  }
}

// ── Public stats helpers (orchestrator wires header readout in Phase 6) ─
// In multi-tier mode the header VPD readout aggregates over every tier's
// sensors; per-tier roll-ups stay in renderTierGroups. Single-tier reads
// the floor-plan sensors as before.
export function getMeasuredVPDStats(APP) {
  const stage = stageBand(APP.stage);
  const sourceList = (APP.mapMode === 'multi')
    ? activeTierSensors(APP)
    : (APP.sensors || []);

  const values = [];
  let inRange = 0;
  for (const s of sourceList) {
    const v = sensorVPD(s);
    if (!Number.isFinite(v)) continue;
    values.push(v);
    if (stage && v >= stage.vpdMin && v <= stage.vpdMax) inRange++;
  }
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  return {
    count: values.length,
    total: sourceList.length,
    min, max, mean,
    range: max - min,
    inRangeCount: inRange,
    stageBandLabel: stage ? stage.label : null
  };
}

export function getMeasuredVPDLabel(APP) {
  const stats = getMeasuredVPDStats(APP);
  if (!stats) return '—';
  const stage = stageBand(APP.stage);
  const v = stats.mean;
  if (!stage) return `${v.toFixed(2)} kPa`;
  if (v < stage.vpdMin) return `${v.toFixed(2)} kPa  LOW`;
  if (v > stage.vpdMax) return `${v.toFixed(2)} kPa  HIGH`;
  return `${v.toFixed(2)} kPa  IN RANGE`;
}

function currentSelection(APP) {
  if (!APP.selectedType || !APP.selectedId) return null;
  let el = null;
  switch (APP.selectedType) {
    case 'equipment': el = (APP.equipmentModules || []).find((x) => x.id === APP.selectedId); break;
    case 'duct':      el = (APP.ducts || []).find((x) => x.id === APP.selectedId); break;
    case 'register':  el = (APP.registers || []).find((x) => x.id === APP.selectedId); break;
    case 'zone':      el = (APP.zones || []).find((x) => x.id === APP.selectedId); break;
    case 'sensor':    el = (APP.sensors || []).find((x) => x.id === APP.selectedId); break;
  }
  if (!el) return null;
  return { type: APP.selectedType, el };
}
