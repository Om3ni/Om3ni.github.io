# Refrigeration — calculator audit

Auditor scope: `tools/refrigeration.html` (incl. the Nov 2026 "Patterns to check" panel), `tools/calculators/refrigerant-charge.html`, `tools/calculators/long-lineset.html`. All three were driven in Playwright at 390x844 (scripts: `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-refrig/rf.js`, `rf2.js`, `ch.js`). I checked the numbers independently in Python with CoolProp 8 (`dens.py`, `dp.py`) and against manufacturer documents.

Primary references used:
- **Carrier/BDP "Residential Piping and Long Line Guideline", Puron (R-410A), Catalog No. LLGP-4XA, ed. 03/09** (downloaded via captiveaire.com, text extracted). Relevant parts:
  - Table 5, charge per foot of liquid line: 3/8" = 0.60 oz/ft, 5/16" = 0.40, 1/4" = 0.27. Factory charge covers 15 ft of 3/8" line (9 oz).
  - Charge formula: `(oz/ft × total length) − factory charge`.
  - Long-line threshold: 80 ft. Maximum 200 ft actual length and 250 ft equivalent length.
  - Vertical-separation tables, plus the required accessories (hard-shutoff TXV, crankcase heater, hard-start kit, bi-flow solenoid on heat pumps, inverted vapor trap when the outdoor unit is below).
  - Vapor traps are not required when the outdoor unit is above.
  - Charge to at least 10°F subcooling or the rating-plate value, whichever is greater.
- **Rheem RP13 installation instructions** (manualslib p.12): R-410A 1/4" = 0.3, 5/16" = 0.4, 3/8" = 0.6 and 1/2" = 1.2 oz/ft. Factory charge covers 15 ft. Same formula.
- **KeepRite N4A3 installation instructions** (manualslib p.10): shipped for 15 ft of line, 0.6 oz per foot of difference.
- **Lennox installation manuals** (XC21/13ACX etc., via search summaries) and HVAC School "approach method": approach = liquid line temperature − outdoor ambient.

## Summary
| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Refrigeration Analysis (`tools/refrigeration.html`) | RISKY | 0 | 2 | 6 | 5 |
| Line Charge (`tools/calculators/refrigerant-charge.html`) | BROKEN | 0 | 2 | 2 | 2 |
| Long Lineset (`tools/calculators/long-lineset.html`) | BROKEN | 0 | 3 | 3 | 3 |

Note on severity: several charge findings push the charge toward **overcharge**, and one gives the **wrong direction** (it says add when the manufacturer formula says remove). The brief's wording would allow CRITICAL for that. I rated them HIGH for two reasons: the absolute error is a few ounces to about 1–2 lb, and every manufacturer cited requires the final charge to be set by subcooling or superheat, not by weight alone. The owner may reasonably rate the line-charge items CRITICAL.

---

## Refrigeration Analysis (`tools/refrigeration.html`)

**What it claims to do:**
- Computes superheat (suction line temp − dew saturation) and subcooling (bubble saturation − liquid line temp) from gauge pressures, using the shared PT library.
- Shows a compression ratio and evaporator/condenser "approach" values in Cooling, Heat Pump air-source and Heat Pump water-source modes.
- Colors SH/SC against fixed target bands.
- In cooling mode only, the new "Patterns to check" panel:
  - classifies suction saturation vs return air − 35°F (±5);
  - classifies liquid saturation vs outdoor + 20/25/30°F by SEER band (±5);
  - classifies SH/SC vs the bands;
  - lists matching rows from `resources/troubleshooting-data.js`.

**Method check:**
- **PT library use is correct.**
  - Suction calls `getSatTemp(id, p, 'dew')` and liquid calls `'bubble'` (lines ~390–396). SH and SC are computed the right way round (lines ~684–685).
  - The glide display for zeotropes is right. For R-407C at 63.2 / 279 psig it shows dew 40.0 / bubble 28.9 and bubble 115.0 / dew 123.3.
  - Out-of-range input returns `null`: "Out of range" is shown and SH/SC are blanked.
  - Switching refrigerant re-runs both lookups (`selectRef` → `onSuctPress`/`onLiqPress`), so nothing goes stale. Tested R-410A → R-22 and R-407C → R-410A; the glide line hides correctly.
