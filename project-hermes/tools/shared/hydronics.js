/**
 * tools/shared/hydronics.js — closed-loop hydronic calculations for Hermes tools.
 *
 * Pure functions, no DOM. Fluid properties come from fluids.js. Tested by
 * tools/shared/hydronics.test.mjs (run with node).
 *
 * Units: GPM, feet of head (of the fluid being pumped), inches for pipe ID,
 * feet for length, °F, Btu/h.
 */

/* ── Pipe ─────────────────────────────────────────────────────────────
   Inside diameters, inches.
   - Copper Type L / M: ASTM B88 tube dimensions.
   - Steel Sch 40: ASME B36.10 (also used for CPVC Sch 40, ASTM F441, whose
     OD and minimum wall match; real average ID is slightly smaller).
   - CPVC CTS SDR-11: ASTM D2846, OD = nominal + 1/8 in, minimum wall = OD/11
     (0.068 in floor). The audit found the old tool used the 3/4 in OD (0.874)
     as its ID.
   - PEX SDR-9: ASTM F876, OD = nominal + 1/8 in, minimum wall = OD/9 (0.070 in
     floor). Manufacturers' published IDs differ slightly; check the submittal
     for long runs.
   Roughness (ft): drawn copper and plastics 0.000005, commercial steel 0.00015. */
const PIPES = {
  copperL: { name: "Copper Type L", rough: 0.000005, id: { '1/2"': 0.545, '3/4"': 0.785, '1"': 1.025, '1-1/4"': 1.265, '1-1/2"': 1.505, '2"': 1.985, '2-1/2"': 2.465, '3"': 2.945, '4"': 3.905 } },
  copperM: { name: "Copper Type M", rough: 0.000005, id: { '1/2"': 0.569, '3/4"': 0.811, '1"': 1.055, '1-1/4"': 1.291, '1-1/2"': 1.527, '2"': 2.009, '2-1/2"': 2.495, '3"': 2.981, '4"': 3.935 } },
  steel40: { name: "Steel Sch 40", rough: 0.00015, id: { '1/2"': 0.622, '3/4"': 0.824, '1"': 1.049, '1-1/4"': 1.380, '1-1/2"': 1.610, '2"': 2.067, '2-1/2"': 2.469, '3"': 3.068, '4"': 4.026, '5"': 5.047, '6"': 6.065, '8"': 7.981 } },
  pex:     { name: "PEX (SDR-9)", rough: 0.000005, id: { '3/8"': 0.360, '1/2"': 0.485, '5/8"': 0.584, '3/4"': 0.681, '1"': 0.875, '1-1/4"': 1.069, '1-1/2"': 1.263, '2"': 1.653 } },
  cpvcCTS: { name: "CPVC CTS (SDR-11)", rough: 0.000005, id: { '1/2"': 0.489, '3/4"': 0.715, '1"': 0.921, '1-1/4"': 1.125, '1-1/2"': 1.329, '2"': 1.739 } },
  cpvc40:  { name: "CPVC Sch 40", rough: 0.000005, id: { '1/2"': 0.622, '3/4"': 0.824, '1"': 1.049, '1-1/4"': 1.380, '1-1/2"': 1.610, '2"': 2.067, '2-1/2"': 2.469, '3"': 3.068, '4"': 4.026 } }
};

const G = 32.174;                 // ft/s²
const CP_TO_LBFTS = 0.000671969;  // cP → lb/(ft·s)
const GAL_PER_FT3 = 7.48052;

/** Velocity, ft/s, from GPM and inside diameter in inches. */
function velocity(gpm, idIn) { return 0.408498 * gpm / (idIn * idIn); }

/**
 * Darcy friction factor.
 *  Re < 2300: laminar, 64/Re.
 *  Re ≥ 4000: Colebrook-White, iterated.
 *  2300–4000: Churchill (1977), which spans all regimes; flagged transitional.
 */
function frictionFactor(re, relRough) {
  if (re <= 0) return { f: 0, regime: "none" };
  if (re < 2300) return { f: 64 / re, regime: "laminar" };
  if (re >= 4000) {
    let f = 0.02;
    for (let i = 0; i < 60; i++) {
      const rhs = -2 * Math.log10(relRough / 3.7 + 2.51 / (re * Math.sqrt(f)));
      const fn = 1 / (rhs * rhs);
      if (Math.abs(fn - f) < 1e-10) { f = fn; break; }
      f = fn;
    }
    return { f, regime: "turbulent" };
  }
  const A = Math.pow(2.457 * Math.log(1 / (Math.pow(7 / re, 0.9) + 0.27 * relRough)), 16);
  const B = Math.pow(37530 / re, 16);
  const f = 8 * Math.pow(Math.pow(8 / re, 12) + 1 / Math.pow(A + B, 1.5), 1 / 12);
  return { f, regime: "transitional" };
}

