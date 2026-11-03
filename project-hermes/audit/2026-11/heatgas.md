# Heating, Gas & Drains — calculator audit

Auditor scope: `tools/heat.html`, `tools/calculators/gas-pipe.html`, `tools/calculators/combustion-air.html`, `tools/calculators/condensate-drain.html`.
All four were driven in Playwright (Chromium, 390×844 viewport) against http://localhost:8765/. The gas-pipe logic was also re-implemented in Python and swept against the code table (scripts in `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-heatgas/scripts/`).

### Sources actually reached
- **Natural gas Sch 40, <2 psi inlet, 0.5 in. w.c. drop, SG 0.60**: full table (10–250 ft rows, 1/2"–2-1/2"), as printed in City of Pleasanton handout "Gas Pipe Sizing" (CPC Table 12-8). This is the same NFPA 54-derived table as IFGC Table 402.4(2). It matches every value I remembered for IFGC 402.4(2). A separate search confirmed the 10 ft row (172/360/678/1390/2090/4020) and the table identity.
- **IFGC Appendix A** (2018 Seattle Fuel Gas Code = IFGC 2018 with local amendments), A.3.1 Longest Length Method step (5): *"select the row showing the measured length or the next longer length if the table does not give the exact length. This is the only length used in determining the size of any section…"* Step (7): *"If the exact figure of demand is not shown, choose the next larger figure."* A.3.3 Hybrid pressure method: size the 2 psi zone and the low-pressure zone separately. A.2.3: undiluted LP tables are in kBtu/h (Table 402.4(28) for Sch 40 in the 2018 numbering).
- **Propane Sch 40, 11 in. w.c. inlet, 0.5 in. w.c. drop, SG 1.50, kBtu/h**: the 10 ft row (291/608/1150/2350) was confirmed in Rinnai and Kenmore appliance manuals that reproduce NFPA 54. The 1-1/2"/2" values (3520/6790) and the 100 ft row (84/175/330/677/1010/1950) are from memory. They fit the table's own length exponent (291×0.1^0.541 = 84), but treat them as **unverified to the digit**.
- **Combustion air**: Goodman furnace manual (NFPA 54 text): indoor openings 1 in²/1,000 Btu/h each, min 100 in²; outdoor direct 1/4,000; horizontal ducts 1/2,000. ICC CodeNotes "Combustion Air Outdoors" confirms horizontal ducts at 1/2,000. Louver defaults of 25% wood and 75% metal (IFGC 304.10) are from memory; no source reached.
- **IMC Table 307.2.2** condensate: secondary reproductions (HVAC School, InspectAPedia, code forum) agree: ≤20 t 3/4", >20–40 1", >40–90 1-1/4", >90–125 1-1/2", >125–250 2". Also: 3/4" ID minimum, no reduction from the pan connection, slope ≥1/8 in/ft (1%). The ICC text itself was not reached.
- codes.iccsafe.org and opentextbc returned 403.

## Summary
| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Gas Pipe Sizing (`tools/calculators/gas-pipe.html`) | **BROKEN** | 3 | 1 | 3 | 4 |
| Combustion Air (`tools/calculators/combustion-air.html`) | **BROKEN** | 1 | 0 | 4 | 2 |
| Condensate Drain (`tools/calculators/condensate-drain.html`) | OK-WITH-ISSUES | 0 | 0 | 1 | 4 |
| Heat Analysis (`tools/heat.html`) | OK-WITH-ISSUES | 0 | 0 | 4 | 4 |

---

## Gas Pipe Sizing (`tools/calculators/gas-pipe.html`)
**What it claims to do:** IFGC pipe sizing for natural gas and LP at "Low (0.5 PSI)" or "2 PSI" inlet, Sch 40 steel/black iron. You enter total BTU/h and the longest run. It returns the minimum size, the capacity at that size, and a "recommended" next size up, plus a capacity table for 1/2"–2".

