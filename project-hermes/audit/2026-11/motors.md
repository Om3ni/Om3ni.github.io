# Motor Analysis — calculator audit

## Summary
| Tool | Verdict (BROKEN / RISKY / OK-WITH-ISSUES / OK) | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Motor Analysis (`tools/motors.html`) | RISKY | 0 | 3 | 11 | 6 |

The arithmetic is mostly right: the NEMA unbalance formula, the cap deviation % and the winding sum. The problems are in the thresholds the tool attaches to those numbers and in the checks it frames as pass/fail. It shows green, yellow and red "ok / warn / bad" verdicts. Some of those come from wrong standards (IEEE 43). Some come from a check that cannot detect what the hint says it detects (the single-phase winding sum). Some are physically meaningless measurements (winding-to-winding megger on 3-terminal motors). There is no CRITICAL item: nothing here sizes conductors or protection. The worst real-world outcomes are a red flag that condemns a healthy compressor, or a green or "above floor" result on a motor that should not be energized.

All results were reproduced in Chromium (Playwright, 390×844 viewport) against `http://localhost:8765/project-hermes/tools/motors.html`. Scripts: `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-motors/run.js` and `run2.js`. No console or page errors occurred.

## Motor Analysis (`tools/motors.html`)

**What it claims to do:** This is a multi-reading "Analyzer" with four tabs: PSC, 3-Phase, ECM and Compressor (1Φ/3Φ toggle). Each tab takes nameplate data, running volts and amps, winding resistance and insulation resistance (megger) readings. It shows color-coded results and exports a text report. The PSC tab also compares a run capacitor's measured µF against its rating. The tool does not include the µF-from-current method (2652 × A / V). That method exists only in `tools/calculators/capacitor-sizing.html`.

**Method check:**
- **Insulation resistance minimum.** The code uses `max(1 MΩ, kV)` (`meggerFloor`, line 1368) and labels it "IEEE 43 floor: 1 MΩ per kV rated voltage, minimum 1 MΩ".
  - IEEE 43 (2000 and 2013 editions, recommended minimum IR1min at 40 °C) gives: **kV + 1 MΩ** for pre-1970 windings, field windings and others not listed; **5 MΩ** for random-wound stators and form-wound coils rated below 1 kV; **100 MΩ** for form-wound AC windings built after about 1970.
  - Every HVAC motor and compressor is random-wound and below 1 kV, so the IEEE 43 figure for these machines is 5 MΩ. Even the old formula gives 1.23 MΩ at 230 V and 1.46 MΩ at 460 V. The tool's floor is below IEEE 43's in every case.
  - IEEE 43 minimums apply to readings corrected to 40 °C. The tool has no winding-temperature input and applies no correction.
  - IEEE 43 is a rotating-machine standard. It is not the governing criterion for hermetic compressors, whose windings sit in refrigerant and oil. Manufacturer criteria apply there and the tool does not cite any.
- **Single-phase winding check.** The code checks |(C-R + C-S) − R-S| / R-S against 5% (warn) and 10% (bad).
  - The identity R-S = C-R + C-S is correct for C/R/S windings in series, and the arithmetic matches.
  - However, the identity holds by construction for any series topology. A shorted run or start winding, or shorted turns, lower one term and R-S by the same amount, so the sum still balances.
  - An open winding reads OL and cannot be entered at all.
  - The industry method for spotting shorted windings is to compare each reading with the manufacturer's published resistance. The tool has no input for that.
- **3-phase winding balance.** The code computes the maximum deviation from the average, warning above 5% and flagging bad above 10%. This is a common field convention, not a cited standard (UNVERIFIED as a standard). The arithmetic is correct.
- **Voltage unbalance.** The code computes 100 × max deviation from the average / average of the three line-to-line readings. That is the NEMA MG-1 definition and it is correct.
  - Thresholds: warn above 1%, bad above 2%. NEMA MG-1 requires derating above 1% and does not recommend operation above 5%. 2% is a common compressor-manufacturer limit.
  - No derating factor is computed.
  - The sub-label "NEMA: >1% causes ~6× current unbalance" misquotes NEMA. NEMA says current unbalance is typically 6 to 10 times the voltage unbalance percentage.
