# Air Distribution & Loads — calculator audit

Group id: `airdist`. Every case below was driven in headless Chromium at a 390×844 viewport against `http://localhost:8765/project-hermes/tools/calculators/…`, and the outputs were compared with hand or Python calculations. Scripts and screenshots are in `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-airdist/` (`run.js`, `vent.js`, `fr.py`, `ux.js`, `*.png`). No page threw a JS error.

## Summary
| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| duct-sizing | RISKY | 0 | 1 | 3 | 3 |
| cfm-per-ton | OK-WITH-ISSUES | 0 | 0 | 2 | 2 |
| ventilation-sizing | BROKEN | 2 | 2 | 4 | 3 |
| load-calc | OK-WITH-ISSUES | 0 | 0 | 3 | 2 |

---

## duct-sizing (`tools/calculators/duct-sizing.html`)
**What it claims to do:** Sizes round duct from CFM and a maximum velocity, then lists "Rectangular Equivalents" at aspect ratios of 1:1, 4:3, 2:1 and 3:1, each with an equivalent diameter (Deq). The header reads "CFM · Velocity · Round & Rectangular" and the footer says "Velocity method. For pressure drop verification, cross-reference with ACCA Manual D or ASHRAE friction charts."

**Method check:**
- **Round size.** The code computes A = CFM/V and D = √(4A/π) (lines 145-147). That is correct.
- **Huebscher formula.** Deq = 1.30·(ab)^0.625/(a+b)^0.25 (line 119) matches ASHRAE Fundamentals (duct design chapter, Eq. for circular equivalent). I checked it by hand: 8×8 → 8.75, 14×4.5 → 8.35, and 22×22 → 24.05 all match the app.
- **Friction input (REVIEW.md claim).** REVIEW.md says a friction-rate input exists but is unused. That is **no longer true**: the page has no friction input at all. The tool is velocity-only, and neither the equal-friction method nor Darcy-Weisbach is implemented anywhere.
- **What a rectangular equivalent should be.** In ASHRAE/SMACNA/Manual D usage, a rectangular equivalent is the rectangle whose Huebscher Deq equals the round diameter, giving equal friction and capacity at the same CFM. The code instead builds the rectangle with the same **area** as the *exact* (unrounded) round diameter (line 168 passes `areaSqIn`). It never uses the selected standard size.

