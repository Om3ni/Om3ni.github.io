b # Calculator Suite — Code Review & Project Assessment

Thorough review of every calculator, the shared infrastructure, and the project as a whole. Written 2026-03-29.

---

## T1 — Utility Calculators

### temp-convert

**What it does:** Converts between Fahrenheit, Celsius, Rankine, and Kelvin. Type in any field, all others update instantly.

**Does well:**
- Clean bidirectional input — type in any box, others clear and recalculate. No ambiguity about source.
- Formula hints displayed per result row (e.g. `°R = °F + 459.67`) — good for techs who want to sanity-check.
- `fmt()` strips trailing zeros so you see `72` not `72.0000`. Practical.
- All logic in a closure via `init()` — no global namespace pollution.

**Could improve:**
- 0 is a valid temperature but `if (!val && val !== 0)` is not used here — instead it checks `source.value === '' || isNaN(val)`, which does handle 0 correctly. Consistent, just noting the pattern diverges from motor-convert.
- Rankine and Kelvin should probably reject negative inputs (absolute zero violation). A subtle yellow hint saying "below absolute zero" would catch accidental negatives without blocking the calculation.

**Verdict:** Solid. This is what a T1 should look like.

---

### motor-convert

**What it does:** Converts between HP, kW, BTU/h, and Tons (refrigeration). Hub-and-spoke model — everything converts through HP.

**Does well:**
- Hub-through-HP approach means adding a unit later is one constant + one line. Clean.
- `fmt()` handles magnitude-aware formatting: >1000 rounds for readability, <1 uses toPrecision for small fractions. Smart for a field tool where "5,089 BTU/h" reads better than "5088.8234".
- Constants documented inline with clear names (`HP_TO_KW`, etc.).
- Tracks `activeField` for focus, though it's declared but unused. Minor.

