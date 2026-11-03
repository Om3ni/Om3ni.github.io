# Psychrometrics & Airflow Analysis — calculator audit

Group id: `psychro`. Auditor scratch work (scripts, screenshots): `/tmp/claude-0/-home-user-om3ni-github-io/98245b8e-657c-5bb8-bb91-5f0e4f30ffbb/scratchpad/calc-audit/work-psychro/`

Independent reference: **CoolProp 8.0.0 `HAPropsSI`** (real-gas moist air, IAPWS water) was installed and used. psychrolib was not available. Enthalpy from CoolProp was converted to the ASHRAE IP reference state as h_IP = H/2326 + 7.68. Every app number below came from running the real code: Playwright at 390×844 against http://localhost:8765, or `math.js` imported into Node.

## Summary
| Tool | Verdict | Critical | High | Medium | Low |
|---|---|---|---|---|---|
| Psychrometric module (`tools/psychrometric/`) | RISKY | 0 | 1 | 6 | 4 |
| Enthalpy calculator (`tools/calculators/enthalpy.html`) | **BROKEN** | 0 | 1 | 2 | 2 |
| Airflow Analysis (`tools/airflow.html`) | OK-WITH-ISSUES | 0 | 0 | 3 | 2 |

---

## Psychrometric module (`tools/psychrometric/index.html`, `math.js`, `chart.js`, `ui.js`, `report.js`)

**What it claims to do:** It computes full moist-air properties from DB + WB or DB + RH at any elevation. In "System Diagnostic" mode it also gives the RA→SA coil process (ΔT, Δgr, Δh, SHR, BTU/h, tons), ADP and bypass factor, mixed air from OA%, an economizer check, a target-RH delta, an ASHRAE 55 comfort-zone overlay, and text/HTML reports. It cites ASHRAE Fundamentals 2017 Ch. 1 and Ch. 23.

**Method check**
- Barometric pressure (`math.js:14-17`): p = 14.696·(1 − 6.8754e-6·Z)^5.2559. This matches ASHRAE Fundamentals Ch. 1 Eq. 3 (IP). Correct.
- Saturation pressure (`math.js:26-48`): the Hyland-Wexler coefficients match ASHRAE Ch. 1 Eq. 5 (ice, C1–C7) and Eq. 6 (water, C8–C13) digit for digit. Against IAPWS (CoolProp) the error is ≤0.02% from 32 to 150 °F. Ice values at 0 and 20 °F match within 0.4% (CoolProp includes the enhancement factor). Correct.
- W from pw (Eq. 22/23/24), enthalpy h = 0.240t + W(1061 + 0.444t) (Eq. 32), and W from wet bulb (Eq. 35, IP): all correct. The model is ideal-gas with no enhancement factor, so W reads about 0.4–0.6% low against CoolProp. That is inherent to the ASHRAE ideal-gas equations and acceptable.
- Wet bulb from W and dew point from W: 60-step bisection of the same equations, which converges. Checked against CoolProp wet bulb and dew point: within 0.1 °F above freezing.
- **RH:** `rhFromW` (`math.js:92-96`) returns W/Ws, which is the degree of saturation μ, not RH. ASHRAE defines φ = pw/pws, and φ = μ / (1 − (1 − μ)·pws/p). The two differ by 1–2 RH points at summer temperatures. See finding M1.
- Mixing (`math.js:161-177`): it conserves dry-air mass, water and enthalpy, then solves Eq. 32 back for t. This is correct ASHRAE adiabatic mixing **by mass fraction**. The UI feeds it the user's "% OA" without saying it must be a mass fraction (M6).
- Coil process (`math.js:189-209`): it uses 1.08 / 4840 / 4.5 multiplied by p/14.696. The derivation 0.075 lb/ft³ × 60 × {0.240, ≈1076, 1} is correct for standard air. The density correction p/p₀ at constant T is correct. The 4.5 factor overstates by 2.3% compared with the true 60/v at 75 °F RA (CoolProp v = 13.67 ft³/lb → 4.39). That is disclosed as a standard-air shortcut and is acceptable.
- ADP / BF (`math.js:222-280`): it extends the RA→SA line in the W–t plane to the saturation curve, then computes BF = (t_SA − t_ADP)/(t_RA − t_ADP). This is the standard ASHRAE/Carrier method. An independent CoolProp intersection gives **identical** results (table below). But the entering state is always RA (H1).

