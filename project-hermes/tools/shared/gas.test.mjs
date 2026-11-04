/**
 * tools/shared/gas.test.mjs — hand-checked cases for gas.js / gas-tables.js.
 * Run: node project-hermes/tools/shared/gas.test.mjs   (exit 1 on failure)
 * Cases marked "audit" reproduce audit/2026-11/heatgas.md.
 */
import * as G from "./gas.js";

let pass = 0, fail = 0;
function check(name, cond, got) {
  if (cond) { pass++; return; }
  fail++; console.log("FAIL", name, "→", JSON.stringify(got));
}
const one = (gas, btuh, lengthFt, extra = {}) => {
  const r = G.sizeSystem({ gas, lengthFt, sections: [{ name: "main", btuh }], ...extra });
  return r.ok ? { ...r.sections[0], rowLength: r.rowLength, r } : r;
};
const ng = G.TABLES.ng, lp = G.TABLES.lp;

// Table spot checks against the printed code (402.4(2), 402.4(28))
check("NG 10 ft row", JSON.stringify(ng.cap[0].slice(0, 6)) === "[172,360,678,1390,2090,4020]", ng.cap[0]);
check("NG 100 ft row", JSON.stringify(ng.cap[ng.lengths.indexOf(100)].slice(0, 4)) === "[50,104,195,400]");
check("NG 80 ft row", JSON.stringify(ng.cap[ng.lengths.indexOf(80)].slice(0, 6)) === "[56,117,220,452,677,1300]");
check("NG 2000 ft 1/2 in. is NA", ng.cap[ng.lengths.indexOf(2000)][0] === null);
check("LP 10 ft row", JSON.stringify(lp.cap[0].slice(0, 6)) === "[291,608,1150,2350,3520,6790]", lp.cap[0]);
check("LP 100 ft row", JSON.stringify(lp.cap[lp.lengths.indexOf(100)].slice(0, 6)) === "[84,175,330,677,1010,1950]");
check("LP 70 ft row exists (2018 printing lost it)", lp.lengths.includes(70) && lp.cap[lp.lengths.indexOf(70)][0] === 101);
check("40 rows each", ng.lengths.length === 40 && lp.lengths.length === 40 && ng.cap.length === 40 && lp.cap.length === 40);

// Row selection: exact or next longer, never interpolate
check("9 ft → 10 ft row", G.rowFor(ng, 9) === 0);
check("50 ft → 50 ft row", ng.lengths[G.rowFor(ng, 50)] === 50);
check("51 ft → 60 ft row", ng.lengths[G.rowFor(ng, 51)] === 60);
check("2001 ft → beyond", G.rowFor(ng, 2001) === null);