**Method check:**
- The code (IFGC 402.4 / Appendix A.3.1) requires table lookup at the measured length **or the next longer table row**, with no interpolation. The app (lines 136–146) **linearly interpolates** between its 6 rows (10/20/30/50/75/100 ft). Capacity vs length is convex, so a linear chord between rows always overstates capacity. The app also **clamps every run longer than 100 ft to the 100 ft row**.
- The app's embedded table (lines 111–120) is a rounded, partly incorrect copy of 402.4(2). It also includes a 75 ft row that does not exist in 402.4(2); the code would use the 80 ft row.
- LP is handled as NG capacity × 2.5 (line 150). The real LP Sch 40 table (11 in. w.c., 0.5 in. drop) is about **1.69×** the NG table at every size and length (10 ft: 291 vs 172, 608 vs 360, 1150 vs 678 …).
- "2 PSI" is handled as × 2.0 (line 151). This does not correspond to any IFGC table. The 2 psi tables (1 psi drop) give several times the low-pressure capacity for the 2 psi zone, and the Hybrid Pressure Method requires the downstream low-pressure zone to be sized separately.
- BTU→CFH assumes 1,000 Btu/ft³ (`btuK` compared directly with CFH values). This is the code's own example value and is conservative for typical NG (~1,030+), but it is not disclosed.

**Findings**
- **[CRITICAL] Runs over 100 ft are sized from the 100 ft row (no length penalty, no warning).**
  - Repro (Playwright): NG, Low, 90,000 Btu/h, 200 ft → app **3/4"** ("104k BTU/h"). IFGC 402.4(2) 200 ft row: 3/4" = 71 CFH, 1" = 134 → **1"** required.
  - 75,000 Btu/h at 250 ft → app 3/4" (104k); code 250 ft row: 3/4" = 63 → 1".
  - Sweep 101–250 ft over 10k–4M Btu/h: **11,400 combinations undersized** by at least one pipe size.
  - Cause: `interpolate()` line 138 `if (run >= lengths[last]) return baseTable[last]`.
  - Fix: carry the full 402.4(2) length column (10–2000 ft, or at least to 250/300). Refuse or flag lengths beyond the table.
- **[CRITICAL] Linear interpolation between rows instead of "next longer length" undersizes pipe inside the table range.**
  - Repro: NG, Low, 120,000 Btu/h at 11 ft → app **1/2"** (capacity shown 170k, interpolated). Code: 20 ft row 1/2" = 118 → **3/4"**.
  - 300,000 Btu/h at 45 ft → app **1"** (307.5k interpolated). Code: 50 ft row 1" = 284 → **1-1/4"**.
  - 115,000 at 21 ft → app 1/2"; code (30 ft row 1/2" = 95) 3/4".
  - Sweep 1–100 ft × 10k–4M Btu/h: **9.5% of all cases undersized by one size**. In the residential band (40–250k Btu/h, 10–100 ft): 8.7% (341/3,913).
  - Cause: lines 139–143. Fix: pick the first table row ≥ run and never interpolate. Also fix the false REVIEW.md claim that "linear interpolation … is correct".
- **[CRITICAL] LP multiplier 2.5× overstates propane capacity by about 48%.**
  - Repro: LP, Low, 400,000 Btu/h at 10 ft → app **1/2"** ("438k"). LP Sch 40 table (11 in. w.c., 0.5 in. drop) 10 ft: 1/2" = 291 kBtu/h, 3/4" = 608 → **3/4"**.
  - LP 200,000 at 100 ft → app 3/4" (260k). LP table 100 ft: 3/4" = 175, 1" = 330 → 1" (100 ft LP row from memory; the ratio is consistent across rows).
  - The 10 ft repro rests only on the verified 10 ft row.
  - Cause: line 150 `m *= 2.5`. Fix: embed the actual LP kBtu/h table (IFGC 402.4(28)/(31) depending on edition, or NFPA 54 Table 6.3.1(a)) rather than a multiplier.