- **Current unbalance.** Same formula, with warn above 5% and bad above 10%. The label says "NEMA: >10% indicates voltage or winding issue". NEMA MG-1 sets no 10% current-unbalance limit, so the attribution is wrong.
- **Amps vs nameplate.**
  - PSC and 3-phase: % of FLA. "Bad" above FLA × SF; when SF is blank the tool silently uses FLA × 1.15.
  - 3-phase uses the average of the three legs, not the highest leg.
  - Compressor: % of RLA, with "bad" above 110% of RLA. RLA is a UL/NEC rating value (MCC / 1.56 under UL; Copeland also uses other divisors). It is not a running limit. The protector trip reference is MCC, which the tool does not collect.
- **Supply voltage.** NEMA MG-1 12.44 sets a ±10% of nameplate voltage utilization range. Only the 3-Phase tab compares supply to nameplate, as a bare volt difference with no flag. The PSC and Compressor tabs show the supply voltage but never compare it.

### Findings

- **[HIGH] The "IEEE 43 floor" is below the IEEE 43 minimum for every HVAC machine, and readings under the real minimum are reported "above floor".**
  - Repro (3-Phase tab):
    - Rated 460 V, T2-G = 1.2 MΩ. The app shows "IEEE 43 floor: 1 MΩ — above floor" with a yellow row. IEEE 43 gives 5 MΩ for a random-wound stator below 1 kV, and kV+1 = 1.46 MΩ even under the legacy formula. Correct output: below minimum.
    - Rated 4160 V, T1-G = 4.5 MΩ. The app shows "IEEE 43 floor: 4 MΩ — above floor". kV+1 = 5.16 MΩ, so the reading is below minimum. For a post-1970 form-wound machine the minimum is 100 MΩ.
    - With rated voltage left blank (the field shows a "460" placeholder but is empty), the floor silently becomes 1 MΩ.
  - Cause: `meggerFloor()` line 1368 (`Math.max(1, ratedKV)`, with the 1 MΩ addend missing). The hint text at lines 261, 537, 818, 1029 and 1123 repeats the wrong rule.
  - Same rule is used in PSC, 3-Phase, ECM and both compressor modes.
  - Suggested fix: either state the IEEE 43 values correctly (5 MΩ for random-wound below 1 kV, kV+1 legacy, at 40 °C) with a temperature input and correction, or drop the "IEEE 43" label and show the raw readings plus the user's own or manufacturer's reference. For compressors, cite the compressor manufacturer's criterion instead of IEEE 43.

- **[HIGH] The single-phase "Balance Check" turns green for a dead-shorted or shorted-turn winding, and the hint says the check detects exactly that.**
  - Repro (Compressor tab, 1Φ):
    - C-R 0, C-S 2, R-S 2 (run winding dead short). The app shows "0.0 % dev" in green (ok).
    - C-R 0.2, C-S 2.0, R-S 2.2 (healthy C-R would be about 0.5). The app shows "0.0 % dev" in green.
    - The hint at lines 200 and 968 reads "Large deviation indicates open or shorted winding." Correct behavior: the sum identity cannot detect either fault. An open winding reads OL and cannot be entered, and shorted turns keep the sum balanced.
  - Conversely, normal measurement error drives false "warn" and "bad" results on low-ohm compressors:
    - 0.2 Ω of un-zeroed lead resistance on each reading (true 0.4 / 1.6 / 2.0 Ω), entered as 0.6 / 1.8 / 2.2, shows "9.1 % dev" (warn).
    - Swapping the C-S and R-S labels (1 / 4 / 3) shows "66.7 % dev" (bad) with the "open or shorted winding" hint.
  - The exported report also drops the sum and deviation lines whenever any reading is 0, which is exactly the dead-short case (`if (wCR && wCS && wRS)`, lines 1925 and 2060).
  - Cause: method error. Lines 1438–1440, 1464–1469, 1685–1695.
  - Suggested fix:
    - Present the sum only as a terminal-identification and measurement-consistency check. Use the largest reading for R-S, the smallest for C-R and the middle for C-S, and say so.
    - Add optional "manufacturer spec Ω" inputs and show the % difference from spec.
    - Add a "zero your leads" note.
    - Remove the fault wording.
    - Use `!== null` in the report.

