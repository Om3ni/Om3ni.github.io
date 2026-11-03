# Conversions, Cost & Motor Controls (util): calculator audit

Auditor scope: temp-convert, pressure-convert, motor-convert, ohms-law, electrical-cost, motor-start-controls.
Method: I read every file in full. I drove each page in Playwright/Chromium at a 390×844 viewport against http://localhost:8765 and filled inputs through the DOM. I compared the outputs against hand and Python math and against the references cited.
Scripts and screenshots: `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-util/` (t1.js = the five T1/T2 tools, t2.js = motor-start-controls, t3.js = stale-state checks and the 390px check, plus *.png).

## Summary

| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| temp-convert | OK-WITH-ISSUES | 0 | 0 | 1 | 1 |
| pressure-convert | OK-WITH-ISSUES | 0 | 0 | 2 | 1 |
| motor-convert | OK-WITH-ISSUES | 0 | 0 | 1 | 2 |
| ohms-law | OK-WITH-ISSUES | 0 | 0 | 2 | 2 |
| electrical-cost | OK-WITH-ISSUES | 0 | 0 | 2 | 3 |
| motor-start-controls | **BROKEN** | 3 | 5 | 5 | 5 |

Shared across all six pages: the viewport meta is `maximum-scale=1.0, user-scalable=no`, which blocks pinch zoom (an accessibility failure, WCAG 1.4.4). The pages have no horizontal overflow at 390px.

---

## temp-convert (`tools/calculators/temp-convert.html`)

**What it claims to do:** Convert between °F, °C, °R and K. You type in any one field and the others update.

**Method check:** The formulas are exact definitions: °C = (°F−32)×5/9, °R = °F+459.67, K = °C+273.15. The constants are exact.

**Findings**
- [MEDIUM] **Temperatures below absolute zero are accepted silently.**
  - Reproduction: K = −10 → "−477.67 °F | −283.15 °C | −18 °R". °F = −500 → "−40.33 °R | −22.4056 K". All are shown as live results with no warning.
  - Correct behaviour: K < 0, °R < 0, °C < −273.15 and °F < −459.67 are physically impossible and should be flagged.
  - Cause: no range check in `onInput()`.
  - Fix: if the computed K is below 0, show a "below absolute zero" warning and dim the results.
  - This was raised in REVIEW.md and is still not fixed.
- [LOW] Output is rounded to 4 decimals with `parseFloat(toFixed(4))`. For example, 1e-7 °F displays as "0 °F". This is harmless.

**Verified OK:**
- 72 °F → 22.2222 °C / 531.67 °R / 295.3722 K.
- −40 °F = −40 °C.
- 0 °C → 32 °F / 491.67 °R / 273.15 K.
- 1e9 °C has no overflow.
- Editing one field clears the others, so the source field is never ambiguous.

**Unverified:** none.

**UX notes:**
- The four inputs and four result rows repeat the same values. On a phone the results sit directly under the inputs and add nothing; the four inputs alone would be enough.
- The formula hint lines are useful.

---

## pressure-convert (`tools/calculators/pressure-convert.html`)

**What it claims to do:** Convert between "PSIG", kPa, bar, inHg and mmHg.

**Method check:** The constants are correct to 6 significant figures:
- 1 psi = 6.89476 kPa (exact value 6.894757)
- 0.0689476 bar
- 2.03602 inHg at 32 °F (exact 2.036021)
- 51.7149 mmHg (exact 51.71493)

The conversions are linear and contain no offset. That is correct only if every field is the same reference: gauge-to-gauge or absolute-to-absolute.

**Findings**
- [MEDIUM] **Gauge vs absolute and vacuum vs pressure are ambiguous, and inHg readings get the wrong sign in normal HVAC use.**
  - The PSI field is labelled "psig", but kPa, bar, inHg and mmHg carry no g/a suffix.
  - In HVAC, inHg is almost always read as vacuum on a compound gauge.
  - Reproduction: enter inHg = 28 (a typical vacuum reading) → app shows "+13.7523 psig, 94.819 kPa". The correct reading is 28 inHg vacuum = −13.75 psig = 0.94 psia.
  - Cause: lines 109–110 and `onInput` treat every unit as a signed gauge value.
  - Fix:
    - label every unit as gauge;
    - add an "inHg vacuum" (or "in. Hg vac") field with the reversed sign;
    - add a psia/kPa(abs) row that uses 14.696 psia (and ideally a barometer input);
    - consider adding microns.
  - REVIEW.md asked for a "gauge" hint; none has been added.
