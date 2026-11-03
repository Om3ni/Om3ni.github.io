# Pumps & Belt Drives (mech) — calculator audit

Auditor scope: `tools/calculators/system-head.html`, `belt-length.html`, `belt-deflection.html`. All three were driven in Playwright/Chromium at a 390×844 viewport against http://localhost:8765. Outputs were compared with independent Python (Colebrook iterated to convergence, my own unit constants) and with manufacturer tables. Scripts and raw output are in `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-mech/` (`sh.js`, `sh2.js`, `belt.js`, `ref.py`, `sh_out.json`, screenshots `sh_*.png`, `bl.png`, `bd.png`; downloaded reference PDFs in `dl/`).

Reference sources actually used:
- **Dow DOWTHERM SR-1 (inhibited EG) Engineering & Operating Guide**, Tables 10 (density), 14 (viscosity) and 22 (specific heat), English units, % by volume. Downloaded and text-extracted.
- **Dow DOWFROST (PG) Technical Data Sheet**, Form 180-01314-1019, saturation tables for 30/40/50 vol%. Its °F column has typos, so I used the °C column.
- **MasterDrive (TB Wood's) V-belt tension gauge instructions**: deflection force tables by section, small-sheave diameter and rpm, plus the FHP 3L/4L/5L table. Its classical "Super Gripbelt" values match the Gates Hi-Power II values as I remember them, but I did not fetch the Gates table itself.
- Browning A60 listing (pitch 61.3", OC 62.2") and Applied/Dodge A42 listing (datum 43.3"). Both give classical pitch length = belt number + 1.3" for A.
- Browning AK41 listings: OD 3.95", PD 3.70" for A/4L and 3.36" for 3L.
- ASTM D2846 CTS CPVC dimensions via EngineeringToolbox: 3/4" OD 0.875", wall 0.080–0.100". ASTM B88 and ASME B36.10 values are from memory and are standard published figures.

---

## Summary

| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Pump Sizing (`system-head.html`) | **BROKEN** for glycol and CPVC, stale or bogus operating point. Water + steel/copper friction math is OK. | 0 | 4 | 7 | 6 |
| Belt Length (`belt-length.html`) | **BROKEN** (classical A/B/C belt pick is systematically 2.7–4.7" too long) | 0 | 1 | 5 | 3 |
| Belt Deflection (`belt-deflection.html`) | **BROKEN** (force table wrong for every section; the verdict tells the tech to mis-tension) | 0 | 1 | 2 | 3 |

No item meets the brief's CRITICAL bar (unsafe or code-violating). These tools set performance and maintenance values, not life-safety limits.

---

## Pump Sizing (`tools/calculators/system-head.html`)

**What it claims to do:** Four tabs: Flow (BTU → GPM with glycol correction, "ASHRAE Ch. 31" property tables), Pipe (Darcy-Weisbach with Colebrook for one uniform pipe run), Head (equivalent-length fittings, custom component losses, static head for open systems, safety margin, HHP/BHP), and Pump (quadratic fit of 3–5 curve points, system-curve intersection, deviation from design and BEP). It also produces a text report.

**Method check**
- Flow: `GPM = BTU/hr ÷ (500·ΔT·cp·ρ/62.4)` (l.1058–1062) is the correct form. 500 = 60 × 8.33.
- Velocity: `V = 0.4085·GPM/D²` (l.856) is correct. Reynolds number `VDρ/μ` with cP/1488.16 (l.655, 1188) is correct.
- Friction: laminar 64/Re below 2300; transitional 2300–4000 is withheld; Colebrook-White iterated from f = 0.02 (l.816–843) is correct. Darcy `f·L/D·V²/2g` (l.846) is correct.
- My independent checks match the app to <0.3%:
  - Water 60°F, 10 GPM, 1" Type L, 100 ft: app 6.647 ft, reference 6.633 ft.
  - Water 180°F, 50 GPM, 2" Sch 40, 200 ft: app 8.398 ft, reference 8.414 ft.
- Fittings: L/D × D × the pipe's own f (l.1371–1378). This is the Crane TP-410 approach with actual f instead of f_T, which is slightly conservative and fine.
- HHP = GPM·TDH·SG/3960 is correct. BHP = HHP/η uses the BEP efficiency, which is disclosed as "est.".
- System curve H = Hs + kQ², with k taken from the raw TDH at design flow. Bisection is correct in principle.
- **Not present** although the task brief expected them: affinity laws, NPSH (disclosed as deferred), and any field "measure ΔP → read GPM" mode.

### Findings

- **[HIGH] Glycol viscosity table is 2–7× too high, so friction head is overstated by up to 2.5× and laminar or transitional flow is falsely flagged.**
  - Repro:
    - **Case A (PG):** Propylene Glycol, 50%, 50°F, Design GPM 20, Copper Type L 1-1/4", 100 ft.
      - App: μ = 79.0 cP, Re = 673 "Laminar", f = 0.0951, **36.5 ft/100 ft**.
      - Dow DOWFROST 50 vol% at 10°C (50°F): μ = 10.65 cP, ρ = 65.50 → Re ≈ 4,930 turbulent, f = 0.0376, **14.5 ft/100 ft**. The app is 2.5× high.
    - **Case B (EG):** Ethylene Glycol, 50%, 40°F, 20 GPM, 1-1/4" L.
      - App: μ = 32 cP, laminar, 14.5 ft/100.
      - Dow SR-1 50 vol% at 40°F: μ = 6.77 cP, Re ≈ 7,980 turbulent, 12.6 ft/100. The regime is wrong and the head is +15%.
    - **Case C (PG):** PG 40%, 104°F, 30 GPM, 2" Sch 40: app 2.39 ft/100 against 2.04 ft/100 from Dow (+17%).
  - App EG_MU compared with Dow SR-1 Table 14 (cP):

    | Concentration and temp | App | Dow SR-1 |
    |---|---|---|
    | 50% at 20°F | 72 | 10.85 |
    | 50% at 40°F | 32 | 6.77 |
    | 50% at 60°F | 15.5 | 4.55 |
    | 50% at 100°F | 5.6 | 2.39 |
    | 40% at 40°F | 11.8 | 4.91 |
    | 30% at 40°F | 5.2 | 3.54 |

  - App PG_MU 50% at 40°F is 115 cP. Dow gives about 10.65 cP at 50°F. The app's 50°F interpolation is 79 cP.
  - Cause: `EG_MU` and `PG_MU` at l.638–651. The values are not the cited "ASHRAE Ch. 31" values. The concentration basis (mass or volume %) is never stated.
  - Fix: replace them with sourced tables (ASHRAE Fundamentals Ch. 31 or Dow SR-1/DOWFROST), state "% by volume" on the input, and interpolate viscosity on log(μ) rather than linearly.

- **[HIGH] Glycol specific heat is 3–11% too high, so BTU-derived GPM is 5–10% low (under-flow).**
  - Repro:
    - EG 50%, 40°F, 100,000 BTU/hr, ΔT 20: app cp 0.857 → **10.77 GPM**. Dow SR-1 Table 22 (50 vol%, 40°F): cp 0.770, ρ 67.47 → **12.01 GPM**, so the app is 10.3% low.
    - PG 40%, 50°F, same load: app cp 0.918 → 10.36 GPM. DOWFROST 40 vol% at 10°C: cp 0.877 → 10.94 GPM (5.3% low).
  - Even if the app's table is meant as mass%, 50 mass% EG has cp ≈ 0.81–0.82 (EngineeringToolbox mass-% table), so it is still about 5% high.
  - Water cp is also high above 120°F. The app uses 1.007 at 140°F, 1.016 at 180°F and 1.022 at 200°F; Dow gives 0.999, 1.003 and 1.005. At 200°F, 100k BTU, ΔT 20, the app gives 10.16 GPM against 10.33 (1.6% low).
  - Cause: `EG_CP`/`PG_CP` at l.606–619 (row 0 also feeds water).
  - Fix: use sourced cp tables and state the concentration basis.

- **[HIGH] CPVC inside diameters are not those of any real CPVC product (the 3/4" "ID" is the CTS outside diameter), so friction is understated about 2.6×.**
  - Repro: Design GPM 4, CPVC 3/4", 100 ft, water 60°F.
    - App: ID 0.874", V 2.14 ft/s, **2.84 ft/100**.
    - Real 3/4" CTS SDR-11 CPVC (ASTM D2846: OD 0.875, wall ≥ 0.080 → ID ≤ 0.715"; listed product ID 0.688"): **7.4–8.8 ft/100**.
    - Even Sch 40 IPS CPVC (ID about 0.80–0.82") gives 3.75 ft/100.
  - The app's 1" ID of 1.101" is larger than both CTS (≈ 0.92") and Sch 40 (≈ 1.03–1.05"). Its 2-1/2" ID of 2.563" is larger than Sch 40 (≈ 2.445–2.469"). Its 1-1/2", 2" and 3" IDs (1.590, 2.047, 3.042) do match Sch 40 PVC average IDs, so the table mixes several sources.
  - Cause: `PIPE_DATA.cpvc` at l.773–783, with the label just "CPVC".
  - Fix: split into "CPVC CTS SDR-11" and "CPVC Sch 40/80" using ASTM D2846 / F441 dimensions.

- **[HIGH] Pump-tab operating point is not recomputed when Flow, Pipe or Head inputs change. The stale point is shown, plotted and printed in the report next to the new design values.**
  - Repro:
    1. Design GPM 10, Copper L 1", 200 ft, then pump points (0, 30), (10, 25), (20, 12). App: Op 12.88 GPM / 22.07 ft. This is correct.
    2. Change Design GPM to 15 and length to 600 ft. The system curve is now k = 81.86/15².
    3. The Pump tab still shows **12.88 GPM / 22.07 ft, deviation +28.8%**. The report prints "Operating GPM 12.88 … Design Deviation −14.1%". The deviation is recomputed against the new design flow but uses the old operating point.
    4. The correct intersection is **8.50 GPM / 26.3 ft** (deviation −43%).
  - Cause: `calcPump()` runs only from the pump-point and BEP inputs (l.1494–1515). `calcFlow`, `calcPipe` and `calcHead` call only `drawCurves()` (l.1478), and the tab switch (l.1977) does not call it either. The canvas then draws the stale point against the new system curve.
  - Fix: call `calcPump()` at the end of `calcHead()` (instead of `drawCurves()` alone) and clear `opGPM`/`opHead` whenever inputs are invalid.

- **[MEDIUM] Operating point is produced from a zero system curve when no pipe data has been entered (and in the transitional case).**
  - Repro: Design GPM 10, nothing on the Pipe or Head tabs, pump points (0, 30), (10, 25), (20, 12). App shows **Operating Flow 26.16 GPM, Operating Head 0.00 ft, Deviation +161.6%**, plus the W18 "Consider re-selection" warning.
  - The 26.16 GPM is also extrapolated 31% beyond the last curve point.
  - Cause: `calcHead` sets `tdh_raw = 0` rather than NaN when nothing is entered (l.1430). `calcPump` only checks `!isNaN(tdh_raw)` (l.1576).
  - Fix: require `tdh_raw > 0` (or pipe friction present) before solving.

- **[MEDIUM] In the transitional regime (Re 2300–4000), pipe AND fitting friction silently drop out of TDH. HHP and the operating point then use only the custom losses.**
  - Repro: Design GPM 1, Copper L 1", 100 ft, 10 standard elbows, one custom loss of 5 ft.
  - App: Re 2,728, W02 is shown on the Pipe tab only. The Head tab shows Fitting 0.000 ft, **TDH 5.000 ft**, HHP 0.001 HP live, and no warning on that tab.
  - 1 GPM in 3/4" L at 60°F (Re ≈ 3,600) also lands here, which is a realistic low-flow residential zone. The absolute head lost is small at these flows, which is why this is not rated HIGH.
  - Cause: l.1207–1216 and the `!isNaN(STATE.f)` guard at l.1371.
  - Fix: use Churchill (1977) or a conservative turbulent Colebrook value through the transition zone, and carry the warning onto the Head and Pump tabs.

- **[MEDIUM] Safety margin cannot be set to 0%.**
  - Repro: Design Margin = 0 → Design TDH = TDH × 1.10, sub-label "TDH × (1 + 10%)".
  - Cause: `parseFloat(this.value) || 10` at l.1444.
  - Fix: use an explicit `isNaN` check.

- **[MEDIUM] Silent substitution of out-of-range or zero inputs with defaults.**
  - Fluid temp 0°F → silently 60°F (`|| 60`, l.1035–1037). The value is outside the table, so it should show the W03 error instead.
  - ΔT 0 → silently 20°F (`|| 20`, l.1043). The app shows 10.00 GPM for 100k BTU.
  - Glycol % left blank with EG/PG selected → 0%, i.e. plain water properties. The report labels it "Ethylene Glycol 0%".
  - Water at 20–31°F is accepted and interpolated (25°F → μ 1.685 cP). That water is ice.
  - Fix: reject rather than default. Set the water lower bound to 32°F (or 33°F).

- **[MEDIUM] Placeholders look like values, and two of them are silently used as values.**
  - Fluid Temp shows "60" and ΔT shows "20" as placeholders, and those defaults are used.
  - "Pump Efficiency at BEP" shows "65", but it is not used: BHP stays "—".
  - A tech sizing a 180°F heating loop who doesn't overwrite the "60" gets friction about 28% high: 10 GPM in 1" L gives 6.63 ft/100 at 60°F against 5.16 at 180°F. That error is conservative.
  - Fix: use real default values that are visibly editable, or empty fields with "required" states.

- **[MEDIUM] Negative load or flow is accepted.** BTU load −100000 → "Active Design Flow −10.00 GPM" (l.1058, 1068).

- **[MEDIUM] Open-system static head is defined against the wrong reference.** The UI says "Pump reference datum to highest discharge point" (l.395). Static head for an open circuit is the elevation from the suction free surface (e.g. cooling-tower basin water level) to the discharge point, plus any pressure difference between the two surfaces. A flooded-suction tower pump would be over-stated. Velocity head at the open discharge is also not included. Fix the wording and the definition.

- **[LOW] Fitting citation and values.**
  - "ASHRAE Fundamentals 2021 Ch. 22 Table 7" could not be confirmed. The L/D values match Crane TP-410 (std 90° = 30, 45° = 16, tee 20/60, globe 340, swing check 100, ball 3) except gate valve 7 (Crane 8) and long-radius 90° 16 (Crane gives 20 for the older LR entry, 14 for r/d = 1.5).
  - Y-strainer L/D 60 is UNVERIFIED. Strainer losses are normally taken from manufacturer Cv/ΔP and rise sharply when fouled.

- **[LOW] BEP band cited to "ASHRAE 90.1-2022 §10.4" (l.1606, 1931).** I could not access the 90.1 text. Hydraulic Institute 9.6.3 defines the Preferred Operating Region as about 70–120% of BEP, so the ±15% band and its citation are UNVERIFIED and probably mis-attributed.

- **[LOW] The report omits several things.**
  - Missing: HHP/BHP, pump efficiency, fitting quantities, custom component names and values, the pump curve points used, and the fact that the operating point may lie on an extrapolated curve.
  - Its footer lists "motor power" as deferred while the Head tab shows BHP.

- **[LOW] Velocity < 2 ft/s is labelled "sedimentation risk".** Small residential loops routinely run at 1–2 ft/s. The usual lower-velocity concern is air entrainment and removal, not a code limit. Soften the wording.

- **[LOW] Switching fluid type swaps to a different temperature input** (`waterTemp` vs `fluidTemp`, l.1035–1037). A 180°F typed for water silently reverts to the 60°F default when EG is chosen.

- **[LOW] Missing common sizes.** There is no 1/2" Type L/M copper, no 1/2" steel and no 5"/8" steel. The PEX 1-1/4" to 2" IDs (1.077/1.265/1.649) are about 1–2% larger than the IDs Uponor publishes (≈ 1.054/1.244/1.629, from memory, UNVERIFIED).

**Verified OK:**
- Velocity constant 0.4085 and the cP → lb/ft·s conversion.
- Reynolds formula and Colebrook implementation (converges well inside 25 iterations for normal Re).
- Darcy-Weisbach, ft ↔ psi conversion, and the 500/3960 constants.
- Sch 40 steel IDs (0.824/1.049/1.380/1.610/2.067/2.469/3.068/4.026/6.065), Type L IDs (0.785/1.025/1.265/1.505/1.985/2.465/2.945/3.905) and Type M IDs (0.811/1.055/1.291/1.527/2.009/2.495/2.981/3.935): all match ASME B36.10 / ASTM B88.
- Roughness: steel 0.00015 ft, drawn copper 0.000005 ft.
- Water density at 40–200°F (matches Dow SR-1 Table 10 within 0.05 lb/ft³) and water viscosity at 40–200°F (within about 0.02 cP).
- EG density table: within about 0.3% of Dow SR-1 vol% values.
- Closed loop excluding static head.
- Quadratic least-squares fit and bisection, when inputs are complete and current.

**Unverified:**
- The exact ASHRAE Ch. 31 tables (no access). I used Dow manufacturer data instead.
- PG density at low temperature.
- The Y-strainer equivalent length.
- The ASHRAE 90.1 §10.4 citation.
- Exact PEX IDs (they vary by manufacturer).

**UX notes (390 px):** see the structure and redesign section at the end.

---

## Belt Length (`tools/calculators/belt-length.html`)

**What it claims to do:** Take large and small pitch diameters plus centre distance and compute pitch length `L = 2C + π/2(D+d) + (D−d)²/4C`. It then derives an "outside circumference" (pitch + section correction), the nearest standard belt for 3L/4L/5L/A/B/C, the speed ratio and the wrap angle.

**Method check:**
- The pitch-length formula (l.391) is the standard approximation and is correct.
- The belt numbering model (l.253–256, 395, 302) is wrong for classical belts. A/B/C belt numbers are nominal *inside* lengths, and pitch (datum) length = number + 1.3" (A), + 1.8" (B), + 2.9" (C). Sources: Browning A60 has pitch 61.3" and OC 62.2"; A42 has datum 43.3" and a retail OC of 44". The code instead computes OC = pitch + correction and matches the belt number to that OC.
- FHP 3L/4L/5L numbers are outside length in tenths of an inch. That part is right, but the 4L pitch-to-OC offset is about +0.6–0.9", not +1.3". The industry rule is "4L OC ≈ A number + 2"", which gives OC ≈ pitch + 0.7. Dayco cross-references 4L440 to AX42.

### Findings

- **[HIGH] Classical A/B/C belt pick is about 2×correction too long (A +2.6", B +3.6", C +5.8" of belt number).**
  - Repro (pitch diameters, inches):
    - **A section**, D 10, d 4, C 20 → pitch 62.44". The app picks **A64**, whose pitch is 65.3" (+2.9"). The correct pick is **A61** (pitch 62.3").
    - **B section**, same drive → app **B64** (pitch 65.8"); correct **B61**/B60 (62.8"/61.8").
    - **C section**, D 16, d 8, C 30 → pitch 98.23" → app **C100** (pitch 102.9"); correct about **C95/C96** (C96 pitch 98.9").
  - A belt 2.9–4.7" too long in pitch needs about 1.4–2.3" of extra centre-distance take-up, which typical motor bases may not have.
  - Cause: `var oc = L + sec.correction` (l.395) followed by matching the number to the OC.
  - Fix: for classical sections, use `number = pitch − {1.3, 1.8, 2.9}`. For FHP sections, `OC = pitch + section-specific offset` taken from a manufacturer table. Then relabel the "Outside Circumference" row.

- **[MEDIUM] 4L/5L/3L offset (+1.3/+1.8/+0.8) appears high, so FHP picks run about one size long.**
  - Repro: 4L, D 10, d 4, C 20 → app **4L640**. If 4L OC ≈ pitch + 0.7 (per the 4L ≈ A + 2" cross-reference), the pick should be 4L630.
  - The exact FHP effective-length offsets are UNVERIFIED (no manufacturer table retrieved), so this is rated MEDIUM.

- **[MEDIUM] The "How to Measure" calipers/tape method computes groove-bottom diameter, not pitch diameter.**
  - The tool says "Pitch diameter = OD − 2 × groove depth" (A: subtract 0.63"; B: 0.81"; C: 1.06"). The listed "groove depths" are actually belt depths.
  - Browning AK41: OD 3.95", PD 3.70" for A/4L (difference 0.25"). The app's method gives 3.32", 0.38" low on each sheave.
  - Fix: use PD = OD − 2a with 2a ≈ 0.25" (A/4L), 0.35" (B/5L) and 0.40" (C) per the classical-sheave convention, or simply list the PD by sheave part number. The 2a values come from my memory of RMA IP-20 and only the A value was confirmed (via AK41), so treat B/C as UNVERIFIED.

- **[MEDIUM] Sheave-stamping shortcut is wrong.** The tool says "AK41 (A section, 4.1" PD)". AK41 is nominally a 4.1" OD sheave (actual OD 3.95") with PD 3.70" for A/4L and 3.36" for 3L (Browning). Entering 4.1 overstates pitch length by about 0.6" per sheave.

- **[MEDIUM] "Measure the inside length and enter that directly as pitch length".** There is no input for this, and inside length ≠ pitch length (A: pitch = inside + 1.3").

- **[MEDIUM] No geometric validation.**
  - C = 0.5" with D 10 / d 4 gives a wrap of **−540°** and still produces a belt match (A42).
  - Swapped pulleys (D 4, d 10) give **198° "On small sheave — adequate"**.
  - Nothing checks C > (D+d)/2.
  - Fix: require D ≥ d (or swap automatically) and C > (D+d)/2, and use the exact wrap `180 − 2·asin((D−d)/2C)`.

- **[LOW] Stale sub-text after clearing centre distance.** With C cleared, the dimmed rows keep "Below 120° — idler pulley required" and "42" OC — −0.3" from calculated" (the `setR(...,'dim','—')` calls don't reset `sub`). Seen in `bl.png`.

- **[LOW] Off-catalog results.** A section, C = 100 → pitch 222" → "BEST A128, −95.4"". The best match is still flagged BEST, only in warn colour. Catalogs stop at A128 / 3L400 / 5L1000, and longer standard sizes exist (UNVERIFIED exact lists).

- **[LOW] Wording and approximations.**
  - "Below 120° — idler pulley required" overstates the issue. Below 120° the rating needs an arc-of-contact correction (about 0.82 at 120° per the MasterDrive table).
  - The wrap approximation `180 − 60(D−d)/C` is off by about 10° at extreme ratios.
  - "Typical adjustment range ±1" per 12" of centre distance" is UNVERIFIED.

**Verified OK:**
- Pitch-length formula.
- Speed ratio.
- Section correction magnitudes 1.3/1.8/2.9 for A/B/C (the magnitudes are right; only the sign is wrong).
- Belt top widths (3/8, 1/2, 21/32, 7/8").
- FHP numbering in tenths.

**Unverified:**
- The FHP pitch/OC offsets.
- Completeness of the standard size lists.
- B/C sheave 2a values.

**UX notes:**
- The header says "A · B · C" but the page starts on 4L.
- There is no RPM input, so it can't give driven RPM (fan speed) even though it asks for both pulleys.
- Inputs are labelled "Pulley Dia.", not "Pitch Dia.". The pitch-diameter requirement appears only in the footer hint.
- The match grid uses red/green only to show short/long.
- The "How to measure" panel is long and pushes the inputs down when open.

---

## Belt Deflection (`tools/calculators/belt-deflection.html`)

**What it claims to do:** Given the span, compute the target deflection (span/64). It then shows a deflection-force range by section and belt condition (new or run-in), and gives a GOOD / TOO LOOSE / TOO TIGHT verdict for a measured force.

**Method check:**
- The 1/64" per inch of span rule is correct (MasterDrive: "ratio of deflection to belt span is 1:64").
- The fraction formatting is correct.
- There is no span-from-centre-distance calculation (t = √(C² − ((D−d)/2)²)). The user must measure span. That is acceptable but limiting.
- Manufacturer force tables depend on cross-section, smallest sheave diameter and rpm, and give a single "used belt" minimum and a "new belt" maximum. The app has one fixed range per section, which ignores sheave diameter and rpm (l.262–269).

### Findings

- **[HIGH] Deflection force values are wrong for every section: too low for A/B/C and 2–4× too high for 3L/4L/5L.**

  Comparison with the MasterDrive table (lb at 1/64"/in; wrapped belts, 1000–2500 rpm):

  | Section | App: new | App: run-in | Manufacturer: used min / new max |
  |---|---|---|---|
  | A | 3.25–5.25 | 2.0–3.5 | 3.7/5.5 (3.0–3.6" sheave), 4.5/6.8 (3.8–4.8"), 5.4/8.0 (5.0–7.0") |
  | B | 5.25–8.5 | 3.25–5.5 | 5.3/7.9 (4.4–5.6"), 6.3/9.4 (5.8–8.6") |
  | C | 10–16 | 6.5–10.5 | 11.5/17.0 (7–9"), 14.1/21.0 (9.5–16") |
  | 3L | 2.25–3.75 | 1.5–2.5 | 3/8–1 used, 5/8–1.5 new |
  | 4L | 3.25–5.25 | 2.0–3.5 | 5/8–2 used, 1–3 new |
  | 5L | 5.25–8.5 | 3.25–5.5 | 1.5–2.5 used, 2.6–3.5 new |

  - Repro:
    - A, span 20", Run-In, 5.0 lb → app **"TOO TIGHT … decrease centre distance"**. For a 3.8–4.8" sheave the manufacturer band is 4.5–6.8 lb, so 5.0 lb is acceptable.
    - A, Run-In, 3.0 lb → app **"GOOD"**. The manufacturer minimum is 3.7–5.4 lb, so the belt is loose and will slip.
    - 3L, span 15", Run-In, 2.0 lb → app **"GOOD"**. The manufacturer maximum for a new 3L belt is ≤ 1.5 lb, so the belt is over-tensioned (bearing load on small blower motors).
    - 4L, New, 3.5 lb → app "GOOD"; the manufacturer new-belt maximum is 3 lb.
  - The app also treats 4L as identical to A, which is wrong: FHP 4L forces are much lower.
  - Cause: `SECTIONS` table at l.262–269 (no source cited).
  - Fix: use a sourced table indexed by section, small-sheave PD and rpm (inputs needed), cite the manufacturer, and present it as "manufacturer range" rather than a verdict.

- **[MEDIUM] The verdict wording ("TOO LOOSE/TOO TIGHT — increase/decrease centre distance") declares a condition and prescribes an action.** This sits at the edge of the CALCULATORS.md rules "do not diagnose / declare faults". It is especially harmful while the table is wrong. Suggest "below/above the reference range for the selected belt" instead.

- **[MEDIUM] Sheave size and rpm aren't collected,** although the reference note itself says "Small pulley speed factor affects the range". Results shown without that assumption are misleading.

- **[LOW] The range display rounds both ends outward** (3.25–5.25 shown as "3.3 – 5.3 lbs") while the comparison uses the unrounded values. A 5.27 lb reading displays as within "5.3" but gets "TOO TIGHT".

- **[LOW] "Thumb method 5–8 lbs" for A/4L** conflicts with the page's own table and the manufacturer data. The thumb method is unsafe to quantify; drop the number.

- **[LOW] No span-from-centre-distance helper.** The task brief asked for one; it is absent.

**Verified OK:**
- Span/64 deflection.
- Fraction display.
- Verdict hides when the force is cleared.

**Unverified:**
- Gates' own current table, which I did not fetch. The MasterDrive values match Gates Hi-Power II as far as I remember, but that is not confirmed.

**UX notes:**
- The diagram is good.
- The force input says "optional", but it is the main field reading.
- The force table is buried in a collapsed panel.
- There are no inputs for small-sheave diameter or rpm.
- 3L–C buttons are adequate (≥ 40 px tall).

---

## Pump Sizing — structure & redesign input

### 1. Map of sections and modes (what each actually computes)

| Tab | Inputs | Computes | Notes |
|---|---|---|---|
| **Flow** | Fluid (Water/EG/PG), glycol %, temperature (two separate inputs depending on fluid), BTU/hr, ΔT, optional "Design GPM" override | cp, ρ, μ by bilinear table lookup; GPM = BTU/(500·ΔT·cp·ρ/62.4); mass flow | The glycol tables are wrong (see HIGH findings). The override silently wins. |
| **Pipe** | Material (5), nominal size, horizontal length, vertical length | V, Re, regime, f (Colebrook / 64/Re / withheld), ft/100 ft, friction head for horizontal + vertical | One uniform pipe only. Horizontal vs vertical is a cosmetic split: both are just length. Fittings are not on this tab. |
| **Head** | Closed/Open, static lift (open only), 10 fitting quantities, N custom losses (ft only), safety margin | Fitting head (L/D·D·f), custom sum, static, raw TDH, design TDH, HHP, BHP (efficiency comes from the Pump tab) | This is where the head answer lives, but it is reached only after 2 tab switches. |
| **Pump** | 3–5 (GPM, ft) curve points, BEP GPM, efficiency | Quadratic fit RMSE, system/pump intersection, deviation from design and from BEP, canvas plot | Needs manufacturer curve data. Not recomputed when Tabs 1–3 change (HIGH). |
| **Report** | — | Text dump of state | Omits HHP/BHP, fittings, components and curve points. |

### 2. Core field use vs rarely useful

**Core for a technician:**
- Checking an installed circulator's operating point: measure ΔP across the pump (psi → ft with SG) and read GPM off the curve, or the reverse.
- Sizing a replacement circulator for a residential or light-commercial closed loop: GPM from BTU/ΔT, then head from the longest circuit's total equivalent length.
- Comparing the old pump's curve with the new one.
- Affinity-law what-ifs (speed or impeller change, ECM speed settings). This is entirely absent today.

**Rarely useful or over-engineered for the field:**
- The Reynolds, regime and friction-factor rows, and the cP/lb·ft·s readouts (keep them in an "engineering details" expander).
- Separate horizontal and vertical length.
- RMSE "fit quality".
- The open-system static path. It is rare for hydronic techs, though relevant to cooling towers.
- The 10-row fitting grid. Most techs use "add 50% for fittings" or a total equivalent length.

**Missing but core:**
- Total equivalent length as a single input.
- The ΔP-gauge mode.
- 1/2" copper.
- Common hydronic components (boiler HX, air separator, zone valve, flow-check) with typical ΔP or Cv.
- NPSH or minimum-pressure awareness for open systems.

### 3. Concrete UX problems at 390 px (from screenshots `sh_flow.png`, `sh_head.png`, `sh_pump.png`)

- **Inputs to reach a head/GPM answer** for a typical small loop (60k BTU, 180°F, 3/4" copper, 80 ft, about 6 elbows, 2 tees, 2 valves):
  - Flow tab: BTU, ΔT, temperature (must overwrite the "60" placeholder) — 3 inputs.
  - Pipe tab: material select, size select, length — 3.
  - Head tab: about 3–4 fitting quantities.
  - Total: **about 9–10 entries across 3 tabs and 2 tab switches** before Design TDH appears. It appears at the bottom of the Head tab, below a 10-row fitting list, about 1,000 px of scroll on a 1,700 px page.
  - Getting an operating point adds **6 curve fields + efficiency = 7 more (about 17 total)** on a fourth tab.
- The GPM result is shown on Tab 1 only inside a box that appears after input. The pipe tab repeats it read-only. The head result is not visible while editing pipe or fittings.
- Placeholders "60", "20" and "65" render like entered values. Two are silently used as values; one ("65" efficiency) is not.
- Result rows wrap awkwardly. Values like "0.000 ft (0.000 PSI)" and "1.130 cP (0.000759 lb/ft·s)" break onto two lines at 390 px.
- Warning codes ("[W08]", "[W17]") are developer-facing. W08 shows permanently for every closed loop.
- Fitting labels show "(30×D)" multipliers, which mean nothing to a tech. The quantity boxes are fine-sized (about 60×40 px).
- The "+ Add Component" row offers only "ft". Manufacturer data is usually in psi, ft or Cv, and there is no unit toggle.
- Canvas text is 9–10 px. The legend overlaps curves at narrow widths.
- The 4 tabs are 98×41 px, which is fine, but nothing on the tabs shows completion or which tab is missing data.
- "Generate Report" is duplicated on two tabs, and the report omits what the tech entered on the Head and Pump tabs.

### 4. Recommended restructure

1. **Single scrolling page with a sticky result bar** (GPM · Design head · operating point) instead of 4 tabs. Each section collapses to a one-line summary once filled.
2. **Three modes at the top:**
   - (a) *Size a pump*: load → GPM → head.
   - (b) *Check an installed pump*: pump model curve + measured ΔP or GPM → operating point.
   - (c) *What-if*: affinity laws for speed, impeller or ECM setting.
3. **Head input as "longest circuit total equivalent length"** with an optional fittings helper (bottom sheet) and a "+50% fittings" quick option. Add 1/2" copper and the common hydronic components (with psi/ft/Cv units).
4. **Fix the data layer first:**
   - Sourced glycol tables with the concentration basis stated (vol%), log-viscosity interpolation, and water limited to ≥ 33°F.
   - Real CPVC CTS and Sch 40 IDs.
   - Transitional-regime handling (Churchill).
5. **Make the dependency graph explicit:** any input change recomputes everything downstream, including the operating point. Invalid or incomplete upstream data clears downstream results rather than leaving them on screen.
6. **Pump curve entry:** paste or CSV, or a few preset common circulator curves only if they can be sourced and cited. Warn when the operating point lies beyond the entered data.
7. **Engineering details** (Re, f, cp, ρ, μ, method citations) go in an expander and in the report; the main view shows field units.
8. **Report** should include every input (fittings, components, curve points, efficiency), HHP/BHP and all assumptions.
