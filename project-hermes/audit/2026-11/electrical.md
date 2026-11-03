# Electrical — calculator audit

Auditor scope: wire-sizing, breaker-sizing, mca-mocp, capacitor-sizing, electrical (module). All five were driven in Playwright/Chromium at a 390×844 viewport against http://localhost:8765. Scripts and screenshots: `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-electrical/` (wire.js, others.js, shots.js, *.png).

Sources used:
- NEC Table 310.15(B)(16) (now 310.16), from Omni Cable's "NEC Ampacity Data" PDF (2014/2017-era text, values unchanged in 2020/2023 as far as I know). I extracted it with pdftotext. It gives Cu 60/75/90 °C as 14: 15/20/25, 12: 20/25/30, 10: 30/35/40, 8: 40/50/55, 6: 55/65/75 … 500: 320/380/430, and Al 8 AWG as 35/40/45 and 300 kcmil as 195/230/260.
- Ambient correction factors: I recomputed them from the NEC 310.15(B) equation, √((Tc−Ta)/(Tc−30)). They match the factors the code uses for the 75 °C column, and they give 60 °C factors of 0.91/0.82/0.71/0.58/0.41.
- 440.22(A) wording ("not exceeding 175 %… shall not exceed 225 %") and the round-down practice: EC&M "Properly sizing conductors and protective devices – AC and refrigeration equipment". Its worked example: an 18 A compressor gets "175 % = 31.5 A, next size down = 30 A; 225 % = 40.5 A, next size down 40 A".
- 2023 Table 240.6(A) adding 10 A: training and exam-prep sites only (expertce.com, open-exam-prep), so treat it as weakly verified.
- PSC blower capacitor data: supplier listings (siglers.com, munchsupply, supplyhouse). 1/2 HP 115 V PSC blowers specify 10 µF/370 VAC in most cases, with a range of 5–15 µF.

## Summary
| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| wire-sizing | RISKY (conservative, but wrong table under a 75 °C label) | 0 | 1 | 6 | 5 |
| breaker-sizing | OK-WITH-ISSUES | 0 | 0 | 2 | 4 |
| mca-mocp | BROKEN | 1 | 0 | 5 | 3 |
| capacitor-sizing | RISKY | 0 | 1 | 3 | 3 |
| electrical (module) | OK-WITH-ISSUES | 0 | 0 | 1 | 4 |

REVIEW.md claims, re-checked:
- wire-sizing 3-phase VD "2×√3" bug: **no longer present.** The code uses 1.732 for 3-phase and 2 for 1-phase (wire-sizing.html:304), and the reproduced numbers match hand math (below).
- mca-mocp "phase selector has no effect": **stale.** There is no phase selector at all now (0 `[data-ph]` elements).
- REVIEW also says MOCP is "rounded up to next standard breaker" and calls that correct. **It is not correct** (see mca-mocp CRITICAL).
- capacitor-sizing dead `inCapVolts`: **stale.** The tool was rewritten into Verify and Size modes, and that input no longer exists.

---

## wire-sizing (`tools/calculators/wire-sizing.html`)
**What it claims to do:** NEC 310.16 75 °C ampacity, 310.15 ambient and fill derating, 125 % continuous load, 240.4/240.4(D) breaker cap, voltage drop with ≤3 % recommendation. Cu/Al, 1Φ/3Φ, 120–480 V. T3 with a report.

**Method check:**
- Ampacity table (lines 216–218): it is labeled "75°C column", but the values are the **60 °C column**.
  - Cu: 14 = 15, 12 = 20, 10 = 30, 8 = 40, 6 = 55 … 500 = 320.
  - Al: 12 = 15, 10 = 25, 8 = 30, … 300 = 190. Al 8 AWG = 30 and 300 kcmil = 190 are also outdated; the current 60 °C values are 35 and 195.
  - The ambient factors (lines 223–234) are the correct **75 °C** column factors, so the code applies 75 °C correction to 60 °C ampacities.
