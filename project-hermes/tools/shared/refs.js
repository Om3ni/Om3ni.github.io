/**
 * tools/shared/refs.js — shared reference rules for Hermes tools.
 *
 * One implementation of each rule, so tools can't disagree (the Nov 2026 audit
 * found three different capacitor tolerances in three tools). Every function
 * returns the computed value AND the reference it is compared with, plus a
 * `source` string to print beside it. Nothing here declares a fault: tools show
 * "value vs reference (source)" and the technician makes the call
 * (CALCULATORS.md boundary rules).
 *
 * Pure functions, no DOM. Tested by tools/shared/refs.test.mjs (run with node).
 */

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const fToC = (f) => (f - 32) * 5 / 9;

/* ── Unbalance / balance ─────────────────────────────────────────────── */

/**
 * NEMA MG-1 definition: max deviation from the average ÷ average × 100.
 * Used for line-to-line voltage, per-leg current, and 3-phase winding resistance.
 * Requires all three readings > 0 (no partial averages).
 */
function unbalance(readings) {
  const r = readings.map(num);
  if (r.length !== 3 || r.some((x) => x === null || x <= 0)) {
    return { ok: false, reason: "needs all three readings" };
  }
  const avg = (r[0] + r[1] + r[2]) / 3;
  const maxDev = Math.max(...r.map((x) => Math.abs(x - avg)));
  return { ok: true, avg, maxDev, pct: (maxDev / avg) * 100, high: Math.max(...r), low: Math.min(...r) };
}

const VOLTAGE_UNBALANCE_REF = {
  limitPct: 1,
  source: "NEMA MG-1 Part 14 (Fig. 14-1): derate the motor above 1% voltage unbalance; operation above 5% not recommended",
  note: "Current unbalance typically runs 6–10× the voltage unbalance."
};

/* ── Supply voltage ──────────────────────────────────────────────────── */

/**
 * NEMA MG-1 12.44 utilization range: ±10% of nameplate. Dual-rated nameplates
 * (e.g. 208–230 V) use −10% of the low rating and +10% of the high rating.
 */
function voltageRange(ratedLow, ratedHigh) {
  const lo = num(ratedLow), hi = num(ratedHigh ?? ratedLow);
  if (lo === null || hi === null || lo <= 0 || hi < lo) return { ok: false, reason: "enter nameplate voltage" };
  return {
    ok: true,
    min: lo * 0.9,
    max: hi * 1.1,
    source: "NEMA MG-1 12.44: nameplate voltage ±10%" + (hi !== lo ? " (−10% of the low rating, +10% of the high)" : "")
  };
}

/** Parse "230", "208-230", "208/230", "208–230" → { low, high } or null. */
function parseRatedVolts(text) {
  if (text == null) return null;
  const parts = String(text).replace(/[–—/]/g, "-").split("-").map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  if (!parts.length || parts.length > 2) return null;
  const low = Math.min(...parts), high = Math.max(...parts);
  return { low, high };
}

/* ── Insulation resistance (megger) ──────────────────────────────────── */

/**
 * Reference minimum, MΩ, at 40 °C.
 *  - Manufacturer minimum, when entered, always wins (compressor makers set their own).
 *  - IEEE 43 recommended minimum IR1min: 5 MΩ for random-wound and form-wound
 *    windings rated below 1 kV — every HVAC motor and compressor.
 *  - Rated 1 kV and above: kV + 1 MΩ (IEEE 43 legacy formula; form-wound
 *    machines built after ~1970 use 100 MΩ — check the nameplate/manufacturer).
 */
function irMinimum({ ratedVolts, mfrMinimum } = {}) {
  const m = num(mfrMinimum);
  if (m !== null && m > 0) return { value: m, source: "manufacturer minimum (entered)", at40C: false };
  const v = num(ratedVolts);
  if (v !== null && v >= 1000) {
    return { value: v / 1000 + 1, source: "IEEE 43: kV + 1 MΩ at 40 °C (100 MΩ for form-wound machines built after ~1970)", at40C: true };
  }
  return { value: 5, source: "IEEE 43: 5 MΩ at 40 °C for windings rated below 1 kV", at40C: true };
}

/**
 * Correct a reading to 40 °C. IEEE 43 approximation: insulation resistance
 * halves for every 10 °C rise. R40 = Rt × 0.5^((40 − t°C) / 10).
 * A cold winding reads high: 4 MΩ at 68 °F (20 °C) is ≈ 1 MΩ at 40 °C.
 */
function irCorrectTo40C(readingMOhm, windingTempF) {
  const r = num(readingMOhm), t = num(windingTempF);
  if (r === null) return null;
  if (t === null) return { value: r, corrected: false, factor: 1 };
  const factor = Math.pow(0.5, (40 - fToC(t)) / 10);
  return { value: r * factor, corrected: true, factor };
}

/** IEEE 43 Table 1 DC test voltage guidance by winding rating. */
function irTestVoltageGuide(ratedVolts) {
  const v = num(ratedVolts);
  if (v === null) return null;
  if (v < 1000) return { text: "500 V DC", source: "IEEE 43 Table 1: windings rated below 1,000 V" };
  if (v <= 2500) return { text: "500–1,000 V DC", source: "IEEE 43 Table 1: windings rated 1,000–2,500 V" };
  if (v <= 5000) return { text: "1,000–2,500 V DC", source: "IEEE 43 Table 1: windings rated 2,501–5,000 V" };
  return { text: "2,500–5,000 V DC or higher", source: "IEEE 43 Table 1: windings rated above 5,000 V" };
}

