/**
 * tools/shared/gas.js — fuel gas pipe sizing (IFGC 2021 Section 402, Appendix A).
 *
 * Pure functions, no DOM. Tested by tools/shared/gas.test.mjs (run with node).
 * Schedule 40 metallic pipe only. CSST and other listed systems are sized
 * from the manufacturer's tables (402.3(2)).
 *
 * Longest length method (402.4.1, A103.1):
 *   - one length for the whole system: point of delivery to the most remote
 *     outlet, plus a fittings allowance where a run has four or more fittings;
 *   - use the table row at that length, or the next LONGER row (never
 *     interpolate); that row sizes every section;
 *   - each section carries the total input of the appliances downstream of it;
 *     pick the first size whose capacity in the row is at least that load.
 */
import { TABLES } from './gas-tables.js';

const ok = (v) => typeof v === 'number' && Number.isFinite(v);
const DEFAULT_HV = 1000;   // Btu/ft³; A102.1: get the actual value from the gas supplier

/* Table A102.2 L/d' ratios (n) for screwed fittings: equivalent length = n × ID(in) / 12 ft. */
const FITTINGS = [
  { key: 'ell90', name: '90° elbow', n: 30 },
  { key: 'tee', name: 'Tee', n: 60 },
  { key: 'ell45', name: '45° elbow', n: 14 }
];

/** Row index for a length: the exact row or the next longer one. Null beyond the table. */
function rowFor(table, lengthFt) {
  if (!ok(lengthFt) || lengthFt <= 0) return null;
  const i = table.lengths.findIndex((L) => L >= lengthFt - 1e-9);
  return i < 0 ? null : i;
}

/** Load in the table's own unit: CFH for natural gas (Btu/h ÷ heating value), kBtu/h for propane. */
function demand(gas, btuh, heatingValue = DEFAULT_HV) {
  if (!ok(btuh) || btuh < 0) return null;
  if (gas === 'lp') return btuh / 1000;
  if (!ok(heatingValue) || heatingValue <= 0) return null;
  return btuh / heatingValue;
}

/** Equivalent length of counted fittings at a given pipe size (Table A102.2). */
function fittingsLength(counts, idIn) {
  let L = 0;
  for (const f of FITTINGS) { const c = counts && counts[f.key]; if (ok(c) && c > 0) L += c * f.n * idIn / 12; }
  return L;
}
const fittingsCount = (counts) => FITTINGS.reduce((s, f) => s + (counts && ok(counts[f.key]) && counts[f.key] > 0 ? counts[f.key] : 0), 0);

/** Smallest size whose capacity in the row ≥ load. */
function pick(table, row, load) {
  const caps = table.cap[row];
  for (let j = 0; j < caps.length; j++) if (caps[j] !== null && caps[j] >= load - 1e-9) return { j, size: table.sizes[j], capacity: caps[j] };
  return null;
}

/**
 * Size a whole system.
 * input = { gas: 'ng'|'lp', heatingValue?, lengthFt, fittings?: {ell90, tee, ell45},
 *           sections: [{ name, btuh }] }
 * Fittings are on the longest run; their equivalent length is taken at the
 * largest pipe size the run ends up using (iterated), which is conservative.
 */
function sizeSystem(input) {
  const gas = input.gas === 'lp' ? 'lp' : 'ng';
  const table = TABLES[gas];
  const hv = gas === 'ng' ? (ok(input.heatingValue) ? input.heatingValue : DEFAULT_HV) : null;
  if (gas === 'ng' && !(hv > 0)) return { ok: false, reason: 'heating value must be a positive number' };
  if (!ok(input.lengthFt) || input.lengthFt <= 0) return { ok: false, reason: 'enter the longest length' };
  const fits = input.fittings || {};
  if (FITTINGS.some((f) => ok(fits[f.key]) && fits[f.key] < 0)) return { ok: false, reason: "fitting counts can't be negative" };
  // Sections keep their order; one with no load comes back marked empty.
  const sections = (input.sections || []).map((s) => ({ name: s && s.name, btuh: s && ok(s.btuh) ? s.btuh : 0 }));
  if (sections.some((s) => s.btuh < 0)) return { ok: false, reason: "loads can't be negative" };
  if (!sections.some((s) => s.btuh > 0)) return { ok: false, reason: 'enter at least one appliance input' };

  const nFit = fittingsCount(fits);
  const useFittings = nFit >= 4;                    // A103.1 step 1: four or more fittings
  let fitLen = 0, fitAt = null, result = null;
  for (let pass = 0; pass < 6; pass++) {
    const total = input.lengthFt + fitLen;
    const row = rowFor(table, total);
    if (row === null) return { ok: false, reason: `${Math.round(total)} ft is beyond the table (${table.lengths[table.lengths.length - 1]} ft); this needs an engineered design`, beyond: true };
    const out = sections.map((s) => {
      if (!(s.btuh > 0)) return { name: s.name, btuh: 0, load: 0, size: null, capacity: null, j: null, over: false, empty: true };
      const load = demand(gas, s.btuh, hv);
      const p = pick(table, row, load);
      return { name: s.name, btuh: s.btuh, load, size: p ? p.size : null, capacity: p ? p.capacity : null, j: p ? p.j : null, over: !p };
    });
    result = { row, rowLength: table.lengths[row], totalLength: total, sections: out };
    if (!useFittings) break;
    const maxJ = Math.max(...out.filter((o) => !o.empty).map((o) => (o.j === null ? table.sizes.length - 1 : o.j)));
    const next = fittingsLength(fits, table.id[maxJ]);
    if (Math.abs(next - fitLen) < 1e-9) break;
    fitLen = next; fitAt = table.sizes[maxJ];
  }
  return {
    ok: true, gas, table: table.table, title: table.title, unit: table.unit, heatingValue: hv,
    measuredLength: input.lengthFt, fittingsCounted: nFit, fittingsApplied: useFittings, fittingsLength: fitLen, fittingsAt: fitAt,
    ...result,
    rowCapacities: table.sizes.map((s, j) => ({ size: s, capacity: table.cap[result.row][j] })),
    source: `${table.table}; IFGC 402.4.1 and Appendix A103.1 (longest length, next longer row)`
  };
}

export { TABLES, FITTINGS, DEFAULT_HV, rowFor, demand, fittingsLength, sizeSystem };