- [MEDIUM] **Values below perfect vacuum are accepted.**
  - Reproduction: −20 psig → "−137.9 kPa, −40.72 inHg, −1034.3 mmHg", with no warning.
  - Correct: gauge pressure cannot go below about −14.7 psig at sea level.
  - Fix: warn when psig < −14.696.
- [LOW] `fmt()` changes precision by magnitude, so the number of decimals varies between rows. For example, 0.0001 psi → "0.0000068948 bar". This is cosmetic.

**Verified OK:**
- 14.696 psi → 101.3254 kPa / 1.0133 bar / 29.9213 inHg / 760.0 mmHg.
- 1 bar → 14.5038 psi.
- 101.325 kPa → 14.6959 psi.
- 760 mmHg → 14.696 psi.
- The round trips are consistent.

**Unverified:** none.

**UX notes:**
- The mmHg field sits alone on a full-width row, which breaks the 2-column rhythm.
- There is no indication anywhere on the page that the values are gauge.
- The "Base unit" sub-label on PSIG is jargon to a technician.

---

## motor-convert (`tools/calculators/motor-convert.html`)

**What it claims to do:** Convert between HP, kW, BTU/h and tons of refrigeration.

**Method check:**
- HP_TO_KW = 0.7457. The exact mechanical HP is 745.69987 W.
- HP_TO_BTU = 2544.43. 745.7 × 3.412142 = 2544.43, which is consistent.
- HP_TO_TONS = 2544.43/12000. It is now derived from the BTU constant, as REVIEW.md asked.
- The dead `activeField` variable that REVIEW.md mentioned has been removed.

**Findings**
- [MEDIUM] **The page implies a motor HP equals a cooling capacity without saying these are different physical quantities.**
  - Reproduction: tons = 5 → "23.58 HP | 17.58 kW". A tech could read this as "a 5-ton unit has a 23.6 HP compressor". A 5-ton residential compressor is about 4–5 HP of motor input.
  - Equally, 1 HP → "0.212 tons" is a heat-equivalent conversion, not the refrigeration capacity a 1 HP compressor produces. A compressor delivers roughly 3× its electrical input as cooling (COP).
  - The only hint is "Mechanical horsepower. 1 ton = 12,000 BTU/h."
  - Fix: add an explicit note: "Energy-rate equivalence only. Compressor HP ≠ cooling tons (cooling ≈ input × COP)." Alternatively, move tons to a separate cooling-capacity converter.
- [LOW] Zero shows as "0.000 HP | 0.000 kW | 0.000 BTU/h" because `toPrecision(4)` is applied to 0. Negative values (e.g. −2 HP) are accepted without comment.
- [LOW] BTU/h values ≥ 1000 are rounded to integers. This is fine, but the row precision is inconsistent.

**Verified OK:**
- 1 HP → 0.7457 kW / 2,544 BTU/h / 0.2120 tons.
- 1 kW → 1.341 HP / 3,412 BTU/h.
- 12,000 BTU/h → 1 ton / 3.5169 kW (exact 3.51685).
- 100 HP → 74.57 kW.

**Unverified:** none.

**UX notes:**
- The tons field's label says "(Refrigeration)", but the page gives no reason why tons belong next to motor HP.
- The hint sits at the very bottom, below the results.

---

## ohms-law (`tools/calculators/ohms-law.html`)

**What it claims to do:** Enter any two of V, I, R and P, and the page computes the other two.

**Method check:** All six pairs are solved with the standard DC/resistive relations (`calc()`, starting at line 158). The math is correct for DC or purely resistive AC. P = V×I and R = V/I are wrong for motors and other inductive loads (P = V×I×PF; V/I gives impedance, not winding resistance).

**Findings**
- [MEDIUM] **No AC/inductive caveat.**
  - Reproduction: a compressor drawing 10 A at 240 V → "P = 2400 W, R = 24 Ω".
  - Real power at PF 0.85 is 2040 W. The 24 Ω is impedance; the winding resistance measured with an ohmmeter would be about 1–3 Ω.
  - Fix: add a one-line note that P = V×I applies to DC and resistive loads only, and point motor users to the PF-aware electrical-cost page.