- **Compression ratio** is `(liqP + 14.696) / (suctP + 14.696)` (line 686).
  - It uses absolute pressures (correct).
  - It assumes sea-level atmosphere.
  - It uses **liquid** pressure, not discharge, and the output is labelled just "Compression Ratio".
- **Approach definitions** (lines 692–707): see findings.
  - Cooling: "Evap Approach" = RA − SST and "Cond Approach" = liquid sat − ambient. The second is condensing temperature over ambient (CTOA, the condenser split), not "approach" as Lennox and the industry use the word.
  - Water source: mixes heating-mode and cooling-mode quantities.
- **Target bands** (lines 349–356):
  - SH: TXV 8–16, FO 10–18, or charging-chart target ±5 when entered.
  - SC: TXV 8–14, FO 4–10.
  - There is no way to enter the rating-plate subcooling target.
- **Patterns panel** (lines 455–508):
  - Logic is internally consistent with `match()`. Every tested reading set produced the matches the data table implies.
  - It needs at least 3 of 4 readings before listing anything, and has an "all normal" short-circuit.
  - It is hidden in heat-pump mode.

**Findings**
- **[HIGH] Water-source heat pump mode computes a meaningless "Cond Approach" and a non-standard "Evap Approach".**
  - Reproduction: R-410A, Heat Pump → Water Source, liquid 350.56 psig (sat 107.0°F), EWT 50, LWT 43 → app shows **Evap Approach 10.0°F** and **Cond Approach 64.0°F**.
  - The mode mixes two operating modes. In heating, the source water is the evaporator, so the condenser is the indoor air coil and the condenser reference should be return air. Instead the code subtracts the source-water LWT (107 − 43 = 64), which describes nothing physical.
  - In cooling, water is the condenser and LWT would be right, but then EWT is the wrong evaporator reference. Cooling mode cannot use water fields at all.
  - Chiller/water-coil convention is evaporator approach = **leaving** water − SST (here 43 − 40 = 3°F, not 10) and condenser approach = SCT − leaving water.
  - Code: `refrigeration.html` ~lines 703–707 (repeated in `getCalcState` ~799 and `getReportBlock` ~846).
  - Fix: add a heating/cooling selector for water source. Heating: evap = LWT − SST, cond = SCT − RA. Cooling: evap = RA − SST, cond = SCT − LWT.
- **[HIGH] "Cond Approach" is actually condensing-over-ambient (CTOA); the name collides with the manufacturer "approach" charging method.**
  - Reproduction: R-410A, liquid 391.09 psig (sat 115.0), liquid line 105, ambient 95 → app **"Cond Approach 20.0 F"**.
  - Lennox installation instructions define approach = liquid line temp − outdoor ambient, here 105 − 95 = **10°F**. Lennox's rule: above the table value, add refrigerant.
  - The app's value is always larger than the true approach by exactly the subcooling. A tech comparing it to a Lennox charging sticker (typically single-digit °F) would conclude "undercharged, add", which is the overcharge direction.
  - "Evap Approach" (RA − SST) is likewise the evaporator TD, not an approach.
  - Code: lines 694–695 and the labels at ~272–273; the same labels appear in the report.
  - Fix: rename to "Condensing over ambient (CTOA)" and "Evaporator TD", or compute true approach as liquid line temp − ambient and label it so.
- **[MEDIUM] Patterns panel can list "Low outdoor ambient" at 95°F ambient, and the 13+ SEER band is too coarse.**
  - Reproduction: TXV, RA 75, ambient 95, 13+ SEER selected, suction 118.46 / line 50, liquid 350.56 (sat 107, CTOA 12) / line 97.
    - Liquid is classed **Low** ("sat 107.0 vs ~115.0°F").
    - Panel: "One chart pattern matches. Check it before adjusting the charge: **Low outdoor ambient**".
  - Ambient is known (95°F) but is never used to gate the `lowAmbient` row.
  - A CTOA of 10–15°F is normal for many 16+ SEER / variable-speed condensers. The SEER buttons stop at "13+" and have no SEER2 wording.
  - Fix:
    - Suppress `lowAmbient` when ambient ≥ ~70°F.
    - Add a high-efficiency band, or let the user enter the expected CTOA / condensing temperature from the manufacturer's data.