**Could improve:**
- `HP_TO_TONS = 0.2121` is an approximation. The exact value is `2544.43 / 12000 = 0.21204`. The rounding means at 100 HP you're off by 0.006 tons — negligible in practice but could be derived from the other constants to avoid the discrepancy (`HP_TO_BTU / 12000`).
- The `activeField` variable is set on focus but never read. Dead code — remove it.
- No hint about whether this is mechanical HP vs electrical HP (it's mechanical per the hint text). Good that the hint exists; could be slightly more prominent.

**Verdict:** Clean and functional. Minor constant precision tweak available.

---

### ohms-law

**What it does:** Enter any two of V, I, R, P — calculates the other two. All six input pair combinations handled.

**Does well:**
- Comprehensive — all 6 combinations of 2 inputs are handled (V+I, V+R, V+P, I+R, I+P, R+P). No missing cases.
- Dynamic hint text shows what was entered vs calculated — excellent UX for a learning tool.
- Formula references per result row show all paths to that value.
- Handles edge cases: sqrt for P+R and R+P combos.

**Could improve:**
- Division by zero: If V=0 or I=0 is entered with another value, the formulas involving division will produce Infinity/NaN. The `fmt()` function handles `!isFinite(n)` so it displays `—`, but the user gets no feedback about why. A hint like "Zero voltage/current produces undefined results for some values" would help.
- Entering 3+ values ignores the extras silently. Could show a note: "Only first two non-empty fields used" — but honestly, the current behavior (just recalculates with whatever pair it finds first) is fine for the audience.

**Verdict:** One of the best T1s. The hint showing entered vs calculated is a UX pattern worth replicating.

---

### pressure-convert

**What it does:** Converts between PSIG, kPa, Bar, inHg, and mmHg. Hub-through-PSIG model.

**Does well:**
- Same clean hub pattern as motor-convert. 5 units, all through PSI.
- Constants are precise to source values.
- The 5th unit (mmHg) breaks out of the `input-pair` grid cleanly — no layout hack, just a single `fg`.

**Could improve:**
- Uses PSIG (gauge) but the conversion constants are for PSI (absolute). At 0 PSIG, kPa should be 0 (gauge) not 0. The calculator treats them as gauge, which is correct for HVAC field use (gauges read gauge pressure), but the label says "PSIG" while the conversion factor is technically PSI→kPa. This is fine in practice because you're converting gauge-to-gauge, but a one-line hint noting "All values are gauge pressure" would prevent confusion.
- No vacuum pressure support (negative PSIG). Some HVAC work involves vacuum — the math works fine with negatives but the user might not realize it's valid.

**Verdict:** Solid. Clean implementation.

---

## T2 — Field Calculators

### belt-length

**What it does:** V-belt sizing: enter pulley diameters + center distance, get pitch length, OC, best belt match from catalog, speed ratio, and belt wrap angle.

**Does well:**
- Outstanding "How to Measure" accordion — 5 practical methods from string-wrap to sheave stampings. This is what separates a field tool from a textbook calculator. A junior tech can use this without Googling.
- Complete belt catalogs for 6 sections (3L, 4L, 5L, A, B, C) with proper FHP vs industrial distinction.
- Match grid shows 5 nearest standard belts with color-coded deltas (short=red, long=green, exact=orange). Visual and immediate.
- Belt wrap warning below 120° — this is a real-world safety/reliability check that most belt calculators skip.
- Section correction factors properly applied (pitch→OC conversion).

**Could improve:**
- The `setR()` helper is defined locally here and in several other calculators. This is the beginning of a pattern that wants to be shared, but given the single-file-per-calculator architecture, duplication is acceptable. More on this in the project-level section.
- Speed ratio is calculated but no blower RPM output. If you added a "motor RPM" input, you could show driven RPM — very useful for adjusting fan speed.
- No validation that the large pulley is actually larger than the small one. If swapped, the math still works (belt wrap formula still valid, just applied to the wrong sheave), but a swap hint would be nice.

**Verdict:** Best T2 in the suite. The measurement guide alone makes this tool worth bookmarking.

---

### breaker-sizing

**What it does:** Enter load amps, select continuous/non-continuous and circuit type (1ph 120V / 1ph 240V / 3ph), get minimum standard breaker size and pole config.

**Does well:**
- Simple and focused. One input, two toggles, three result rows. Perfect T2 scope.
- Correct application of NEC 125% continuous load rule.
- Standard NEC breaker sizes table is complete (15A to 600A).
- Pole configuration output (1-pole, 2-pole, 3-pole) with clear labeling.

**Could improve:**
- The phase selector says "1ph 120V" and "1ph 240V" but the voltage isn't used in any calculation — it's only for pole count display. This is fine functionally, but the buttons imply voltage matters when it doesn't affect breaker sizing directly. Consider relabeling to "1-Pole" / "2-Pole" / "3-Pole" since that's what actually changes.
- No mention of NEC 240.4(D) — for small conductors (14/12/10 AWG) the breaker must not exceed 15/20/30A regardless of continuous load calc. This is an edge case but a common one.

**Verdict:** Does its job well. Narrow scope, correctly executed.

---

### capacitor-sizing

**What it does:** Enter motor voltage and FLA, get calculated MFD and nearest standard capacitor size with tolerance band.

**Does well:**
- Uses the industry-standard 2652 factor for PSC motor run cap estimation.
- Standard MFD sizes table is complete and correct.
- Shows ±6% tolerance range — this is practical because it tells the tech if the cap they're holding is close enough.

**Could improve:**
- The `inCapVolts` input (capacitor voltage rating) is wired to `addEventListener('input', calc)` but the `calc()` function never reads it. This is dead wiring — the cap voltage input does nothing. Either use it (check that cap voltage rating exceeds motor voltage) or remove it.
- Only handles run capacitors. The title says "Run/start cap sizing" but there's no start capacitor mode. The motor-start-controls calculator covers this more thoroughly, so maybe just clarify the title to "Run Capacitor Sizing."
- The 2652 factor is an approximation. A note about verifying against OEM specs (already in the hint) is good, but the hint is easy to miss on mobile.

**Verdict:** Functional but has dead code. Fix the unused cap voltage input.

---

### cfm-per-ton

**What it does:** Enter system capacity (tons or BTU/h) and measured CFM, get CFM/ton ratio with status classification (LOW / MARGINAL / NORMAL / HIGH).

**Does well:**
- Smart partial results: entering just tonnage shows expected CFM range even without a measured CFM. This is useful for pre-visit planning.
- Five-level status classification (LOW, MARGINAL LOW, NORMAL, MARGINAL HIGH, HIGH) with field-relevant descriptions ("possible coil icing", "poor latent capacity").
- BTU/h toggle is nice for when the unit nameplate lists BTU instead of tons.

**Could improve:**
- The readout shows "Effective Tons" but if you enter tons directly, it just echoes the input. Only useful in BTU/h mode. Consider hiding it when mode=tons.
- The threshold values (300, 350, 450, 500) are hardcoded. They're industry standard, but a note in the hint about humid climate targets (350 CFM/ton for dehumidification) is already there — good.

**Verdict:** Well-designed. Practical for commissioning and troubleshooting.

---

### combustion-air

**What it does:** IFGC combustion air sizing — enter appliance BTU/h, room volume, and air source type, get room adequacy check and required opening sizes.

**Does well:**
- Three air source options (indoor only, one opening, two openings) match IFGC 304 directly.
- Room volume supports both L×W×H and direct cubic feet — practical because sometimes you know the room volume from plans.
- Confined/unconfined classification at 50 cu ft per 1,000 BTU/h is correct per code.
- Equivalent round duct diameter for openings — saves the tech a step.

**Could improve:**
- The one-opening divisor is 3,000 BTU/h per sq in and two-opening is 4,000. These are swapped from what I'd expect — IFGC 304.6 uses 1 sq in per 3,000 for outdoor (single opening within 12" of ceiling) and 304.5 uses two openings at 1 sq in per 1,000 (each). Double-check these values against the specific IFGC edition you're targeting. The minimum 100 sq in floor is correct.
- `var i` and `var j` loop variables are used with traditional `for` loops and closures — the `this` reference in `addEventListener` callbacks works correctly because `function()` creates a new scope, but this is a subtle pattern that could break if someone converts to arrow functions. Low risk given the codebase.

**Verdict:** Good coverage of IFGC requirements. Verify the divisor values against code edition.

---

### condensate-drain

**What it does:** Enter unit capacity, number of units, and horizontal run length — get minimum drain size per IMC Table 307.2.1, recommended size, slope, and total drop.

**Does well:**
- Upsizing logic for long runs (>50 ft) and multiple units is a real-world consideration that most drain calculators ignore.
- Slope calculation (1/8" per foot) and total drop at run length — immediately useful for checking clearance.
- Multi-unit support with combined tonnage readout.

**Could improve:**
- The size table stops at 250 tons. A warning for >250 tons exists but it would be more helpful to suggest dual drain lines.
- No P-trap mention in the results, despite the hint saying "P-trap required on negative pressure units." This could be a result row that conditionally appears when the user indicates the unit type.

**Verdict:** Solid for its scope. Simple and practical.

---

### duct-sizing

**What it does:** Enter CFM and max velocity, get round duct size, actual velocity, and rectangular equivalents at multiple aspect ratios.

**Does well:**
- Standard round duct sizes (6"–24") used for sizing — practical.
- Rectangular equivalent table at 4 aspect ratios (1:1, 4:3, 2:1, 3:1) with equivalent diameter — this is exactly what you need when you can't fit a round duct.
- Equivalent diameter formula `Deq = 1.3(ab)^0.625 / (a+b)^0.25` is correct (Huebscher equation).
- Velocity warning when actual velocity exceeds max by >10%.

**Could improve:**
- Friction rate input exists (`inFriction` with default 0.08) but is never used in the calculation. The sizing is purely velocity-based. Either remove the friction rate input or implement friction-based sizing as a second method. Currently it's misleading.
- Standard sizes stop at 24". Commercial work regularly uses 26", 28", 30", 36" round duct.
- Rectangular sizes are rounded to nearest 0.5" which can produce non-standard dimensions. Standard sheet metal sizes go by whole inches (8, 10, 12, 14, etc.). Rounding to standard increments would be more practical.

**Verdict:** Good concept, but the unused friction rate input is a red flag. Either complete the friction method or remove the input.

---

### electrical-cost

**What it does:** Enter power (kW, watts, or V×A), usage hours, and electricity rate — get energy consumption and cost per day/month/year.

**Does well:**
- Dual input modes (kW/Watts and Voltage×Amps) cover both scenarios: nameplate data and measured data.
- Mutually exclusive kW/Watts inputs (typing in one clears the other) avoids confusion.
- Cost formatting is magnitude-aware (`$0.123`, `$1.23`, `$1,234`).
- Sensible defaults (8 hrs/day, 30 days/month, $0.12/kWh) mean you can get a quick estimate with just a power input.

**Could improve:**
- Year calculation is `kwhMo * 12`, which assumes the same usage pattern every month. An annual hours input or seasonal multiplier would be more accurate for HVAC equipment that runs differently summer vs winter.
- Power factor is ignored in V×A mode. For motors, V×A gives VA (apparent power), not watts. Multiplying by a default 0.85 PF or adding a PF input in VA mode would give more accurate results. Currently it overstates real power consumption.
- No phase selection in VA mode — a 3-phase motor at 480V/10A is not `480 × 10 = 4800W`. It's `480 × 10 × 1.732 = 8314VA`. This could significantly understate 3-phase operating costs.

**Verdict:** Functional for single-phase quick estimates. Needs a phase selector and PF consideration for accuracy.

---

### enthalpy

**What it does:** Enter dry bulb and wet bulb temps, get enthalpy, humidity ratio (lb/lb and grains), relative humidity, and dew point.

**Does well:**
- Uses the Hyland-Wexler saturation pressure equation (the A/B/C constants for `ln(Ps) = A + B/T + C·ln(T)`). This is the real deal, not a simplified approximation.
- Humidity ratio from wet bulb depression uses the correct psychrometric relationship with the 1093/0.556/0.240/0.444 constants.
- Dew point via binary search (60 iterations) — converges to negligible error. Simple and robust.
- Shows both lb/lb and grains — HVAC industry uses both depending on context.

**Could improve:**
- Hardcoded to standard atmospheric pressure (14.696 psia). The hint mentions altitude correction but doesn't offer it. A barometric pressure input would make this accurate at elevation (Denver techs would thank you).
- No validation beyond `twb > tdb` check. Extremely low or high temperatures could produce nonsensical humidity ratios. A range check (say 0–200°F for field conditions) would catch typos.
- This is arguably the most technically sophisticated T2 calculator. It could legitimately be T3 if you added altitude correction and a sensible heat ratio output.

**Verdict:** Impressive for a T2. The psychrometric math is correct and well-implemented.

---

### gas-pipe

**What it does:** IFGC gas pipe sizing — enter BTU/h load and run length, select gas type and inlet pressure, get minimum pipe size with capacity table.

**Does well:**
- IFGC Table 402.4 data embedded directly — no external dependency.
- Linear interpolation between standard lengths (10, 20, 30, 50, 75, 100 ft) is correct.
- LP gas multiplier (2.5×) and 2 PSI pressure multiplier (2.0×) allow quick comparisons.
- Capacity table with green/red highlighting shows all pipe sizes at a glance — lets the tech see margin and alternatives.
- "Recommended" row suggesting next size up for margin is practical field wisdom.

**Could improve:**
- The LP and 2 PSI multipliers are approximations. IFGC has separate tables for LP (Table 402.4(7)) and high-pressure systems. The multiplier approach is reasonable for field estimation but should note it's approximate.
- No CSST support (corrugated stainless steel tubing), which is increasingly common. The hint mentions this — good.
- Extrapolation beyond 100 ft uses the 100 ft value flat (no further reduction). Long commercial runs can exceed 100 ft. A warning would help.
- The `fmtK` function formats capacities as "175k BTU/h" but the table stores values in thousands, so 175 = 175,000 BTU/h. This works but the variable naming (`btuK = btu / 1000`) makes you think twice about what unit you're in.

**Verdict:** Practical and well-built. The capacity table is a standout feature.

---

### load-calc

**What it does:** Rule-of-thumb cooling load estimate from square footage, climate zone, and construction quality.

**Does well:**
- Honest about what it is: "Rule of thumb only. Manual J required for system design."
- Three climate zones (20/25/30 BTU/sqft) and three construction quality tiers (0.8×/1.0×/1.2×) are simple but cover the most common estimation scenarios.
- Ceiling height adjustment above 8 ft — this catches high-ceiling spaces that many simplified calculators miss.
- CFM output at 400 CFM/ton gives the tech actionable ductwork information alongside the load.

**Could improve:**
- Only handles cooling load. Heating load estimation would double the utility.
- No window/orientation/insulation factors. Even one more axis (e.g., "heavy glass" vs "standard" adding 20%) would improve accuracy meaningfully.
- The ceiling adjustment is linear (`ceiling / 8`), which overestimates for tall spaces. Volume adjustment would be more accurate: `(ceiling / 8)^0.8` or similar. But for a rule-of-thumb tool, linear is defensible.

**Verdict:** Appropriately scoped for a quick field estimate. The Manual J disclaimer is important and correctly placed.

---

### refrigerant-charge

**What it does:** Calculate additional refrigerant charge for extended lineset length by refrigerant type, liquid line OD, and length.

**Does well:**
- Four refrigerant types (R-410A, R-22, R-134a, R-407C) with correct charge rates per tube OD.
- Six liquid line sizes from 1/4" to 7/8" cover the full residential/commercial range.
- Output in both ounces and pounds+ounces — techs weigh refrigerant in both units depending on their scale.
- Clean button grid for selections — no dropdowns, fast to tap on mobile.

**Could improve:**
- The charge rates are density-based approximations. Real charge rates vary with subcooling and operating conditions. A note about this being for "liquid-filled line at typical subcooling" would manage expectations.
- This calculator overlaps significantly with long-lineset (which also calculates charge). Consider whether both are needed, or if refrigerant-charge should be folded into long-lineset as the "quick mode."
- No factory charge length input. The hint says "factory charge typically covers 15-25 ft" but there's no subtraction. The tech has to mentally subtract factory length before entering. The long-lineset calculator handles this better.

**Verdict:** Functional but redundant with long-lineset. Consider merging or clearly differentiating scope.

---

## T3 — Advanced Calculators

### long-lineset

**What it does:** Multi-factor long lineset analysis: additional charge calculation, suction pressure drop estimate, and superheat adjustment note.

**Does well:**
- Factory charge length input with default 25 ft — handles the subtraction that refrigerant-charge doesn't.
- Pressure drop estimation per 100 ft with elevation adjustment (1 PSI per 10 ft rise for both refrigerants). This is practical for roof-mounted condensers.
- Superheat adjustment note when pressure drop >3 PSI — tells the tech to expect higher readings and roughly how much.
- Warning state on pressure drop >5 PSI — this triggers "something needs to change" awareness.

**Could improve:**
- The tonnage input (`inTon`) is collected but never used in any calculation. Dead input. Either remove it or use it for suction line sizing recommendations.
- Only supports R-410A and R-22. Missing R-407C, R-454B, and other modern refrigerants. The charge table duplicates refrigerant-charge data for 2 of the 4 refrigerants.
- The pressure drop model (`psiPer100` and `elevPsiPer10`) is very simplified. Real pressure drop depends on line diameter, flow rate (related to tonnage — which is why tonnage should be used), and refrigerant state. This is where using the tonnage input for suction line sizing would elevate this from "rule of thumb" to "engineered estimate."
- No oil trap recommendations despite the hint mentioning them. For a T3, this should either calculate trap spacing (every 20 ft of vertical rise is the common rule) or at least state when one is needed.

**Verdict:** Has the right idea but doesn't fully deliver on the T3 promise. The unused tonnage input and missing oil trap logic are gaps. The charge calculation is redundant with refrigerant-charge.

---

### mca-mocp

**What it does:** Calculate Minimum Circuit Ampacity and Maximum Overcurrent Protection per NEC 440.33/440.22 from compressor RLA and fan motor FLA.

**Does well:**
- Correct NEC 440 methodology: MCA = (largest motor × 1.25) + sum of others. MOCP = (largest motor × 2.25) + sum of others, rounded up to next standard breaker.
- Wire gauge recommendation from MCA using NEC 310.16 75°C copper table.
- "Additional loads" input for crankcase heaters, controls, etc.
- Standard breaker sizes complete to 300A.

**Could improve:**
- Phase selector (1-phase/3-phase buttons) is present in the UI but never used in the calculation. The MCA/MOCP formulas don't change with phase — but the wire gauge should (3-phase uses 3 conductors in conduit, affecting fill derating). Currently dead UI.
- No comparison to nameplate MCA/MOCP. Many units have MCA/MOCP on the nameplate. A "Nameplate MCA/MOCP" input pair that shows whether the calculated values align would catch data entry errors and units with unusual configurations.
- The 2.25× multiplier for MOCP is the maximum allowed — some equipment specifies lower. A note about this would help.
- This is a simpler T3. It could arguably be T2 given the scope. It earns T3 status through the NEC table embedding and the fact that results drive purchasing decisions (wire and breaker selection).

**Verdict:** Correct and useful. The phase selector should either do something or be removed.

---

### motor-start-controls

**What it does:** Comprehensive single-phase and three-phase motor start analysis. 1ph: PSC, CSIR, CSR, CSCR motor types with back EMF, relay, capacitor, and hard start kit sizing. 3ph: DOL, Star-Delta, Soft Starter, VFD sizing with full component selection.

**Does well:**
- This is the crown jewel of the calculator suite. Enormous scope executed well.
- **Single phase:** Motor type selector dynamically shows/hides relevant sections (PSC doesn't need start cap, CSIR doesn't need run cap). The config object `SP_CONFIG` makes this clean.
- **Back EMF calculation** from winding resistance ratio — this is specialized knowledge that most field tools don't offer.
- **Capacitor tolerance bands** with PASS/HIGH/LOW verdicts and visual feedback. Immediately tells a tech if the installed cap is in range.
- **Hard start kit sizing** with HP-based cap ranges and PTCR vs potential relay recommendation.
- **Three phase DOL:** NEMA starter sizing table with HP and voltage adjustment. Contactor, overload, and breaker sizing all from FLA.
- **Star-Delta:** Open vs closed transition analysis, 3-contactor sizing (KM1/KM2/KM3), winding configuration check.
- **Soft Starter:** Current limit and ramp time effects, starting torque percentage with warning for low-torque conditions.
- **VFD:** kVA sizing, derating for ambient/altitude, 1ph→3ph input current increase, cable length reactor recommendations.
- **Report generation** for both panels — printable, copyable, timestamped. This is what T3 is for.

**Could improve:**
- At ~680 lines in a single HTML file, this is the largest calculator and pushes the limits of the single-file pattern. The code is still readable, but functions like `spCalc()` and `tpCalc()` are doing a lot. Not a problem yet, but this is the file most likely to benefit from refactoring if it grows further.
- The report format is plain text with box-drawing characters. It works, but a structured format (even just aligned columns) would be more professional for quoting purposes. This applies to all T3 reports.
- The VFD derating formula `1 - ((ambient - 104) / 18) * 0.02` seems to understate the derating. Most VFD manufacturers derate 1-2% per degree C above 40°C (104°F), not per 18°F. Double-check this against a specific manufacturer's derating curve (ABB ACS580 or similar).
- No motor efficiency input. For VFD sizing, motor efficiency affects actual current draw. Currently assumes nameplate FLA which is conservative (safe) but could oversize the drive.

**Verdict:** Exceptional. This is a legitimate field engineering tool, not just a calculator. The breadth and depth of motor start analysis here is rare even in commercial software.

---

### system-head

**What it does:** Full pump sizing workflow across 4 tabs: Flow (BTU→GPM with glycol correction), Pipe (Darcy-Weisbach friction loss), Head (TDH with fittings and custom losses), Pump (curve fitting and operating point intersection).

**Does well:**
- **Flow authority system** — Tab 1 owns flow, other tabs read it. The "AUTH" badge and "Tab 1 owns flow authority" messages prevent confusion about which value is driving the calculation. This is sophisticated UX design for a multi-tab tool.
- **Glycol correction** with ASHRAE Ch. 31 property tables (Cp, density, viscosity) for EG and PG at multiple concentrations and temperatures. Bilinear interpolation on the property tables. This is professional-grade.
- **Darcy-Weisbach** with Colebrook-White friction factor — not the simplified Hazen-Williams. Reynolds number, flow regime classification, and roughness-specific calculations per material.
- **5 pipe materials** with correct inside diameters (Sch 40 steel, Type L/M copper, CPVC, PEX).
- **Fittings via equivalent length method** with ASHRAE Ch. 22 Table 7 values. Custom component losses with user-entered manufacturer data (coils, HX, valves).
- **Pump curve fitting** with quadratic regression, system/pump curve intersection via bisection, BEP proximity check.
- **Canvas-rendered curve chart** showing system curve, pump curve, and operating point intersection visually.
- **Safety margin** with engineering range recommendation (5-15%, warning >20%).
- **Source citations throughout** (ASHRAE Fundamentals 2021, ASME B36.10, ASTM B88). This is accountability you rarely see in field tools.

**Could improve:**
- This is a monster (~600+ lines of JS plus the HTML). It's the one calculator that might legitimately benefit from a separate JS file for the fluid property tables and Darcy-Weisbach solver.
- NPSH is explicitly noted as "not evaluated" — this is honest, but for a T3 that's driving pump selection, NPSH is important. Even a simplified check (available vs required) would add value.
- The pump curve tab requires manual data entry of 3-5 points. An import option (paste from spreadsheet) would save time for commercial jobs where the engineer has the curve data.
- The report generation is behind a button but I didn't see the full report format in what I read. Ensure the report includes all tabs' results in a single output.

**Verdict:** This is engineering software. The glycol correction, Darcy-Weisbach, and curve intersection features are well beyond what field calculators typically offer. The ASHRAE citations give it credibility for engineering review.

---

### wire-sizing

**What it does:** NEC wire sizing with ampacity tables, voltage drop calculation, and full derating for ambient temperature and conduit fill.

**Does well:**
- **Complete NEC 310.16 table** — 75°C column for both copper and aluminum, 14 AWG through 500 kcmil.
- **Full derating:** NEC 310.15(B)(1) ambient correction factors and 310.15(C)(1) conduit fill factors. Both tables are complete and correct.
- **Derating summary box** shows each factor with visual warnings when derating applies. This transparency helps the tech understand why a larger wire is recommended.
- **Voltage drop calculation** using the circular mil formula with correct K values (12.9 Cu, 21.2 Al) and 3-phase √3 multiplier.
- **Two-tier recommendation:** shows minimum gauge from ampacity, then recommended gauge for ≤3% voltage drop. Clear distinction between "code minimum" and "best practice."
- **5 voltage options** (120/208/240/277/480) and phase selection — covers residential through commercial.
- **Distance hint** explicitly says "from source panel, not disconnect" — this catches a common field mistake.
- Continuous load at 125% correctly applied as conductor sizing requirement, not breaker sizing.

**Could improve:**
- Minimum wire size for circuits: NEC 210.3 requires 14 AWG minimum for 15A circuits, 12 AWG for 20A. The calculator doesn't enforce these minimums — at very low amps it might recommend 14 AWG on a 20A circuit if derating allows.
- No conduit size recommendation. Once you know wire gauge and conductor count, the conduit size is a natural next step. This would make the tool complete for circuit installation.
- The `calcVdrop` function uses `2 * K * multiplier` where `multiplier` is either 1 (1-phase) or 1.732 (3-phase). For single-phase, the factor of 2 accounts for round-trip distance. For 3-phase, the standard formula is `√3 × K × I × D / cmil` (no factor of 2). The current implementation gives `2 × 1.732 = 3.464` for 3-phase instead of the correct `1.732`. This would overstate 3-phase voltage drop by 2×. **This may be a bug — verify the 3-phase voltage drop formula.**

**Verdict:** Excellent tool with thorough NEC compliance. Check the 3-phase voltage drop formula — the 2× multiplier may be incorrectly applied for 3-phase circuits.

---

## Project-Level Assessment

### What the Project Does Well

**1. The tier system is excellent.** CALCULATORS.md is a real contract, not just documentation. The boundary rules ("calculators do not diagnose," "calculators do not declare faults") show maturity — these are the kind of guardrails that prevent scope creep and liability.

**2. Single-file-per-calculator is the right call.** Each calculator is completely self-contained: HTML, CSS overrides, JS. This means:
- Any calculator can be loaded standalone (bookmark, iframe, share link)
- A bug in one calculator cannot affect another
- Adding or removing a calculator is a file-level operation, not a merge conflict
- No build step, no bundler, no module resolution at runtime

**3. Vanilla JS was the right choice.** For a field tool that needs to work on phones, tablets, and aging laptops:
- No framework loading time
- No version conflicts
- No build pipeline to maintain
- Any web developer can read and modify the code
- Files are tiny (most calculators are 100-400 lines total)

**4. The design system (base.css) is cohesive.** Dark theme with orange accents, consistent component patterns (`.sec`, `.fg`, `.iw`, `.result-row`, `.phase-btn`), monospace for data, variable-weight UI font. The visual language is consistent across 22 calculators without feeling rigid.

**5. The refrigerant library is properly engineered.** Immutable registry, validation-first, generic lookup engine handling both zeotropic orientations, binary search with interpolation. This is the kind of shared infrastructure that justifies its complexity.

**6. Domain accuracy.** NEC tables, IFGC references, ASHRAE citations, psychrometric equations — the code consistently references authoritative sources and uses correct values. This is a tool built by someone who knows the trade.

---

### What Could Be Better

**1. Code duplication across calculators.** Several patterns repeat in almost every file:
- `setR(id, state, val, sub)` — result row updater (belt-length, long-lineset, wire-sizing, motor-start-controls, system-head)
- `setActive(btns, val)` — toggle button group (gas-pipe, combustion-air, refrigerant-charge, long-lineset)
- `fmt(n)` — number formatting (slightly different in each file)
- Reset patterns that iterate over rows setting `dim` class

This duplication is acceptable in the single-file architecture, but if you ever create a `calc-utils.js`, these would be the first things to extract.

**2. Dead code / unused inputs.** Found in:
- `capacitor-sizing`: `inCapVolts` input wired but never read
- `motor-convert`: `activeField` variable set but never read
- `long-lineset`: `inTon` (tonnage) input collected but never used
- `mca-mocp`: phase selector UI has no effect on calculations
- `duct-sizing`: friction rate input exists but isn't used in calculations

Each of these is small, but collectively they create a pattern of inputs that look functional but aren't. A user might wonder why changing them doesn't change results.

**3. No input validation for physically impossible values.** Negative tonnage, zero-ohm resistance, temperatures below absolute zero, negative pipe lengths — the calculators generally accept anything `parseFloat` can parse. The math often still works (producing correct but meaningless results), but a tech entering "-5 tons" by accident gets a result instead of a correction.

**4. No keyboard/mobile polish.** The `inputmode="decimal"` attribute is used consistently (good), but:
- No keyboard shortcut for "clear all" or "reset"
- Tab order follows DOM order but isn't optimized for workflow (e.g., in belt-length, you might want to tab from large pulley directly to small pulley, skipping center distance)
- No haptic feedback on mobile button taps

---

### Should This Be a Different Format?

**No. The current format is correct for the use case.** Here's why:

**Why not a framework (React, Vue, Svelte)?**
- Adds build complexity for zero benefit. These calculators are stateless (no data persistence, no component reuse, no routing, no API calls).
- A React rewrite would make every calculator 3× larger in code volume and require a build step.
- The current files load instantly. A framework bundle would add 30-100KB of overhead.
- The audience (field techs) doesn't care about the tech stack. They care about speed and reliability.

**Why not a native app?**
- Distribution friction. A PWA in a browser is one URL. An app is app store approval, updates, permissions, platform-specific code.
- The current approach works offline if you cache the HTML files (save page, add to home screen).
- No platform-specific APIs are needed.

**Why not TypeScript?**
- Type safety would catch some of the dead-code issues mentioned above, but the codebase is small enough that manual review is sufficient.
- TypeScript requires a build step. The zero-build-step nature of this project is a feature, not a limitation.

**What about making it a real PWA (service worker, manifest)?**
- **Yes, this is the one change that would have the most impact.** A service worker would enable true offline use without "save page." A manifest.json would enable "Add to Home Screen" with an app icon and full-screen mode. This is the single biggest improvement available, and it requires:
  - One `manifest.json` file
  - One `sw.js` file that caches the calculator HTML/CSS
  - One line in `index.html` to register the service worker
  - Total effort: ~50 lines of new code

---

### Recommendations (Priority Order)

1. **Add PWA support** (service worker + manifest). The single highest-impact improvement. Offline access and home-screen install turn this from "a website with calculators" into "my field tool."

2. **Fix the potential wire-sizing 3-phase voltage drop bug.** If confirmed, this is the only calculator producing incorrect results. Everything else is either correct or conservatively approximate.

3. **Remove dead code/inputs.** The unused `inCapVolts`, `activeField`, `inTon`, phase selector in MCA, and friction rate in duct-sizing. Each is a 1-minute fix. Reduces user confusion.

4. **Add `calc-utils.js`** for shared patterns (`setR`, `setActive`, `fmt`, reset helpers). Optional — only worth doing if you're going to add more calculators. The current duplication is manageable at 22 files.

5. **Complete the long-lineset calculator.** Use the tonnage input for suction line sizing, add oil trap logic. This would make it genuinely T3 instead of a slightly larger T2.

6. **Add a barometric pressure input to enthalpy.** Turns it from "accurate at sea level" to "accurate everywhere." Denver, Albuquerque, Mexico City techs would use this.

7. **Remove or complete the duct-sizing friction method.** The unused friction rate input is misleading.

---

### Bottom Line

This is a well-built, domain-accurate field tool suite with a clear design philosophy and consistent execution. The vanilla JS / single-file architecture is the right choice for the audience and use case. The tier system provides meaningful structure. The T3 calculators (especially motor-start-controls and system-head) are genuinely impressive in scope and accuracy.

The biggest gaps are operational (PWA support for offline use) and quality-of-life (dead code cleanup), not architectural. You did not choose the wrong format. The format matches the problem.
