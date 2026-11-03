# Calculator audit — November 2026

Every tool in Hermes was reviewed on the assumption that its method, math, constants and code tables were wrong. Each formula was re-derived from the governing source (NEC 2023, IFGC/NFPA 54, IMC, ASHRAE, manufacturer data), and each calculator was driven in a browser at phone width against hand and Python calculations, edge cases and bad input. Critical and High findings were reproduced; the most serious were re-checked against the code a second time.

The March 2026 `REVIEW.md` turned out to be unreliable in places (it endorsed the MOCP round-up and the gas-pipe interpolation, and called correct combustion-air divisors "swapped"). Treat this audit as superseding it.

Detailed reports, with exact reproductions, file:line causes, suggested fixes, what was verified OK, what could not be verified, and UX notes:
[electrical](electrical.md) · [motors](motors.md) · [psychro](psychro.md) · [airdist](airdist.md) · [heatgas](heatgas.md) · [mech](mech.md) · [refrig](refrig.md) · [util](util.md)

## Verdicts

| Tool | Verdict | Crit | High | Med | Low | Listed in app? |
|---|---|---|---|---|---|---|
| Gas Pipe | **BROKEN** | 3 | 1 | 3 | 4 | yes |
| Start Controls | **BROKEN** | 3 | 5 | 5 | 5 | yes |
| Ventilation Sizing | **BROKEN** | 2 | 2 | 4 | 3 | yes |
| MCA / MOCP | **BROKEN** | 1 | 0 | 5 | 3 | yes |
| Combustion Air | **BROKEN** | 1 | 0 | 4 | 2 | yes |
| Pump Sizing | **BROKEN** (glycol, CPVC, operating point) | 0 | 4 | 7 | 6 | yes |
| Long Line Set | **BROKEN** | 0 | 3 | 3 | 3 | hidden |
| Line Set Charge | **BROKEN** | 0 | 2 | 2 | 2 | yes |
| Belt Length | **BROKEN** | 0 | 1 | 5 | 3 | yes |
| Belt Deflection | **BROKEN** | 0 | 1 | 2 | 3 | yes |
| Enthalpy | **BROKEN** | 0 | 1 | 2 | 2 | hidden |
| Motor Analysis | RISKY | 0 | 3 | 11 | 6 | yes |
| Refrigeration Analysis | RISKY | 0 | 2 | 6 | 5 | yes |
| Wire & Breaker | RISKY (oversizes) | 0 | 1 | 6 | 5 | yes |
| Capacitor | RISKY | 0 | 1 | 3 | 3 | yes |
| Psychrometric | RISKY | 0 | 1 | 6 | 4 | yes |
| Duct Sizing | RISKY | 0 | 1 | 3 | 3 | yes |
| Breaker Sizing | OK with issues | 0 | 0 | 2 | 4 | hidden |
| Electrical Analysis | OK with issues | 0 | 0 | 1 | 4 | yes |
| Airflow Analysis | OK with issues | 0 | 0 | 3 | 2 | yes |
| CFM per Ton | OK with issues | 0 | 0 | 2 | 2 | yes |
| Load Estimate | OK with issues | 0 | 0 | 3 | 2 | yes |
| Heat Analysis | OK with issues | 0 | 0 | 4 | 4 | yes |
| Condensate Drain | OK with issues | 0 | 0 | 1 | 4 | yes |
| Temperature | OK with issues | 0 | 0 | 1 | 1 | yes |
| Pressure | OK with issues | 0 | 0 | 2 | 1 | yes |
| Power (motor convert) | OK with issues | 0 | 0 | 1 | 2 | yes |
| Ohm's Law | OK with issues | 0 | 0 | 2 | 2 | yes |
| Operating Cost | OK with issues | 0 | 0 | 2 | 3 | yes |
| **Total (29)** | 11 broken · 6 risky · 12 OK with issues | **10** | **29** | | | |

## Critical findings (unsafe or code-violating in normal use)

1. **Gas Pipe — runs over 100 ft sized from the 100 ft row.** NG 90,000 BTU/h at 200 ft → 3/4″; IFGC Table 402.4(2) requires 1″.
2. **Gas Pipe — interpolates between table rows** instead of using the next longer length (IFGC App. A). Capacity falls with length, so interpolation overstates it: 120k BTU/h at 11 ft → 1/2″ (code 3/4″); 300k at 45 ft → 1″ (code 1-1/4″). About 1 in 10 cases up to 100 ft are one size small.
3. **Gas Pipe — propane = natural gas × 2.5.** Real ratio ≈ 1.69. LP 400k at 10 ft → 1/2″ (code 3/4″). (Also HIGH: "2 psi" is an invented ×2 with no two-zone guidance.)
4. **Combustion Air — "two openings" always uses 1 in² per 4,000 BTU/h** (outdoor, vertical ducts). No indoor-openings (1/1,000, min 100 in²) or horizontal-duct (1/2,000) option. 400k → 100 in² where 400 (indoor) or 200 (horizontal) is required.
5. **MCA/MOCP — MOCP rounded up to the next standard size.** NEC 440.22(A) is a maximum ("shall not exceed"); round down. RLA 20 + 2 A fan → 40/50 A shown; maximum is 35/45 A.
6. **Ventilation — boiler and mechanical rooms preset to negative pressure** and graded "correct" when depressurized. Depressurizing rooms with combustion appliances risks backdrafting and CO (IFGC 304, NFPA 54 §9.3).
7. **Ventilation — "Clean Room / Lab" preset positive.** Chemical labs must be negative to corridors (NFPA 45, ANSI Z9.5); the tool flags a correctly negative lab as "wrong direction".
8. **Start Controls — overload setting inverted.** NEC 430.32(A)(1): SF ≥ 1.15 → 125%, otherwise 115%. The tool does the reverse (SF 1.0, FLA 28 → 35.0 A; max 32.2 A).
9. **Start Controls — NEMA starter size one size small at 200–240 V** (its "460 V" column holds 230 V ratings, then halves HP below 400 V). 10 HP/230 V → Size 1 (needs 2).
10. **Start Controls — capacitor recommendations off by ~1,000×** (×1000 where µF needs ×1,000,000), so correct OEM capacitors get flagged "HIGH — overheating risk".