- **[MEDIUM] Fixed-orifice default superheat band 10–18°F is wrong in normal hot/dry conditions.**
  - With no target entered, SH 6°F is colored red "Low".
  - The industry target-superheat relation for pistons (Carrier-style charging chart, often approximated as (3×IWB − 80 − ODB)/2) gives about 5–7°F at 95°F outdoor / 62–63°F indoor wet bulb. On a mild humid day it gives 18–20°F or more.
  - The band is disclosed in the hint ("blank uses 10–18°F"), so this is MEDIUM.
  - Fix: require the target for FO (or compute it from IWB/ODB) and show no color without it.
- **[MEDIUM] TXV subcooling is judged against a fixed 8–14°F band with no rating-plate target input.**
  - SC 6.0 is shown red "Low" (repro case 9). Rating-plate targets vary by model.
  - Carrier LLGP-4XA §I: charge to "10°F subcooling or the rating plate subcooling, whichever is greater".
  - Fix: add an optional "Target SC" field (nameplate) and judge against target ±3 (or the manufacturer tolerance). Without it, show no color.
- **[MEDIUM] Heat-pump mode keeps cooling SH/SC bands and colors and gives no warning about where suction is read.**
  - In Heat Pump mode, SH/SC still go red or green against cooling-mode bands. Manufacturers give separate heating charging procedures or charts, or say to weigh in or charge in cooling.
  - On most residential heat pumps the large-line service valve carries discharge gas in heating, so a "suction" reading there is head pressure.
  - Fix: no color in heating mode, plus a note: "read suction at the compressor/accumulator port in heating".
- **[MEDIUM] "Patterns to check" vs the CALCULATORS.md "does not diagnose / declare faults" rule — owner's call.**
  - What the panel does:
    - It labels readings High/Low/Normal.
    - It names faults ("Refrigerant undercharge", "Liquid restriction (drier)", "Low outdoor ambient").
    - It says "Check it before adjusting the charge".
    - SH/SC rows are colored red/green (base.css `.result-row.low/high` = red).
  - What weighs against a violation:
    - It is hedged ("typical patterns, not a diagnosis… Confirm before acting").
    - This file is an Analyzer module, not one of the listed calculators.
  - Even so, a ranked list of named faults is functionally a differential diagnosis. The hedging is undermined when the classifications rest on generic defaults (the 10–18 FO band, the 8–14 SC band, +20 for every 13+ SEER unit) rather than unit data, as the two findings above show.
  - Fix:
    - Show the panel only when unit-specific targets are entered.
    - Rename the outputs "above/below the reference you set".
    - Drop "before adjusting the charge".
- **[MEDIUM] Patterns panel thresholds are not shown as assumptions.**
  - The "−35°F at 400 CFM/ton" assumption appears only inside one problem's "Confirm" text.
  - The ±5°F tolerance and the SEER→CTOA mapping are not stated anywhere on screen.
  - The "~40.0°F" detail text helps but does not say where the number comes from.
- **[LOW] Compression ratio uses liquid pressure and is labelled plainly "Compression Ratio".**
  - Discharge is higher than liquid-line pressure by the condenser and discharge-line drop (typically several to ~15 psi), so CR reads a few percent low. Example: 391 vs 405 psig gives 3.05 vs 3.16.
  - Sea-level atmosphere is assumed (14.696). At 5,000 ft that adds about 1°F error to R-410A suction saturation and about 1.7°F to R-22 (library inputs are gauge pressure).
  - Fix: label it "Compression ratio (liquid ≈ discharge, sea level)" or add a discharge input.
- **[LOW] Compression ratio shows nonsense values with no flag.**
  - Suction −14.696 psig → **"Infinity"**. Suction −20 → **"−55.37"**. Suction 1000 (flagged Out of range) → **"0.36"**. Liquid < suction → "0.93".
  - Code: line 686 has no guard.
  - Fix: blank CR when either pressure is out of range or the result is ≤ 1.
- **[LOW] Panel says "enter pressure" when a pressure *was* entered but is out of range** (suction 1000 case). It should say "out of range for R-xxx".
- **[LOW] CFM input feeds no calculation.**
  - It is only echoed to results and the report.
  - The hint refers to a "Heat Module" that is not on the page.
- **[LOW] FO target ±5°F tolerance is a judgment call.** Some manufacturers use ±3°F (UNVERIFIED which).