- **[HIGH] "2 PSI" option is an invented ×2.0 factor and gives no hybrid-system guidance.**
  - Repro: NG, 2 PSI, 200,000 Btu/h at 60 ft → app 3/4" (280k).
  - If the tech applies this to piping downstream of the line regulator (7 in. w.c.), the code (402.4(2), 60 ft) needs 1" (3/4" = 137 CFH).
  - For the 2 psi zone itself, the real 2 psi/1 psi-drop table gives far more than 2× (exact values UNVERIFIED; not reached), so the result is wrong in the conservative direction there.
  - The LP + 2 PSI combination gives ×5 with no basis.
  - Cause: line 151. Fix: replace with the 2 psi tables and an explicit two-zone workflow (meter→regulator, regulator→appliances) per Appendix A.3.3. Or remove the option.
- **[MEDIUM] Several embedded table values are higher than 402.4(2) (unsafe direction), even before interpolation.**
  - 1/2" @10 ft 175 vs 172. 1-1/2" @20 ft 1460 vs 1430; @30 1180 vs 1150; @50 890 vs 873; @100 610 vs 600.
  - 75 ft row (59/122/228/468/715/1340) vs the code's next-longer 80 ft row (56/117/220/452/677/1300).
  - Repros: 880,000 @50 ft → app 1-1/2", code 2". 605,000 @100 ft → app 1-1/2", code 2". 1,450,000 @20 ft → app 1-1/2", code 2". 700,000 @75 ft → app 1-1/2", code 2" (80 ft row 677). 175,000 @10 ft → app 1/2", code 3/4".
  - Rated MEDIUM because each is ≤2.6% and only bites near the edge (72 swept cases), but they are all on the unsafe side. Fix: copy the table exactly.
- **[MEDIUM] "Inlet Pressure: Low (0.5 PSI)" mislabels the table and hides its basis.** 402.4(2) is "inlet pressure less than 2 psi, pressure drop 0.5 in. w.c., SG 0.60". The design pressure drop is the parameter that actually defines the capacities, and it is never shown. Typical residential supply is 7 in. w.c. (0.25 psi), not 0.5 psi. Fix: label "<2 psi (typ. 7 in. w.c.), 0.5 in. w.c. drop, SG 0.60, 1,000 Btu/ft³".
- **[MEDIUM] No branch/section workflow.** One "Total BTU/h + Longest Run" result is only the size of the first section from the meter. The code sizes every section for its own downstream load using the longest-length row. Nothing tells the tech this, and a tech entering a branch's own length (not the longest length) gets an undersized branch. Fix: a section list (load per section, one longest length), or at least a note.
- **[LOW] "Recommended: next size up for margin"** is not a code requirement. It is harmless but presents a cost decision as a recommendation.
- **[LOW] Capacity display rounding can read higher than the table value.** `fmtK`: 1460 → "1.5M"; 1150 → "1.1M". Example: at 100 ft with load 1,150,000 the result says "2" — 1.1M" (looks smaller than the load).
- **[LOW] Only 1/2"–2"**; "Exceeds 2"" offers no larger sizes (402.4(2) goes to 4"+). The 1,000 Btu/ft³ assumption is not stated.
- **[LOW] Tier:** embeds IFGC charts and drives installation, which by CALCULATORS.md is T3 (report required). It is badged T2 "field".

**Verified OK:**
- Picks the first size whose capacity ≥ load (rounds size up, not down).
- Empty, negative, or zero BTU/run blanks the results.
- Runs under 10 ft use the 10 ft row (correct).
- 3/4" and 1"/1-1/4" columns at 10/30/50/100 ft equal the code values or are within 1.
- CSST disclaimer present.

**Unverified:**
- Exact 2 psi NG/LP table values (source 403).
- LP Sch 40 rows other than 10 ft (from memory, internally consistent).
- Whether the owner targets IFGC 2021 vs 2024 table numbering; values for 402.4(2) have not changed across editions as far as I know.

