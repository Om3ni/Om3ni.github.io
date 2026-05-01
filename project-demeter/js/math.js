// Project Demeter — Math Module
// Pure functions only. No DOM. No state. No side effects.
// Every UI calculation routes through here.

// ── Stage VPD targets ──────────────────────────────────────────────────────
// Single source of truth for cultivation-stage VPD bands.
// Index aligns with APP.stage (0–4) and survey-form data-stage attributes.
// Values in kPa; bands inclusive on both ends.

export const STAGES = Object.freeze([
  { key: 'prop',   label: 'Prop',   vpdMin: 0.4, vpdMax: 0.8 },
  { key: 'eveg',   label: 'E-Veg',  vpdMin: 0.8, vpdMax: 1.0 },
  { key: 'lveg',   label: 'L-Veg',  vpdMin: 1.0, vpdMax: 1.2 },
  { key: 'eflwr',  label: 'E-Flwr', vpdMin: 1.2, vpdMax: 1.4 },
  { key: 'lflwr',  label: 'L-Flwr', vpdMin: 1.4, vpdMax: 1.6 }
]);

export function stageBand(stageIndex) {
  const i = Number(stageIndex);
  if (!Number.isInteger(i) || i < 0 || i >= STAGES.length) return null;
  return STAGES[i];
}

// ── Saturation Vapor Pressure (Magnus–Alduchov 1996) ───────────────────────
// Input: temperature in °C. Output: SVP in kPa.
// Form:  e_s = 0.61094 * exp(17.625 * T / (T + 243.04))
// Valid range roughly -40°C to +50°C, well-suited to cultivation rooms.

export function svp(tC) {
  return 0.61094 * Math.exp((17.625 * tC) / (tC + 243.04));
}

// ── Vapor Pressure Deficit ─────────────────────────────────────────────────
// Leaf-to-air VPD. Leaf surface is cooler than air by leafOffsetC due to
// transpiration cooling — so SVP at leaf temp is the reference, and the
// air's actual vapor pressure is subtracted from it.
//
// Inputs:
//   tdbC         — air dry-bulb temperature, °C
//   rhPct        — relative humidity, percent (0–100)
//   leafOffsetC  — leaf cooler than air by this many °C (typical 1–3°C)
// Output: VPD in kPa.

export function calcVPD(tdbC, rhPct, leafOffsetC) {
  const offset = (leafOffsetC == null) ? 0 : leafOffsetC;
  const svpAir  = svp(tdbC);
  const svpLeaf = svp(tdbC - offset);
  const actualVP = svpAir * (rhPct / 100);
  return svpLeaf - actualVP;
}

// ── Back-calculate target RH from desired VPD ──────────────────────────────
// Given air dry-bulb and a target VPD, what RH puts the leaf-air system
// at that VPD? Useful for setpoint advisory.
// targetVpd = svp(tdb - offset) - svp(tdb) * rh/100
//   →  rh = (svp(tdb - offset) - targetVpd) / svp(tdb) * 100

export function rhForVpd(tdbC, targetVpd, leafOffsetC) {
  const offset = (leafOffsetC == null) ? 0 : leafOffsetC;
  const svpAir  = svp(tdbC);
  const svpLeaf = svp(tdbC - offset);
  return ((svpLeaf - targetVpd) / svpAir) * 100;
}

// ── Dewpoint approximation (Magnus form) ───────────────────────────────────
// Standard Magnus inversion. RH must be > 0 (returns NaN at 0% RH, which
// is correct — dewpoint is undefined for absolutely dry air).

export function dewPointApprox(tdbC, rhPct) {
  const a = 17.625;
  const b = 243.04;
  const alpha = Math.log(rhPct / 100) + (a * tdbC) / (b + tdbC);
  return (b * alpha) / (a - alpha);
}

// ── Unit conversions ───────────────────────────────────────────────────────

export function toC(tF)   { return (tF - 32) * 5 / 9; }
export function fromC(tC) { return tC * 9 / 5 + 32; }

export function inToFt(inches) { return inches / 12; }
export function ftToIn(feet)   { return feet * 12; }