// audit: runs over 100 ft clamped to the 100 ft row
let s = one("ng", 90000, 200);
check("audit NG 90k @ 200 ft → 1 in.", s.size === "1" && s.rowLength === 200, s);
s = one("ng", 75000, 250);
check("audit NG 75k @ 250 ft → 1 in.", s.size === "1", s);
// audit: interpolation undersized
s = one("ng", 120000, 11);
check("audit NG 120k @ 11 ft → 3/4 in. (20 ft row)", s.size === "3/4" && s.rowLength === 20, s);
s = one("ng", 300000, 45);
check("audit NG 300k @ 45 ft → 1-1/4 in.", s.size === "1-1/4", s);
s = one("ng", 115000, 21);
check("audit NG 115k @ 21 ft → 3/4 in.", s.size === "3/4", s);
// audit: LP multiplier 2.5× overstated
s = one("lp", 400000, 10);
check("audit LP 400k @ 10 ft → 3/4 in.", s.size === "3/4" && s.load === 400, s);
s = one("lp", 200000, 100);
check("audit LP 200k @ 100 ft → 1 in.", s.size === "1", s);
// audit: table values copied high
for (const [btu, L, want] of [[880000, 50, "2"], [605000, 100, "2"], [1450000, 20, "2"], [700000, 75, "2"], [175000, 10, "3/4"]]) {
  s = one("ng", btu, L);
  check(`audit NG ${btu / 1000}k @ ${L} ft → ${want} in.`, s.size === want, s);
}
// Exactly at capacity fits
s = one("ng", 172000, 10);
check("NG 172k @ 10 ft fits 1/2 in. exactly", s.size === "1/2", s);
// Heating value: 1,000 default, supplier value used when given
s = one("ng", 180000, 10, { heatingValue: 1050 });
check("NG 180k @ 1050 Btu/ft³ = 171.4 CFH → 1/2 in.", s.size === "1/2" && Math.abs(s.load - 171.43) < 0.01, s);
check("default heating value 1000", one("ng", 180000, 10).size === "3/4");
// NA cell skipped
s = one("ng", 9000, 2000);
check("NG 9 CFH @ 2000 ft → 3/4 in. (1/2 is NA)", s.size === "3/4", s);
// Beyond the table
check("2100 ft refused", !one("ng", 50000, 2100).ok && one("ng", 50000, 2100).beyond);
s = one("lp", 50000000, 10);
check("LP load beyond 4 in. → over", s.over === true && s.size === null, s);
// Input checks
check("negative load refused", !G.sizeSystem({ gas: "ng", lengthFt: 50, sections: [{ btuh: -5 }] }).ok);
check("no length refused", !G.sizeSystem({ gas: "ng", sections: [{ btuh: 5 }] }).ok);
check("no loads refused", !G.sizeSystem({ gas: "ng", lengthFt: 50, sections: [] }).ok);

// Fittings (Table A102.2): 30 × 0.824 / 12 = 2.06 ft per 3/4 in. ell
check("3/4 in. ell = 2.06 ft", Math.abs(G.fittingsLength({ ell90: 1 }, 0.824) - 2.06) < 0.005);
check("1 in. tee = 5.24 ft", Math.abs(G.fittingsLength({ tee: 1 }, 1.049) - 5.245) < 0.005);
// Fewer than four fittings: no allowance (A103.1 step 1)
let r = G.sizeSystem({ gas: "ng", lengthFt: 48, fittings: { ell90: 3 }, sections: [{ btuh: 150000 }] });
check("3 fittings: no allowance, 50 ft row", r.ok && !r.fittingsApplied && r.rowLength === 50, r);
// Four or more: 48 ft + 6 ells at 1 in. (6 × 2.62 = 15.7) → 70 ft row
r = G.sizeSystem({ gas: "ng", lengthFt: 48, fittings: { ell90: 6 }, sections: [{ btuh: 150000 }] });
check("6 ells: 48 + 15.7 ft → 70 ft row", r.ok && r.fittingsApplied && r.rowLength === 70 && r.fittingsAt === "1", r);

// Whole system: longest length sizes every section from one row (A103.1)
r = G.sizeSystem({ gas: "ng", lengthFt: 60, sections: [
  { name: "Meter to tee", btuh: 100000 + 40000 + 35000 },
  { name: "Tee to furnace", btuh: 100000 },
  { name: "Tee to water heater", btuh: 40000 },
  { name: "Tee to range", btuh: 35000 }] });
check("system uses the 60 ft row", r.ok && r.rowLength === 60, r);
check("system sizes 1 in. / 3/4 / 1/2 / 1/2", r.sections.map((x) => x.size).join(",") === "1,3/4,1/2,1/2", r.sections);

// Empty sections keep their place
r = G.sizeSystem({ gas: "ng", lengthFt: 60, sections: [{ name: "a", btuh: 100000 }, { name: "b", btuh: 0 }, { name: "c", btuh: 35000 }] });
check("empty section keeps order", r.ok && r.sections[1].empty && r.sections[2].name === "c" && r.sections[2].size === "1/2", r.sections);

console.log(`${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