- **[HIGH] The winding-to-winding and phase-to-phase megger sections ask for a measurement that is physically just the winding's copper on 3-terminal machines, then flag the reading red.**
  - Background: on a PSC motor, a single-phase compressor (C/R/S share an internal junction), a 3-lead 3-phase motor or compressor (internal wye or delta), and an ECM stator (internal wye), a megger across two terminals reads through the winding: a few ohms, so 0.00 MΩ.
  - Repro: Compressor 1Φ, C-R / C-S / R-S megger = 0 shows "0.0 MΩ" in red (bad) on all three. ECM T1-T2 megger = 0 shows red (bad). PSC and 3-Phase behave identically (`meggerPhaseAnalysis`, line 1395: below 1 MΩ is bad, below 10 MΩ is warn).
  - Correct behavior: phase-to-phase IR is only meaningful on 6-, 9- or 12-lead motors with the winding connections opened. Otherwise the field should not exist.
  - Impact: a tech following the form on a healthy compressor gets three red results. That is a false fault indication and also breaks the CALCULATORS.md "do not declare faults" rule.
  - Suggested fix: remove these fields for PSC, 1Φ compressor and ECM. On 3-Phase, show them only behind a "6/9/12-lead, connections separated" option.

- **[MEDIUM] When Service Factor is blank, the tool silently assumes 1.15, while the PSC placeholder shows "1.0".**
  - Repro (PSC): FLA 4.0, SF blank, running 4.56 A shows "114.0 %" in yellow (warn) with no SF ceiling shown. The same readings with SF = 1.0 entered show red (bad) and "SF ceiling: 4 A".
  - The 1.15 assumption is never displayed. The 3-Phase SF placeholder "1.15" also looks like a pre-filled value.
  - Cause: line 1413 (`sfCeiling ?? fla * 1.15`) and the placeholders at lines 121 and 384.
  - Suggested fix: treat a blank SF as 1.0, the conservative choice, or show "SF assumed 1.15". Do not use placeholders that look like values.

- **[MEDIUM] The 3-phase % of FLA uses the average of the legs, so a leg above the nameplate SF current shows green.**
  - Repro: FLA 10, SF 1.0, legs 10.9 / 10.0 / 9.1 show "Average 10.0 A, 100.0 %" in green (ok). L1 is 109% of FLA and 0.9 A over the SF ceiling.
  - Overload relays act per leg, and NEMA MG-1 and manufacturers judge loading by the highest leg.
  - Cause: line 1527 and the `ampPctAnalysis(avgAmps…)` call that follows it.
  - Suggested fix: base % FLA on the highest leg, and show both.

- **[MEDIUM] Compressor amps above 110% of RLA are flagged red, but RLA is not a running limit, MCC is not collected and LRA is a dead input.**
  - Repro: RLA 20, running 22.5 A shows "112.5 %" in red (bad).
  - RLA = MCC/1.56 per UL. The protector trip reference is MCC, and running amps depend on suction and discharge pressure and voltage. ACHR News ("Troubleshooting with compressor amperage") states RLA should not be used to judge whether a compressor is running properly.
  - LRA is collected but used only in the report.
  - Cause: line 1671.
  - Suggested fix: show % of RLA neutrally, add an optional MCC input to compare against, use LRA (for example a locked-rotor or start-current reference) or remove it.

- **[MEDIUM] No ±10% supply-voltage check (NEMA MG-1 12.44 utilization range).**
  - Repro (3-Phase): rated 460 V, supply 506 / 507 / 508 V shows "Deviation from Rated: 47.0 V" with no color. The supply is +10.2%, outside the ±10% range.
  - The PSC and Compressor tabs never compare supply to rated voltage at all. The ECM checklist does mention ±10%.
  - Cause: line 1563.
  - Suggested fix: show % deviation, and give the ±10% band as a reference.

- **[MEDIUM] The 3Φ compressor mode takes one amp reading and one voltage reading.** There are no per-leg amps and no voltage or current unbalance. Unbalance is the main 3-phase compressor electrical check, with a common manufacturer limit of 2% (UNVERIFIED). The single "Running Amps" field also does not say which leg it is. Cause: shared `comp-run-*` inputs (lines 860–880). Suggested fix: reuse the 3-Phase leg inputs in 3Φ compressor mode.

- **[MEDIUM] The insulation test voltage input is dead, and the tool has no temperature correction or polarization index (PI).**
  - Repro (PSC): rated 230 V, C-G 3 MΩ. Changing the test voltage from 1000 V to 250 V leaves every result unchanged.
  - IEEE 43 Table 1 gives 500 V DC for windings rated below 1000 V. The tool does not warn when a 1000 V test is used on a 230 V winding.
  - Readings taken cold are compared against a 40 °C-referenced minimum without correction. A winding at 20 °C reads roughly 4× higher than it would at 40 °C under the halving-per-10 °C approximation.
  - Cause: `*-meg-v` inputs are read only in `getCalcState` and the report.
  - Suggested fix: use or drop the test voltage. Add an optional winding temperature input with the correction stated, or state "uncorrected" next to the result.