- [MEDIUM] **When 3 or 4 values are entered, contradictory inputs are shown as a valid solution.**
  - Reproduction: V=240, I=10, R=5 → shows "240 V, 10 A, 5 Ω, 2400 W", hint "Entered: V, I, R → Calculated: P". In fact 240/10 = 24 Ω, not 5.
  - With all four entered (V=240, I=10, R=5, P=99), nothing is calculated, but every row is lit as "live".
  - Cause: lines 158–176 use the first matching pair and keep the extra entered values unchanged.
  - Fix: if more than 2 values are entered, warn "more than two values; using V and I" and recompute the others, or flag the inconsistency.
- [LOW] Division by zero shows "—" silently. For example, V=0, I=0 → R "—"; R=0, P=100 → I "—" and V "0.000", which is inconsistent and physically meaningless. There is no explanation.
- [LOW] Negative values are accepted. R = −10 with P = 100 → V and I show "—" with no message. V = −120 with R = 10 → I = −12 A.

**Verified OK:**
- V=240, I=10 → R 24 Ω, P 2400 W.
- R=10, P=1000 → V 100, I 10.
- All six pair branches are present.
- The hint text correctly reports which values were entered and which were calculated.

**Unverified:** none.

**UX notes:** Results have 3 fixed decimals (e.g. "240.000 V"), which looks over-precise.

---

## electrical-cost (`tools/calculators/electrical-cost.html`)

**What it claims to do:** Estimate energy and cost from kW/W or from V×A (1- or 3-phase, with PF), hours per day, days per month and $/kWh.

**Method check:**
- kW = V×A×PF/1000 for 1-phase; V×A×1.732×PF/1000 for 3-phase, with V taken as line-to-line.
- kWh/day = kW × h; per month = × days; per year = month × 12; cost = kWh × rate.
- The phase selector and PF input that REVIEW.md said were missing are now present and wired in.

**Findings**
- [MEDIUM] **An invalid or blank PF silently becomes 1.0.**
  - Reproduction: VA mode, 480 V, 10 A, 3-phase. PF 0.85 → 7.07 kW (correct). PF typed as "85" (a percentage) → 8.31 kW. PF blank → 8.31 kW.
  - There is no message, and the 18% overstatement is shown as a valid result.
  - Cause: line 198.
  - Fix: show an error for PF ≤ 0 or PF > 1, or interpret values from 1 to 100 as a percentage, and state the PF actually used.
- [MEDIUM] **"Hours / Day" is not defined as run hours, and there is no duty-cycle input.**
  - For HVAC compressors and fans, cost depends on runtime, not connected hours. Users will enter thermostat-on hours or 24.
  - There is also no check for more than 24 hours: 30 h/day → 106 kWh/day, accepted.
  - Fix: rename the field to "Run hours / day (actual runtime)" or add a duty-cycle %, and reject values above 24.
- [LOW] Yearly = monthly × 12. With the default 30 days/month that is a 360-day year, which understates by 1.4%. Days > 31 is not rejected.
- [LOW] The Voltage field shows placeholder "240", but it is blank and treated as 0, so nothing calculates. A placeholder that looks like a default value misleads.
- [LOW] The 3-phase voltage is assumed line-to-line but is not labelled that way. The hint "0.85 for motors" is generic; using measured amps is better than nameplate FLA, but the page does not say so.

**Verified OK:**
- 3.5 kW, 8 h, 30 d, $0.12 → 28.0 kWh/day, 840 kWh/month, 10,080 kWh/yr, $3.36 / $101 / $1,210. Matches hand math.
- 480 V × 10 A × √3 × 0.85 = 7.07 kW → $2,442/yr, which matches.
- kW/W mutual clearing works.
- Switching mode triggers a recalculation, so no stale result is left on screen.

**Unverified:** none.

**UX notes:**
- The two mode-toggle buttons are under 32 px tall at 390 px width, which is a small touch target.
- The PF input sits inside the "Phase" row pair, so on a phone it reads as part of the phase choice.
- The results (Energy and Cost, 6 rows) are below the fold once VA mode is open.

---

## motor-start-controls (`tools/calculators/motor-start-controls.html`)