**Findings**
- [HIGH] **The "Rectangular Equivalents" are equal-area, not equal-friction, so every rectangle is smaller than the round duct it claims to replace.**
  - *Reproduction:* 400 CFM at 900 FPM. Round Duct shows **10" dia** (calculated 9.0"). The rectangles shown are 8×8 (Deq 8.7"), 9×7 (8.7"), 11.5×5.5 (8.6") and 14×4.5 (Deq **8.4"**).
  - *Correct result:* An equal-friction equivalent of the selected 10" round has Deq ≥ 10" (for example about 9×9.5 or 14×6). A same-area rectangle has a lower Deq by a fixed ratio: 0.969 at 1:1, 0.966 at 4:3, 0.955 at 2:1 and 0.935 at 3:1. At the same CFM, friction scales roughly as D^-4.9 (Darcy-Weisbach with Colebrook f).
  - *Impact:* Even against the exact 9.03" diameter, the rectangles carry 17% (1:1) to 39% (3:1) more friction per foot. Against the 10" round the page tells the tech to install, the 14×4.5 has about **2.4×** the friction ((10/8.35)^4.9). A tech who installs "the equivalent" rectangle installs an undersized duct. The Deq column does show the smaller number, but it is not explained.
  - *Cause:* lines 111-121 and 167-168.
  - *Fix:* Solve for the rectangle whose Huebscher Deq equals the *selected* round size, iterating on h for each ratio. Round up to whole inches (or 2" sheet-metal increments), and label the column "equal friction".
- [MEDIUM] **Above 24" the headline silently shows an undersized round.** The size list stops at 24 (line 93), and `nearestStd` falls back to 24 (line 107).
  - 3000 CFM at 900 FPM: calculated 24.7", Round Duct **24" dia**, actual velocity 955 FPM. That is within the 10% tolerance, so no warning appears and the result looks fine.
  - 5000 CFM at 900 FPM: **24" dia** next to "Calculated Diameter 31.9"" and 1592 FPM, with only an amber row.
  - *Fix:* Extend the list (26-36"+), or show "exceeds table — use ≥ 32"" instead of a smaller size.
- [MEDIUM] **There is no friction or pressure check, and the 900 FPM default can give high friction rates on small branches.** I computed Darcy-Weisbach friction with standard air (0.075 lb/ft³), galvanized ε = 0.0003 ft and Colebrook f:
  - 150 CFM → 6" at 764 FPM ≈ **0.17 in.wg/100 ft**.
  - 400 CFM at the exact 9.0" and 900 FPM ≈ 0.14 in.wg/100 ft.

  Residential Manual D design friction rates are typically below 0.10, and the method itself is equal-friction from available static pressure and total effective length. The footer discloses that this is a velocity method, so this is a limitation rather than a math error. *Fix:* Show the friction rate of the selected size (one Darcy-Weisbach line), or add the equal-friction mode REVIEW.md described.
- [MEDIUM] **The 900 FPM default gives no context.** It is one pre-filled number with no note saying it applies to supply trunks. Manual D recommends lower limits for branches, returns and grilles. Specific Manual D Table 3-1 values are UNVERIFIED (I could not reach the source), so I am not quoting them. *Fix:* Add a velocity preset selector (trunk, branch, return, commercial) with its source cited.
- [LOW] **"Nearest standard size" is the wrong label.** The code picks the next size **up**, which is the safe direction (400 CFM: 9.03" → 10"). Relabel it "next larger standard size".
- [LOW] **Rectangle dimensions round to the nearest 0.5" and can round down below the required area.** For 400 CFM at 1:1, 8.07" → 8.0", which gives 916 FPM, over the 900 maximum. The output sizes (4.5", 5.5", 11.5") are not stock sheet-metal sizes either. *Fix:* Round up to whole inches.
- [LOW] **Nonsense input still produces confident output.** 1e9 CFM gives "24" dia" and a 14,273" calculated diameter. A sanity cap would help. Zero, negative and empty values clear correctly.

**Verified OK:**
- Round diameter math.
- Actual velocity at the selected size: 400 CFM in 10" → 733 FPM.
- Huebscher formula and coefficients.
- Size selection rounds up within 6-24".
- Invalid input clears every output, so no stale results remain.
- The 10% over-velocity warning triggers as coded.

**Unverified:** ACCA Manual D velocity table values (source not reachable).

**UX notes:**
- There is no way to choose duct type or material (flex vs. metal) or trunk vs. branch.
- The 24" headline sits right above a larger "Calculated Diameter" with no explanation.
- The rectangle table has no "equal friction / equal area" label, and its sizes are not orderable stock sizes.
- The header icons (⌂ 20px, ← 24px, ☆ 26px tall) are below the 44px minimum touch target. The same applies to all four tools.

---

## cfm-per-ton (`tools/calculators/cfm-per-ton.html`)
**What it claims to do:** Compares measured CFM with capacity in tons or BTU/h and classifies the CFM/ton ratio. It also shows expected CFM at 400 CFM/ton and a 350-450 range.

**Method check:**
- CFM/ton = CFM ÷ (BTU/h ÷ 12,000). The conversion is correct.
- 400 CFM/ton as a nominal design value and 350-450 as a normal band are standard rules of thumb, and the hint mentions 350 for humid climates.
- The bands are: below 300 LOW; 300 to below 350 MARGINAL LOW; 350-450 NORMAL; above 450 to 500 MARGINAL HIGH; above 500 HIGH.
- Boundary tests at 3 tons: 899 CFM → 299.7 LOW; 900 → 300.0 MARGINAL; 1050 → 350 NORMAL; 1350 → 450 NORMAL; 1500 → 500 MARGINAL HIGH; 1501 → HIGH. All boundaries behave as coded and are consistent.
- The `status` variable (lines 138-158) is computed but never displayed, so it is dead code.

**Findings**
- [MEDIUM] **Switching Tons ↔ BTU/h keeps the number and silently changes what it means.** Enter 3 tons and 1200 CFM (400.0, Normal), then tap BTU/h. The result becomes Effective Tons "0.00 tons", ratio **4,800,000.0**, "High — poor latent capacity", Expected "0 CFM". It should convert the value (3 → 36,000) or clear it. *Cause:* the mode handler (lines 76-90) only changes labels. In the other direction, 36000 entered in Tons mode gives "36000.00 tons" and "Low — possible coil icing", with no plausibility range.
- [MEDIUM] **The status text leans toward diagnosis, against CALCULATORS.md rules 1 and 2.** "Low — possible coil icing, reduced capacity" and "High — poor latent capacity" are hedged, but they are fault language. The ratio also ignores manufacturer-specified airflow: variable-speed equipment, dry-climate 450+ settings and heat pumps in heating can legitimately sit outside 350-450. *Fix:* Say "below/above typical 350-450 range — compare to manufacturer airflow spec."
- [LOW] **The ratio has no unit.** It shows "400.0" with no "CFM/ton".
- [LOW] **The capacity basis is not stated.** "System capacity" is nominal tons, not actual capacity at conditions. Add a one-line note.

**Verified OK:** BTU/h → tons conversion; expected and range math (3 tons → 1200 and 1050-1350); band boundaries; partial results with tons only; blank, zero and negative input clearing.

**Unverified:** None of the math. The 300/500 outer bands are a judgment call, not a cited standard.

**UX notes:**
- The mode toggle sits above the input, but its effect on an already-entered value is invisible.
- The "Effective Tons" readout duplicates the input in tons mode.
- The status color is the only strong cue, and the label text is small.

---

## ventilation-sizing (`tools/calculators/ventilation-sizing.html`, T3)
**What it claims to do:** "ASHRAE ACH · Exhaust · Makeup Air." It has two tabs:
- **Size:** exhaust = volume × ACH ÷ 60, plus makeup air as a preset fraction of exhaust.
- **Audit:** compares installed exhaust and supply against those numbers and declares "Adequate / Marginal / Deficient", "WRONG DIRECTION", and "System meets ASHRAE ventilation requirements".

It cites "ASHRAE Handbook — HVAC Applications, Ch. 46, Table 4".

**Method check:**
- **ACH formula.** CFM = V·ACH/60 (lines 358 and 410) is correct. 20×20×10 at 15 ACH → 1000 CFM, matching hand math.
- **Source of the ACH values.** The presets (lines 217-230) are kitchen 15, boiler 12, restroom 10, locker 8, mechanical, electrical and janitor 6, server 10, "Clean Room / Lab" 12, general and office 4, storage 2. They are **not** ASHRAE 62.1 or IMC values. 62.1's minimum exhaust table and IMC Table 403.3.1.1 give exhaust **per fixture or per ft²**, not ACH:
  - Public toilet: 50 CFM per WC/urinal continuous, 70 intermittent.
  - Private toilet: 25/50.
  - Janitor/trash: 1.0 CFM/ft².
  - Locker/dressing: 0.25 CFM/ft²; sports locker 0.5.
  - Commercial kitchen: 0.7 CFM/ft².
  - Chemical storage: 1.5 CFM/ft².

  I verified these IMC rows and footnotes from the Washington adoption of IMC Table 403.3.1.1 (WAC 51-52-0403, lawfilesext.leg.wa.gov). I could not identify an ASHRAE Handbook "Ch. 46, Table 4" listing these room-type ACH values, so the citation is UNVERIFIED and very likely does not support the presets.
- **Other sizing bases the tool ignores:**
  - Commercial kitchen exhaust is sized by hood (IMC 507/508, UL 710), not by room ACH.
  - Boiler and mechanical rooms are governed by combustion air (IFGC 304 / NFPA 54 §9.3) and, for refrigeration machinery rooms, ASHRAE 15.
  - Data rooms are sized by heat load.
  - ASHRAE 62.2 (residential) is not referenced or used.
- **Makeup-air rules.** IMC 508.1 requires commercial-kitchen makeup air roughly equal to exhaust. That section number and wording are from memory and not fetched. The tool sizes makeup air as a fraction of *required* exhaust, not of *installed* exhaust.

**Findings**
- [CRITICAL] **Fuel-fired rooms (Boiler, Mechanical, Kitchen) are designed negative, and the audit rewards unlimited depressurization while flagging a neutral or positive boiler room as "WRONG DIRECTION".**
  - *Reproduction (Audit tab, 20×20×10):*
    - Boiler, exhaust 800, supply 900 → Pressure **"POSITIVE — WRONG DIRECTION — room must be negative, not positive. Fire/contaminant spread risk."** in red.
    - Boiler, 800/800 → "Neutral — Should be negative".
    - Boiler, exhaust 2000, supply 720 → **"Negative — Correct — room is negative as intended"** with net −1280 CFM, and the hint reads **"System meets ASHRAE ventilation requirements for boiler room."**
    - Kitchen, exhaust 3000, supply 850 → net −2150 CFM, "Correct", "System meets ASHRAE ventilation requirements".
  - *Correct result:* Appliance rooms with atmospherically vented (Category I) appliances must not be depressurized enough to spill combustion products. IFGC 304 / NFPA 54 §9.3 require combustion and dilution air, and require makeup air where exhaust interferes with appliance operation. I could not fetch the exact IFGC 304.1 wording from ICC; the requirement is well established, but the clause text is UNVERIFIED. Boiler rooms are normally designed neutral or slightly positive. Commercial-kitchen makeup air must roughly equal exhaust (IMC 508.1).
  - *Impact:* The tool steers a tech to cut supply or add exhaust in a boiler room, which is a backdraft and CO hazard. It also never accounts for the combustion air the appliances themselves consume.
  - *Cause:* PRESETS lines 218, 219 and 222 (`intent:'negative'`, supplyRatio 0.85/0.90). The pressure logic (lines 473-491) has no upper bound on negative imbalance. Supply is checked against `reqSup` (based on required exhaust) instead of installed exhaust (lines 412 and 448).
  - *Fix:*
    - Remove the "negative" intent from fuel-fired room presets, or add a "contains fuel-fired appliances" toggle that forces neutral/positive and points to the combustion-air calculator.
    - Base makeup air on installed exhaust.
    - Never print "Correct" for a large negative imbalance.
    - Drop the "meets ASHRAE requirements" text.
- [CRITICAL] **"Clean Room / Lab" is preset to positive pressure (115% supply), and the audit flags a correctly negative lab as wrong.**
  - *Reproduction:* Lab, 30×20×10, exhaust 1200, supply 1000 → **"NEGATIVE — WRONG DIRECTION — room must be positive, not negative. Contaminant infiltration risk."**, with supply marked "Deficient −27.5%".
  - *Correct result:* NFPA 45 requires laboratory work areas using hazardous chemicals to be negative relative to corridors and non-lab areas (§8.3.3 in the 2011 edition; the section number varies by edition and I did not confirm the current one), and ANSI/ASSP Z9.5 says the same. Only true cleanrooms or protective-environment rooms are positive.
  - *Additional problem:* 12 ACH is far below typical cleanroom air-change rates, which are tens to hundreds of ACH for ISO 7-5. That figure is from memory and UNVERIFIED.
  - *Impact:* A tech auditing a chemistry or bio lab is told to make it positive, pushing contaminants into corridors.
  - *Cause:* line 226; the lab and clean room are merged under "Positive Pressure (Supply-Dominant)" (HTML lines 45-48).
  - *Fix:* Split them into "Laboratory (chemical) — negative, sized per Z9.5 / hood exhaust" and "Cleanroom — positive, ACH per ISO class", or remove them.
- [HIGH] **"Restroom 10 ACH" can fall below IMC/62.1 per-fixture exhaust, yet the tool declares compliance.**
  - *Reproduction:* Restroom, 10×12×9, exhaust 180, supply 0 → Exhaust "Adequate", hint **"System meets ASHRAE ventilation requirements for restroom / toilet."**
  - *Correct result:* A public restroom with 4 WC/urinals needs ≥ 200 CFM continuous or 280 CFM intermittent (IMC Table 403.3.1.1, footnote e; 62.1 equivalent). The janitor preset has the same problem: 6×8×8 at 6 ACH → 38 CFM, against 1.0 CFM/ft² × 48 ft² = **48 CFM**.
  - *Cause:* The ACH-based presets (lines 220 and 224) and the compliance sentence (line 528).
  - *Fix:* For restroom, janitor, locker and kitchen, ask for fixture count or floor area and compute the code rate. Show ACH only as a cross-check, and remove the "meets ASHRAE" claim.
- [HIGH] **The ASHRAE attribution is unsupported, and the "deficiency audit" declares faults and compliance, against CALCULATORS.md boundary rules 1-4.** Outputs include "Deficient", "WRONG DIRECTION … Fire/contaminant spread risk", "Additional exhaust fan capacity needed" and "System meets ASHRAE ventilation requirements". These go into a printable report labelled "ASHRAE Ventilation Guidelines". None of the preset values could be traced to ASHRAE (see Method check). *Fix:* Re-source every preset with a table citation and edition, change the audit wording to neutral comparisons ("installed is X% below the reference rate"), and remove compliance statements.
- [MEDIUM] **Supply adequacy is judged against *required* exhaust × ratio, not installed exhaust.** This is part of the first CRITICAL item. The Supply row says "Adequate" whenever supply ≥ reqExh·ratio, even when installed exhaust is 3× the required value.
- [MEDIUM] **The "Neutral" band is ±5% of installed exhaust** (line 474). With exhaust 0 and supply 0 in the kitchen preset, it reports "Neutral — Should be negative — supply too close to exhaust" when nothing is installed. The message is misleading when both fans are zero or missing.
- [MEDIUM] **Server/IT room at 10 ACH "exhaust" with 110% supply has no engineering basis.** Data and IT rooms are sized by heat rejection, and requiring 10 ACH of *exhaust* in a positive room is contradictory. Electrical rooms marked "negative" have no code basis I know of (UNVERIFIED).
- [MEDIUM] **The ASHRAE Handbook reference link** points to the generic Handbook landing page, and the "Ch. 46, Table 4" citation could not be verified.
- [LOW] **The report's "ACH:" line prints the preset key instead of the number.** It prints "ACH: kitchen" (line 558 uses `achSel.value`). The "Guideline:" line does carry "— 15 ACH".
- [LOW] **The Room Volume sub-label never updates.** `setRow('Volume', …, sub)` passes a sub string, but no element `subVolume` or `subAuditVol` exists, so the dimensions sub-label stays "L × W × H". This is harmless dead code.
- [LOW] **Number formatting is inconsistent.** `fmt()` uses thousands separators only for positive numbers ≥ 1000, so it shows "−1280 CFM" next to "2,000 installed".

**Verified OK:**
- Volume and CFM arithmetic in both tabs.
- Supply-ratio multiplication.
- Restroom and janitor "Transfer air only" branch.
- Custom ACH plus intent toggle (0.90 / 1.00 / 1.10).
- Status thresholds as coded (≥ 0 Adequate, ≥ −15% Marginal).
- Blank or invalid dimensions reset every row, with no stale values after clearing.
- The report reproduces the on-screen statuses, apart from the ACH line.

**Unverified:**
- ASHRAE Handbook HVAC Applications Ch. 46 Table 4 content (no access).
- Exact current-edition section numbers for NFPA 45 negative-pressure and IFGC 304.1 makeup-air text.
- ASHRAE 62.1 exhaust table number in the current edition. I verified IMC Table 403.3.1.1 rows via the WA adoption; the 62.1 values are, to my knowledge, the same.

**UX notes:**
- The page's only scroll is vertical; it is about 1100px tall in the Audit tab.
- The Audit results show the same numbers twice: in the deficiency box and again in the status rows.
- The red "WRONG DIRECTION" hint sits below the results, far from the inputs.
- Status values in the result rows render in a muted color in the screenshot, so "Deficient" and "POSITIVE" are weak against the background.
- The preset dropdown hides the pressure intent and makeup ratio; neither is shown until results appear.
- The 15% supply reduction for kitchens is never explained.
- There is no field for fixture count, floor area or appliance input, which are the actual code inputs.

---

## load-calc (`tools/calculators/load-calc.html`)
**What it claims to do:**
- The page header says "Rule of Thumb · BTU/sq ft" and the footer says "Rule of thumb only. Manual J required for system design." Both are honest.
- CALCULATORS.md calls it "Manual J simplified load estimate".
- The app catalog (`index.html:494`) says "Simplified heating and cooling load", with search keyword "manual j".

**Method check:** BTU/h = ft² × {30 hot/humid, 25 mixed, 20 cold} × {1.2 poor, 1.0 avg, 0.8 good} × (ceiling/8 if ceiling > 8). It computes tons = BTU/12,000 and CFM = tons × 400. This is a square-foot rule of thumb, not any part of ACCA Manual J: no envelope U-values, glazing/SHGC and orientation, infiltration, internal gains, design temperatures, latent load or duct load.

Executed cases:
| Inputs | App output | Hand check |
|---|---|---|
| 2000 ft², 8 ft, mixed, average | 50,000 BTU/h, 4.17 tons, 1,667 CFM | matches |
| 2000 ft², 10 ft, hot, poor | 90,000 BTU/h, 7.50 tons, 3,000 CFM | 2000×30×1.2×1.25 = 90,000 |
| 2000 ft², 16 ft | 100,000 BTU/h | load doubled by ceiling height |
| 2000 ft², ceiling blank, 0 or 6 | treated as 8 | silent default |

**Findings**
- [MEDIUM] **It is described as "Manual J simplified" and "heating and cooling", but it computes only a cooling square-foot rule.** The CALCULATORS.md roster and the `index.html:494` description/keyword make the tool show up under "manual j" searches and promise heating, which the page does not provide. *Fix:* Change the catalog text to "Rule-of-thumb cooling estimate" and drop "manual j" and "heating" from the description.
- [MEDIUM] **There is no warning about oversizing.** It outputs "Equivalent Tons" and "Recommended CFM", which reads as an equipment-selection number. ACCA Manual S limits cooling equipment to roughly 90-115% of the Manual J total cooling load (from memory, UNVERIFIED edition detail). Modern code-built homes often come in well below 20-30 BTU/ft², so 500 ft²/ton rules commonly oversize. The disclaimer exists but sits at the bottom and does not say "do not select equipment from this". *Fix:* Rename "Recommended CFM" to "Airflow at 400 CFM/ton", and add a sentence that equipment must be selected per Manual S from a Manual J load.
- [MEDIUM] **The ceiling adjustment scales the entire load linearly with height.** A 16 ft ceiling gives 2× the load, but roof, glass, occupant and appliance loads do not scale with ceiling height. REVIEW.md noted this too. It is undisclosed, though it errs toward the safe side for equipment capacity. *Fix:* Disclose it, or apply the adjustment only to a wall and infiltration fraction.
- [LOW] **Blank, zero or negative ceiling silently becomes 8 ft** (line 97: `parseFloat(...) || 8`), and there is no reduction below 8 ft. The behavior is conservative, but it is undisclosed.
- [LOW] **The "Cold 20 BTU/ft²" label is easy to misread** as a heating figure for cold climates. Label it as cooling.

**Verified OK:** Arithmetic in every branch; conversion of 12,000 BTU/h per ton and 400 CFM/ton; toggles recalculating; zero or negative ft² clearing the outputs.

**Unverified:** The 20/25/30 BTU/ft² and 0.8/1.2 multipliers are common folklore, not from a citable standard, so there is nothing to verify them against. Manual S sizing limits are from memory.

**UX notes:**
- The climate-zone buttons don't map to IECC or DOE climate zone numbers, which techs know.
- The disclaimer is low-contrast footer text.
- There is no heating output even though the app catalog promises one.
- The pre-filled ceiling value "8" looks like a placeholder.