**Findings**

- **[HIGH] Coil capacity, SHR, ADP and bypass factor always use RA as the coil entering air, even when OA and mixed air are entered.**
  Reproduction (Playwright, System Diagnostic, sea level): RA 75/62.5, SA 55/53.5, 1200 CFM.
  - Without OA: 25,920 sens / 31,325 total BTU/h, **2.61 tons**, SHR 0.83, ADP 52.0 °F, BF 0.13.
  - After entering OA 95/78 at 20% OA, MA computes as 79.0/66.1, but the coil numbers do not change: still **2.61 tons**, SHR 0.83.
  - Correct (MA→SA, same `math.js` functions): ΔT 24.0 °F, Δh 8.45 BTU/lb, **3.80 tons**, SHR 0.68, ADP 51.2 °F.

  So the app under-reports coil capacity by 31% and over-reports SHR whenever the unit takes outside air. The how-to then says "Compare to nameplate; significant shortfall indicates low charge, dirty condenser, restricted airflow" (`index.html:266`), which steers the tech toward a false low-capacity conclusion and possibly a charge change. The "(RA → SA)" label is shown, but the page also tells users to enter OA/MA in the same mode "for coil performance verification … mixed-air diagnostics" (`index.html:220`).
  Cause: `ui.js:81-91` passes `computed.RA` into `coilProcess`, `apparatusDewPoint` and `bypassFactor`. `chart.js:278-283` draws the process arrow from RA as well.
  Fix: use MA as the entering state when MA exists, and RA only when there is no OA. Label the section "Coil process (MA → SA)" in that case.

- **[MEDIUM] RH is computed as degree of saturation (W/Ws), not pw/pws. The displayed RH disagrees with the RH the user typed, with the chart's RH curves, and with the target-delta logic.**
  - App vs CoolProp: 95/78 WB → app 45.9% vs 47.3%; 110 °F at 30% input → app shows 28.1%; 100/70 → 20.5% vs 21.6%.
  - The RH the user enters is not echoed back. 95 °F / 50% RH input shows "RH 48.6%" on the state card and "49% RH" on the chart tag, while the plotted point sits exactly on the 50% curve (the curves use the exact definition).
  - Reproduced: single state 95 °F, RH 50%, Target RH 50 → delta tag reads **"TARGET Δ +1.4% RH (+0.0 gr/lb) — humidify"** for air that is already at the target.

  Cause: `math.js:92-96`; used at `math.js:146`, `math.js:171`, `ui.js:105`.
  Fix: pw = p·W/(0.62198 + W), then RH = 100·pw/pws(tdb).

- **[MEDIUM] Economizer high limit is a fixed 28 BTU/lb at every elevation and ignores the dry-bulb half of the 90.1 control, yet tells the user "lockout required".**
  As I recall ASHRAE 90.1 Table 6.5.1.1.3 (not fetched, but well known), "fixed enthalpy with fixed dry-bulb" shuts off at h_OA > 28 BTU/lb **or** T_OA > 75 °F. A footnote says that at altitude the enthalpy limit is the enthalpy at 75 °F / 50% RH.
  - At 5000 ft, that limit computes to 30.18 BTU/lb. App: OA 74 °F / 50% RH (h = 29.53) → "**above limit — lockout required**", although 90.1 would allow it.
  - At sea level, OA 80 °F / 30% (h = 26.34) → "within 90.1 limit", although 90.1 would lock out above 75 °F.

  Cause: `math.js:293`, `ui.js:283`.
  Fix: compute the limit as h(75 °F, 50%, p), add T_OA ≤ 75 °F, and phrase the result as "exceeds typical 90.1 high-limit setting" instead of an instruction.