**What it claims to do:** A tier-3 motor start tool.
- Single-phase: PSC, CSIR, CSR and CSCR motors, with back-EMF and relay pickup/dropout, start/run capacitor recommendation with PASS/LOW/HIGH checks, capacitor voltage checks, and hard start kit sizing.
- Three-phase: DOL (NEMA starter, contactor, overload, breaker), star-delta, soft starter, and VFD (kVA, output current, ambient/altitude derating, input current, breaker, cable flag).
- Printable report.

**Map:**

| Area | Lines |
|---|---|
| Inputs | 63–135 (1Φ), 177–296 (3Φ) |
| Utilities and STD_BREAKERS | 317–335 |
| NEMA_SIZES / getNemaSize | 338–354 |
| spCalc | 410–494 |
| tpCalc | 523–631 |
| Reports | 635–670 |

**Method check (vs references):**

| Item | Tool does | Reference requires |
|---|---|---|
| Motor FLC for OCPD | nameplate FLA | NEC 430.6(A)(1): Table 430.248/430.250 FLC for conductors and OCPD. Nameplate FLA is used only for overloads. **Missing.** |
| Overload (430.32(A)(1)) | SF ≥ 1.15 → 115%; else 125% | SF ≥ 1.15 → **125%**; temp rise ≤ 40 °C → 125%; all others → **115%**. **Inverted.** |
| Branch SC/GF (430.52) | 250% FLA, next standard size, labelled "Breaker / Disconnect" | 250% of table FLC for inverse-time breakers (next size up permitted, Exc. 1). Time-delay fuse 175% (max 225%). Hermetic compressors: Art. 440.22(A), 175% of RLA, max 225%, no rounding up past it. |
| NEMA starter | `hp460` column is really the 230 V column; HP ÷ 2 for 200–399 V | NEMA ICS 2: Size 00/0/1/2/3/4 = 1.5/3/7.5/15/30/50 HP @230 V; 1.5/3/7.5/10/25/40 HP @200 V; 2/5/10/25/50/100 HP @460 V |
| VFD output current | FLA if entered, else HP×746/(PF×√3×V) | Size by motor current. HP alone needs the Table 430.250 FLC (includes efficiency and PF). |
| VFD derating | 2% per 18 °F above 104 °F; 3% per 3300 ft above 3300 ft; motor HP × factor | Manufacturer-specific. ABB ACS580: ≈1%/°C from 40–50 °C (0.90 at 50 °C) and 1% per 100 m above 1000 m. Apply to drive rated current. |
| 1Φ input on a 3Φ VFD | input current only | Manufacturers derate output current ~50% (ABB ACS355 note: 50%; others 35–60%) |
| Start/run capacitor | HP×2650/V, HP×2650×0.13/V, or I×1000×0.9/(2πfV) | No simple HP formula exists. OEM/nameplate µF governs. The 2652×I/V relation is for *measuring* an installed capacitor, not sizing one. |
| Potential relay | back-EMF = 0.75×V; pickup = 0.4×V; dropout = 0.75×V | Back-EMF across the start winding typically *exceeds* line voltage (e.g. 150–300+ V on a 240 V motor). Pickup is the high threshold (e.g. 285–305 V); dropout is the low one (e.g. ≤ 77 V). Source: ACHR News potential relay ratings. |

**Findings**

- [CRITICAL] **The overload setting rule is inverted relative to NEC 430.32(A)(1), and it over-sizes overloads for SF 1.0 motors.**
  - Reproduction (3Φ, DOL): HP 10, FLA 28, V 230, SF 1.0 → "Overload Setting 35.0 A, 125% FLA (SF < 1.15)". The NEC maximum for SF 1.0 without a marked 40 °C rise is 115% × 28 = **32.2 A**.
  - With SF 1.15 the tool gives 32.2 A (115%) where up to 35.0 A is permitted. That is conservative but wrong, and can cause nuisance trips.
  - The static sub-label on line 214 is also inverted: "115% FLA (SF≥1.15) or 125% FLA".
  - Cause: lines 539–540, `sf >= 1.15 ? fla*1.15 : fla*1.25`.
  - Fix: use `sf >= 1.15 || tempRise <= 40 ? 1.25 : 1.15`; add a temperature-rise input or a checkbox; cite 430.32(A)(1).
  - Source: NEC 430.32(A)(1), quoted identically by Schneider Electric FAQ000278068 and Mike Holt forum threads. I could not reach the NFPA text directly.