**UX notes:**
- "Longest Pipe Run" has no explanation (meter to most remote outlet) and no fittings guidance.
- Results sit between the selectors and the table; the capacity table repeats the result. Fine on 390 px but long.
- No indication of which table/drop/SG is used. The pressure label confuses inlet pressure with drop.
- The "Exceeds 2"" state leaves the capacity table red with no next step.

---

## Combustion Air (`tools/calculators/combustion-air.html`)
**What it claims to do:** "IFGC Requirements / Per IFGC Section 304". Enter appliance input and room volume. "Indoor Only" checks 50 ft³ per 1,000 Btu/h. "One Opening" sizes at 1 in²/3,000. "Two Openings" sizes at 1 in²/4,000 per opening, min 100 in², plus an equivalent round duct diameter.

**Method check (IFGC 304 / NFPA 54 9.3):**
- Standard-method volume of 50 ft³/kBtu: correct (304.5.1).
- Single outdoor opening 1/3,000 within 12 in. of top (304.6.2): divisor correct. The other two conditions (≥ sum of vent connector areas, and appliance clearances) are missing.
- Two outdoor openings direct/vertical duct 1/4,000 each (304.6.1(1)): correct.
- **Missing:** horizontal ducts 1/2,000 each (304.6.1(2)); indoor combined-space openings 1/1,000 each, min 100 in² (304.5.3.1), or 2/1,000 for different stories (304.5.3.2); known-air-infiltration method (304.5.2, required when ACH < 0.40); combination indoor/outdoor (304.7); mechanical (304.9); louver derating (304.10).
- The 100 in² floor is applied to the outdoor methods too. The code has no such floor there (only a 3 in. minimum duct dimension), so this is conservative.

**Findings**
- **[CRITICAL] "Two Openings" always uses the 1/4,000 outdoor-direct/vertical-duct ratio, with no option for indoor openings (1/1,000) or horizontal ducts (1/2,000), and the button does not say "outdoor".**
  - When "Indoor Only" reports "Too Small", the normal field remedy is two openings to an adjoining room. The tool then gives a quarter of the code area.
  - Repro (Playwright): 140,000 Btu/h (100k furnace + 40k WH), Two Openings → **100 sq in**. IFGC 304.5.3.1 indoor openings: **140 in² each**.
  - 400,000 Btu/h → app **100 sq in, 11.3" dia**. Code: indoor openings 400 in² each; outdoor via horizontal ducts 200 in² each; only outdoor direct/vertical = 100 in².
  - Cause: line 194 `divisor = selAir === 'one' ? 3000 : 4000`, button labels lines 89–91. REVIEW.md flagged this vaguely (and wrongly claimed 3000/4000 were "swapped"; they are not).
  - Fix: the air-source choice must be explicit: Indoor openings (same story / different story), Outdoor two openings (direct or vertical duct / horizontal duct), Outdoor one opening, Known infiltration, Mechanical.
- **[MEDIUM] Louver hint is incomplete and no gross louver size is computed.** "Louvers and grilles typically have 75% free area." IFGC 304.10: where free area is unknown, assume 25% for wood and 75% for metal louvers. A tech fitting a wood louver per the hint would install a third of the required free area. Fix: louver material selector that outputs the gross louver area.
- **[MEDIUM] Standard-method "Adequate" verdict without the 0.40 ACH precondition.** 304.5.1 applies only when infiltration is not known to be below 0.40 ACH; tighter buildings need 304.5.2 (21 ft³/ACH per kBtu for other appliances, 15 ft³/ACH per kBtu for fan-assisted). The green "Adequate" result shows no assumption. Fix: show the condition and offer the known-infiltration calculation.
- **[MEDIUM] Single-opening method omits two code conditions.** The area must also be ≥ the sum of vent connector areas, and appliances need ≥1 in. side/back and 6 in. front clearance (304.6.2). The "top 12 in." placement is not stated either. Usually 1/3,000 governs, so not rated higher.
- **[MEDIUM] Invalid volume input still produces opening sizes.** L = −10, Two Openings → volume "—" but "100 sq in / 11.3" dia" shown. Volume does not affect area, but the page gives no sign the inputs are invalid. Negative BTU blanks the results correctly.
- **[LOW] Uses "Confined/Unconfined"** (pre-2002 NFPA 54 terms) while claiming current IFGC.
- **[LOW] "Equivalent Round Duct" is shown for single/direct openings,** where it is irrelevant. The 3 in. minimum duct dimension (304.11) is not mentioned.