- **[MEDIUM] Diagnostic and fault language breaks CALCULATORS.md boundary rules 1–2.**
  - Bypass factor > 0.25 is labelled "poor — shallow/fouled" (`ui.js:269`, `report.js:130,298`). Bypass factor depends on airflow and face velocity, not only fouling.
  - "significant shortfall indicates low charge, dirty condenser…" (`index.html:266`). Nameplate capacity is at AHRI rating conditions (80/67 °F entering, 95 °F outdoor), so a field-condition comparison is not like-for-like either.
  - "If outside, you have a customer narrative for what's wrong" (`index.html:275`).
  - "above limit — lockout required" (`ui.js:283`).

  Fix: report the values and typical ranges only.

- **[MEDIUM] The "ASHRAE 55-2020" comfort zones are made-up polygons, not the standard's zones.**
  - `math.js:303-324` uses a 30% RH lower edge. ASHRAE 55 (since 2004) has no lower humidity limit in the graphic method.
  - The upper humidity ratio is 0.0121–0.0123 lb/lb at 73 °F/70% and 75.5 °F/65%, which is above 55's 0.012 limit.
  - The dry-bulb edges (73–79 °F and 67–76 °F) are not derived from PMV for the stated clo/met values. UNVERIFIED against the CBE comfort tool, which I could not run.

  The page and both reports cite "ASHRAE 55-2020" (`index.html:275,667`, `report.js:163,346`). Fix: relabel as "approximate comfort zone", or implement the 55 graphic method.

- **[MEDIUM] Physically inconsistent coil readings produce impossible outputs without any warning.**
  - RA 75/55, SA 60/50, 1200 CFM (SA wetter than RA, which is a common RH-probe error) → **SHR 1.26**, "Latent ΔW −5.0 gr/lb removed", latent −4,161 BTU/h. The total of 1.28 tons is computed as if valid.
  - Heating case (SA warmer than RA) → "−2.99 tons", and the report prints "Sensible ΔT −30.0 °F (cooling)".

  Cause: `math.js:197`, `report.js:105-106`.
  Fix: flag SHR > 1, Δgr < 0 and ΔT < 0 as "check readings", and hide capacity.

- **[MEDIUM] "Outdoor Air Fraction % OA" is used as a dry-air mass fraction, and the UI never says so.**
  OA 0/−1 °F, RA 70 °F/35%, 20% OA. If the 20% is by volume (the usual meaning, from CFM), the mass fraction is 0.225 and MA = **54.4 °F**. The app shows **56.1 °F**, 1.7 °F warm. The summer error is about 0.1 °F.
  Cause: `ui.js:68-70`.
  Fix: label it "% OA by mass", or convert from volume using each stream's specific volume.

- **[LOW] Capacity constants are inconsistent with each other and with their labels.**
  - Latent uses 4840·ΔW = 0.691·Δgr, but the row label says "0.68 · CFM · Δgr" (`index.html:614`).
  - The code comment says 4840 ≈ 1061·60·0.075; that product is actually 4774 (`math.js:183`).
  - Sensible + latent ≠ total: 25,920 + 4,919 = 30,839 vs 31,325 shown (1.6%).

- **[LOW] Below-freezing wet bulb uses the liquid-water Eq. 35 instead of the ice Eq. 37** (`math.js:70-79`).
  20 °F DB / 18 °F WB → W 10.5 vs 10.9 gr (CoolProp), RH 70.0 vs 72.5%.

- **[LOW] Elevation input edge cases** (`math.js:14-16`).
  - Negative elevation is silently treated as sea level.
  - Z ≥ 145,446 ft gives "NaN psia".
  - There is no warning above the 36,000 ft troposphere limit the comment mentions.