- **[MEDIUM] Diagnostic and fault-declaring language contradicts CALCULATORS.md rules 1–2.**
  - "Large deviation indicates open or shorted winding" (lines 200, 968).
  - "Significant deviation indicates winding fault" (lines 476, 1062).
  - "NEMA: >10% indicates voltage or winding issue" (line 569).
  - "BELOW FLOOR" (line 1389).
  - "Low readings may indicate acid/moisture contamination" (lines 1029, 1123; hedged).
  - "Diagnostic Checklist" title on the ECM tab.
  - Every reading gets an ok / warn / bad class rendered green, yellow or red.
  - Suggested fix: show measured value vs reference value with the source, and drop the verdict wording and red "bad" styling. The owner should decide whether threshold coloring is allowed at all.

- **[MEDIUM] The run-capacitor tolerance is a fixed ±6% (red above 6%, yellow above 4%) and contradicts the app's other cap tools.**
  - `capacitor-sizing.html` says "within ±6% good, 6–10% marginal, beyond 10% replace".
  - `motor-start-controls.html` uses ±10%.
  - In this tool, rated 7.5 µF measured 7.0 µF (−6.7%) is red, while capacitor-sizing would call it marginal.
  - Run caps are printed with their own tolerance (commonly ±5%, ±6% or ±10%).
  - Cause: line 1460.
  - Suggested fix: add a "rated tolerance (from can)" input with a single shared default, used the same way in all three tools.

- **[MEDIUM] Averages built from partial readings are presented as complete.**
  - Repro (3-Phase): FLA 10, only L1 = 12 entered shows "Average Amps 12.0 A" and "120.0 %" in red. The average L-L voltage is likewise computed from 1 or 2 readings.
  - The 3-phase and ECM winding balance also computes from 2 of 3 readings.
  - Cause: line 1527 and the `avg()`/`maxDevPct()` calls that filter out nulls.
  - Suggested fix: require all three readings, or label the result "n of 3 readings".

- **[MEDIUM] Several inputs look live but feed no result.**
  - Horsepower (PSC, 3-Phase, ECM).
  - ECM running volts and amps.
  - ECM module model.
  - The five ECM checklist boxes, which call `calcECM()` but are never read by it.
  - Compressor LRA.
  - Test voltage (above).
  - All of these appear only in the report.
  - Suggested fix: use them or move them into a clearly labelled "record only" section.

- **[MEDIUM] The exported report leaves out every judgment the screen shows.** It omits the ok/warn/bad state, the floor value, "BELOW FLOOR", the SF ceiling, the 3-phase % of FLA and the voltage deviation. It also drops winding sum lines when any reading is 0 (lines 1925, 2060). In a report from the Compressor tab with C-G 0.5 MΩ, which the screen shows red, the report prints the bare "0.5 MOhm".
  - Suggested fix: print the reference used next to each value.

- **[LOW] Zero denominators are printed as "Infinity".** FLA 0 gives "Infinity %" (bad). Rated cap 0 gives "Infinity %". R-S 0 gives "Infinity % dev". Suggested fix: validate positive inputs.
- **[LOW] Negative inputs are accepted and can turn green.** Running amps −5 with FLA 4 shows "−125.0 %" in green (ok). Suggested fix: reject values ≤ 0 where they are meaningless.
- **[LOW] The floor display rounds while the comparison does not.** At rated 1500 V the text reads "IEEE 43 floor: 2 MΩ" (`floor.toFixed(0)`, line 1389), but 1.6 MΩ is called "above floor". Suggested fix: show 2 decimals.
- **[LOW] A stale SF ceiling stays on screen.** Repro (3-Phase): SF 1.15, FLA 10, L1 12, then clear FLA. % FLA goes back to "--" but "SF ceiling: 11.5 A" remains. Cause: the `else` branches near lines 1540 and 1450 do not clear the sub-label.
- **[LOW] The NEMA sub-labels are misattributed or misworded.** See Method check. Suggested fix: "NEMA MG-1: derate above 1%; current unbalance is typically 6–10× voltage unbalance".
- **[LOW] No derating factor is shown for voltage unbalance (NEMA MG-1 Fig. 14-1).** The tool does not claim to compute one, so this is a missing nice-to-have, not an error.