/**
 * Friction head for a pipe run, ft of fluid (Darcy-Weisbach).
 * fluid: { rho lb/ft³, mu cP } from fluids.props().
 */
function pipeLoss({ gpm, idIn, roughFt, lengthFt, fluid }) {
  if (!(gpm > 0) || !(idIn > 0) || !(lengthFt >= 0) || !fluid) return null;
  const D = idIn / 12, V = velocity(gpm, idIn);
  const re = fluid.rho * V * D / (fluid.mu * CP_TO_LBFTS);
  const { f, regime } = frictionFactor(re, roughFt / D);
  const per100 = f * (100 / D) * V * V / (2 * G);
  return { velocity: V, re, f, regime, per100, head: per100 * lengthFt / 100 };
}

/* ── Flow ─────────────────────────────────────────────────────────── */

/** GPM to carry a load at a temperature difference: Q = GPM × (ρ/7.48 × 60) × cp × ΔT. */
function gpmFromLoad(btuh, deltaT, fluid) {
  if (!(btuh > 0) || !(deltaT > 0) || !fluid) return null;
  return btuh / (deltaT * fluid.cp * fluid.rho * 60 / GAL_PER_FT3);
}
/** Btu/h ↔ GPM factor for this fluid (500 for water near 60 °F). */
function flowFactor(fluid) { return fluid.cp * fluid.rho * 60 / GAL_PER_FT3; }

/* ── Fittings and components ─────────────────────────────────────────
   Equivalent length = L/D × inside diameter (Crane TP-410 L/D values).
   Hydronic specialties (flow-checks, air separators, boiler heat exchangers,
   zone valves) vary too much for L/D: enter them as components from the
   manufacturer's ΔP or Cv. */
const FITTINGS = [
  { key: "elbow90", name: "90° elbow", ld: 30 },
  { key: "elbow45", name: "45° elbow", ld: 16 },
  { key: "teeRun", name: "Tee, flow through run", ld: 20 },
  { key: "teeBranch", name: "Tee, flow through branch", ld: 60 },
  { key: "ball", name: "Ball valve, full port", ld: 3 },
  { key: "gate", name: "Gate valve, open", ld: 8 },
  { key: "globe", name: "Globe valve, open", ld: 340 },
  { key: "swingCheck", name: "Swing check valve", ld: 100 }
];
function fittingsEquivLength(counts, idIn) {
  if (!(idIn > 0)) return 0;
  return FITTINGS.reduce((s, ft) => s + (counts[ft.key] || 0) * ft.ld * idIn / 12, 0);
}

/** A component's head loss at a flow, ft of fluid. unit: "ft" | "psi" | "cv". */
function componentHead({ value, unit, gpm, sg }) {
  if (!(value > 0)) return null;
  if (unit === "ft") return value;
  if (unit === "psi") return value * 2.3066 / sg;            // ft of this fluid
  if (unit === "cv") { if (!(gpm > 0)) return null; const dpPsi = sg * Math.pow(gpm / value, 2); return dpPsi * 2.3066 / sg; }
  return null;
}

/* ── Check an existing system by heat ────────────────────────────── */

/**
 * Actual flow from heat output and the measured supply/return split.
 * Use the heat source's OUTPUT at the firing rate during the test.
 */
function gpmFromMeasuredSplit(outputBtuh, supplyF, returnF, fluid) {
  const dt = Math.abs(supplyF - returnF);
  if (!(outputBtuh > 0) || !(dt > 0) || !fluid) return null;
  return { gpm: outputBtuh / (dt * flowFactor(fluid)), deltaT: dt };
}

/* ── Pump curve (optional, from the manufacturer's submittal) ────── */

/**
 * Validate and fit 3–6 (GPM, ft) points. Head must fall as flow rises;
 * anything else is a typing error, not a pump.
 * Fit: least-squares quadratic H = a + bQ + cQ².
 */