- Fill factors (237–245) match Table 310.15(C)(1): 80/70/50/45/40/35 %. ✓
- 125 % continuous load is multiplied with the derating factors, `designAmps / (amb × fill)`. NEC 210.19(A)(1)/215.2(A)(1) instead requires the larger of 125 % before adjustment and 100 % after adjustment. The tool's method is conservative.
- No 90 °C derating path and no 110.14(C) termination check. The 60 °C table makes both moot, but conservatively.
- 240.4(D) caps of 15/20/30 A are keyed by gauge only, not by material (240.4(D) gives Al 12 = 15 A and Al 10 = 25 A). Because the Al table values are already 15 and 25, this never produces a violation. Checked.
- Voltage drop:
  - K = 12.9 Cu / 21.2 Al, which equals Ch. 9 Table 8 DC resistance (12 AWG Cu 1.98 Ω/kft × 6.53 kcmil = 12.93; Al 3.25 × 6.53 = 21.2). ✓
  - cmil values match Table 8. ✓
  - The multiplier is 2 for 1Φ and 1.732 for 3Φ. ✓
  - It uses the actual load amps, not 125 %. ✓
  - It is DC-resistance only (no Table 9 AC impedance / power factor).

**Findings**
- [HIGH] **Ampacity table is NEC 310.16 60 °C, labeled and reported as 75 °C.** It oversizes conductors in normal use.
  - Repro: 150 A, non-continuous, Cu, 1–3 conductors, 86 °F → app gives **3/0 AWG** ("165A table"). At 75 °C, which 110.14(C)(1)(b) allows for circuits over 100 A, the answer is **1/0 AWG** (150 A).
  - Repro: 45 A → app 6 AWG. 75 °C answer: 8 AWG (50 A), if the terminations are 75 °C-rated as most HVAC equipment is.
  - The subtitle "Based on NEC 75°C derated ampacity", the hint, and the report footer "NEC 310.16 (75°C)" are all false.
  - Not unsafe: the 60 °C values are always ≤ the 75 °C values. But the number is materially wrong and the stated assumption is wrong.
  - Cause: wire-sizing.html:216–218.
  - Fix: use the real 75 °C (and 90 °C) columns. Add a termination-rating selector (60/75 °C) per 110.14(C)(1). Derate from the insulation column and cap at the termination column.
- [MEDIUM] **Ambient correction uses 75 °C factors on 60 °C ampacities.** This is internally inconsistent.
  - If the user really has a 60 °C conductor (TW/UF), the result is non-conservative. Repro: 28 A, 122 °F, 4–6 conductors → app 6 AWG with "33.0 A derated" (55 × 0.75 × 0.8). The 60 °C factor at 122 °F is 0.58, so 55 × 0.58 × 0.8 = **25.5 A < 28 A**.
  - For the 75 °C conductors the tool claims to model, the result is conservative.
  - Cause: lines 223–234 combined with 217–218. The fix is the same as the HIGH item.
- [MEDIUM] **No 310.15(B)(2) rooftop temperature adder warning.** NEC 2023 adds 33 °C (60 °F) for raceways less than 7/8 in. above a roof in sunlight. That is the standard condenser/RTU install. A tech entering a 95 °F outdoor ambient gets 0.94 instead of the correct "use 155 °F → 0.33" factor.
  - Fix: add a "raceway on rooftop <7/8 in" toggle, or at least a warning in the hint.
- [MEDIUM] **125 % continuous and derating are multiplied instead of taking the larger.** It oversizes.
  - Repro: 40 A continuous, 4–6 conductors → required 62.5 A → 4 AWG. NEC 210.19(A)(1) requires max(50, 40/0.8 = 50) = 50 A → 6 AWG even on the tool's own table.
  - Cause: line 366.
- [MEDIUM] **Invalid voltage/phase combinations accepted silently.**
  - Repro: 120 V + 3-Phase, 20 A, 50 ft → "3-Pole", VD 2.85 % computed against 120 V. 277 V + 3-Phase behaves the same way.
  - A 3Φ circuit on a 120/208Y system is 208 V line-to-line.
  - Fix: disable 120/277 when 3-Phase is selected, or label the voltage as L-L.
- [MEDIUM] **Breaker can be shown as "upsize conductor" while "Minimum Wire Size" still shows the smaller gauge.**
  - Lines 427–432 flag "Exceeds derated ampacity — upsize conductor" when no standard breaker fits between the load and the derated ampacity of a >10 AWG conductor.
  - 240.4(B) (next size up, ≤800 A) would normally permit that breaker, so the warning is both over-strict and contradicts the gauge row.
  - It only triggers on >10 AWG with derating. I could not hit it in the cases I ran because 240.4(D) masks it for 14–10 AWG. Treat it as a logic smell, not a reproduced defect.