**Verified OK:**
- Dew/bubble selection for suction/liquid, including zeotropes (R-407C, R-448A family, R-454B).
- Glide display, and the glide line hiding on switch to a single-component refrigerant.
- Out-of-range → null → error with blank SH/SC; no stale saturation after a refrigerant switch.
- SH/SC arithmetic and sign.
- CR uses absolute pressures.
- Heat-pump air-source approach definitions are consistent with heating mode (evaporator = ambient − SST, condenser = SCT − RA).
- Report text values match the on-screen values (checked all fields).
- Patterns panel ↔ `match()` agree. Every tested reading set produced the matches the data table implies: overcharge (FO u/u/d/u), undercharge (TXV n/d/n/d), lowAmbient, "no single match", "all normal". The link query string carries the same codes.
- No console errors and no horizontal overflow at 390px.

**Unverified:**
- The PT data itself (out of scope; audited separately).
- Manufacturer-specific SH/SC tolerances.
- The exact Carrier target-superheat chart values (I used the common published approximation).

**UX notes:**
- Results start about 1,040px down the page at 390px. The Patterns panel is a further ~650px below and appears only after scrolling past every result row. SH/SC are far from the inputs.
- Fifteen refrigerant buttons in small mono type (~11px) make small targets.
- "System Mode: Cooling / Heat Pump" implies heat pumps can't be in cooling. It should be "Cooling / Heating", with source air/water.
- "Condenser Design (for expected head)" uses SEER bands but does not say they change the Patterns panel.
- Unit suffix "F" without the degree sign; "PSIG" with no altitude note.
- Target superheat appears only for FO. There is no matching SC target field for TXV.

---

## Line Charge (`tools/calculators/refrigerant-charge.html`)