- **[LOW] Chart and report details.**
  - States outside 40–110 °F or above 210 gr/lb are silently not plotted, but mixing lines are still drawn toward them, past the axes (winter OA at 0 °F).
  - A target delta of exactly 0 is labelled "dehumidify".
  - The text report omits the target delta in single mode.
  - Bypass-factor bands disagree: the how-to says typical is 0.10–0.20 and poor is > 0.25, while the code calls 0.10–0.25 typical.
  - ADP silently hides (returns null) when the process line never reaches saturation (e.g. RA 75/62.5 → SA 60/52), with no message.

**Verified OK**
- Eq. 3 pressure: 5000 ft → 12.228 psia.
- Eq. 5/6 saturation pressure coefficients and values (table below).
- W, h, wet bulb and dew point against CoolProp over 18 cases (sea level, 5000 ft, 10,000 ft, 20–110 °F): W within 0.6%, h within 0.13 BTU/lb, dew point and wet bulb within 0.1 °F above freezing.
- Wet bulb > dry bulb is rejected. Impossible WB/DB pairs (W < 0) are rejected, not clamped.
- RH outside 0–100 is rejected.
- Mixing math, given a mass fraction.
- ADP/BF:

  | RA → SA, elevation | App ADP | App BF | CoolProp ADP | CoolProp BF |
  |---|---|---|---|---|
  | 75/62.5 → 55/53.5, 0 ft | 52.01 | 0.130 | 52.01 | 0.130 |
  | 80/67 → 58/56, 0 ft | 53.31 | 0.176 | 53.31 | 0.176 |
  | 75/62.5 → 55/53.5, 5000 ft | 51.98 | 0.131 | 51.98 | 0.131 |

- Altitude density factor p/p₀ (0.832 at 5000 ft) on all three capacity terms.
- The chart's saturation, RH and WB curves use the same equations as the results.
- No console errors and no horizontal scroll at 390 px.

Saturation pressure check (psia):

| °F | math.js | IAPWS |
|---|---|---|
| 32 | 0.08865 | 0.08865 |
| 70 | 0.36328 | 0.36336 |
| 95 | 0.81625 | 0.81642 |
| 150 | 3.72276 | 3.72318 |

**Unverified**
- Exact ASHRAE 55-2020 zone boundaries (no PMV/CBE tool run).
- Exact 90.1 table text and edition (from memory, not fetched).
- Typical bypass-factor ranges by coil type (these are textbook values; no source checked).

**UX notes (390 px)**
- Chart text renders at about 4–6 px (viewBox 420 scaled to ~360 px) and the RH/WB labels are unreadable. The saturation curve leaves the top of the plot at about 88 °F, so hot or humid points have no reference curve.
- In System Diagnostic, the results sit about 2,000 px below the RA inputs. Every state needs DB + moisture + toggle, so the page is roughly 3,500 px long. The sticky header overlaps inputs while scrolling (seen in the screenshot).
- The WB/RH toggle sits below the input it controls, so the user types into the wrong field before seeing the toggle.
- "% OA" does not say by volume or by mass. "Airflow (for capacity calcs)" does not say actual vs standard CFM.
- Hidden cards (ADP, capacity) appear and disappear with no "why" message. Coil numbers show no warning when inputs are inconsistent.
- The `user-scalable=no` viewport blocks pinch-zoom on the tiny chart.

---

## Enthalpy calculator (`tools/calculators/enthalpy.html`)

**What it claims to do:** Takes DB + WB (+ elevation) and returns enthalpy, humidity ratio (lb/lb and gr), RH and dew point. It cites "ASHRAE Fundamentals 2021".

**Method check:** The Eq. 35 wet-bulb relation, Eq. 32 enthalpy and Eq. 3 pressure (`enthalpy.html:127-130,182,186`) are correct in form. The saturation-pressure function (`enthalpy.html:121-135`) is ln(pws) = 54.6329 − 12301.686/T − 5.468·ln T (psia, °R). This is **not** Hyland-Wexler (REVIEW.md is wrong about that), and the C constant is wrong. The published 3-term correlation uses **C = −5.16923**: with that value the function reproduces IAPWS within −0.2 to −0.5% from 32 to 110 °F. With −5.468, pws is **6.5× too low** at every temperature (70 °F: 0.0556 vs 0.3634 psia).