- [MEDIUM] **No scope warning for motor/HVAC equipment.** The tool is titled "Wire & Breaker" and sits in the HVAC electrical category, but compressor and multi-motor circuits are sized under Article 440/430 (MCA/MOCP, up to 225 %), not 210/240.
  - A tech entering a compressor RLA gets a "Minimum Breaker" that will nuisance-trip, and conductor sizing without 440.33.
  - Fix: add a one-line pointer to mca-mocp.
- [LOW] Voltage drop uses DC K-factors (Table 8) only. That is fine up to about 1/0. For about 4/0 and larger at PF 0.85, Ch. 9 Table 9 effective Z exceeds DC R, so VD is understated. Magnitude is UNVERIFIED (I did not have Table 9 to hand). Disclose the assumption.
- [LOW] Stale or awkward sub-text:
  - When the ambient is >158 °F or the load exceeds the table, the Breaker row still reads "From load: … — refining with derating…".
  - Required ampacity shows "Infinity A" (repro: 20 A, 159 °F).
- [LOW] Below 77 °F the ambient factor is capped at 1.05; NEC allows up to 1.20 at ≤50 °F. Conservative.
- [LOW] Al 8 AWG = 30 and 300 kcmil = 190 are pre-2014 60 °C values (current: 35 and 195). Moot once the table is replaced.
- [LOW] Breaker list stops at 600 A, and 10 A is missing (added in 2023 Table 240.6(A), weakly verified). Upsizing the conductor for voltage drop doesn't mention proportional EGC upsizing (250.122(B)).

**Verified OK:**
- Fill adjustment factors.
- 75 °C ambient factors and their °F bins (78–86 = 1.00, 87–95 = 0.94, 96–104 = 0.88 … 150–158 = 0.33, >158 = not permitted).
- Ch. 9 Table 8 cmil values and K constants.
- VD formulas. Repro: 30 A, 100 ft, 240 V 1Φ, 10 AWG → 7.46 V / 3.11 %; hand calc 2·12.9·30·100/10380 = 7.457 V ✓. 208 V 3Φ → 6.46 V / 3.10 %; hand calc √3·12.9·30·100/10380 = 6.458 V ✓.
- 240.4(D) small-conductor caps.
- Next-standard-breaker selection.
- Pole count.
- Negative or blank distance and blank ambient are handled. Blank ambient = 86 °F, matching the placeholder.

**Unverified:** Ch. 9 Table 9 impedances (for the size of the large-conductor VD understatement); whether NEC 2023 changed any 310.16 value. I compared against 2014/2017 text.

**UX notes:**
- At 390 px the results start about 940 px down, two screens below the Amps input. The derating summary sits between the inputs and the results.
- The ambient input shows "86" as a placeholder, which looks like an entered value.
- No hint on what "Load Amps" should be for HVAC (MCA? RLA?).
- The 5-button voltage row has no L-L/L-N meaning shown.
- Continuous/Non-continuous defaults to Non-continuous. Most HVAC and heat loads are continuous.

---

## breaker-sizing (`tools/calculators/breaker-sizing.html`)
**What it claims to do:** Load amps × 125 % (continuous) or 100 %, then the next standard OCPD size, plus a pole configuration. T2.

**Method check:** 210.20(A)/215.3: OCPD ≥ non-continuous + 125 % continuous. ✓ The standard list matches 240.6(A) from 15 to 600 A. ✓ Rounding is up. ✓ The circuit-type buttons only change the pole label.

**Findings**
- [MEDIUM] **No conductor context or 240.4 warning on a "Minimum Breaker".**
  - Repro: 40 A continuous → "50 A". Nothing says the conductor must be rated for it (240.4, 240.4(D)). A tech could put 50 A on existing 8 AWG (40 A at 60 °C), which 240.4(B) does not allow.
  - Fix: add a line such as "Conductor must be sized first; OCPD may not exceed conductor ampacity except per 240.4(B)/(G)", and link to wire-sizing.