// ── Inverse-distance-weighted interpolation ────────────────────────────────
// Used by the heatmap (Phase 4) to estimate VPD at arbitrary grid cells
// from sensor readings. Sensors must have numeric `xFt`, `yFt`, and a
// `value` field (caller supplies — typically pre-computed VPD per sensor).
// Sensors without finite values are skipped.
//
// If the query point coincides with a sensor (distance 0), the sensor's
// value is returned exactly — no division by zero, no infinite weight.

export function idwInterpolate(x, y, sensors, power = 2) {
  if (!Array.isArray(sensors) || sensors.length === 0) return null;

  let weightedSum = 0;
  let weightTotal = 0;

  for (const s of sensors) {
    const v = s.value;
    if (!Number.isFinite(v)) continue;

    const dx = s.xFt - x;
    const dy = s.yFt - y;
    const d2 = dx * dx + dy * dy;

    if (d2 === 0) return v;

    const w = 1 / Math.pow(Math.sqrt(d2), power);
    weightedSum += v * w;
    weightTotal += w;
  }

  if (weightTotal === 0) return null;
  return weightedSum / weightTotal;
}

// ── Mean nearest-neighbor distance ─────────────────────────────────────────
// Spatial-summary fact: average of each sensor's distance to its closest
// neighbor. Returns null if fewer than 2 sensors.

export function meanNearestNeighborDistance(sensors) {
  if (!Array.isArray(sensors) || sensors.length < 2) return null;

  let total = 0;
  for (let i = 0; i < sensors.length; i++) {
    let nearest = Infinity;
    for (let j = 0; j < sensors.length; j++) {
      if (i === j) continue;
      const dx = sensors[i].xFt - sensors[j].xFt;
      const dy = sensors[i].yFt - sensors[j].yFt;
      const d  = Math.sqrt(dx * dx + dy * dy);
      if (d < nearest) nearest = d;
    }
    total += nearest;
  }
  return total / sensors.length;
}

// ── Canopy area ────────────────────────────────────────────────────────────
// Sum of canopy-zone rectangles (sq ft). Dead zones are excluded.
// Zone shape: { type, x1Ft, y1Ft, x2Ft, y2Ft }.

export function canopyArea(zones) {
  if (!Array.isArray(zones)) return 0;
  let total = 0;
  for (const z of zones) {
    if (z.type !== 'canopy') continue;
    const w = Math.abs((z.x2Ft ?? 0) - (z.x1Ft ?? 0));
    const h = Math.abs((z.y2Ft ?? 0) - (z.y1Ft ?? 0));
    total += w * h;
  }
  return total;
}

// ── Self-tests ─────────────────────────────────────────────────────────────
// Sanity checks against known reference values. Auto-runs on module load;
// any failure fires console.error loudly. Does not mutate external state.

function approxEq(a, b, tol = 1e-6) {
  return Math.abs(a - b) <= tol;
}