**Verified OK:**
- 50 ft³/kBtu threshold and the comparison (≥, boundary 5,000 ft³ @ 100k = "Adequate").
- 1/3,000 and 1/4,000 arithmetic. `Math.ceil` on area. Round-duct diameter √(4A/π) (100 in² → 11.3").
- Dims vs direct-volume toggle. Results reset on empty/negative BTU.

**Unverified:** 304.10 louver percentages and 304.6.2 vent-connector clause wording (from memory; ICC site 403).

**UX notes:**
- The three source buttons need plain-language descriptions ("to outdoors", "to another room") and a diagram.
- The result says "per opening" only in tiny sub-text.
- Height defaults to 8 with a placeholder that looks identical to a typed value.
- There is no "next step" when "Too Small".

---

## Condensate Drain (`tools/calculators/condensate-drain.html`)
**What it claims to do:** Minimum condensate drain size from total tonnage per "IMC Table 307.2.1". Also a recommended upsize, 1/8 in/ft slope, and total drop.

**Method check:**
- Size bands (≤20 t 3/4", ≤40 1", ≤90 1-1/4", ≤125 1-1/2", ≤250 2") match IMC Table 307.2.2 as reproduced by multiple secondary sources. Inclusive upper bounds match "up to / over … to".
- Slope 1/8 in/ft matches 307.2.2 (1%). Drop = run/8 is correct.
- BTU/h ÷ 12,000 is correct.

**Findings**
- **[MEDIUM] Missing the "not smaller than the drain-pan connection, no reduction" rule.** The result is labeled "Minimum Drain Size". Repro: 5 t single unit → "3/4"". If the unit's pan connection is 1", 3/4" violates IMC 307.2.2. Fix: add a "pan connection size" input or a prominent note. Also note that the table formally governs manifolded drains.
- **[LOW] Wrong citation:** "IMC Table 307.2.1" (lines 64, 91). In current IMC the table is 307.2.2.
- **[LOW] Tonnage display rounding:** 20.04 t shows "20.0 tons" next to 1" (correct size, confusing display).
- **[LOW] "Recommended" upsizing for multiple units double-counts.** The table is already applied to the combined tonnage; the extra size for ">50 ft" or "multiple units" is opinion. It is disclosed ("Upsized: …"), so only LOW.
- **[LOW] Input handling:** units = 0 is silently treated as 1, and 1.9 as 1 (`parseInt`). Units = −2 blanks everything. Hint "P-trap required on negative pressure units" vs 307.2.4 "trapped as required by the manufacturer"; no mention of secondary/auxiliary drain (307.2.3).

**Verified OK:** all band edges (20, 20.01, 40, 90, 125, 250, 251 → "> 2"" with warn); BTU/h mode (36,000 → 3.0 t; 240,000 → 20 t → 3/4"); drop (40 ft → 5.00"); blanking on invalid capacity.

**Unverified:** ICC primary text of Table 307.2.2 (403); values come from consistent secondary reproductions.

**UX notes:**
- Mode buttons are `div`s, not buttons (no keyboard/a11y).
- The slope row is static (always 1/8") and takes a full result row.
- The 250 t "> 2"" state gives no guidance.

---

## Heat Analysis (`tools/heat.html`)
**What it claims to do:** Gas tab: output = input × efficiency; ΔT = supply − return; CFM = output / (1.08 × ΔT). Electric tab: nameplate kW × 3412, or measured V × A (× 1.732 for 3-phase, PF 1) → kW → BTU/h → CFM by the same 1.08 formula. Exports a text report. It does **not** implement clocking the gas meter or an altitude derate, and claims neither.

**Method check:**
- 1.08 = 60 min × 0.075 lb/ft³ × 0.24 Btu/lb·°F: correct for **standard air at sea level**, giving standard CFM.
- 3.412 Btu/h per W: correct (3412.14). √3 for balanced 3-phase line-to-line V × line A: correct for resistive heat.
- Arithmetic reproduced exactly:
  - 100,000 × 80% = 80,000; ΔT 55 → 1,347 CFM.
  - 10 kW, ΔT 30 → 34,120 BTU/h, 1,053 CFM.
  - 240 V × 41.7 A → 10,008 W.
  - 3φ 208 V × 27.8 A → 10,015 W.

**Findings**
- **[MEDIUM] No altitude/density correction or disclosure for the 1.08 factor.** At 5,000 ft (standard atmosphere, 12.23 psia, ρ ratio 0.832) the factor is ~0.90. Repro: 100,000 in, 80%, 68→123 °F → app **1,347 CFM**; actual airflow at 5,000 ft ≈ 80,000/(0.90×55) ≈ **1,617 CFM** (+20%). The gas furnace's own high-altitude input derate also isn't mentioned. Fix: elevation input (or at least a stated "sea-level standard air" assumption).
- **[MEDIUM] Gas CFM rests on undisclosed assumptions: firing at nameplate input and efficiency ≈ steady-state.**
  - The input is the nameplate value, not measured (no clock-the-meter or manifold-pressure path).
  - "Efficiency" is unlabeled; a tech will type AFUE, which is a seasonal figure, not steady-state.
  - An over- or under-fired furnace (±10–20%) moves CFM by the same percentage.
  - Fix: label the result as an estimate and add a "measured input" path: BTU/h = 3600 / seconds per ft³ × heating value × dial size.
- **[MEDIUM] Electric "Nameplate kW" ignores actual supply voltage.** Heater kW is rated at a voltage (usually 240 V); at 208 V output is (208/240)² = 75%. Repro: nameplate 10 kW, 70→100 °F → app 34,120 BTU/h, **1,053 CFM**; the same heater on 208 V (measured path, 208 V × 36.1 A) → 25,620 BTU/h, **791 CFM**. The nameplate path overstates by 33%. Fix: ask for rated voltage and measured voltage, or warn.
- **[MEDIUM] Reversed or negative ΔT produces negative output.** Return 123, supply 68 → ΔT "−55.0 F", CFM "**−1347 CFM**", shown as a live result and copied into the report. Efficiency 800% is accepted (→ 13,468 CFM). Fix: validate (ΔT > 0, 0 < eff ≤ 100) and blank the results.
- **[LOW] Efficiency placeholder "80" looks like a default but isn't one.** With efficiency blank, output and CFM stay "--" with no hint why.
- **[LOW] Dead code:** `window.HVAC_SESSION` is written (lines 427, 476) but nothing in the repo defines or reads it. `getCalcState`/`getReportBlock(context)` have no caller in the repo for heat. If wired up later, the negative/stale CFM would propagate.
- **[LOW] Report omits the assumptions** (1.08 sea-level, PF = 1, balanced 3φ, nameplate firing). No efficiency label (AFUE vs steady-state).
- **[LOW] 3-phase measured path assumes balanced legs** with one amp reading; not stated outside the formula hint. Blower motor heat is not addressed for electric furnaces.

**Verified OK:** all formulas and constants above; ΔT = 0 blanks CFM (no divide-by-zero); path/phase switching updates the formula text and report; the report values equal on-screen values for the active tab.

**Unverified:** n/a (no code tables are used).

**UX notes:**
- Input values are echoed back as "result" rows (Return/Supply/BTU In/Efficiency), which makes the results list long. On 390 px the CFM answer is about two screens below the inputs.
- The electric tab hint about duct-heater bypass is useful but sits in the middle of the inputs.
- Tabs are `div`s with onclick.
- No unit symbol "°" on temperatures ("F").