- [CRITICAL] **The NEMA starter size is undersized by one size at 200–240 V (and oversized at 460 V).**
  - The `NEMA_SIZES.hp460` values (1.5, 3, 7.5, 15, 30, 50, …) are the **230 V** ratings.
  - `getNemaSize` then divides HP by 2 for 200–399 V, which in effect doubles the starter's 230 V rating.
  - Reproductions (app → correct per NEMA ICS 2 ratings):

    | Motor | App | Correct | Rating of the app's size |
    |---|---|---|---|
    | 3 HP, 230 V | NEMA 00 | NEMA 0 | Size 00 = 1.5 HP @230 V |
    | 5 HP, 208 V | NEMA 0 | NEMA 1 | Size 0 = 3 HP @200 V |
    | 10 HP, 230 V | NEMA 1 | NEMA 2 | Size 1 = 7.5 HP @230 V |
    | 20 HP, 230 V | NEMA 2 | NEMA 3 | Size 2 = 15 HP @230 V |
    | 25 HP, 208 V | NEMA 2 | NEMA 3 | Size 2 = 10 HP @200 V |
    | 10 HP, 460 V | NEMA 2 | NEMA 1 | — (oversized) |

  - An undersized starter can overheat and its contacts can weld closed, so the motor cannot be stopped from the control circuit.
  - Cause: lines 338–354.
  - Fix: replace the table with separate 200 / 230 / 460 / 575 V HP columns per NEMA ICS 2 and look up by the voltage column. The `fla` column is unused and also not the NEMA continuous rating (Size 1 = 27 A, etc.).
  - Sources: Square D/Rexel catalog listings and E&I Sales/ABB NEMA tables (sizes 00–4 corroborated). Sizes 5–7 are UNVERIFIED.

- [CRITICAL] **The single-phase capacitor "Recommended" values are wrong by about 10× to 1000×, and they drive PASS/LOW/HIGH verdicts that condemn correct OEM capacitors.**
  - Reproductions:
    - PSC, 230 V, FLA 2.8, HP 0.5, installed run capacitor 7.5 µF/370 V (a typical OEM value) → "Recommended Run Cap 0.7 µF; Installed Cap Check **HIGH — 7.5 µF overheating risk**".
    - The same case without HP (FLA path) → "0.0 µF".
    - CSR, 230 V, 3 HP, FLA 15, run capacitor 40 µF, start capacitor 145 µF (typical for about 3 tons) → "Run Cap 4.5 µF HIGH — overheating risk; Start Cap 35 µF HIGH — relay may not drop".
    - CSR with LRA 76 and no HP → "Start Cap 1 µF; Run 0.2 µF".
  - Real-world run capacitors for these motors are about 5–10 µF for a fractional-HP PSC fan and about 35–45 µF for a 3-ton compressor. Start capacitors are about 88–175 µF.
  - The FLA and LRA paths use `×1000` where farads-to-µF needs `×1e6`. The HP paths (2650/V and 2650×0.13/V) have no engineering basis; 2650 is the capacitor-*measurement* constant (µF = 2652 × I_start-winding / V_cap) misused as a sizing rule.
  - A tech who trusts the verdict will replace a correct capacitor with one far too small. The motor will then fail to start or will cycle on its thermal protector (equipment damage).
  - Cause: lines 447 and 463.
  - Fix: remove capacitor "recommendation" sizing. Offer a capacitor *check* instead: measured µF vs the nameplate µF ± its rated tolerance (run caps typically ±5/6%; start caps per the printed range). Optionally add 2652×I/V from measured start-winding current and capacitor voltage.

- [HIGH] **The back-EMF and potential relay numbers misstate the physics and the relay specification semantics.**
  - Reproduction (CSR, 230 V, voltage-sensing relay):
    - Estimated back EMF 172.5 V (0.75 × V), labelled "Relay Dropout Target".
    - "Relay Pickup 92.0 V — coil energizes at ~40% V".
    - "Relay Dropout 172.5 V — opens at back EMF threshold".
  - Real potential relays are specified with a **pickup** (high threshold, contacts open, e.g. 285–305 V) above a **dropout** (low threshold, e.g. ≤ 77 V) and a continuous coil voltage (e.g. 300 V) that must exceed the running back-EMF.
  - The running back-EMF on a 230 V compressor is typically **above** line voltage (often 150–300+ V).
  - The tool reverses pickup and dropout, and its numbers would select a relay that never opens or that overheats its coil. A relay that never opens leaves the start capacitor in circuit, which overheats or ruptures it.
  - The winding-ratio formula (lines 428–430) is an ad-hoc heuristic and is not disclosed as one.
  - Sources: ACHR News "Potential relay ratings and specifications" (82405); RectorSeal/MARS relay data.
  - Fix: drop the computed back-EMF. Ask for *measured* S–C voltage at full speed and select pickup per the OEM cross-reference.