export function runMathSelfTests() {
  const fails = [];
  const check = (name, ok, detail) => {
    if (!ok) fails.push({ name, detail });
  };

  // SVP — Magnus-Alduchov 1996 reference values:
  // svp(0)  = 0.61094, svp(20) ≈ 2.3339, svp(25) ≈ 3.1617
  // (Roadmap cites 2.339 — that's original Magnus constants; spec
  // specifies Alduchov, which lands at 2.3339 here. Spec wins.)
  check('svp(0)',  approxEq(svp(0),  0.61094, 1e-4),  `got ${svp(0)}`);
  check('svp(20)', approxEq(svp(20), 2.3339, 5e-4),   `got ${svp(20)}`);
  check('svp(25)', approxEq(svp(25), 3.1617, 5e-4),   `got ${svp(25)}`);

  // VPD — at 25°C / 60% RH / 2°C leaf offset (Alduchov):
  //   svp(25)   = 3.1617
  //   svp(23)   = 2.8038
  //   actualVP  = 3.1617 * 0.60 = 1.8970
  //   vpd       = 2.8038 - 1.8970 ≈ 0.9068 kPa
  check('calcVPD(25,60,2)',   approxEq(calcVPD(25, 60, 2),   0.9068, 1e-3), `got ${calcVPD(25, 60, 2)}`);
  check('calcVPD(25,100,0)',  approxEq(calcVPD(25, 100, 0),  0,     1e-9), `got ${calcVPD(25, 100, 0)}`);
  check('calcVPD(20,50,0)',   approxEq(calcVPD(20, 50, 0),   svp(20) * 0.5, 1e-9));

  // RH ↔ VPD round-trip — back-calc the rh we started with
  const rh = rhForVpd(25, calcVPD(25, 60, 2), 2);
  check('rhForVpd round-trip', approxEq(rh, 60, 1e-9), `got ${rh}`);

  // Dewpoint at 100% RH equals dry-bulb
  check('dewPointApprox(20,100) == 20', approxEq(dewPointApprox(20, 100), 20, 1e-9), `got ${dewPointApprox(20, 100)}`);
  // Dewpoint at 25°C / 50% RH ≈ 13.86°C (reference Magnus value)
  check('dewPointApprox(25,50)', approxEq(dewPointApprox(25, 50), 13.86, 5e-2), `got ${dewPointApprox(25, 50)}`);

  // Temperature unit round-trips
  for (const f of [-40, 0, 32, 72, 100, 212]) {
    check(`fromC(toC(${f}))===${f}`, approxEq(fromC(toC(f)), f, 1e-9));
  }
  for (const c of [-10, 0, 10, 20, 37, 100]) {
    check(`toC(fromC(${c}))===${c}`, approxEq(toC(fromC(c)), c, 1e-9));
  }

  // Length conversions
  check('inToFt(12)===1', approxEq(inToFt(12), 1));
  check('ftToIn(1)===12', approxEq(ftToIn(1), 12));

  // IDW
  const sensors = [
    { xFt: 0,  yFt: 0,  value: 1.0 },
    { xFt: 10, yFt: 0,  value: 2.0 }
  ];
  check('idw at sensor returns sensor value', approxEq(idwInterpolate(0, 0, sensors), 1.0));
  check('idw at midpoint is mean (equal weights)',
    approxEq(idwInterpolate(5, 0, sensors), 1.5));
  check('idw with empty list returns null', idwInterpolate(0, 0, []) === null);

  // Nearest-neighbor distance
  const nnSensors = [
    { xFt: 0, yFt: 0 }, { xFt: 3, yFt: 4 }, { xFt: 6, yFt: 8 }
  ];
  // distances: 5, 5, 5 → mean = 5
  check('meanNNDistance equilateral chain', approxEq(meanNearestNeighborDistance(nnSensors), 5, 1e-9));
  check('meanNNDistance with 1 sensor returns null',
    meanNearestNeighborDistance([{ xFt: 0, yFt: 0 }]) === null);

  // Canopy area
  const zones = [
    { type: 'canopy', x1Ft: 0, y1Ft: 0, x2Ft: 10, y2Ft: 4 },     //  40
    { type: 'canopy', x1Ft: 5, y1Ft: 5, x2Ft: 8,  y2Ft: 8 },     //   9
    { type: 'dead',   x1Ft: 0, y1Ft: 0, x2Ft: 100, y2Ft: 100 }   // ignored
  ];
  check('canopyArea sums canopy only', approxEq(canopyArea(zones), 49));

  // Stage table
  check('STAGES has 5 entries', STAGES.length === 5);
  check('stageBand(2) is L-Veg', stageBand(2) && stageBand(2).label === 'L-Veg');
  check('stageBand(99) is null', stageBand(99) === null);

  if (fails.length === 0) {
    console.log(`Demeter math: self-tests pass`);
    return { passed: true, fails: [] };
  }
  console.error(`Demeter math: ${fails.length} self-test(s) failed`, fails);
  return { passed: false, fails };
}

// Auto-run once on module load. Cheap, catches regressions immediately,
// and surfaces in any environment that loads the module — including PWA.
runMathSelfTests();