/* ── Capacitors ──────────────────────────────────────────────────────── */

/**
 * Measured vs rated µF against the tolerance PRINTED ON THE CAN (commonly ±5%,
 * ±6% or ±10%). No built-in pass/fail: without a printed tolerance the
 * deviation is shown alone.
 */
function capacitorCheck(ratedUF, measuredUF, tolerancePct) {
  const r = num(ratedUF), m = num(measuredUF), t = num(tolerancePct);
  if (r === null || m === null || r <= 0 || m < 0) return { ok: false, reason: "enter rated and measured µF" };
  const devPct = ((m - r) / r) * 100;
  const out = { ok: true, devPct, rated: r, measured: m };
  if (t !== null && t > 0) {
    out.tolerancePct = t;
    out.low = r * (1 - t / 100);
    out.high = r * (1 + t / 100);
    out.withinTolerance = Math.abs(devPct) <= t + 1e-9;
    out.source = "rated µF ±" + t + "% (printed on the capacitor)";
  } else {
    out.source = "enter the tolerance printed on the capacitor to compare";
  }
  return out;
}

/** µF from start-winding current and capacitor voltage (60 Hz): 2652 × A ÷ V. */
function capacitorFromCurrent(amps, volts, hz = 60) {
  const a = num(amps), v = num(volts);
  if (a === null || v === null || a <= 0 || v <= 0) return null;
  return (a * 1e6) / (2 * Math.PI * hz * v); // 60 Hz → 2652.6 × A / V
}

/* ── Single-phase windings (C / R / S) ───────────────────────────────── */

/**
 * Identify Common / Run / Start from the three terminal-to-terminal readings.
 * Labels: readings across terminal pairs "1-2", "1-3", "2-3" (the tech numbers
 * the terminals however they like). Largest reading = Run–Start (both
 * windings), smallest = Common–Run, middle = Common–Start.
 *
 * Also reports how well the two smaller readings add up to the largest.
 * This is a measurement-consistency and terminal-ID check only: it CANNOT
 * detect shorted turns (a shorted winding lowers both sides of the sum), and
 * an open winding reads OL and can't be entered.
 */
function identifyTerminals(r12, r13, r23) {
  const pairs = [["1", "2", num(r12)], ["1", "3", num(r13)], ["2", "3", num(r23)]];
  if (pairs.some((p) => p[2] === null || p[2] < 0)) return { ok: false, reason: "needs all three readings" };
  const sorted = [...pairs].sort((a, b) => a[2] - b[2]);
  const [cr, cs, rs] = sorted;
  if (cr[2] === cs[2] || cs[2] === rs[2]) {
    return { ok: false, reason: "two readings are equal, so the terminals can't be told apart; re-check the readings" };
  }
  const shared = cr.slice(0, 2).find((t) => cs.slice(0, 2).includes(t));
  const run = cr.slice(0, 2).find((t) => t !== shared);
  const start = cs.slice(0, 2).find((t) => t !== shared);
  const sum = cr[2] + cs[2];
  const diff = rs[2] - sum;
  return {
    ok: true,
    common: shared, run, start,
    runOhms: cr[2], startOhms: cs[2], runStartOhms: rs[2],
    sum, diff, diffPct: rs[2] > 0 ? (diff / rs[2]) * 100 : null
  };
}

/** % difference from a manufacturer-specified resistance. */
function vsSpec(measured, spec) {
  const m = num(measured), s = num(spec);
  if (m === null || s === null || s <= 0) return null;
  return ((m - s) / s) * 100;
}

/* ── Load ────────────────────────────────────────────────────────────── */

/**
 * Running amps vs nameplate. Uses the HIGHEST leg (overloads act per leg).
 * Blank service factor is treated as 1.0 (conservative) and reported as assumed.
 */
function motorLoad({ fla, serviceFactor, amps }) {
  const f = num(fla);
  const legs = (Array.isArray(amps) ? amps : [amps]).map(num);
  if (f === null || f <= 0) return { ok: false, reason: "enter nameplate FLA" };
  if (legs.some((a) => a === null || a < 0)) return { ok: false, reason: legs.length > 1 ? "needs all three legs" : "enter running amps" };
  const sfIn = num(serviceFactor);
  const sf = sfIn !== null && sfIn >= 1 ? sfIn : 1.0;
  const high = Math.max(...legs);
  return {
    ok: true,
    high, highLeg: legs.indexOf(high) + 1,
    pctFLA: (high / f) * 100,
    sf, sfAssumed: !(sfIn !== null && sfIn >= 1),
    sfAmps: f * sf,
    overSF: high > f * sf + 1e-9
  };
}

export {
  fToC, unbalance, VOLTAGE_UNBALANCE_REF, voltageRange, parseRatedVolts,
  irMinimum, irCorrectTo40C, irTestVoltageGuide,
  capacitorCheck, capacitorFromCurrent, identifyTerminals, vsSpec, motorLoad
};