**Findings**

- **[HIGH — verdict BROKEN] Saturation pressure is 6.5× too low, so humidity ratio is forced to 0 for almost every real input. Every output except dry-air enthalpy is wrong.**
  Playwright, elevation 0 unless noted:

  | DB/WB (°F) | App | Correct (CoolProp) |
  |---|---|---|
  | 75/62.5 | h **18.00**, W 0.000000, 0.0 gr, RH 0.0%, DP −60.0 °F | h **28.13**, 64.7 gr, RH 49.8%, DP 55.0 °F |
  | 80/67 | h 19.20, 0 gr | h 31.51, 78.6 gr |
  | 95/78 | h 22.80, 0 gr | h 41.40, 118.0 gr |
  | 70/70 (saturated) | h 19.38, 16.5 gr, RH 100% | h ≈34.1, ≈110.8 gr |
  | 55/54 | h 14.42, 7.9 gr, RH 80.3% | h 22.61, 60.7 gr, RH 94.0% |

  The same happens at 5000 ft: 75/62.5 → 18.00 BTU/lb (correct 30.86). The output is enthalpy of dry air only, with no moisture term. Any capacity or Δh a tech takes from this page is wrong by 30–45%.
  Cause: `enthalpy.html:123` (`var C = -5.468;`).
  Fix: drop this function and import `satPressure`/`computeState` from `tools/psychrometric/math.js` (ASHRAE Eq. 5/6). At minimum, set C = −5.16923.
  I rated this HIGH, not CRITICAL, because the output feeds capacity estimates rather than a code-compliance number. In practice the tool is unusable.

- **[MEDIUM] Impossible or degenerate states are clamped to W = 0 and shown as valid results** (`enthalpy.html:183`).
  The dew point then shows the search-bracket edge, "−60.0 °F". This is what lets the bug above look like plausible output. After the constant is fixed, the clamp still hides bad entries such as 100/55.
  Fix: reject W < 0 the way `psychrometric/math.js:144` does.

- **[MEDIUM] RH uses W/Ws (degree of saturation), not pw/pws** (`enthalpy.html:190`). Same 1–2 point error as the psychrometric module. The sub-label "Approximate at standard pressure" is replaced with a pressure readout, which suggests exactness.

- **[LOW] The REVIEW.md claim "no barometric pressure input (sea-level only)" is stale.** An elevation input with the correct Eq. 3 now exists (`enthalpy.html:43-56,127-130`); 5000 ft → 12.228 psia. Quantification as requested, using the correct property functions at 75/62.5 °F: ignoring altitude at 5000 ft would understate W by 21% (64.4 vs 81.8 gr) and h by 2.7 BTU/lb (28.07 vs 30.79, −8.8%). It would overstate RH by about 2.4 points (49.1 vs 51.5%). Today this is moot because the saturation bug dominates. Negative elevation is silently treated as 0.

- **[LOW] The hint cites "ASHRAE Fundamentals 2021", but the saturation correlation is not ASHRAE's.** The page duplicates math that already exists correctly in `psychrometric/math.js`.

**Verified OK:** Eq. 35 constants (1093 / 0.556 / 0.240 / 0.444); Eq. 32; Eq. 3 pressure; the WB > DB rejection; results clearing when an input is emptied (no stale values).

**Unverified:** none. Everything was reproduced in Playwright and compared with CoolProp.

**UX notes (390 px):** DB and WB sit side by side and are usable. There is no RH input mode, unlike the psychrometric module. The dew point shows "−60.0 °F" instead of "—" when W = 0. There are no input range limits.

---

## Airflow Analysis (`tools/airflow.html`)