- [MEDIUM] **No warning that motor/HVAC equipment follows Article 430/440 (nameplate MOCP), not the 125 % rule.** This tool is in the HVAC electrical category.
- [LOW] It cannot do mixed loads (non-continuous + 125 % continuous). It is all-or-nothing.
- [LOW] The list starts at 15 A (2023 240.6(A) added 10 A, weakly verified) and ends at 600 A ("Exceeds 600A" for 481 A continuous, although 700 and 800 are standard).
- [LOW] "1Φ 120V / 1Φ 240V / 3Φ" implies voltage matters; only the pole count changes. 277 V 1-pole and 208 V 2-pole are not represented. (REVIEW's note still holds.)
- [LOW] Non-numeric or huge input: 1e9 → "1000000000.0 A … Exceeds 600A". Harmless.

**Verified OK:** 125 %/100 % math; next-size-up selection, including the exact-boundary cases (16 A continuous = 20.0 → 20 A; 480 A continuous = 600 → 600 A); negative input clears the results.

**Unverified:** NEC 2023 Table 240.6(A) contents (10 A addition): secondary sources only.

**UX notes:** Compact and clear. The results are on screen at 390 px. Continuous defaults to Yes, which is good. Add a units note that this is for non-motor loads.

---

## mca-mocp (`tools/calculators/mca-mocp.html`)
**What it claims to do:** NEC 440.33 MCA and 440.22(A) MOCP (175 % "default", 225 % "maximum") from compressor RLA, fan FLA and other loads, plus the minimum wire gauge. T3, tagged "Report" in index.html.

**Method check:**
- MCA = 1.25 × largest + others is correct per 440.33. ✓
- MOCP per 440.22(A)/(B)(1): the value **may not exceed** 175 % (or 225 % if needed for starting) of the largest motor-compressor RLA/BCSC, plus the other loads. Article 440 has no next-size-up allowance, so the result is rounded **down** to a 240.6(A) standard size, with a 15 A minimum. That is also how UL listings compute nameplate "MAX FUSE/BKR".
- The code rounds **up**: `nextBreaker` at lines 112–117, used at lines 159–160.
- Wire table (96–110) is 60 °C Cu, labeled "75°C copper".

**Findings**
- [CRITICAL] **MOCP is rounded UP to the next standard size, so both MOCP values exceed the 440.22 maximum.**

  | RLA / fan / extra | App MOCP (175 % / 225 %) | Code maximum (round down) |
  |---|---|---|
  | 20 / 2 / 0 | **40 A / 50 A** | 35 A / 45 A (37.0 → 35; 47.0 → 45) |
  | 18 / 0 / 0 | **35 A / 45 A** | 30 A / 40 A (EC&M worked example) |
  | 26.4 / 1.5 / 0.5 | **50 A / 70 A** | 45 A / 60 A (48.2 → 45; 61.4 → 60) |
  | 150 / 5 / 0 | **300 A** (175 %) | 250 A (267.5 → 250) |

  - A tech who trusts "MOCP — Maximum 50 A" installs a breaker above the nameplate and code limit. That is a code violation (110.3(B), 440.22(C)) and loses compressor short-circuit protection.
  - Cause: mca-mocp.html:112–117 and 159–160.
  - Fix: add `prevBreaker()` (largest standard ≤ value, minimum 15 A). If the rounded-down value is below the MCA, show the manufacturer/UL convention, flagged. Also fix the subtitle text "next std size" (line 65) and REVIEW.md, which endorses the wrong rule.
- [MEDIUM] **Silent cap at 300 A.** `nextBreaker` returns 300 for anything larger.
  - Repro: RLA 200, fan 10 → 225 % = 460 A → app shows "300 A" with no warning (round-down answer: 450 A).
  - The MCA of 260 A gives "> 4/0 AWG".
  - Fix: extend the list to 240.6(A) or show "out of range".
- [MEDIUM] **Negative "Additional Loads" accepted and subtracted.**
  - Repro: RLA 20, fan 2, extra −10 → MCA **17.0 A → 12 AWG**. The real MCA is 27 A.
  - Fix: reject values below 0.
- [MEDIUM] **Wire table is 60 °C, labeled "75°C copper".**
  - Repro: MCA 35.0 A (RLA 26.4/1.5/0.5) → app 8 AWG. At 75 °C, 10 AWG (35 A) is compliant, and 240.4(G) lets Article 440 protection exceed 240.4(D).
  - Conservative. The 60 °C column is also the 110.14(C)(1)(a) default for unmarked ≤100 A terminations, so the values are defensible but the label is wrong.
  - No derating (ambient/rooftop/fill) is mentioned for a wire size that is presented as "Min Wire Gauge".
- [MEDIUM] **Missing 440.22/440.33 inputs.**
  - No BCSC input. 440.22(A) and 440.33 use "RLA or BCSC, whichever is greater".
  - Only one compressor.
  - "Additional loads" are taken at 100 % in the MCA, but resistance heaters (424.3(B)) are required at 125 %. An air handler with heat strips is under-stated. Repro: RLA 0, fan 3, extra 40 (heat) → the app's MCA is 43.75; the 424.3(B) basis is 1.25 × 43 = 53.75.
- [MEDIUM] **T3 contract not met.** CALCULATORS.md requires a report modal for T3, and index.html tags the tool "Report", but there is no report button. The results drive purchasing and install decisions.
- [LOW] The largest load is picked from max(RLA, fan). When the fan FLA exceeds the RLA, 175 %/225 % is applied to the fan motor, but 440.22(B)(1) applies it to the largest **motor-compressor**. Repro: RLA 3, fan 60 → MOCP 110/150 A. Edge case.
- [LOW] The "MOCP — Default 175 %" framing does not match what nameplates show (225 %-based max fuse/breaker). The hint does say the nameplate governs.
- [LOW] "40 A" wraps onto two lines in the MOCP row at 390 px.

**Verified OK:**
- MCA arithmetic: 20/2 → 27.0 ✓; 18/0 → 22.5 ✓; 26.4/1.5/0.5 → 35.0 ✓.
- The 15 A minimum holds (RLA 6 → 15 A).
- Results reset when both motor inputs are blank or zero.
- No phase selector exists (the REVIEW claim is stale).

**Unverified:** The exact UL 1995/60335-2-40 wording for the case "rounded-down MOCP < MCA" (I did not reach the standard). NEC 2023 440.22 text was confirmed only via secondary sources (EC&M), not the code book.

**UX notes:** Short page with results directly under the inputs, which is good. The Capture button is 21 px tall, too small a tap target. No input for nameplate MCA/MOCP to compare against. The 225 % row has no visual emphasis that it is conditional.

---

## capacitor-sizing (`tools/calculators/capacitor-sizing.html`)
**What it claims to do:** Verify mode: µF = 2652 × A / V from running measurements, compared with the nameplate (GOOD ≤6 %, MARGINAL 6–10 %, FAILED >10 %). Size mode: 12–18 µF/HP at 230 V scaled by (230/V)², nearest standard size, and a voltage rating. index.html calls it "Run and start capacitor check"; CALCULATORS.md calls it "Run/start cap sizing".

**Method check:**
- 2652 = 10⁶/(2π·60) = 2652.6 ✓. The 50 Hz figure 3183 ✓.
- Measuring the voltage across the capacitor (HERM/FAN to C) is correct for this formula.
- The size rule of thumb has no authoritative source. Checked against manufacturer data, it holds roughly at 208/230 V and fails at 115 V.

**Findings**
- [HIGH] **Size mode overestimates 115 V capacitors about 3×, and the 1/V² scaling is wrong.**
  - Repro: 1/2 HP, 115 V → app "24.0–36.0 MFD, nearest **30 MFD**". Supplier and OEM listings for 1/2 HP 115 V PSC blowers specify mostly **10 µF/370 V**, range 5–15 µF (siglers.com 7.4 A/10 µF and 9.6 A/15 µF; Munch/Packard "1/2 HP use 10 mfd at 370"; Marathon 5 µF).
  - Repro: 1/3 HP 115 V → app 20 µF.
  - The tool's own help warns that oversized caps overdrive and overheat the start winding.
  - Disclosed as "estimate only", so not CRITICAL.
  - Cause: line 352, `scale = (230/v)²`.
  - Fix: drop the voltage scaling, or remove 115 V support from Size mode.
- [MEDIUM] **Voltage-rating advice "250 VAC for 115 V" contradicts the manufacturer specs above**, which call for 370 VAC. Capacitor voltage in a PSC circuit exceeds line voltage. Cause: lines 328 and 220. Fix: minimum 370 V.
- [MEDIUM] **Silent clamp outside 3–80 µF.**
  - Repro: 10 HP 230 V → range "120.0–180.0 MFD", "Nearest Standard **80 MFD**", outside its own range.
  - Repro: 1/2 HP 460 V → range 1.5–2.3, "Nearest 3 MFD".
  - Cause: `nearestStd` at lines 243–251. Fix: show "out of range" instead.
- [MEDIUM] **Verify mode declares "FAILED" and the help says "beyond 10% replace the cap".** That is a fault declaration, which CALCULATORS.md boundary rules 1–2 prohibit for calculators.
  - The bands also ignore the cap's rated tolerance. Most HVAC run caps are marked ±6 % (some ±5 %, some ±10 %). Repro: 370 V, 6.9 A, nameplate 45 µF → 49.5 µF, +9.9 % "MARGINAL", but a ±6 % cap reading +9.9 % is out of its rating.
  - Fix: add a "rated tolerance" input (±5/6/10 %) and report "within / outside rated tolerance" as a reference value.
- [LOW] No 50/60 Hz selector, although the hint gives 3183.
- [LOW] "Run/start" in index.html and CALCULATORS.md: there is no start-capacitor mode.
- [LOW] Measurement uncertainty from clamp meter and voltmeter accuracy (roughly ±2–3 %) is not mentioned, while the GOOD/MARGINAL boundary is 6 %.

**Verified OK:**
- 2652 constant and formula. Repro: 240 V, 4.0 A → 44.2 µF; hand calc 4 × 2652.6 / 240 = 44.21 ✓.
- Percent-vs-nameplate math: 49.5 vs 45 = +9.9 % ✓.
- Band edges: |pct| ≤ 6 → GOOD, ≤ 10 → MARGINAL ✓.
- Blank, zero or negative inputs clear the results.
- 208/230 V Size outputs for 1/4–1/2 HP fan motors are plausible: 4, 5 and 7.5 µF against typical 5/5/7.5 µF.

**Unverified:** The 12–18 µF/HP rule for compressors (3 HP → 45 µF, 5 HP → 70 µF). I found no authoritative source, and OEM compressor caps vary widely. 460 V PSC capacitor practice.

**UX notes:** Mode toggle and results are close together, which is good. Switching modes keeps the other mode's values hidden but live. "MFD" and "µF" are used interchangeably. The help is inside a collapsed `<details>`, so the measurement procedure and the discharge warning are easy to miss on mobile.

---

## electrical (module) (`tools/electrical.html`)
**What it claims to do:**
- Records the nameplate voltage and the supply L-L/L-G readings (1Φ/3Φ).
- Computes average L-L, deviation from rated (V and %), and NEMA voltage unbalance.
- Echoes transformer primary/secondary readings.
- Builds a report. The module is embedded by other analyzers via `getCalcState`/`getReportBlock`.

**Method check:** NEMA MG-1 unbalance = max |V − avg| / avg × 100, on L-L only, computed only when all three readings are present. ✓ Deviation = avg − nameplate. ✓ Transformers have no computation (no ratio or expected secondary); they only echo the readings.

**Findings**
- [MEDIUM] **Partial 3Φ entry silently produces "Average L-L" and "Deviation from Rated" from 1 or 2 legs.** Nothing indicates the average is incomplete.
  - Repro: 480, 480, blank; nameplate 460 → "Average L-L 480.0 V", "+20.0 V / +4.3 %". The unbalance row is correctly hidden.
  - Fix: require all three legs, or label the result "(2 of 3 legs)".
- [LOW] No reference band is shown: nameplate ±10 % utilization range (e.g. 187–253 V for 208/230 V equipment), and NEMA MG-1 derating above 1 % unbalance. That is acceptable under the no-diagnose rule, but a reference value would help the tech. A single "Rated Voltage" field can't hold dual ratings like 208/230.
- [LOW] `vDevPct` is computed from `vDev` after `vDev` has been rounded to 0.1 V (line ~545). Minor precision issue.
- [LOW] Negative or nonsense voltages are accepted. The standalone report prints "ELECTRICAL ANALYSIS" twice (header plus block).
- [LOW] The results block repeats every input verbatim, which doubles page length (1220 px at 390 wide). The transformer section adds inputs but no derived values, so it may look like it calculates something.

**Verified OK:**
- Unbalance math. Repro: 460/467/450 → avg 459.0, max dev 9 → 1.96 % ✓. 208/212/204 → avg 208, dev 4 → 1.92 % ✓. Balanced → 0.00 %.
- Deviation: 459 vs 460 → −1.0 V / −0.2 % ✓.
- Phase switching shows and hides the correct inputs and results.
- The report reflects state.

**Unverified:** How the parent analyzers (airflow/heat/refrigeration/motors) consume `getCalcState`. That is out of this group's scope.

**UX notes:**
- The results duplicate the inputs.
- Line-to-ground inputs have no explanation of why they're optional or what they're for.
- The Capture button is 21 px tall.
- The orange theme differs from the calculators.
- The transformer block defaults to 3Ph primary and 1Ph secondary with no explanation.