## High findings (materially wrong in normal use)

- **Start Controls:** potential-relay pickup/dropout reversed; breaker from nameplate FLA instead of Table 430.250 and no Article 440 caveat (compressor 25 A → 70 A, max ≈ 50 A); VFD current from HP alone; VFD derating understated and never applied; VFD input current/breaker are estimates, not the 430.122/430.130 basis.
- **Ventilation:** restroom/janitor presets below IMC 403.3.1.1 per-fixture rates but called "meets ASHRAE"; preset ACH values don't trace to ASHRAE; "deficiency audit" declares compliance and faults (against CALCULATORS.md).
- **Gas Pipe:** "2 psi" factor (above).
- **Pump Sizing:** glycol viscosity 2–7× too high (false laminar flow, friction ~2.5× high); glycol specific heat 3–11% high (GPM up to 10% low); CPVC 3/4″ "ID" is the OD (friction ~2.6× low); operating point never recomputed after inputs change (shown and reported stale).
- **Motor Analysis:** IEEE 43 floor of max(1 MΩ, kV) (should be 5 MΩ random-wound <1 kV, or kV+1 legacy, at 40 °C; no temperature correction); single-phase "balance check" can't detect shorts but claims to; winding-to-winding megger fields read 0 MΩ on healthy 3-terminal machines and show red.
- **Line Set Charge:** rates 30–45% high (R-410A 3/8″ 0.78 vs 0.60 oz/ft); charges the full length with no factory allowance (50 ft → 39 oz vs ~21), and can say "add" where the manufacturer says "remove".
- **Long Line Set:** same rate table; fixed 2.5 psi/100 ft suction drop regardless of size/tonnage; no length/lift limits or accessories.
- **Refrigeration Analysis:** water-source "approach" uses the wrong water temperatures; "Cond Approach" is condensing − ambient where Lennox defines approach as liquid line − ambient.
- **Belt Length:** section correction has the wrong sign for A/B/C → belts 2.9–4.7″ too long.
- **Belt Deflection:** force table wrong for every section and ignores sheave size/rpm; its TOO TIGHT/GOOD verdicts mis-tension belts.
- **Enthalpy:** saturation-pressure constant wrong (C = −5.468; should be ≈ −5.169), so moisture is ~6.5× too low: 75/62.5 °F → 18.0 BTU/lb instead of 28.1.
- **Psychrometric:** coil capacity always uses return air as entering air even with outside air mixed in (2.61 vs 3.80 tons in the test case).
- **Wire & Breaker:** table is NEC 310.16's 60 °C column labelled 75 °C (oversizes: 150 A → 3/0 vs 1/0).
- **Capacitor:** Size mode's (230/V)² scaling gives 30 µF for a 1/2 HP 115 V blower motor (typical 5–15 µF); recommends 250 VAC caps on 115 V.
- **Duct Sizing:** rectangular equivalents match the round's area, not its friction (17–39% more friction than intended).

## Patterns across tools

- **Rounding the unsafe way and interpolating where codes say "next size":** MOCP, gas pipe.
- **Invented multipliers standing in for real tables:** propane ×2.5, 2 psi ×2, line-charge rates, belt corrections.
- **Verdicts on top of correct arithmetic:** Motor Analysis, Capacitor, Ventilation, Belt Deflection and the psychrometric module declare good/bad/failed, against the CALCULATORS.md boundary rules. The new Refrigeration "Patterns to check" panel was judged borderline (owner's call) and has threshold issues of its own.
- **Stale results** after inputs change (Pump Sizing operating point, Airflow "Use this CFM").
- **Silent defaults** (blank service factor → 1.15, blank PF → 1.0) and **duplicated, inconsistent rules** (capacitor tolerance differs across three tools).
- **No altitude handling** where it matters (1.08 sensible factor, economizer limit).

## Trustworthy as-is (verified)

- Refrigerant PT library and its use in Refrigeration Analysis (dew/bubble, glide, out-of-range).
- Wire & Breaker 3-phase voltage drop (the March bug is fixed).
- Pump Sizing water friction for steel/copper (±0.3%), Sch 40 and Type L/M inside diameters.
- Psychrometric property equations and ADP/bypass method (match CoolProp).
- Conversion constants (temperature, pressure, power) and Operating Cost math.

## Not verified

Listed per tool in the detailed reports. Main gaps: primary code books (ICC and NFPA sites blocked; secondary reproductions used), NEMA starter sizes 5–7, propane table rows beyond 10 ft, 2 psi tables, ASHRAE 55 zone boundaries, manufacturer long-line guides other than Carrier.
