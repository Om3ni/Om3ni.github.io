/**
 * tools/shared/nec.js — NEC (NFPA 70, 2023) rules shared by Hermes electrical tools.
 *
 * Pure functions, no DOM. Tested by tools/shared/nec.test.mjs (run with node).
 * Every result carries the section it applies so tools can print the source.
 * The equipment nameplate always governs (110.3(B)); these are for checking a
 * nameplate, or for equipment without one.
 */

/* 240.6(A) standard ampere ratings for fuses and inverse-time breakers. */
const STANDARD_OCPD = [15, 20, 25, 30, 35, 40, 45, 50, 60, 70, 80, 90, 100, 110, 125, 150, 175, 200, 225, 250,
  300, 350, 400, 450, 500, 600, 700, 800, 1000, 1200, 1600, 2000, 2500, 3000, 4000, 5000, 6000];

/* Table 310.16 — not more than three current-carrying conductors, 30 °C (86 °F)
   ambient. [size, 60 °C, 75 °C, 90 °C] amperes. */
const AMPACITY = {
  cu: [['14 AWG', 15, 20, 25], ['12 AWG', 20, 25, 30], ['10 AWG', 30, 35, 40], ['8 AWG', 40, 50, 55], ['6 AWG', 55, 65, 75],
    ['4 AWG', 70, 85, 95], ['3 AWG', 85, 100, 115], ['2 AWG', 95, 115, 130], ['1 AWG', 110, 130, 145],
    ['1/0', 125, 150, 170], ['2/0', 145, 175, 195], ['3/0', 165, 200, 225], ['4/0', 195, 230, 260],
    ['250 kcmil', 215, 255, 290], ['300 kcmil', 240, 285, 320], ['350 kcmil', 260, 310, 350], ['400 kcmil', 280, 335, 380], ['500 kcmil', 320, 380, 430]],
  al: [['12 AWG', 15, 20, 25], ['10 AWG', 25, 30, 35], ['8 AWG', 35, 40, 45], ['6 AWG', 40, 50, 55],
    ['4 AWG', 55, 65, 75], ['3 AWG', 65, 75, 85], ['2 AWG', 75, 90, 100], ['1 AWG', 85, 100, 115],
    ['1/0', 100, 120, 135], ['2/0', 115, 135, 150], ['3/0', 130, 155, 175], ['4/0', 150, 180, 205],
    ['250 kcmil', 170, 205, 230], ['300 kcmil', 195, 230, 260], ['350 kcmil', 210, 250, 280], ['400 kcmil', 225, 270, 305], ['500 kcmil', 260, 310, 350]]
};
const TEMP_COL = { 60: 1, 75: 2, 90: 3 };

const ok = (v) => typeof v === 'number' && Number.isFinite(v);

/** Largest standard rating ≤ amps (maximums round down). Null below 15 A. */
function standardAtOrBelow(amps) {
  if (!ok(amps)) return null;
  let r = null;
  for (const s of STANDARD_OCPD) { if (s <= amps + 1e-9) r = s; else break; }
  return r;
}
/** Smallest standard rating ≥ amps (minimums round up). Null above 6000 A. */
function standardAtOrAbove(amps) {
  if (!ok(amps)) return null;
  for (const s of STANDARD_OCPD) if (s >= amps - 1e-9) return s;
  return null;
}

/** Smallest conductor whose Table 310.16 ampacity ≥ required. */
function conductorFor(requiredAmps, { metal = 'cu', tempC = 75 } = {}) {
  const t = AMPACITY[metal], col = TEMP_COL[tempC];
  if (!t || !col || !ok(requiredAmps) || requiredAmps <= 0) return null;
  const row = t.find((r) => r[col] >= requiredAmps - 1e-9);
  return row ? { size: row[0], ampacity: row[col], metal, tempC } : { size: null, over: true, metal, tempC };
}

/**
 * Article 440 HVAC equipment: MCA and MOCP.
 *
 * input = {
 *   compressors: [{ rla, bcsc? }],  // motor-compressors; BCSC used when greater (440.4(C))
 *   motors:      [fla, ...],          // fan / blower motors on the same circuit
 *   heatAmps:    number,              // resistance heat on the circuit (424.3(B): 125 %)
 *   otherAmps:   number               // other non-motor loads (controls, etc.) at 100 %
 * }
 *
 * MCA (440.33): sum of all compressor RLA/BCSC + all other motor FLA
 *   + 25 % of the largest motor or motor-compressor; plus heat × 1.25 and other loads.
 * MOCP (440.22(A), (B)(1)): 175 % of the largest compressor's RLA/BCSC (225 % only
 *   where 175 % won't carry the starting current) + the other compressors and motors
 *   + heat + other loads; ROUNDED DOWN to a 240.6(A) size, not less than 15 A.
 */
function mcaMocp(input) {
  const errors = [];
  const comps = (input.compressors || []).filter((c) => c && (ok(c.rla) || ok(c.bcsc)));
  const motors = (input.motors || []).filter(ok);
  const heat = ok(input.heatAmps) ? input.heatAmps : 0;
  const other = ok(input.otherAmps) ? input.otherAmps : 0;
  comps.forEach((c, i) => {
    if ((ok(c.rla) && c.rla < 0) || (ok(c.bcsc) && c.bcsc < 0)) errors.push(`compressor ${i + 1}: values can't be negative`);
  });
  if (motors.some((m) => m < 0) || heat < 0 || other < 0) errors.push("loads can't be negative");
  if (errors.length) return { ok: false, reason: errors[0] };
  const compAmps = comps.map((c) => Math.max(ok(c.rla) ? c.rla : 0, ok(c.bcsc) ? c.bcsc : 0)).filter((a) => a > 0);
  const motorAmps = motors.filter((m) => m > 0);
  if (!compAmps.length) return { ok: false, reason: 'enter at least one compressor RLA (Article 440 applies to motor-compressor equipment)' };

  const sumComp = compAmps.reduce((s, a) => s + a, 0), sumMot = motorAmps.reduce((s, a) => s + a, 0);
  const largestAny = Math.max(...compAmps, ...motorAmps);
  const mca = sumComp + sumMot + 0.25 * largestAny + 1.25 * heat + other;

  const largestComp = Math.max(...compAmps);
  const othersForMocp = sumComp - largestComp + sumMot + heat + other;
  const calc175 = 1.75 * largestComp + othersForMocp, calc225 = 2.25 * largestComp + othersForMocp;
  const mocp175 = Math.max(15, standardAtOrBelow(calc175) ?? 0), mocp225 = Math.max(15, standardAtOrBelow(calc225) ?? 0);
  return {
    ok: true,
    mca, largestAny, largestComp, heatAt125: 1.25 * heat,
    calc175, calc225, mocp175, mocp225,
    belowMca175: mocp175 < mca - 1e-9, belowMca225: mocp225 < mca - 1e-9,
    sources: {
      mca: 'NEC 440.33 (+ 424.3(B) for resistance heat)',
      mocp: 'NEC 440.22(A), (B)(1); rounded down to 240.6(A), 15 A minimum'
    }
  };
}

export { STANDARD_OCPD, AMPACITY, standardAtOrBelow, standardAtOrAbove, conductorFor, mcaMocp };