- [HIGH] **Branch-circuit protection uses nameplate FLA instead of Table 430.250 FLC, and the "Breaker / Disconnect" label invites fuse or compressor misuse.**
  - Code requirement: NEC 430.6(A)(1) requires Table 430.248/430.250 FLC for 430.52 OCPD sizing. The tool has no FLC table and uses the typed FLA (lines 541, 559, 582).
  - The 250% is the inverse-time *breaker* percentage. The label "Breaker / Disconnect" suggests it applies to a fused disconnect, where the time-delay fuse limit is 175% (225% max).
  - Example: FLA 20 → "50 A Breaker / Disconnect"; a 50 A time-delay fuse is 250%, above the 225% maximum.
  - In an HVAC app, the most common 3Φ motor is a hermetic compressor. Art. 440.22(A) limits protection to 175% of RLA, up to 225% max.
  - Example: RLA 25 entered as FLA → app "70 A"; the compliant maximum is 225% × 25 = 56 A → 50 A. The equipment nameplate MOCP governs in either case (110.3(B)).
  - Fix:
    - look up FLC from Table 430.250 by HP and voltage;
    - label the result "Inverse-time breaker (max per Table 430.52)";
    - show fuse percentages separately;
    - add "Hermetic compressors: use Art. 440 / nameplate MOCP".
  - Disconnect sizing is 115% of FLC (430.110), not 250%.

- [HIGH] **VFD output current falls back to an HP-only formula that ignores efficiency, understating the motor current by 20–50%.**
  - Reproductions (app → Table 430.250 FLC):

    | Motor | App "Drive Output Current, rated ≥ this" | Table 430.250 FLC |
    |---|---|---|
    | HP 10, 460 V, FLA blank | 11.0 A | 14 A |
    | HP 1, 460 V | 1.1 A | 2.1 A |

  - "Required Drive kVA" = HP×0.746/PF, which is likewise missing efficiency.
  - A drive sized to the displayed current will trip on overload or be undersized.
  - Cause: lines 595–599.
  - Fix: require FLA for VFD sizing, or use Table 430.250 FLC when only HP is given, and say which one was used.

- [HIGH] **VFD derating is understated by about 5× (ambient) and 3× (altitude), and the derating is never applied to the required drive current.**
  - Reproduction: FLA 14, 460 V, 122 °F, 5280 ft → app "Derate 96.2% (Amb 98.0% × Alt 98.2%)", "Drive Output Current 14.0 A".
  - Using ABB ACS580 published rules (0.90 at 50 °C; 1 − (1609 − 1000)/10000 = 0.939), the combined factor is 0.845, so the drive needs a rating of **≥ 16.6 A**.
  - "Derated Drive HP = motor HP × factor" is not an actionable number, and "Upsize if derated < motor HP" is always true once the factor is below 1.
  - The 0.7 floor (`Math.max(0.7,…)`) also hides operation above the drive's maximum ambient; most drives allow 50–55 °C maximum.
  - **1Φ→3Φ input** (lines 270–275, 613–617): only the input current changes. There is no output derating, though manufacturers require about 50% (ABB ACS355 application note: 50%; others 35–60%). A drive sized at the motor FLA on single-phase input will be overloaded.
  - Cause: lines 605–610.
  - Fix: show "Minimum drive rated output current = FLA ÷ derate (÷ 0.5 for 1Φ input)", say that factors are manufacturer-specific, and block or flag ambient above 122 °F.
  - REVIEW.md flagged the ambient formula; it is still unchanged.