**Verified OK:**
- **NEMA voltage unbalance formula.** 460 / 467 / 450 V gives an app value of 1.96%. Hand calculation: average 459, maximum deviation 9, 9/459 = 1.961%. Current unbalance uses the same function and matches.
- **Single-phase sum arithmetic** (as arithmetic only): 0.6 + 1.8 = 2.40 against 2.2 gives 9.09%, and the app shows 9.1%.
- **Capacitor deviation.** (7.0 − 7.5)/7.5 = −6.67%, and the app shows −6.7%.
- **3-phase winding maximum deviation.** 1.00 / 1.06 / 1.12 gives 0.06/1.06 = 5.66%, and the app shows 5.7%.
- **% of FLA and % of RLA division**, and the average L-L voltage.
- **Page health.** No JavaScript errors. No horizontal scroll at 390 px. The compressor 1Φ/3Φ toggle switches inputs, results and report correctly.
- **Single-phase identity direction.** The tool's identity R-S = C-R + C-S is the right one. Note that the brief's wording "C-S = C-R + R-S" is not correct for C/R/S windings.

**Unverified:**
- **IEEE 43 IR1min values** (kV+1 / 5 MΩ / 100 MΩ at 40 °C) were confirmed only through secondary sources, an EASA summary page and a TestGuy forum post. The standard itself is paywalled. IEEE lists 43-2013 as inactive-reserved since March 2024, and I could not confirm whether a newer edition changes the values.
- **NEMA MG-1 derating curve values and the 12.44 ±10% clause** are from my own knowledge, not fetched.
- **Compressor-manufacturer megger minimums and the 3-phase unbalance limit** (Copeland, Tecumseh) were not found online, so the 2% compressor unbalance figure is UNVERIFIED.
- **ECM manufacturer winding and IR criteria** (Regal/Genteq, Nidec) were not checked.
- **The 5% / 10% 3-phase winding-balance rule** has no authoritative source; it is a field convention.

**UX notes (390 px):**
- Placeholders look like real values: "460" and "1.15" on 3-Phase, "230" and "1.0" on PSC, "500" for test voltage. A blank field is easily read as filled, and the blank-SF logic then uses 1.15, not the 1.0 shown.
- Results start 1150–1420 px down the page (about 1.4–1.7 screens), below 19–26 inputs. To see the result of one megger reading you scroll past everything else. Page heights are 1905–2205 px.
- "Average Amps" appears twice on the 3-Phase tab (readout and results).
- The favorite button is 26×26 px and the 1Φ/3Φ toggle is 31 px tall, both under 44 px.
- The viewport meta has `maximum-scale=1, user-scalable=no`, which blocks pinch-zoom (accessibility).
- Megger, winding and amp results carry no source or reference value next to them. Only the ground megger "Lowest Reading" shows the floor.
- The three-column inputs ("L1 — L2", "T1 — G") are narrow (about 105 px) with units squeezed inside.
- The report modal shows plain text with none of the on-screen colors or assessments.

## Structure & redesign input

**1. Map of sections and modes (what each actually computes).**

| Tab / section | Inputs | What it computes |
|---|---|---|
| PSC: Nameplate | V, FLA, HP, SF | FLA and SF feed % FLA; V feeds the megger floor; HP is unused |
| PSC: Running | supply V, amps | % FLA and SF ceiling; supply V is displayed only |
| PSC: Run Capacitor | rated µF, measured µF | % deviation against fixed ±6% |
| PSC: Winding Resistance | C-R, C-S, R-S | sum check (see HIGH finding) |
| PSC: Insulation | test V (unused), C/R/S-G, C-R/C-S/R-S | per-reading class vs "IEEE 43 floor"; lowest reading; winding-to-winding class vs 1 / 10 MΩ |
| 3-Phase: Nameplate | V, FLA, HP, SF | same as PSC |
| 3-Phase: Amps | L1, L2, L3 | average, % FLA (from the average), current unbalance |
| 3-Phase: Voltage | 3 L-L readings | average, NEMA unbalance, volt deviation from rated |
| 3-Phase: Windings and Insulation | 3 resistances, 6 IR readings | max deviation %; same megger logic as PSC |
| ECM | V, HP, model, 5-box checklist, run V/A, 3 resistances, 6 IR readings | only winding max deviation and megger classes; checklist, run V/A, HP and model are report-only |
| Compressor (shared) | V, RLA, LRA, run V/A | % RLA (red above 110%); LRA unused |
| Compressor 1Φ | C/R/S resistances, 6 IR readings | same as PSC windings and megger |
| Compressor 3Φ | T1-T3 resistances, 6 IR readings | same as 3-Phase windings and megger; no per-leg amps or volts |
| Report | — | plain-text dump of the inputs for the active tab |

