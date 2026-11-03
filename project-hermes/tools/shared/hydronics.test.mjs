/**
 * tools/shared/hydronics.test.mjs — checks for fluids.js + hydronics.js.
 * Run: node project-hermes/tools/shared/hydronics.test.mjs   (exit 1 on failure)
 * "audit" cases are reproductions from audit/2026-11/mech.md (references from
 * Dow data and the reviewer's independent calculations).
 */
import { props } from "./fluids.js";
import * as H from "./hydronics.js";

let pass = 0, fail = 0;
const within = (a, b, pct) => a !== null && Math.abs(a - b) / Math.abs(b) * 100 <= pct;
function check(name, cond, got) { if (cond) pass++; else { fail++; console.log("FAIL", name, "→", JSON.stringify(got)); } }

// Independent friction reference: Swamee-Jain explicit (≈1% of Colebrook).
function sj(gpm, idIn, rough, fl) {
  const D = idIn / 12, V = 0.408498 * gpm / idIn ** 2, Re = fl.rho * V * D / (fl.mu * 0.000671969);
  const f = 0.25 / Math.log10(rough / D / 3.7 + 5.74 / Re ** 0.9) ** 2;
  return f * (100 / D) * V * V / (2 * 32.174);
}
const water60 = props("water", 0, 60), water180 = props("water", 0, 180);

// Fluids (Dow SR-1 values exactly; PG model vs Dow sheet)
check("water 60 °F µ 1.12 cP", water60.ok && within(water60.mu, 1.12, 0.1), water60);
check("EG 50% 40 °F = Dow 6.77 cP / 0.770 / 67.47", (() => { const p = props("eg", 50, 40); return within(p.mu, 6.77, .1) && within(p.cp, .770, .1) && within(p.rho, 67.47, .1); })());
check("PG 50% 50 °F µ within 3.5% of Dow 10.65", within(props("pg", 50, 50).mu, 10.65, 3.5), props("pg", 50, 50));
check("frozen mix refused (EG 10% at 20 °F)", !props("eg", 10, 20).ok);
check("water below 40 °F refused", !props("water", 0, 35).ok);
check("blank temp refused", !props("water", 0, NaN).ok);

// Friction: water, matches independent Swamee-Jain within 1.5 %, and audit references
let r = H.pipeLoss({ gpm: 10, idIn: H.PIPES.copperL.id['1"'], roughFt: 0.000005, lengthFt: 100, fluid: water60 });
check("audit: water 60°F 10 GPM 1\" L 100 ft ≈ 6.63 ft", within(r.head, 6.633, 1.5), r);
check("Colebrook vs Swamee-Jain (1\" L)", within(r.per100, sj(10, 1.025, 0.000005, water60), 1.5), [r.per100, sj(10, 1.025, 0.000005, water60)]);
r = H.pipeLoss({ gpm: 50, idIn: H.PIPES.steel40.id['2"'], roughFt: 0.00015, lengthFt: 200, fluid: water180 });
check("audit: water 180°F 50 GPM 2\" Sch40 200 ft ≈ 8.41 ft", within(r.head, 8.414, 1.5), r);

// Glycol friction (audit HIGH): was 36.5 ft/100 and 'laminar'
r = H.pipeLoss({ gpm: 20, idIn: H.PIPES.copperL.id['1-1/4"'], roughFt: 0.000005, lengthFt: 100, fluid: props("pg", 50, 50) });
check("audit: PG 50% 50°F 20 GPM 1-1/4\" L ≈ 14.5 ft/100, turbulent", r.regime === "turbulent" && within(r.per100, 14.5, 4), r);
r = H.pipeLoss({ gpm: 20, idIn: H.PIPES.copperL.id['1-1/4"'], roughFt: 0.000005, lengthFt: 100, fluid: props("eg", 50, 40) });
check("audit: EG 50% 40°F 20 GPM 1-1/4\" L ≈ 12.6 ft/100, turbulent", r.regime === "turbulent" && within(r.per100, 12.6, 3), r);