- [HIGH] **The VFD input current and breaker are an estimate that ignores efficiency and harmonics, not NEC 430.122/430.130 values.**
  - Reproduction: 10 HP, FLA 14, 460 V → "Input Current 11.0 A, Breaker 15 A (125% × 11.0)".
  - NEC 430.122(A) sizes conductors at 125% of the drive's *rated input current*, and the OCPD is the drive manufacturer's marked maximum (430.130 / listing).
  - Neither number can be derived from motor HP ÷ motor PF. Single-phase input current from `kva*1000/V` also ignores the rectifier's poor input power factor.
  - Fix: relabel as "estimate", ask for the drive nameplate input current, and state that the OCPD is per the drive's installation manual.
  - Manufacturer input-current values are UNVERIFIED for a specific model.

- [MEDIUM] **Stale results stay on screen.**
  - (a) 3Φ: clearing Voltage after a DOL calculation leaves every row live ("NEMA 00 For 1.5 HP at 460V", "Breaker 15 A"). Cause: line 529 `return` without dimming.
  - (b) 1Φ: switching CSR→PSC leaves "Recommended Start Cap 35 µF / HIGH" visible and live.
  - (c) 1Φ: switching to CSIR leaves "Recommended Run Cap 4.5 µF / HIGH — 40 µF overheating risk" visible under the "Start Capacitor Sizing" header (screenshot `msc-1ph.png`). Cause: the `else` branches at lines ~459/474 hide only the headers, not the rows.
  - Hidden inputs keep their values.
  - Fix: dim or hide the rows in those branches; reset results when required inputs are cleared.

- [MEDIUM] **The soft starter ignores the entered LRA, and Ramp Time is a dead input.**
  - Torque is computed as (limit/600)², which assumes LRA = 6×FLA.
  - Reproduction: FLA 10, LRA 80, limit 350% → app "34% of DOL" with no warning. The correct value is (35/80)² = 19%, which is below the tool's own 30% warning threshold.
  - `ssRamp` is read on line 574 but never used.
  - Fix: use (I_limit/LRA)² when LRA is given, and remove or use Ramp Time.

- [MEDIUM] **Star-delta values are internally inconsistent, and the transition timer input is dead.**
  - The overload is set at FLA/√3, which correctly assumes it sits in the winding (phase) circuit. Yet the main contactor KM1 is sized at 1.1×FLA, "carries full line current".
  - In the standard 6-lead scheme, KM1 and the overload carry the same phase current (0.58 FLA), and the star contactor typically carries about 0.33 FLA.
  - Reproduction: FLA 65 → KM1 72 A, KM2 = KM3 = 42 A, overload 37.5 A.
  - The contactor sizes are conservative, but the overload is wrong by √3 if the overload is actually on the line side; the tool does not ask.
  - The open-transition inrush is a hard-coded 0.67×LRA, while the hint says it "can approach DOL levels".
  - `tp_sdTimer` is collected but never used.

- [MEDIUM] **Boundary-rule violation (CALCULATORS.md: "do not diagnose / declare faults").**
  - The capacitor PASS/LOW/HIGH checks print fault conclusions: "weak start torque", "relay may not drop", "overheating risk", "reduced efficiency".
  - The soft starter prints "may not start heavy loads".
  - These sit on top of incorrect recommendations (see above).
  - Fix: report measured vs rated with tolerance only.

- [MEDIUM] **SF and PF inputs are shown in every 3Φ mode but used in only one each.** SF is used only by the DOL overload; PF only by the VFD. The other modes look live but ignore them.

- [LOW] **Motor type list issues.**
  - CSR and CSCR are the same motor (both "Capacitor Start, Capacitor Run") and share identical config.
  - RSIR (split-phase), the main current-relay application, is missing.
  - The current-vs-voltage relay choice is not tied to motor type: potential relays go with CSR, current relays with RSIR/CSIR.
- [LOW] **Hard start kit ranges are UNVERIFIED** (≤0.5 HP 88–108, ≤1 HP 108–130, ≤3 HP 145–175, >3 HP 175–216 µF; PTCR ≤1 HP, else potential relay). Kits are sold by tonnage/HP per the manufacturer, and PTCR kits are commonly used well above 1 HP. Present these as manufacturer cross-reference, not a rule.
- [LOW] **Capacitor voltage minimums.** Run cap 370 V for V ≥ 208 V, else 250 V; start cap 250 V for every voltage. Field practice is "≥ the original rating". 115 V PSC motors commonly use 370 V caps, and 115 V start caps are 125/165 V. Reproduction: 115 V CSIR with a 165 VAC start cap → flagged "high"/red.
- [LOW] **Report gaps.**
  - The 1Φ report prints "FREQ: —Hz" when blank: `getInput` returns "—", so the `|| '60'` fallback never fires.
  - The SF/PF, ambient, altitude, transition type and hint warnings are not all in the reports; e.g. the VFD report omits the ambient and altitude used.
