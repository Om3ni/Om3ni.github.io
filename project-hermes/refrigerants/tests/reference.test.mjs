/**
 * refrigerants/tests/reference.test.mjs
 * Checks every refrigerant table against INDEPENDENT saturation data — not
 * against its own source chart, which can't catch swapped or mislabelled
 * columns (the 2026-11 audit found R-407C, R-454B and R-454C wrong that way).
 *
 * Run:  node project-hermes/refrigerants/tests/reference.test.mjs
 * Exit code 1 on any failure.
 *
 * For each point: the app's getSatTemp(id, psig, point) must land within
 * TOL_F of the reference temperature — the same lookup the Refrigeration
 * Analysis tool uses (dew → suction/superheat, bubble → liquid/subcooling).
 *
 * References:
 *   CoolProp 8.0 (HEOS, mass-fraction blends at nominal composition).
 *     HFO-containing blends carry a known ~0.5°F model offset, inside TOL_F.
 *   TDS — R-454C Technical Data Sheet (2025), labelled Bubble/Dew columns.
 *     Used for R-454C because CoolProp runs up to ~2°F warm on that blend.
 *   R-438A dew is omitted: CoolProp lacks interaction data for its 0.6% isopentane.
 */

import { getSatTemp, getSatPressure, listRefrigerants } from "../index.js";

const TOL_F = 1.0;

// [id, point, tempF, psig, reference]
const REFERENCE = [
  ["R-22"   , "dew"    ,   20,   43.1, "CoolProp"],
  ["R-22"   , "dew"    ,   40,   68.6, "CoolProp"],
  ["R-22"   , "bubble" ,   90,  168.4, "CoolProp"],
  ["R-22"   , "bubble" ,  110,  226.4, "CoolProp"],
  ["R-32"   , "dew"    ,   20,   80.0, "CoolProp"],
  ["R-32"   , "dew"    ,   40,  121.0, "CoolProp"],
  ["R-32"   , "bubble" ,   90,  281.3, "CoolProp"],
  ["R-32"   , "bubble" ,  110,  374.9, "CoolProp"],
  ["R-134a" , "dew"    ,   20,   18.4, "CoolProp"],
  ["R-134a" , "dew"    ,   40,   35.0, "CoolProp"],
  ["R-134a" , "bubble" ,   90,  104.3, "CoolProp"],
  ["R-134a" , "bubble" ,  110,  146.4, "CoolProp"],
  ["R-410A" , "dew"    ,   20,   78.4, "CoolProp"],
  ["R-410A" , "dew"    ,   40,  118.4, "CoolProp"],
  ["R-410A" , "bubble" ,   90,  275.4, "CoolProp"],
  ["R-410A" , "bubble" ,  100,  318.5, "CoolProp"],
  ["R-410A" , "bubble" ,  120,  419.4, "CoolProp"],
  ["R-407C" , "dew"    ,   20,   37.9, "CoolProp"],
  ["R-407C" , "dew"    ,   40,   63.2, "CoolProp"],
  ["R-407C" , "bubble" ,   90,  194.1, "CoolProp"],
  ["R-407C" , "bubble" ,  110,  260.3, "CoolProp"],
  ["R-454B" , "dew"    ,   20,   70.6, "CoolProp"],
  ["R-454B" , "dew"    ,   40,  107.5, "CoolProp"],
  ["R-454B" , "bubble" ,   90,  262.3, "CoolProp"],
  ["R-454B" , "bubble" ,  110,  348.6, "CoolProp"],
  ["R-454C" , "dew"    ,   20,   37.6, "TDS"],
  ["R-454C" , "dew"    ,   40,   61.5, "TDS"],
  ["R-454C" , "bubble" ,   90,  192.7, "TDS"],
  ["R-454C" , "bubble" ,  110,  255.4, "TDS"],
  ["R-507A" , "dew"    ,   20,   58.2, "CoolProp"],
  ["R-507A" , "dew"    ,   40,   89.2, "CoolProp"],
  ["R-507A" , "bubble" ,   90,  209.3, "CoolProp"],
  ["R-507A" , "bubble" ,  110,  278.8, "CoolProp"],
  ["R-427A" , "dew"    ,   20,   36.6, "CoolProp"],
  ["R-427A" , "dew"    ,   40,   61.2, "CoolProp"],
  ["R-427A" , "bubble" ,   90,  186.1, "CoolProp"],
  ["R-427A" , "bubble" ,  110,  249.5, "CoolProp"],
  ["R-422B" , "dew"    ,   20,   35.5, "CoolProp"],
  ["R-422B" , "dew"    ,   40,   59.4, "CoolProp"],
  ["R-422B" , "bubble" ,   90,  171.0, "CoolProp"],
  ["R-422B" , "bubble" ,  110,  229.8, "CoolProp"],
  ["R-438A" , "bubble" ,   90,  181.0, "CoolProp"],
  ["R-438A" , "bubble" ,  110,  242.7, "CoolProp"],
  ["R-448A" , "dew"    ,   20,   43.9, "CoolProp"],
  ["R-448A" , "dew"    ,   40,   71.2, "CoolProp"],
  ["R-448A" , "bubble" ,   90,  210.9, "CoolProp"],
  ["R-448A" , "bubble" ,  110,  280.9, "CoolProp"],
  ["R-449A" , "dew"    ,   20,   44.0, "CoolProp"],
  ["R-449A" , "dew"    ,   40,   71.2, "CoolProp"],
  ["R-449A" , "bubble" ,   90,  207.9, "CoolProp"],
  ["R-449A" , "bubble" ,  110,  277.0, "CoolProp"],
  ["R-450A" , "dew"    ,   20,   14.3, "CoolProp"],
  ["R-450A" , "dew"    ,   40,   28.9, "CoolProp"],
  ["R-450A" , "bubble" ,   90,   91.6, "CoolProp"],
  ["R-450A" , "bubble" ,  110,  129.1, "CoolProp"],
  ["R-513A" , "dew"    ,   20,   22.3, "CoolProp"],
  ["R-513A" , "dew"    ,   40,   39.8, "CoolProp"],
  ["R-513A" , "bubble" ,   90,  111.2, "CoolProp"],
  ["R-513A" , "bubble" ,  110,  153.8, "CoolProp"]
];

let fail = 0, pass = 0;
const covered = new Set();
for (const [id, point, tempF, psig, src] of REFERENCE) {
  covered.add(id);
  const t = getSatTemp(id, psig, point);
  const p = getSatPressure(id, tempF, point);
  const ok = t !== null && Math.abs(t - tempF) <= TOL_F;
  if (ok) { pass++; continue; }
  fail++;
  console.log(`FAIL ${id.padEnd(7)} ${point.padEnd(6)} ${psig} psig → ${t}°F, expected ${tempF}°F ±${TOL_F} (${src}); table psig at ${tempF}°F = ${p}`);
}

// Every refrigerant in the library must be covered.
for (const id of listRefrigerants().map(r => (typeof r === "string" ? r : r.id))) {
  if (!covered.has(id)) { fail++; console.log(`FAIL ${id}: no independent reference points`); }
}

console.log(`${pass} passed, ${fail} failed (${covered.size} refrigerants, tolerance ±${TOL_F}°F)`);
if (fail) process.exit(1);
