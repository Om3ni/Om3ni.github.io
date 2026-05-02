// Project Demeter — Report module.
// Pure builders + a thin DOM layer for the Report tab. The generator
// emits ASCII for XOI-pasteability; no unicode separators, no emojis.

import {
  CHECKLIST_GROUPS,
  C9_DETAIL,
  getItemState,
  defaultItemState,
  c9Failed,
  flatItems
} from './checklist.js';

import {
  STAGES,
  stageBand,
  calcVPD,
  toC,
  rhForVpd,
  meanNearestNeighborDistance,
  canopyArea
} from './math.js';

import { openPrintReport } from './print.js';

const COL_WIDTH = 64;
const RULE_1 = '================================================================';
const RULE_2 = '----------------------------------------------------------------';

const FAIL_DOMAIN_WORD = {
  A: 'distribution',
  B: 'equipment',
  C: 'controls/sensing',
  D: 'envelope',
  E: 'pressurization',
  F: 'heat-rejection',
  G: 'design/commissioning'
};

const VIABILITY_LABEL = {
  COMMISSIONED: 'COMMISSIONED',
  FUNCTIONAL:   'FUNCTIONAL',
  DEFICIENT:    'DEFICIENT',
  'NOT VERIFIED': 'NOT VERIFIED'
};

// ── Pure helpers ───────────────────────────────────────────────────────────

function pad(s, n) {
  s = String(s ?? '');
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function padLeft(s, n) {
  s = String(s ?? '');
  if (s.length >= n) return s;
  return ' '.repeat(n - s.length) + s;
}

function fmtNum(n, digits) {
  if (!Number.isFinite(n)) return '--';
  return n.toFixed(digits);
}

function fmtTemp(t, unitF) {
  if (!Number.isFinite(t)) return '--';
  return unitF ? `${t.toFixed(1)}F` : `${t.toFixed(1)}C`;
}

function fmtPercent(n) {
  if (!Number.isFinite(n)) return '--';
  return `${n.toFixed(0)}%`;
}

function wrap(text, width, indent) {
  const ind = indent || '';
  if (text == null) return '';
  const words = String(text).replace(/\s+/g, ' ').trim().split(' ');
  if (!words[0]) return '';
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur.length) {
      cur = w;
    } else if ((cur.length + 1 + w.length) <= width) {
      cur += ' ' + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur.length) lines.push(cur);
  return lines.map((ln, i) => (i === 0 ? ln : ind + ln)).join('\n');
}

function wrapBlock(text, width, indent) {
  const ind = indent || '';
  if (text == null || String(text).trim() === '') return ind + '--';
  const paragraphs = String(text).split(/\r?\n/);
  return paragraphs.map((p) => {
    if (!p.trim()) return '';
    return ind + wrap(p, width - ind.length, ind);
  }).join('\n');
}