**What it claims to do:** additional refrigerant (oz and lb+oz) for a liquid line, from refrigerant (R-410A, R-22, R-134a, R-407C), liquid line OD (1/4–7/8") and length.

**Method check:**
- Code is `totalOz = table[ref][size] × length` (lines 87–92, 117).
- Manufacturers use `(oz/ft × total length) − factory charge`, with the factory charge covering 15 ft of 3/8" line (Carrier LLGP-4XA Table 5, Rheem RP13, KeepRite N4A3).
- The table values are 30–45% above both the manufacturer data and the liquid-density physics.

**Findings**
- **[HIGH] Charge rates are inflated and the refrigerant ordering is physically inverted.**
  - R-410A comparison:

    | Line OD | App (oz/ft) | Manufacturer (oz/ft) | Physics, 100°F liquid in ACR tube (oz/ft) |
    |---|---|---|---|
    | 3/8" | **0.78** | 0.60 (Carrier Table 5, Rheem, KeepRite) | 0.54 |
    | 1/2" | **1.46** | 1.2 (Rheem) | 1.00 |
    | 5/8" | 2.34 | — | 1.61 |
    | 3/4" | 3.44 | — | 2.40 |
    | 7/8" | 4.76 | — | 3.34 |
    | 1/4" | 0.31 | 0.27 (Carrier) / 0.3 (Rheem) | 0.20 |

  - Physics basis: CoolProp liquid density × tube bore area.
  - Ordering: R-410A has the *lowest* liquid density of the four (about 62 lb/ft³ at 100°F, vs R-22 71, R-134a 72, R-407C 67), yet the table gives it the *highest* rate.
  - Reproduction: R-410A, 3/8", 50 ft → **39.0 oz**; at 0.60 oz/ft the same 50 ft is 30.0 oz.
  - Code: lines 87–92. The same table is copied into long-lineset lines 113–116.
  - Fix: use manufacturer values (R-410A 1/4 0.27–0.3, 5/16 0.40, 3/8 0.60, 1/2 1.2) and cite the source. For other refrigerants either cite a source or remove them.
- **[HIGH] "Additional Charge" is computed on the full length entered; there is no factory-charge subtraction or factory-diameter handling.**
  - The input is labelled "Lineset Length". Only the footer hint says factory charge covers 15–25 ft.
  - Reproduction: R-410A, 3/8", 50 ft → **"Additional Charge 39.0 oz"**. Manufacturer formula: 0.60 × 50 − 9 = **21 oz**. That is 18 oz (about 1.1 lb) of overcharge if the label is taken at face value.
  - A careful tech who subtracts 15 ft (enters 35) still gets 27.3 oz vs 21.
  - Smaller line: R-410A 1/4", 15 ft → app says **add 4.7 oz**. Carrier example 1: (0.27 × 15) − 9 = **−4.95 oz, remove**. This is a wrong-direction case.
  - REVIEW.md's claim ("no factory charge length input") is still true.
  - Fix:
    - Inputs: total length, factory allowance (default 15 ft) and factory line size (default 3/8").
    - Formula: rate × total − factory oz.
    - Allow a negative result, shown as "Remove".
- **[MEDIUM] 5/16" liquid line missing.** It is a common size on 1.5–2.5 ton units (Carrier Table 5: 0.40 oz/ft).
- **[MEDIUM] No assumptions shown.**
  - Not stated: tube type, liquid temperature/subcooling, whether the figure is total or added, or the source.
  - Missing note: "final charge by subcooling per the nameplate".
  - R-134a and R-407C rates have no source (UNVERIFIED).
- **[LOW] No range checks.** 1,000,000 ft gives 48,750 lb. Typing "50,5" yields "505" (Chromium drops the comma) → 393.9 oz.
- **[LOW] lb/oz rounding can show "1 lb 16.0 oz".** Example: 0.78 × 41 = 31.98 oz. Cause: `Math.floor` on lb, then `toFixed(1)` on the remainder (lines 118–122).

**Verified OK:**
- The arithmetic rate × length is executed as written.
- Zero/negative length blanks the results.
- Button state and recalculation work.
- No overflow at 390px.

**Unverified:** manufacturer rates for R-22, R-134a and R-407C, and for 5/8–7/8" R-410A. Only physics bounds are given above.

**UX notes:**
- The most important instruction (subtract the factory length) sits in a footer hint under the results.
- The "Additional Charge" label is wrong for what is computed.
- The 3×2 size grid is fine. The refrigerant row has no R-454B/R-32 even though new equipment uses them.

---

## Long Lineset (`tools/calculators/long-lineset.html`)

**What it claims to do:** additional charge for line length beyond the factory length, suction pressure drop (length + elevation), and a superheat-adjustment note. It is tagged T3 "advanced".

**Method check:**
- Charge: `(total − factory) × rate`, with the same inflated table as Line Charge and only R-410A/R-22 (lines 113–116, 145, 163–164).
- Pressure drop: a fixed `2.5 psi/100 ft` (R-410A) or `1.5` (R-22), plus `1 psi per 10 ft` of positive elevation, regardless of line size or capacity (lines 117–118, 171–173).
- Superheat note: `+round(drop × 0.8)°F` when the drop exceeds 3 psi (line 178).
- **REVIEW.md re-check:**
  - The tonnage input it calls "dead" **no longer exists**. The page has only `inTotal`, `inFactory` and `inElev`, so there is no tonnage or suction-size input at all.
  - Suction sizing and oil-trap logic are **still absent** (confirmed).
  - REVIEW's suggested rule, "oil trap every 20 ft of rise", is commercial-refrigeration practice. It **contradicts** Carrier's residential guidance ("vapor line traps are not required" with the outdoor unit above; an inverted vapor trap at the indoor unit when the outdoor unit is below), so it should not be adopted as written.

**Findings**
- **[HIGH] Charge rates inflated (same table as Line Charge) and the factory allowance ignores line diameter.**
  - Reproduction 1: R-410A 3/8", total 100 ft, factory 15 → **66.3 oz**. Carrier formula 0.60 × 100 − 9 = **51 oz**. That is +15.3 oz.
  - Reproduction 2: total 200 ft → 144.3 oz vs 111 oz, which is +2.1 lb.
  - Reproduction 3: 1/4" line, total 30 ft, factory 15 → app says **add 4.7 oz**. Carrier formula 0.27 × 30 − 9 = **−0.9 oz (remove)**, a wrong direction.
  - Reproduction 4: total 10 ft (shorter than factory) → 0.0 oz. The tool cannot express "remove" (`Math.max(0, …)`, line 145).
- **[HIGH] "Suction Pressure Drop" ignores the only variables that determine it, and the elevation term uses the wrong physics.**
  - Darcy–Weisbach with CoolProp properties: R-410A at 40°F SST, 10°F superheat, 100 ft:

    | Capacity, suction line | Calculated drop per 100 ft | App |
    |---|---|---|
    | 2 ton, 7/8" | 0.9 psi | 2.5 psi |
    | 3 ton, 3/4" | 4.5 psi | 2.5 psi |
    | 5 ton, 3/4" | **11.6 psi (≈5°F)** | **2.5 psi, "Minimal impact"** |

  - R-22 actually has a *higher* psi drop than R-410A for the same size and capacity (3 ton, 7/8": 3.0 vs 2.0 psi), but the app gives R-22 the lower figure.
  - Elevation: the static head of R-410A suction vapor is about **0.14 psi per 10 ft** (R-22 about 0.10), but the app adds 1.0 psi per 10 ft, roughly 7–10× too high.
  - Negative elevation (condenser below the indoor unit: liquid lift of about 4.3 psi per 10 ft for R-410A, causing subcooling loss and flash gas) is **silently discarded** by `Math.max(0, elev)` (line 172).
  - Carrier sizes vapor lines by capacity, length and diameter (LLGP-4XA Tables 3a–4b, capacity-loss %) and limits outdoor-below lift through Tables 8–9.
  - Fix: add tonnage and suction OD inputs and use a capacity-based table (manufacturer or ASHRAE). Otherwise remove the number.
- **[HIGH] No long-line limits, lift limits or required accessories for a tool named "Long Lineset".**
  - The tool accepts 500 ft total, or 300 ft with 80 ft rise, and shows only charge and PSI.
  - Carrier LLGP-4XA requirements it omits:
    - Long line starts beyond 80 ft (3/8").
    - Maximum 200 ft actual and 250 ft equivalent length.
    - Outdoor-below limits per Tables 8–9 (e.g. 60 ft lift only up to 230 ft equivalent on 4-ton units).
    - Hard-shutoff TXV, crankcase heater and hard-start kit; bi-flow liquid line solenoid on heat pumps.
    - Heat-pump piston change.
    - Minimum 10°F subcooling.
  - The hint "Manufacturer specs take priority" is the only mitigation. Rated HIGH because the page presents itself as the long-line check.
- **[MEDIUM] Default factory length is 25 ft, and 0 cannot be entered.**
  - Every source checked (Carrier, Rheem, KeepRite) uses 15 ft. A 25 ft default under-adds 10 ft × rate.
  - `parseFloat(inFactory.value) || 25` (line 143) turns an entered 0 into 25: total 100, factory 0 → "75 ft".
- **[MEDIUM] Superheat note uses 0.8°F/psi and an ambiguous "+N°F adj".**
  - R-410A dTsat/dP at 40°F is **0.44°F/psi** (R-22 0.68), so the adjustment is about 1.8× too high for R-410A.
  - "+6°F adj" does not say whether it is an expected reading offset or a change to the charging target. Raising a piston target superheat would push toward undercharge.
- **[MEDIUM] Only R-410A and R-22.** No R-454B/R-32 (new A2L equipment). For A2L systems, added charge also interacts with UL 60335-2-40 charge limits, which the tool does not mention.
- **[LOW] Inconsistent warning thresholds.** At 4.3 psi the pressure-drop row is "live" while the SH row is "warn" (drop > 3). The pressure-drop row only warns above 5.
- **[LOW] lb/oz rounding can show "x lb 16.0 oz"** (same code as Line Charge).
- **[LOW] No input validation.** Negative, huge, or a decimal comma typed into the number field is accepted without a warning.

**Verified OK:**
- Additional length = max(0, total − factory) is computed as written.
- Results blank when total ≤ 0.
- Buttons recalculate; no console errors; no overflow at 390px.

**Unverified:**
- Other manufacturers' long-line guides (Goodman, Trane, Lennox) were not retrieved; only Carrier LLGP-4XA (2009) was read in full. Newer Carrier editions may differ.
- My pressure-drop values are independent Darcy estimates (smooth copper, Churchill/Swamee-Jain friction), not manufacturer tables. They show the order of magnitude and that the drop depends on size and capacity; they are not design values.

**UX notes:**
- The elevation unit "ft (+cond above)" is cryptic. A negative entry is accepted but ignored, with no message.
- No total-length warning bands (80 / 200 / 250 ft).
- The charge result does not show the formula or the assumed rate. The rate is invisible on this page, unlike Line Charge.
- Two calculators share a duplicated, wrong table. They should share one sourced table, or be merged with Line Charge as REVIEW.md suggested.