The `getCalcState()` and `getReportBlock()` hooks are exported for cross-module use. No other file in the repo references the motors module's `getCalcState`.

**2. Core field use vs rare or duplicated.**
- **Core:**
  - Megger winding-to-ground on compressors and motors, used daily by commercial and residential techs.
  - The single-phase compressor C/R/S ohms check. It is valuable mainly for terminal identification and comparison with manufacturer spec.
  - 3-phase amps per leg and voltage unbalance.
  - Run-cap measured vs rated.
- **Duplicated elsewhere in Hermes:**
  - Voltage unbalance: `tools/electrical.html` already computes the NEMA voltage unbalance with the same `imbal()` function.
  - Capacitor checks: `tools/calculators/capacitor-sizing.html` has both the 2652 µF-from-current method and the rated-vs-measured check, with a different tolerance rule (±6 / 10%). `tools/calculators/motor-start-controls.html` has start and run cap checks at ±10% and start/run winding inputs.
  - The app therefore has three different cap tolerance rules.
- **Rarely useful or wrong as built:**
  - The winding-to-winding and phase-to-phase megger rows on the PSC, 1Φ compressor and ECM tabs (physically meaningless).
  - The ECM checklist (records only, computes nothing).
  - HP, LRA and test-voltage inputs (dead).
  - ECM megger and resistance on a stator many techs will not open in the field.

**3. Places where it judges or declares good or bad.**
- Every result row gets an ok / warn / bad class (green / yellow / red): % FLA, % RLA, cap deviation, winding balance, every megger reading, current and voltage unbalance.
- Explicit fault wording appears at lines 200, 476, 569, 968, 1029, 1062 and 1123 ("indicates open or shorted winding", "indicates winding fault", "indicates voltage or winding issue", "may indicate acid/moisture contamination"), plus "BELOW FLOOR" (line 1389) and the ECM "Diagnostic Checklist" heading.
- These are the places where the CALCULATORS.md "do not diagnose / do not declare faults" rules are broken. Three of these verdicts are also technically wrong (IEEE floor, sum check, phase-to-phase megger).

**4. UX at 390 px: inputs and screens per task today.**

| Task | Inputs / scroll today |
|---|---|
| Megger one compressor (3 readings to ground) | Open Compressor tab, enter rated V (top), scroll about 1.5 screens to Insulation, enter 3 values, scroll about 1 more screen to results. About 4–5 fields over about 3 screens. The page has 26 inputs. |
| Single-phase compressor ohms | 3 fields mid-page; the result is about 1 screen further down |
| 3-phase unbalance | 3 fields (already available in `electrical.html`); result about 1 screen down |
| PSC cap check | 2 fields; result about 1.3 screens down |
| Full PSC workup | 19 fields over about 2.5 screens (page 2130 px; results start at 1223 px) |

Other problems at 390 px:
- Placeholders that look like values.
- No reference shown next to most results.
- Undersized favorite and phase toggle targets.
- Zoom disabled.
- Results are far from the inputs that produce them.

**5. Recommendation.**
- **Organize by test, not motor type.** The same three checks repeat across four motor-type tabs.
  - **Insulation Resistance:** a ground-only list of readings. Show the correct reference (manufacturer value or an IEEE 43 note with temperature caveat), plus an optional temperature and test voltage. Show phase-to-phase readings only for separated 6/9/12-lead windings.
  - **Winding Resistance:** a 1Φ C/R/S terminal-identification helper (sorts the readings and identifies C, R and S) plus an optional manufacturer spec Ω with % difference. Add a 3Φ balance option.
  - **Running Load:** amps vs FLA×SF using the highest leg, or vs RLA/MCC for compressors. Include per-leg 3Φ readings and a link to, or reuse of, the `electrical.html` unbalance.
- **Merge the capacitor check into `capacitor-sizing.html`** with one shared tolerance rule.
- **Put results directly under each test's inputs**, so each task fits about one screen.
- **Replace ok/warn/bad colors with "value vs reference (source)"**, per CALCULATORS.md.
- **Keep the Notes field and Export Report as a "service record" layer** that collects whichever tests were filled. The report should include the reference used for each value.
- **Drop dead inputs**, or move them to a record-only nameplate block.