function fitPumpCurve(points) {
  const pts = points.filter((p) => Number.isFinite(p.gpm) && Number.isFinite(p.head));
  if (pts.length < 3) return { ok: false, reason: "enter at least three points from the curve" };
  if (pts.some((p) => p.gpm < 0 || p.head < 0)) return { ok: false, reason: "flow and head can't be negative" };
  const s = [...pts].sort((a, b) => a.gpm - b.gpm);
  for (let i = 1; i < s.length; i++) {
    if (s[i].gpm === s[i - 1].gpm) return { ok: false, reason: "two points have the same flow" };
    if (s[i].head >= s[i - 1].head) return { ok: false, reason: `head must fall as flow rises (check ${s[i - 1].gpm} → ${s[i].gpm} GPM)` };
  }
  // normal equations for a quadratic
  let S = [0, 0, 0, 0, 0], T = [0, 0, 0];
  s.forEach(({ gpm: x, head: y }) => { for (let k = 0; k < 5; k++) S[k] += Math.pow(x, k); for (let k = 0; k < 3; k++) T[k] += y * Math.pow(x, k); });
  const M = [[S[0], S[1], S[2]], [S[1], S[2], S[3]], [S[2], S[3], S[4]]];
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  const D = det(M);
  if (Math.abs(D) < 1e-12) return { ok: false, reason: "points can't be fitted; spread them across the curve" };
  const col = (i) => M.map((r, j) => r.map((v, k) => (k === i ? T[j] : v)));
  const a = det(col(0)) / D, b = det(col(1)) / D, c = det(col(2)) / D;
  const resid = Math.sqrt(s.reduce((acc, p) => acc + Math.pow(a + b * p.gpm + c * p.gpm * p.gpm - p.head, 2), 0) / s.length);
  return { ok: true, a, b, c, points: s, minGpm: s[0].gpm, maxGpm: s[s.length - 1].gpm, rms: resid, head: (q) => a + b * q + c * q * q };
}

/**
 * Operating point: closed-loop system curve H = k·Q² (k from the duty point)
 * meets the pump curve. Flags a point outside the entered points.
 */
function operatingPoint(curve, dutyGpm, dutyHead) {
  if (!curve || !curve.ok || !(dutyGpm > 0) || !(dutyHead > 0)) return null;
  const k = dutyHead / (dutyGpm * dutyGpm);
  const A = curve.c - k, B = curve.b, C = curve.a;      // A Q² + B Q + C = 0
  let q;
  if (Math.abs(A) < 1e-12) q = -C / B;
  else {
    const disc = B * B - 4 * A * C;
    if (disc < 0) return { ok: false, reason: "pump and system curves don't cross" };
    const r = [(-B + Math.sqrt(disc)) / (2 * A), (-B - Math.sqrt(disc)) / (2 * A)].filter((x) => x > 0);
    if (!r.length) return { ok: false, reason: "pump and system curves don't cross at positive flow" };
    q = Math.min(...r);
  }
  const h = k * q * q;
  return { ok: true, gpm: q, head: h, extrapolated: q < curve.minGpm - 1e-9 || q > curve.maxGpm + 1e-9, k };
}

/** Pump head from a measured differential across the pump: psi → ft of the fluid. */
function headFromDeltaP(psi, sg) { return psi > 0 && sg > 0 ? psi * 2.3066 / sg : null; }

/** Read flow off the fitted curve at a head (the larger root inside the curve). */
function gpmAtHead(curve, head) {
  if (!curve || !curve.ok || !(head >= 0)) return null;
  const A = curve.c, B = curve.b, C = curve.a - head;
  let qs;
  if (Math.abs(A) < 1e-12) qs = [-C / B];
  else { const d = B * B - 4 * A * C; if (d < 0) return null; qs = [(-B + Math.sqrt(d)) / (2 * A), (-B - Math.sqrt(d)) / (2 * A)]; }
  qs = qs.filter((q) => q >= 0);
  if (!qs.length) return null;
  const q = Math.min(...qs.filter((x) => x >= 0));
  return { gpm: q, extrapolated: q < curve.minGpm - 1e-9 || q > curve.maxGpm + 1e-9 };
}

export {
  PIPES, FITTINGS, velocity, frictionFactor, pipeLoss, gpmFromLoad, flowFactor,
  fittingsEquivLength, componentHead, gpmFromMeasuredSplit, fitPumpCurve, operatingPoint,
  headFromDeltaP, gpmAtHead
};
