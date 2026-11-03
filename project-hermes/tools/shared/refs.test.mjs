/**
 * tools/shared/refs.test.mjs — hand-checked cases for refs.js.
 * Run: node project-hermes/tools/shared/refs.test.mjs   (exit 1 on failure)
 * Cases marked "audit" are reproductions from audit/2026-11/motors.md.
 */
import * as R from "./refs.js";

let pass = 0, fail = 0;
const near = (a, b, tol = 0.01) => a !== null && b !== null && Math.abs(a - b) <= tol;
function check(name, cond, got) {
  if (cond) { pass++; return; }
  fail++; console.log("FAIL", name, "→", JSON.stringify(got));
}

// Unbalance (NEMA definition). audit: 460/467/450 → 1.961 %
let u = R.unbalance([460, 467, 450]);
check("voltage unbalance 460/467/450", u.ok && near(u.pct, 1.9608, 0.001) && near(u.avg, 459), u);
check("unbalance needs all three", !R.unbalance([12, null, null]).ok, R.unbalance([12, null, null]));   // audit: partial average
check("unbalance rejects zero/negative", !R.unbalance([0, 10, 10]).ok && !R.unbalance([-5, 10, 10]).ok);
u = R.unbalance([1.00, 1.06, 1.12]);
check("winding balance 1.00/1.06/1.12 = 5.66 %", u.ok && near(u.pct, 5.6604, 0.001), u);

// Voltage range ±10 %. audit: rated 460, supply 506–508 is outside (+10.2 %)
let vr = R.voltageRange(460);
check("460 V range 414–506", vr.ok && near(vr.min, 414) && near(vr.max, 506), vr);
vr = R.voltageRange(208, 230);
check("208–230 V range 187.2–253", vr.ok && near(vr.min, 187.2) && near(vr.max, 253), vr);
check("parse 208/230", JSON.stringify(R.parseRatedVolts("208/230")) === '{"low":208,"high":230}', R.parseRatedVolts("208/230"));
check("parse 208–230 (en dash)", JSON.stringify(R.parseRatedVolts("208–230")) === '{"low":208,"high":230}');
check("parse junk", R.parseRatedVolts("abc") === null);

// IR minimum. audit: 460 V motor must not get a 1 MΩ floor
check("IR min 460 V = 5 MΩ", R.irMinimum({ ratedVolts: 460 }).value === 5);
check("IR min 230 V = 5 MΩ", R.irMinimum({ ratedVolts: 230 }).value === 5);
check("IR min blank V = 5 MΩ", R.irMinimum({}).value === 5);
check("IR min 4160 V = kV+1 = 5.16", near(R.irMinimum({ ratedVolts: 4160 }).value, 5.16));   // audit: was 4
check("IR manufacturer overrides", R.irMinimum({ ratedVolts: 460, mfrMinimum: 2 }).value === 2);

// IR temperature correction: halves per 10 °C. 4 MΩ at 68 °F (20 °C) → 1 MΩ at 40 °C
let c = R.irCorrectTo40C(4, 68);
check("IR 4 MΩ @68°F → 1 MΩ @40°C", c.corrected && near(c.value, 1.0, 0.001), c);
c = R.irCorrectTo40C(4, 104);          // 40 °C → unchanged
check("IR @104°F unchanged", near(c.value, 4, 1e-9), c);
c = R.irCorrectTo40C(4, null);
check("IR no temp → uncorrected", c.corrected === false && c.value === 4, c);
check("test voltage guide 230 V → 500 V DC", R.irTestVoltageGuide(230).text === "500 V DC");

// Capacitor tolerance from the printed value. audit: 7.5 rated, 7.0 measured = −6.67 %
let cap = R.capacitorCheck(7.5, 7.0, 10);
check("cap 7.0/7.5 ±10% within", cap.ok && near(cap.devPct, -6.667, 0.001) && cap.withinTolerance === true, cap);
cap = R.capacitorCheck(7.5, 7.0, 6);
check("cap 7.0/7.5 ±6% outside", cap.withinTolerance === false, cap);
cap = R.capacitorCheck(7.5, 7.0, null);
check("cap no tolerance → no verdict", cap.ok && cap.withinTolerance === undefined, cap);
check("cap rated 0 rejected", !R.capacitorCheck(0, 7, 6).ok);                                   // audit: Infinity %
check("µF from current: 2652×A/V (1 A, 370 V = 7.17)", near(R.capacitorFromCurrent(1, 370), 7.169, 0.01), R.capacitorFromCurrent(1, 370));

// Terminal ID. Healthy compressor: C-R 0.5, C-S 1.6, R-S 2.1, terminals labelled 1..3 arbitrarily.
// Say C=2, R=3, S=1: pairs 1-2 = S-C 1.6, 1-3 = S-R 2.1, 2-3 = C-R 0.5
let t = R.identifyTerminals(1.6, 2.1, 0.5);
check("terminal ID C=2 R=3 S=1", t.ok && t.common === "2" && t.run === "3" && t.start === "1" && near(t.diff, 0), t);
// audit: 0.2 Ω lead offset on each reading (0.6/1.8/2.2) → 0.2 Ω mismatch, reported, not judged
t = R.identifyTerminals(1.8, 2.2, 0.6);
check("lead offset shows +/-0.2 Ω mismatch", t.ok && near(t.diff, -0.2), t);
check("equal readings can't be identified", !R.identifyTerminals(1, 1, 2).ok);
check("vsSpec 0.55 vs 0.50 = +10 %", near(R.vsSpec(0.55, 0.5), 10));

// Load. audit: blank SF must be 1.0 (not silent 1.15); highest leg, not average.
let L = R.motorLoad({ fla: 4.0, amps: 4.56 });
check("PSC SF blank → 1.0 assumed, over SF", L.ok && L.sf === 1 && L.sfAssumed && L.overSF && near(L.pctFLA, 114), L);
L = R.motorLoad({ fla: 10, serviceFactor: 1.0, amps: [10.9, 10.0, 9.1] });
check("3φ highest leg 10.9 = 109 %, over SF 1.0", L.ok && L.highLeg === 1 && near(L.pctFLA, 109) && L.overSF, L);
check("3φ needs all legs", !R.motorLoad({ fla: 10, amps: [12, null, null] }).ok);
check("FLA 0 rejected", !R.motorLoad({ fla: 0, amps: 4 }).ok);                                   // audit: Infinity %
check("negative amps rejected", !R.motorLoad({ fla: 4, amps: -5 }).ok);                          // audit: −125 % green

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