**What it claims to do:** Return/supply temperatures → ΔT; CFM entered directly or from FPM × duct area; sensible heat = 1.08 × CFM × |ΔT|; OA% from mixed-air temperature; OA and RA CFM.
**Note:** this module does **not** implement total heat (4.5 × CFM × Δh) or latent heat (0.68 × CFM × Δgr). Those appear only in the psychrometric module, reviewed above.

**Method check**
- 1.08 = 0.075 lb/ft³ × 60 min/h × 0.240 BTU/lb·°F, i.e. standard dry air at about 70 °F and 29.92 inHg. With moist-air cp ≈ 0.244 the factor would be about 1.10.
- Air density, and so the factor, scales with p/T. It is 1.08 × 0.832 = **0.899 at 5000 ft**. For CFM measured in hot heating supply air (e.g. 120 °F) it is about 1.08 × 530/580 ≈ 0.99.
- The OA% temperature method (MA − RA)/(OA − RA) is the standard sensible mass balance and is correct.
- FPM × (W × H/144) is correct for an average velocity over the gross duct area.

**Findings**

- **[MEDIUM] The sensible-heat constant 1.08 has no altitude or density correction, and no assumption is shown.**
  RA 75, SA 55, 1200 CFM → 25,920 BTU/h at any elevation. At 5000 ft the correct value is 1200 × 20 × 0.899 = **21,570 BTU/h**, so the app overstates by **20%**. No elevation input, no "sea-level standard air" note.
  Cause: `airflow.html:297,349,378`.
  Fix: add elevation (Eq. 3) and use 1.08 × p/14.696, or at least print the assumption.

- **[MEDIUM] OA% has no plausibility checks.**
  - RA 75, OA 76, MA 74 → "**OA Percentage −100.0%**, OA CFM −1200, Return Air CFM 2400" (total 1200).
  - MA beyond the RA–OA range gives > 100%.
  - When OA − RA is small, a 1 °F sensor error swings the result by tens of percent, with no warning. Common field guidance is that the method needs a large OA–RA difference (roughly ≥ 10–20 °F); that threshold is UNVERIFIED.

  Cause: `airflow.html:300-303`.
  Fix: reject results outside 0–100%, and warn when |OA − RA| is small.

- **[MEDIUM] CFM goes stale after "Use This CFM", and the report then contradicts itself.**
  FPM 500, 20×10 in, Use This CFM → CFM 694 ("calculated from FPM"). Then change FPM to 600: the FPM panel shows 833 CFM, but CFM stays at 694, still labelled "calculated from FPM". The exported report prints "CFM: 694 (from FPM) … FPM: 600 … Duct Area: 1.39 ft2" (600 × 1.39 = 833).
  Cause: `airflow.html:253-280,410-414`.
  Fix: re-apply or clear on FPM change, or print the FPM that was actually applied.

- **[LOW] No validation of nonsense input.** Negative CFM is accepted (−1000 → sensible −21,600 BTU/h, OA CFM −250). Sensible uses |ΔT|, so heating (ΔT −52.0 F) shows a positive "Sensible Heat" next to a negative ΔT with no heat/cool label.

- **[LOW] Copy and units.** Units show "F" without a degree sign. The hint "Add Heat Module to calculate from BTU" refers to a module that is not on this page. The FPM method is described as a single reading "at the duct face" rather than a traverse average.

**Verified OK:** ΔT; 1.08 × CFM × ΔT arithmetic (25,920 BTU/h for 1200 CFM × 20 °F); OA% formula (RA 75, OA 95, MA 79 → 20.0%, 240/960 CFM); FPM × area (500 FPM × 200 in² = 694 CFM); the division-by-zero guard when OA = RA; no console errors and no horizontal scroll at 390 px.

**Unverified:** the minimum OA–RA temperature difference guidance (no source fetched).

**UX notes (390 px):** The FPM path takes three inputs plus a button press, and nothing tells the user the button is required. Results sit below the mixed-air section, far from the temperature inputs. There is no elevation input and no heat/cool mode. Sensible heat has no sign or direction label.