// Flow from load (audit HIGH: GPM was 5–10 % low)
check("audit: EG 50% 40°F 100k Btu/h ΔT20 ≈ 12.01 GPM", within(H.gpmFromLoad(100000, 20, props("eg", 50, 40)), 12.01, 0.5), H.gpmFromLoad(100000, 20, props("eg", 50, 40)));
check("audit: PG 40% 50°F 100k ΔT20 ≈ 10.94 GPM", within(H.gpmFromLoad(100000, 20, props("pg", 40, 50)), 10.94, 1.0), H.gpmFromLoad(100000, 20, props("pg", 40, 50)));
check("water 60°F flow factor ≈ 500", within(H.flowFactor(water60), 500, 0.5), H.flowFactor(water60));
check("negative load refused", H.gpmFromLoad(-100000, 20, water60) === null);
check("ΔT 0 refused (was silently 20)", H.gpmFromLoad(100000, 0, water60) === null);

// CPVC (audit HIGH: ID was the OD)
r = H.pipeLoss({ gpm: 4, idIn: H.PIPES.cpvcCTS.id['3/4"'], roughFt: 0.000005, lengthFt: 100, fluid: water60 });
check("audit: CPVC CTS 3/4\" 4 GPM ≈ 7.4 ft/100 (0.715\" ID; old tool 2.84)", within(r.per100, 7.4, 1.5), r);

// Transitional regime (audit MEDIUM: friction dropped to zero)
r = H.pipeLoss({ gpm: 1, idIn: H.PIPES.copperL.id['1"'], roughFt: 0.000005, lengthFt: 100, fluid: water60 });
check("transitional 1 GPM 1\" L has friction and is flagged", r.regime === "transitional" && r.head > 0, r);

// Components
check("2 psi = 4.61 ft of water", within(H.componentHead({ value: 2, unit: "psi", gpm: 5, sg: 1 }), 4.613, 0.1));
check("Cv 5 at 5 GPM = 1 psi = 2.31 ft", within(H.componentHead({ value: 5, unit: "cv", gpm: 5, sg: 1 }), 2.3066, 0.1));
check("fittings: 6 elbows 1\" L = 15.4 ft", within(H.fittingsEquivLength({ elbow90: 6 }, 1.025), 15.375, 0.1));

// Check by heat
const w160 = props("water", 0, 160);
const chk = H.gpmFromMeasuredSplit(100000, 180, 145, w160);
check("100k Btu/h output at 35 °F split ≈ 5.8 GPM", chk && within(chk.gpm, 100000 / (35 * H.flowFactor(w160)), 0.01) && chk.gpm > 5.5 && chk.gpm < 6.0, chk);

// Pump curve (audit HIGH: stale operating point; correct point 8.50 GPM / 26.3 ft)
const curve = H.fitPumpCurve([{ gpm: 0, head: 30 }, { gpm: 10, head: 25 }, { gpm: 20, head: 12 }]);
check("curve fits 3 points exactly", curve.ok && curve.rms < 1e-9, curve);
const op = H.operatingPoint(curve, 15, 81.86);
check("audit: operating point 8.50 GPM / 26.3 ft", op.ok && within(op.gpm, 8.50, 0.5) && within(op.head, 26.3, 0.5), op);
check("rising-head curve rejected", !H.fitPumpCurve([{ gpm: 0, head: 20 }, { gpm: 10, head: 25 }, { gpm: 20, head: 12 }]).ok);
check("two points refused", !H.fitPumpCurve([{ gpm: 0, head: 20 }, { gpm: 10, head: 15 }]).ok);
const opX = H.operatingPoint(curve, 10, 2);       // very flat system → beyond the last point
check("operating point beyond entered curve is flagged", opX.ok && opX.extrapolated, opX);
check("no duty point → no operating point (audit: zero system curve)", H.operatingPoint(curve, 10, 0) === null);
const atH = H.gpmAtHead(curve, H.headFromDeltaP(10.84, 1.0));   // 10.84 psi ≈ 25 ft
check("measured ΔP 10.84 psi → 25 ft → 10 GPM on curve", atH && within(atH.gpm, 10, 0.5), atH);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