- [LOW] The contactor row shows 125% FLA, but its sub-label says "Min continuous rating ≥ FLA". The DOL inrush fallback "6× FLA" ignores the NEMA code letter.

**Verified OK:**
- STD_BREAKERS 15–600 A matches NEC 240.6(A) for that range.
- The `nextStd` rounding goes up, as allowed by 430.52(C)(1) Exc. 1.
- 250% for inverse-time breakers on general-purpose (non-hermetic) motors matches Table 430.52 *when FLC is used*. Example: 10 HP 230 V, FLC 28 → 70 A.
- Star inrush = LRA/3 is correct.
- Soft starter start current = FLA × limit% is correct arithmetic.
- The cable flag thresholds (100/300 ft) are reasonable rules of thumb but manufacturer-dependent.
- No JavaScript errors were thrown in any tested path.

**Unverified:**
- NEMA sizes 5–7 (sources conflict).
- Hard start kit µF ranges.
- Exact manufacturer VFD single-phase input currents.
- The NFPA 70 text itself. 430.32 and 430.52 percentages were confirmed via secondary sources quoting the code. The Table 430.250 values used (1 HP/460 = 2.1 A, 10 HP/460 = 14 A, 10 HP/230 = 28 A, 5 HP/208 = 16.7 A) are from memory of the standard table and should be spot-checked.

**UX notes:**
- Placeholders look like entered values ("60" Hz, "370"/"250" VAC, "1.15" SF, "0.85" PF, "104" °F, "300" %, "10" s). Some are silently used as defaults (SF, PF, limit, Hz) and some are not (capacitor voltage), so the user cannot tell which values the result used.
- In the 1Φ form, results start about 900 px down. The back-EMF rows appear for PSC motors, which have no relay.
- Every result row is the same visual weight. The PASS/LOW/HIGH colour boxes dominate over the actual numbers.
- In VFD mode, "Derated Drive HP" sits where the "minimum drive current" should be. The input current (11 A) appears below the output current (14 A) without explanation.
- The tabs use `div` elements (not buttons), so there is no keyboard focus or role.

---

### Sources consulted
- [NEMA starter ratings (E&I Sales / ABB-style table)](https://eandisales.com/?p=27506)
- [Square D Size 1, 10 HP @460 V (Rexel)](https://www.rexelusa.com/p/257328/square-d/nema-motor-starter-type-s-nonreversing-size-1-27a-10-hp-at-460-vac-5-ka-sccr-3-phase-3-pole-melting-alloy-480-vac-coil-open/785901184225/8536sco3v06s)
- [Square D Size 2, 25 HP @460 V (Rexel)](https://www.rexelusa.com/p/657692/square-d/nema-motor-starter-type-s-non-reversing-size-2-45a-25hp-460vac-100ka-sccr-3ph-3p-motor-logic-120vac-coil-nema-1-enclosure/785901807087/8536sdg1v02h30s)
- [Engineering Toolbox NEMA starters](https://www.engineeringtoolbox.com/nema-starters-d_918.html)
- [Schneider FAQ: 430.32 overload percentages](https://www.se.com/id/en/faqs/FAQ000278068/)
- [Mike Holt forum: 430.32(A)(1)](https://forums.mikeholt.com/threads/430-32-a-1.2578704)
- [ABB ACS580-01 hardware manual, derating](https://www.manualslib.com/manual/1261097/Abb-Acs580-01.html?page=140)
- [ABB ACS880-37 manual, 1%/°C](https://www.manualslib.com/manual/1353541/Abb-Acs880-37.html?page=173)
- [ABB application note: single-phase input 50% derate](https://library.e.abb.com/public/610f2d332765615e85257d8d005c1475/LVD-EOTN71U-EN_REVA.pdf)
- [ACHR News: potential relay ratings and specifications](https://achrnews.com/articles/82405-potential-relay-ratings-and-specifications)
- [ACHR News: know your potential starting relays](https://achrnews.com/articles/92424-know-your-potential-starting-relays)