function formatTimestamp(iso) {
  if (!iso) return '--';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December'];
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mm = String(m).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} - ${h}:${mm} ${ampm}`;
}

// ── Snapshot computations ──────────────────────────────────────────────────

function computeSensorVPD(sensor, unitF) {
  const tdb = sensor.tdb;
  const rh  = sensor.rh;
  if (!Number.isFinite(tdb) || !Number.isFinite(rh)) return null;
  const tC = unitF ? toC(tdb) : tdb;
  return calcVPD(tC, rh, 2);
}

function vpdStatusLabel(vpd, band) {
  if (!Number.isFinite(vpd) || !band) return '--';
  if (vpd < band.vpdMin) return 'LOW';
  if (vpd > band.vpdMax) return 'HIGH';
  return 'IN RANGE';
}

function computeMeasured(snapshot) {
  const md = snapshot.mapData;
  const sensors = Array.isArray(md.sensors) ? md.sensors : [];
  if (!sensors.length) return null;

  const band = stageBand(snapshot.metadata.stage);
  const unitF = snapshot.metadata.unitF !== false;

  let withReadings = [];
  for (const s of sensors) {
    const vpd = computeSensorVPD(s, unitF);
    if (Number.isFinite(vpd)) withReadings.push({ s, vpd });
  }
  if (!withReadings.length) {
    return { count: sensors.length, withReadingsCount: 0, band };
  }

  const vpds = withReadings.map((r) => r.vpd);
  const min = Math.min(...vpds);
  const max = Math.max(...vpds);
  const mean = vpds.reduce((a, b) => a + b, 0) / vpds.length;
  const range = max - min;
  let inRangeCount = 0;
  if (band) {
    for (const v of vpds) {
      if (v >= band.vpdMin && v <= band.vpdMax) inRangeCount++;
    }
  }

  return {
    count: sensors.length,
    withReadingsCount: withReadings.length,
    min, mean, max, range,
    inRangeCount,
    stageBandLabel: band ? band.label : '--',
    stageBandLow: band ? band.vpdMin : null,
    stageBandHigh: band ? band.vpdMax : null,
    band
  };
}

function failureGroupKeys(failedItems) {
  const set = new Set();
  for (const f of failedItems) set.add(f.group);
  const order = ['A','B','C','D','E','F','G'];
  return order.filter((k) => set.has(k));
}

function collectFailedItems(checklistState) {
  const out = [];
  for (const it of flatItems()) {
    const st = getItemState(checklistState, it.id);
    if (st.status === 'fail') {
      out.push({
        id: it.id,
        group: it.group,
        name: it.name,
        priority: it.priority,
        fail: it.fail,
        method: it.method,
        agiq: it.agiq,
        status: st.status,
        evidenceBasis: st.evidenceBasis,
        note: st.note
      });
    }
  }
  return out;
}

// Resolve viability per spec table; precedence high → low.
export function computeViability(snapshot) {
  const cs = snapshot.checklistState || {};
  let hasCriticalOrHighFail = false;
  let hasCriticalOrHighOpen = false;
  let b5Pass = false;

  for (const it of flatItems()) {
    const st = getItemState(cs, it.id);
    const high = (it.priority === 'Critical' || it.priority === 'High');
    if (high && st.status === 'fail') hasCriticalOrHighFail = true;
    if (high && (st.status == null)) hasCriticalOrHighOpen = true;
    if (it.id === 'B5' && st.status === 'pass') b5Pass = true;
  }

  if (hasCriticalOrHighFail) return 'DEFICIENT';
  if (hasCriticalOrHighOpen) return 'NOT VERIFIED';
  if (b5Pass) return 'COMMISSIONED';
  return 'FUNCTIONAL';
}

export function computeViabilityLabel(snapshot) {
  return VIABILITY_LABEL[computeViability(snapshot)] || 'NOT VERIFIED';
}

// Distinguish "checklist exercised, no failures found" from "checklist
// not yet exercised at all". Empty failure arrays alone can't tell the
// two apart, which is why the report sections below consult this before
// emitting "No failures recorded." A null or missing item.status counts
// as open (not evaluated) — matches the implicit state model where null
// means OPEN, and pass/fail/na are the three evaluated outcomes.
function evaluationStats(checklistState) {
  let evaluated = 0;
  let open = 0;
  let total = 0;

  for (const it of flatItems()) {
    total++;
    const st = getItemState(checklistState, it.id);
    if (!st || st.status == null) {
      open++;
    } else {
      evaluated++;
    }
  }

  return { evaluated, open, total };
}

export function reportC9Failed(snapshotOrChecklistState) {
  if (!snapshotOrChecklistState) return false;
  if (snapshotOrChecklistState.checklistState) {
    return c9Failed(snapshotOrChecklistState.checklistState);
  }
  return c9Failed(snapshotOrChecklistState);
}

// ── Snapshot builder ───────────────────────────────────────────────────────

export function buildSnapshot(APP) {
  const generatedAt = new Date().toISOString();

  const metadata = {
    customer: APP.customer || '',
    facility: APP.facility || '',
    room: APP.room || '',
    equipmentModel: APP.equipmentModel || '',
    equipmentSerial: APP.equipmentSerial || '',
    equipmentNotes: APP.equipmentNotes || '',
    tech: APP.tech || '',
    date: APP.date || '',
    narrative: APP.narrative || '',
    stage: typeof APP.stage === 'number' ? APP.stage : 0,
    lights: APP.lights || 'on',
    unitF: APP.unitF !== false
  };

  const mapData = {
    roomLen: APP.roomLen ?? null,
    roomWid: APP.roomWid ?? null,
    mapMode: APP.mapMode || 'single',
    airflowConfidence: APP.airflowConfidence || 'UNKNOWN',
    coverageNotes: APP.coverageNotes || '',
    sensors: Array.isArray(APP.sensors) ? APP.sensors.map((s) => ({ ...s })) : [],
    zones: Array.isArray(APP.zones) ? APP.zones.map((z) => ({ ...z })) : [],
    equipmentModules: Array.isArray(APP.equipmentModules)
      ? APP.equipmentModules.map((m) => ({ ...m })) : [],
    ducts: Array.isArray(APP.ducts) ? APP.ducts.map((d) => ({ ...d })) : [],
    registers: Array.isArray(APP.registers) ? APP.registers.map((r) => ({ ...r })) : [],
    tierCount: APP.tierCount ?? 2,
    lighting: APP.lighting || 'led',
    tierSensors: APP.tierSensors ? JSON.parse(JSON.stringify(APP.tierSensors)) : {}
  };

  const checklistState = APP.checklistState
    ? JSON.parse(JSON.stringify(APP.checklistState)) : {};

  const baseSnap = { generatedAt, metadata, mapData, checklistState };
  const measured = computeMeasured(baseSnap);
  const area = canopyArea(mapData.zones);
  const meanSpacing = meanNearestNeighborDistance(mapData.sensors);
  const sensorsPer100 = (area > 0 && mapData.sensors.length > 0)
    ? (mapData.sensors.length * 100 / area) : null;

  const failed = collectFailedItems(checklistState);
  const groupKeys = failureGroupKeys(failed);
  const c9 = c9Failed(checklistState);
  const viability = computeViability(baseSnap);

  const computed = {
    measuredVPD: measured,
    canopyArea: area,
    meanSensorSpacing: meanSpacing,
    sensorsPer100SqFt: sensorsPer100,
    failedItems: failed,
    failureGroupKeys: groupKeys,
    c9Failed: c9,
    viability
  };

  const snap = { generatedAt, metadata, mapData, checklistState, computed };
  const text = generateTextReport(snap);
  snap.text = text;
  return Object.freeze(snap);
}

// ── Section renderers ──────────────────────────────────────────────────────

function sectionHeader(title) {
  return `${title}\n${RULE_2}`;
}

function renderHeader(snap) {
  const m = snap.metadata;
  const lines = [];
  lines.push('PROJECT DEMETER');
  lines.push(RULE_1);
  lines.push(`Generated:        ${formatTimestamp(snap.generatedAt)}`);
  lines.push(`Technician:       ${m.tech || '--'}`);
  const cf = [m.customer || '--', m.facility || '--'].join(' / ');
  lines.push(`Client/Facility:  ${cf}`);
  lines.push(`Room:             ${m.room || '--'}`);
  return lines.join('\n');
}

function renderSiteInfo(snap) {
  const m = snap.metadata;
  const stage = stageBand(m.stage);
  const lightsLabel = m.lights === 'transition'
    ? 'TRANSITION'
    : (m.lights || 'on');
  const lines = [sectionHeader('SITE INFORMATION')];

  const rows = [
    ['Customer',          m.customer],
    ['Facility',          m.facility],
    ['Room',              m.room],
    ['Equipment Model',   m.equipmentModel],
    ['Equipment Serial',  m.equipmentSerial]
  ];
  for (const [k, v] of rows) {
    lines.push(`${pad(k + ':', 20)}${v || '--'}`);
  }

  // Equipment notes — wrapped, hanging indent.
  const notesLabel = pad('Equipment Notes:', 20);
  if (m.equipmentNotes && m.equipmentNotes.trim()) {
    const wrapped = wrap(m.equipmentNotes, 60, ' '.repeat(20));
    lines.push(`${notesLabel}${wrapped}`);
  } else {
    lines.push(`${notesLabel}--`);
  }

  lines.push(`${pad('Growth Stage:', 20)}${stage ? stage.label : '--'}`);
  lines.push(`${pad('Lights Cycle:', 20)}${lightsLabel}`);
  lines.push(`${pad('Technician:', 20)}${m.tech || '--'}`);
  lines.push(`${pad('Date:', 20)}${m.date || '--'}`);
  lines.push(`${pad('Field Narrative:', 20)}(see Section 11)`);

  if (m.lights === 'transition') {
    lines.push('');
    lines.push('Note: lights transition state - see Final Assessment caveat.');
  }
  return lines.join('\n');
}

function renderMeasured(snap) {
  const lines = [sectionHeader('MEASURED ENVIRONMENTAL STATE')];
  if (snap.computed.c9Failed) {
    lines.push('*** VOID ***');
    lines.push('Sensor validity not established. Reported VPD values cannot be');
    lines.push('assumed to represent canopy conditions. See C9 in Site Checklist.');
    return lines.join('\n');
  }

  const m = snap.computed.measuredVPD;
  if (!m || !m.withReadingsCount || m.withReadingsCount < 1) {
    lines.push('Insufficient sensor data to characterize measured state.');
    return lines.join('\n');
  }

  const status = vpdStatusLabel(m.mean, m.band);
  const meanLine = `${pad('Mean VPD:', 24)}${fmtNum(m.mean, 2)} kPa  (${status})`;
  lines.push(meanLine);

  let rangeLine = `${pad('Spatial Range:', 24)}${fmtNum(m.range, 2)} kPa`;
  if (m.range > 0.3) rangeLine += '  (WIDE - investigate airflow balance)';
  lines.push(rangeLine);

  const pct = m.withReadingsCount > 0
    ? Math.round(100 * m.inRangeCount / m.withReadingsCount) : 0;
  lines.push(`${pad('In-Range Sensors:', 24)}${m.inRangeCount}/${m.withReadingsCount} (${pct}%)`);

  if (m.band) {
    lines.push(`${pad('Target VPD Band:', 24)}${fmtNum(m.band.vpdMin, 2)} - ${fmtNum(m.band.vpdMax, 2)} kPa (${m.band.label})`);

    // Target RH at the mean dry-bulb across sensors with readings.
    const sensors = snap.mapData.sensors || [];
    const unitF = snap.metadata.unitF !== false;
    const tdbs = sensors
      .map((s) => s.tdb)
      .filter((t) => Number.isFinite(t));
    if (tdbs.length) {
      const meanT = tdbs.reduce((a, b) => a + b, 0) / tdbs.length;
      const meanTC = unitF ? toC(meanT) : meanT;
      const targetVpd = (m.band.vpdMin + m.band.vpdMax) / 2;
      const rh = rhForVpd(meanTC, targetVpd, 2);
      lines.push(`${pad('Target RH at Mean Tdb:', 24)}${fmtPercent(rh)} (at band midpoint)`);
    }
  }

  return lines.join('\n');
}

function renderViability(snap) {
  const lines = [sectionHeader('SYSTEM VIABILITY')];
  const v = snap.computed.viability;
  lines.push(`Status: ${VIABILITY_LABEL[v] || v}`);

  const evals = evaluationStats(snap.checklistState);
  if (v === 'NOT VERIFIED' && evals.open > 0) {
    lines.push(`Open Checklist Items: ${evals.open}/${evals.total}`);
  }

  lines.push('');

  let vpdState = 'not characterized';
  if (!snap.computed.c9Failed && snap.computed.measuredVPD
      && snap.computed.measuredVPD.withReadingsCount >= 1) {
    const status = vpdStatusLabel(
      snap.computed.measuredVPD.mean, snap.computed.measuredVPD.band);
    if (status === 'IN RANGE') vpdState = 'within target VPD range';
    else if (status === 'LOW') vpdState = 'below target VPD range';
    else if (status === 'HIGH') vpdState = 'above target VPD range';
    else vpdState = 'not characterized';
  } else if (snap.computed.c9Failed) {
    vpdState = 'reported as VOID (sensor validity not established)';
  }

  let para = `The room is currently ${vpdState}, however system viability is ${v}.`;
  const groups = snap.computed.failureGroupKeys || [];
  if (groups.length) {
    const words = groups.map((k) => FAIL_DOMAIN_WORD[k]).filter(Boolean);
    para += ` Measured conditions cannot be assumed stable due to ${words.join(', ')}.`;
  }
  lines.push(wrap(para, COL_WIDTH, ''));

  if (snap.metadata.lights === 'transition') {
    lines.push('');
    lines.push(wrap(
      'Survey performed during sunrise/sunset transition; measured values reflect a non-steady-state period.',
      COL_WIDTH, ''));
  }
  return lines.join('\n');
}

function renderSpatialSingle(snap) {
  const lines = [sectionHeader('SPATIAL DATA - SINGLE TIER')];
  const md = snap.mapData;
  const c = snap.computed;
  const m = c.measuredVPD;
  const unitF = snap.metadata.unitF !== false;
  const band = m && m.band ? m.band : null;

  lines.push(`${pad('Sensor Count:', 24)}${md.sensors.length}`);
  lines.push(`${pad('Canopy Area:', 24)}${fmtNum(c.canopyArea, 1)} sq ft`);
  lines.push(`${pad('Mean Sensor Spacing:', 24)}${
    Number.isFinite(c.meanSensorSpacing) ? `${fmtNum(c.meanSensorSpacing, 2)} ft (mean nearest-neighbor)` : '--'}`);
  lines.push(`${pad('Density:', 24)}${
    Number.isFinite(c.sensorsPer100SqFt)
      ? `${fmtNum(c.sensorsPer100SqFt, 2)} sensors per 100 sq ft` : '--'}`);

  lines.push('');
  lines.push('Sensor Table:');
  lines.push('  Point  Pos (X, Y)     Temp     RH      VPD       Status     Basis');
  lines.push('  -----  -------------  -------  ------  --------  ---------  -----------');

  // Per-sensor evidence basis comes off the sensor record itself
  // (added in the post-Phase-8 schema fix). When a sensor has a reading
  // but no basis recorded, default to 'Measured'; with no reading,
  // surface 'Not Verified' regardless of stored basis since there's
  // nothing to attest to.
  for (let i = 0; i < md.sensors.length; i++) {
    const s = md.sensors[i];
    const label = s.label || `S${i + 1}`;
    const xy = `(${fmtNum(s.xFt, 1)}, ${fmtNum(s.yFt, 1)})`;
    const tdbStr = Number.isFinite(s.tdb) ? fmtTemp(s.tdb, unitF) : '--';
    const rhStr = Number.isFinite(s.rh) ? `${fmtNum(s.rh, 0)}%` : '--';
    const vpd = computeSensorVPD(s, unitF);
    const vpdStr = Number.isFinite(vpd) ? `${fmtNum(vpd, 2)} kPa` : '--';
    const status = Number.isFinite(vpd) && band ? vpdStatusLabel(vpd, band) : '--';
    const basis = Number.isFinite(vpd)
      ? (s.evidenceBasis || 'Measured')
      : 'Not Verified';
    lines.push(
      '  ' + pad(label, 5)
      + '  ' + pad(xy, 13)
      + '  ' + pad(tdbStr, 7)
      + '  ' + pad(rhStr, 6)
      + '  ' + pad(vpdStr, 8)
      + '  ' + pad(status, 9)
      + '  ' + basis
    );
  }
  if (!md.sensors.length) lines.push('  (no sensors recorded)');

  lines.push('');
  if (m && m.withReadingsCount >= 1) {
    lines.push(`${pad('VPD Summary:', 24)}min / mean / max / range`);
    lines.push(`${pad('', 24)}${fmtNum(m.min, 2)} / ${fmtNum(m.mean, 2)} / ${fmtNum(m.max, 2)} / ${fmtNum(m.range, 2)} kPa`);
  } else {
    lines.push(`${pad('VPD Summary:', 24)}--`);
  }

  lines.push('');
  lines.push('Coverage Notes:');
  lines.push(wrapBlock(md.coverageNotes, COL_WIDTH, '  '));

  lines.push('');
  lines.push(`${pad('Airflow Confidence:', 24)}${md.airflowConfidence || 'UNKNOWN'}`);
  return lines.join('\n');
}

function renderSpatialMulti(snap) {
  const lines = [sectionHeader('SPATIAL DATA - MULTI TIER')];
  const md = snap.mapData;
  const ts = md.tierSensors || {};
  const tierKeys = Object.keys(ts).sort((a, b) => Number(a) - Number(b));

  lines.push(`${pad('Tier Count:', 24)}${md.tierCount}`);
  lines.push(`${pad('Lighting:', 24)}${md.lighting}`);
  lines.push('');

  if (!tierKeys.length) {
    lines.push('Multi-tier mode: no per-tier sensors recorded yet.');
    return lines.join('\n');
  }

  const unitF = snap.metadata.unitF !== false;
  const band = stageBand(snap.metadata.stage);

  for (const t of tierKeys) {
    const arr = Array.isArray(ts[t]) ? ts[t] : [];
    lines.push(`Tier ${t}:`);
    lines.push('  Point  Pos    Temp     RH      VPD       Status     Basis');
    lines.push('  -----  -----  -------  ------  --------  ---------  -----------');
    let vpds = [];
    for (let i = 0; i < arr.length; i++) {
      const s = arr[i];
      const label = s.label || `T${t}-S${i + 1}`;
      const pos = (s.position || 'mid').toUpperCase();
      const tdbStr = Number.isFinite(s.tdb) ? fmtTemp(s.tdb, unitF) : '--';
      const rhStr = Number.isFinite(s.rh) ? `${fmtNum(s.rh, 0)}%` : '--';
      const vpd = computeSensorVPD(s, unitF);
      if (Number.isFinite(vpd)) vpds.push(vpd);
      const vpdStr = Number.isFinite(vpd) ? `${fmtNum(vpd, 2)} kPa` : '--';
      const status = Number.isFinite(vpd) && band ? vpdStatusLabel(vpd, band) : '--';
      const basis = Number.isFinite(vpd)
        ? (s.evidenceBasis || 'Measured')
        : 'Not Verified';
      lines.push(
        '  ' + pad(label, 5)
        + '  ' + pad(pos, 5)
        + '  ' + pad(tdbStr, 7)
        + '  ' + pad(rhStr, 6)
        + '  ' + pad(vpdStr, 8)
        + '  ' + pad(status, 9)
        + '  ' + basis
      );
    }
    if (!arr.length) lines.push('  (no sensors recorded for this tier)');

    if (vpds.length) {
      const min = Math.min(...vpds);
      const max = Math.max(...vpds);
      const mean = vpds.reduce((a, b) => a + b, 0) / vpds.length;
      const range = max - min;
      let inR = 0;
      if (band) for (const v of vpds) if (v >= band.vpdMin && v <= band.vpdMax) inR++;
      lines.push(`  Summary: in-range ${inR}/${vpds.length} | mean ${fmtNum(mean, 2)} kPa | range ${fmtNum(range, 2)} kPa`);
      if (range > 0.3) {
        lines.push('  Within-tier gradient - supply-end vs return-end imbalance suspected.');
      }
    }
    lines.push('');
  }

  // Multi-tier limitation note (per Spec §Multi-Tier Limitation Note).
  // The technician needs the AGIQ rationale in the report so the report
  // reader knows why no floor-plan map appears for multi-tier rooms.
  lines.push('Multi-Tier Limitation:');
  lines.push(wrap(
    'Spatial distribution within tiers is partially evaluated via head/middle/tail position tagging but no floor-plan map is rendered. Each tier is treated as an independent environmental zone.',
    COL_WIDTH, ''));
  lines.push('');
  lines.push(wrap(
    'AGIQ: Multi-tier rooms must be sensed independently per tier - tiers are supplied by different equipment and may experience different conditions.',
    COL_WIDTH, ''));

  return lines.join('\n').trimEnd();
}

function renderSpatial(snap) {
  if (snap.mapData.mapMode === 'multi') return renderSpatialMulti(snap);
  return renderSpatialSingle(snap);
}

function moduleEvidenceBasis(m) {
  // Stored on the record post-schema-fix; the synthesis fallback below
  // matches the pre-fix behavior so reports built from records that
  // somehow skipped migration still produce a reasonable value.
  if (m && m.evidenceBasis) return m.evidenceBasis;
  if (m.model || m.serial || m.unitType || m.reheatType) return 'Observed';
  return 'Inferred';
}

function renderEquipment(snap) {
  const lines = [sectionHeader('EQUIPMENT LAYOUT')];
  const md = snap.mapData;
  const mods = md.equipmentModules || [];
  lines.push(`${mods.length} equipment module${mods.length === 1 ? '' : 's'} placed.`);

  if (mods.length) {
    lines.push('');
    lines.push('  Module   Type     Pos (X,Y)     Size (WxH)   Model                Serial          Reheat        Comm.   Internet  Basis');
    lines.push('  -------  -------  ------------  -----------  -------------------  --------------  ------------  ------  --------  -----------');
    for (let i = 0; i < mods.length; i++) {
      const m = mods[i];
      const id = m.label || `EQ-${i + 1}`;
      const type = (m.type || '').toLowerCase() === 'return' ? 'Return' : 'Supply';
      const pos = `(${fmtNum(m.xFt, 1)},${fmtNum(m.yFt, 1)})`;
      const size = `(${fmtNum(m.wFt, 1)}x${fmtNum(m.hFt, 1)})`;
      const model = m.model || '--';
      const serial = m.serial || '--';
      const reheat = m.reheatType || '--';
      const comm = m.commissioningPresent ? 'yes' : 'no';
      const inet = m.internetConnected ? 'yes' : 'no';
      const basis = moduleEvidenceBasis(m);
      lines.push(
        '  ' + pad(id, 7)
        + '  ' + pad(type, 7)
        + '  ' + pad(pos, 12)
        + '  ' + pad(size, 11)
        + '  ' + pad(model.slice(0, 19), 19)
        + '  ' + pad(serial.slice(0, 14), 14)
        + '  ' + pad(reheat.slice(0, 12), 12)
        + '  ' + pad(comm, 6)
        + '  ' + pad(inet, 8)
        + '  ' + basis
      );
    }
  }

  // Duct runs.
  lines.push('');
  const ducts = md.ducts || [];
  lines.push(`Duct Runs:`);
  lines.push(`  ${ducts.length} run${ducts.length === 1 ? '' : 's'} total.`);
  for (let i = 0; i < ducts.length; i++) {
    const d = ducts[i];
    const parent = mods.find((m) => m.id === d.equipmentId);
    const parentLabel = parent ? (parent.label || `EQ-${mods.indexOf(parent) + 1}`) : 'unknown';
    const parentType = parent
      ? ((parent.type || '').toLowerCase() === 'return' ? 'Return' : 'Supply')
      : '--';
    lines.push(`  D-${i + 1}: from ${parentLabel} (${parentType}) -> terminus at (${fmtNum(d.x2Ft, 1)}, ${fmtNum(d.y2Ft, 1)})`);
  }

  // Registers.
  lines.push('');
  const regs = md.registers || [];
  lines.push(`Registers:`);
  lines.push(`  ${regs.length} register${regs.length === 1 ? '' : 's'} placed.`);
  for (let i = 0; i < regs.length; i++) {
    const r = regs[i];
    const id = r.label || `R-${i + 1}`;
    const tag = r.ductId ? `[auto from D-${ducts.findIndex((d) => d.id === r.ductId) + 1}]` : '[independent]';
    lines.push(`  ${id}: at (${fmtNum(r.xFt, 1)}, ${fmtNum(r.yFt, 1)})  ${tag}`);
  }
  return lines.join('\n');
}

function statusLabel(s) {
  if (s.status === 'pass') return 'PASS';
  if (s.status === 'fail') return 'FAIL';
  if (s.status === 'na')   return 'N/A';
  return 'OPEN';
}

function renderChecklistSection(snap) {
  const lines = [sectionHeader('SITE CHECKLIST')];
  const cs = snap.checklistState || {};

  for (const g of CHECKLIST_GROUPS) {
    lines.push('');
    lines.push(`GROUP ${g.key} - ${g.title.replace(/^[A-Z] - /, '').replace(/^[A-Z] — /, '')}`);
    lines.push(RULE_2);

    for (const it of g.items) {
      const st = cs[it.id] ? cs[it.id] : defaultItemState();
      const status = statusLabel(st);
      const basis = st.evidenceBasis || (st.status == null ? 'Not Verified' : 'Not Verified');

      lines.push('');
      lines.push(`${it.id}  ${wrap(it.name, COL_WIDTH - 4, '    ')}`);
      lines.push(`    Status: ${pad(status, 6)}  Priority: ${pad(it.priority, 9)}  Basis: ${basis}`);
      if (st.note && st.note.trim()) {
        lines.push('    Field Note:');
        lines.push(wrapBlock(st.note, COL_WIDTH, '      '));
      } else {
        lines.push('    (no field note)');
      }
      // C9 gets the extended detail block (per spec §Tab 3 → Group C9
      // detail), trimmed of the AGIQ citation. The on-screen checklist
      // still shows AGIQ refs as technician documentation; the report
      // is the customer-facing artifact and stays manufacturer-neutral.
      if (it.id === 'C9') {
        lines.push('    Failure mode:');
        lines.push(wrapBlock(C9_DETAIL.failureMode, COL_WIDTH, '      '));
        lines.push('    Method:');
        lines.push(wrapBlock(C9_DETAIL.method, COL_WIDTH, '      '));
        lines.push('    Field note required on fail:');
        lines.push(wrapBlock(C9_DETAIL.fieldNoteOnFail, COL_WIDTH, '      '));
      }
    }
  }
  return lines.join('\n');
}

function renderFailureSummary(snap) {
  const lines = [sectionHeader('FAILURE MODE SUMMARY')];
  const fails = snap.computed.failedItems || [];

  const evals = evaluationStats(snap.checklistState);
  if (!evals.evaluated) {
    lines.push('No evaluations performed.');
    return lines.join('\n');
  }

  if (!fails.length) {
    lines.push('No failures recorded.');
    return lines.join('\n');
  }

  for (const f of fails) {
    lines.push('');
    const titleLine = `X ${f.id}  ${f.name}`;
    const priLine = `Priority: ${f.priority}`;
    // Title with priority right-aligned (best effort within 78 cols).
    if (titleLine.length + priLine.length + 4 <= 78) {
      lines.push(titleLine + ' '.repeat(78 - titleLine.length - priLine.length) + priLine);
    } else {
      lines.push(titleLine);
      lines.push('  ' + priLine);
    }
    lines.push('');
    const existing = (f.note && f.note.trim())
      ? f.note.trim()
      : '(observed by technician on site)';
    const required = `must be true that ${f.name}.`;
    lines.push('  Existing Condition:');
    lines.push(wrapBlock(existing, COL_WIDTH, '    '));
    lines.push('  Required Condition:');
    lines.push(wrapBlock(required, COL_WIDTH, '    '));
    lines.push('  Impact:');
    lines.push(wrapBlock(f.fail || '--', COL_WIDTH, '    '));
    lines.push('  Basis:           ' + (f.evidenceBasis || 'Not Verified'));
    lines.push('  Field Note:');
    lines.push(wrapBlock(f.note || '--', COL_WIDTH, '    '));
  }
  return lines.join('\n');
}

function renderRetests(snap) {
  const lines = [sectionHeader('RETEST REQUIREMENTS')];
  const fails = snap.computed.failedItems || [];

  const evals = evaluationStats(snap.checklistState);
  if (!evals.evaluated) {
    lines.push('No evaluations performed. Retest requirements cannot be determined.');
    return lines.join('\n');
  }

  if (!fails.length) {
    lines.push('No failures recorded. No retests required.');
    return lines.join('\n');
  }
  const failedIds = new Set(fails.map((f) => f.id));
  const groups = new Set(fails.map((f) => f.group));

  const items = [];

  if (groups.has('A')) {
    items.push([
      'Distribution (Group A) failures:',
      'Full spatial remap required.',
      'Min basis on retest: Measured.'
    ]);
  }
  if (failedIds.has('C4') || failedIds.has('C5') || failedIds.has('C6')) {
    items.push([
      'Sensor placement (C4-C6) failures:',
      'Re-measure at canopy height with corrected housing/location.',
      'Min basis: Measured.'
    ]);
  }
  if (failedIds.has('C9')) {
    items.push([
      'Sensor validity (C9) failure:',
      'Correct sensor housing or location, then re-validate against aspirated reference under operating conditions before re-measuring room state. Room VPD measurements taken prior to C9 correction are void and cannot inform viability assessment.',
      'Min basis: Measured.'
    ]);
  }
  if (failedIds.has('C1') || failedIds.has('C2') || failedIds.has('C3')
      || failedIds.has('C7') || failedIds.has('C8')) {
    items.push([
      'Control sequence (C1-C3 / C7-C8) failures:',
      'Test lights-on and lights-off cycle independently.',
      'Min basis: Observed.'
    ]);
  }
  if (groups.has('E')) {
    items.push([
      'Pressurization (Group E) failures:',
      'Verify full pressure cascade.',
      'Min basis: Measured.'
    ]);
  }
  if (groups.has('B')) {
    items.push([
      'Equipment / documentation (Group B) failures:',
      'Verification required before further action - retrieve commissioning report / submittals / equipment data plates.',
      'Min basis: Documented.'
    ]);
  }
  if (groups.has('F')) {
    items.push([
      'Heat rejection (Group F) failures:',
      'Inspect outdoor heat rejection device clearances and economizer seals.',
      'Min basis: Observed.'
    ]);
  }
  if (groups.has('G')) {
    items.push([
      'Design / commissioning (Group G) failures:',
      'Confirm original sizing inputs and unit-per-room redundancy.',
      'Min basis: Documented.'
    ]);
  }
  if (groups.has('D')) {
    items.push([
      'Envelope (Group D) failures:',
      'Inspect envelope continuity, seals, penetrations.',
      'Min basis: Observed.'
    ]);
  }

  for (const [head, body, basis] of items) {
    lines.push('');
    lines.push(head);
    lines.push(wrapBlock(body, COL_WIDTH, '  '));
    lines.push('  ' + basis);
  }
  return lines.join('\n');
}

function renderFinalAssessment(snap) {
  const lines = [sectionHeader('FINAL ASSESSMENT')];
  const c9 = snap.computed.c9Failed;
  const v = snap.computed.viability;

  if (c9) {
    lines.push('Measured Condition:  VOID - sensor validity not established.');
    lines.push('                     Reported VPD values cannot be assumed to');
    lines.push('                     represent canopy conditions.');
    lines.push(`System Condition:    ${VIABILITY_LABEL[v] || v}`);
    lines.push('');
    lines.push('Conclusion:');
    lines.push(wrap(
      'The system viability assessment stands independently of measured state. Sensor validity must be established before room conditions can be evaluated. See C9 retest requirements.',
      COL_WIDTH, ''));
    lines.push('');
    lines.push('Recommended Next Action:');
    lines.push(wrap(
      'Correct sensor validity per C9, re-validate, re-measure room state, then evaluate measured environmental state.',
      COL_WIDTH, ''));
  } else {
    const m = snap.computed.measuredVPD;
    let measuredCond;
    let vpdState;
    if (m && m.withReadingsCount >= 1) {
      const status = vpdStatusLabel(m.mean, m.band);
      const statusWord = status === 'IN RANGE' ? 'in range'
        : status === 'LOW' ? 'below target'
        : status === 'HIGH' ? 'above target' : 'not characterized';
      measuredCond = `Mean VPD ${fmtNum(m.mean, 2)} kPa, ${statusWord}, spatial range ${fmtNum(m.range, 2)} kPa.`;
      vpdState = statusWord === 'in range' ? 'within target VPD range'
        : statusWord === 'below target' ? 'below target VPD range'
        : statusWord === 'above target' ? 'above target VPD range'
        : 'not characterized';
    } else {
      measuredCond = 'Insufficient sensor data to characterize measured state.';
      vpdState = 'not characterized';
    }
    lines.push(`Measured Condition:  ${measuredCond}`);
    lines.push(`System Condition:    ${VIABILITY_LABEL[v] || v}`);
    lines.push('');
    lines.push('Conclusion:');
    let para = `The room is currently ${vpdState}, however system viability is ${v}.`;
    const groups = snap.computed.failureGroupKeys || [];
    if (groups.length) {
      const words = groups.map((k) => FAIL_DOMAIN_WORD[k]).filter(Boolean);
      para += ` Measured conditions cannot be assumed stable due to ${words.join(', ')}.`;
    } else {
      const evals = evaluationStats(snap.checklistState);
      if (!evals.evaluated) {
        para += ' System has not been evaluated.';
      } else {
        para += ' No failure modes recorded.';
      }
    }
    lines.push(wrap(para, COL_WIDTH, ''));
    lines.push('');
    lines.push('Recommended Next Action:');
    lines.push(wrap(
      'Correct system deficiencies and retest under operating load.',
      COL_WIDTH, ''));
  }

  if (snap.metadata.lights === 'transition') {
    lines.push('');
    lines.push(wrap(
      'Note: Survey performed during sunrise/sunset transition. Steady-state evaluation requires re-survey during stable lights-on or lights-off period.',
      COL_WIDTH, ''));
  }
  return lines.join('\n');
}

function renderNarrative(snap) {
  const lines = [sectionHeader('FIELD NARRATIVE')];
  const text = snap.metadata.narrative;
  if (!text || !text.trim()) {
    lines.push('--');
  } else {
    lines.push(wrapBlock(text, 70, ''));
  }
  return lines.join('\n');
}

function renderFooter() {
  return [
    RULE_1,
    '(c) Michael Seth Aaron - Project Demeter'
  ].join('\n');
}

// ── Public generator ───────────────────────────────────────────────────────

// Manufacturer-neutralization pass. AGIQ literature citations in the
// checklist (e.g. "AGIQ Ch.6: …", "AGIQ Fig 11.05: …") are documentation
// references and pass through verbatim. What this pass strips is anything
// that implies the report was co-produced with the manufacturer or that
// we're an agent of theirs: contact strings (AgronomicIQ.com, phone),
// endorsement phrasings ("preferred by AGIQ", "Every AGIQ unit"), and
// the "AGIQ Specific:" group label. Exported so the print/PDF report
// (print.js) can apply the same pass before HTML-escaping.
export function manufacturerSanitize(s) {
  return String(s)
    .replace(/AGIQ Specific:?\s*/g, '')
    .replace(/AGIQ remote monitoring/gi, 'remote monitoring')
    .replace(/AGIQ project file \(call 1-833-327-AGIQ\)/gi, 'project documentation')
    .replace(/AGIQ project file/gi, 'project documentation')
    .replace(/Cannot contact AGIQ for project file\.?/gi, 'Cannot retrieve project file.')
    .replace(/Request from AGIQ \(1-833-327-AGIQ\):?/gi, 'Required documentation:')
    .replace(/Water-cooled systems preferred by AGIQ\.?/gi,
             'Water-cooled systems preferred per design specification.')
    .replace(/preferred by AGIQ\b/gi, 'preferred per design specification')
    .replace(/AGIQ sizing input data retrievable/gi,
             'Sizing input data retrievable per design specification')
    .replace(/Every AGIQ unit/gi, 'Every unit')
    // Contact strings — the affiliation-implying parts of the
    // header/footer/method lines.
    .replace(/\bAgronomicIQ\.com\b/gi, '')
    .replace(/\b1-833-327-AGIQ\b/gi, '')
    .replace(/\bAgronomicIQ\b/gi, '')
    // Cleanup: collapse runs of whitespace, strip stray space before
    // terminal punctuation ("by ." -> "by."), drop empty parens
    // ("Document retrieval - ()" -> "Document retrieval -").
    .replace(/  +/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/  +/g, ' ');
}

// Final pass: strip non-ASCII glyphs so the report stays XOI-pasteable
// across every terminal/editor. The checklist source data and field-narrative
// inputs may carry em-dashes, smart quotes, arrows, and degree symbols;
// they map to plain ASCII equivalents here.
function asciiSanitize(s) {
  return String(s)
    .replace(/[—–−]/g, '-')   // em-dash, en-dash, minus
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/…/g, '...')
    .replace(/[→➔➡]/g, '->')
    .replace(/[←]/g, '<-')
    .replace(/°/g, ' deg ')
    .replace(/©/g, '(c)')
    .replace(/·/g, '-')
    .replace(/◆/g, '*')
    .replace(/°F/g, 'F')
    .replace(/°C/g, 'C')
    .replace(/°/g, '*')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, '?');
}

export function generateTextReport(snapshot) {
  const sections = [
    renderHeader(snapshot),
    renderSiteInfo(snapshot),
    renderMeasured(snapshot),
    renderViability(snapshot),
    renderSpatial(snapshot),
    renderEquipment(snapshot),
    renderChecklistSection(snapshot),
    renderFailureSummary(snapshot),
    renderRetests(snapshot),
    renderFinalAssessment(snapshot),
    renderNarrative(snapshot),
    renderFooter()
  ];
  return asciiSanitize(manufacturerSanitize(sections.join('\n\n'))) + '\n';
}

// ── DOM-touching layer ─────────────────────────────────────────────────────

let _api = null;

export function initReport(api) {
  _api = api;
  const gen = document.getElementById('btn-generate-report');
  const cpy = document.getElementById('btn-copy-report');
  const prn = document.getElementById('btn-print-report');
  if (gen) gen.addEventListener('click', onGenerate);
  if (cpy) cpy.addEventListener('click', onCopy);
  if (prn) prn.addEventListener('click', onPrint);
}

function onGenerate() {
  if (!_api) return;
  const APP = _api.getState();
  const snap = buildSnapshot(APP);
  if (typeof _api.commitReportSnapshot === 'function') {
    _api.commitReportSnapshot(snap);
  } else {
    // Soft fallback for pre-merge isolation: stash on APP via setState so
    // renderReport can find it. Orchestrator merge replaces this branch.
    if (typeof _api.setState === 'function') {
      _api.setState({ reportSnapshot: snap, reportGeneratedAt: snap.generatedAt });
    }
  }
}

function onCopy() {
  if (!_api) return;
  const APP = _api.getState();
  const snap = APP.reportSnapshot;
  if (!snap || !snap.text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(snap.text);
  }
}

function onPrint() {
  if (!_api) return;
  const APP = _api.getState();
  const snap = APP.reportSnapshot;
  if (!snap) return;
  // openPrintReport opens a popup synchronously to keep the user-gesture
  // context, then async-loads the rasterized heatmap before swapping in
  // the full report. Errors get logged in the popup's console.
  openPrintReport(snap).catch((err) => console.error('Print failed:', err));
}

function localTimestamp(iso) {
  if (!iso) return '--';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch (_) {
    return iso;
  }
}

export function renderReport() {
  if (!_api) return;
  const APP = _api.getState();
  const snap = APP.reportSnapshot;
  const body = document.getElementById('report-body');
  const status = document.getElementById('report-status');
  const cpy = document.getElementById('btn-copy-report');
  const prn = document.getElementById('btn-print-report');
  if (!body || !status) return;

  if (!snap) {
    body.textContent = 'No report yet - tap Generate Report to produce one.';
    status.textContent = 'Not generated yet.';
    if (cpy) cpy.disabled = true;
    if (prn) prn.disabled = true;
    return;
  }
  body.textContent = snap.text;
  status.textContent = `Last generated: ${localTimestamp(snap.generatedAt)}`;
  if (cpy) cpy.disabled = false;
  if (prn) prn.disabled = false;
}
