/**
 * tools/shared/nec.test.mjs — hand-checked cases for nec.js.
 * Run: node project-hermes/tools/shared/nec.test.mjs   (exit 1 on failure)
 * Cases marked "audit" reproduce audit/2026-11/electrical.md.
 */
import * as N from "./nec.js";

let pass = 0, fail = 0;
const near = (a, b, tol = 0.01) => typeof a === "number" && Math.abs(a - b) <= tol;
function check(name, cond, got) {
  if (cond) { pass++; return; }
  fail++; console.log("FAIL", name, "→", JSON.stringify(got));
}
const mm = (rla, fan, other = 0, extra = {}) =>
  N.mcaMocp({ compressors: [{ rla }], motors: fan ? [fan] : [], otherAmps: other, ...extra });

// 240.6(A) rounding
check("≤ 37 → 35", N.standardAtOrBelow(37) === 35);
check("≤ 35 → 35 (exact)", N.standardAtOrBelow(35) === 35);
check("≤ 267.5 → 250", N.standardAtOrBelow(267.5) === 250);
check("≤ 14 → null", N.standardAtOrBelow(14) === null);
check("≥ 36 → 40", N.standardAtOrAbove(36) === 40);
check("≥ 7000 → null", N.standardAtOrAbove(7000) === null);

// audit: MOCP must round DOWN (440.22(A) is a maximum)
let r = mm(20, 2);
check("audit 20/2: MCA 27.0", r.ok && near(r.mca, 27), r);
check("audit 20/2: MOCP 35 / 45", r.mocp175 === 35 && r.mocp225 === 45, r);
r = mm(18, 0);
check("audit 18: MCA 22.5, MOCP 30 / 40", near(r.mca, 22.5) && r.mocp175 === 30 && r.mocp225 === 40, r);
r = mm(26.4, 1.5, 0.5);
check("audit 26.4/1.5/0.5: MCA 35.0", near(r.mca, 35.0), r);
check("audit 26.4/1.5/0.5: MOCP 45 / 60", r.mocp175 === 45 && r.mocp225 === 60, r);
// audit: table capped at 300 A
r = mm(150, 5);
check("audit 150/5: MOCP 250 at 175 %", r.mocp175 === 250, r);
r = mm(200, 10);
check("audit 200/10: MCA 260, MOCP 450 at 225 %", near(r.mca, 260) && r.mocp225 === 450, r);

// audit: negative "extra" lowered both results; now rejected
check("audit negative other load rejected", !mm(20, 2, -10).ok, mm(20, 2, -10));
check("negative RLA rejected", !mm(-5, 2).ok);
check("negative fan rejected", !mm(20, -2).ok);

// audit: fan larger than RLA — 25 % goes to the largest motor, 175 % only to the compressor
r = mm(4, 6);
check("fan > RLA: MCA = 4 + 6 + 0.25×6 = 11.5", near(r.mca, 11.5), r);
check("fan > RLA: calc175 = 1.75×4 + 6 = 13 → 15 A minimum", near(r.calc175, 13) && r.mocp175 === 15, r);

// 15 A minimum
r = mm(6, 0);
check("RLA 6: calc175 10.5 → 15 A", r.mocp175 === 15 && r.mocp225 === 15, r);

// Resistance heat at 125 % in MCA (424.3(B)), 100 % in MOCP
r = mm(20, 2, 0, { heatAmps: 40 });
check("heat 40: MCA = 27 + 50 = 77", near(r.mca, 77), r);
check("heat 40: calc175 = 35 + 2 + 40 = 77 → 70", near(r.calc175, 77) && r.mocp175 === 70, r);
check("heat 40: 70 < MCA 77 flagged", r.belowMca175 === true, r);
// audit: no compressor → Article 440 doesn't apply
check("no compressor → not ok", !N.mcaMocp({ motors: [3], heatAmps: 40 }).ok);

// BCSC used where greater (440.4(C))
r = N.mcaMocp({ compressors: [{ rla: 20, bcsc: 24 }], motors: [2] });
check("BCSC 24 > RLA 20: MCA = 24 + 2 + 6 = 32", near(r.mca, 32), r);
r = N.mcaMocp({ compressors: [{ rla: 20, bcsc: 18 }], motors: [2] });
check("BCSC 18 < RLA 20: RLA governs, MCA 27", near(r.mca, 27), r);

// Two compressors: 175 % on the largest only
r = N.mcaMocp({ compressors: [{ rla: 20 }, { rla: 12 }], motors: [2, 1] });
check("tandem 20+12, fans 2+1: MCA = 35 + 5 = 40", near(r.mca, 40), r);
check("tandem: calc175 = 35 + 12 + 3 = 50 → 50", near(r.calc175, 50) && r.mocp175 === 50, r);

// Table 310.16 conductors. audit: MCA 35 → 10 AWG at 75 °C, 8 AWG at 60 °C
check("Cu 75 °C 35 A → 10 AWG", N.conductorFor(35).size === "10 AWG");
check("Cu 60 °C 35 A → 8 AWG", N.conductorFor(35, { tempC: 60 }).size === "8 AWG");
check("Al 75 °C 35 A → 8 AWG", N.conductorFor(35, { metal: "al" }).size === "8 AWG");
check("Cu 75 °C 27 A → 10 AWG", N.conductorFor(27).size === "10 AWG");
check("Cu 75 °C 260 A → 300 kcmil", N.conductorFor(260).size === "300 kcmil");
check("Cu 75 °C 400 A → over table", N.conductorFor(400).over === true);
check("zero → null", N.conductorFor(0) === null);
check("unknown column → null", N.conductorFor(30, { tempC: 105 }) === null);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
