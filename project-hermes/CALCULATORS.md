# Calculator Contract

Rules for how calculators in this app are classified, what they get, and when to add new ones.

---

## Tiers

| Tier | Label | Color | What it does | Reporting |
|------|-------|-------|-------------|-----------|
| T1 | Utility | Gray | Single input, single output, pure conversion. No assumptions. | None — result is on screen |
| T2 | Field | Blue | Narrow scope, a few inputs, may reference one code table. No cross-domain logic. | Optional copy summary |
| T3 | Advanced | Orange | Multiple input paths, embedded NEC/IFGC/ACCA rules, higher complexity. | Full report modal — copy + print |

---

## Roster

### T1 — Utility
- `motor-convert` — HP/kW/BTU/Ton conversions
- `ohms-law` — V/I/R/P relationships
- `pressure-convert` — PSI/kPa/bar/inHg/mmHg
- `temp-convert` — F/C/R/K conversions

### T2 — Field
- `belt-length` — V-belt sizing with section matching
- `capacitor-sizing` — Run/start cap sizing and tolerance check
- `cfm-per-ton` — Airflow per ton calculation
- `combustion-air` — Combustion air opening sizing
- `condensate-drain` — Condensate drain line sizing
- `duct-sizing` — Round/rectangular duct sizing
- `electrical-cost` — Operating cost estimation
- `enthalpy` — Psychrometric calculations
- `gas-pipe` — IFGC gas pipe sizing
- `load-calc` — Manual J simplified load estimate
- `refrigerant-charge` — Line charge calculation

### T3 — Advanced
- `mca-mocp` — Minimum circuit ampacity / maximum overcurrent protection
- `motor-start-controls` — 1ph/3ph start methods, VFD sizing, relay/cap sizing
- `system-head` — Pump sizing: single-loop head, Darcy-Weisbach pipe loss, pump curve intersection, BHP
- `ventilation-sizing` — ASHRAE ACH exhaust/makeup air sizing and deficiency audit
- `wire-sizing` — NEC ampacity tables, voltage drop, conductor selection, breaker sizing

---

## Classification Rules

**How to decide which tier a new calculator belongs to:**

- One input, one formula, unit conversion → **T1**
- Narrow scope, a few inputs, maybe one code table lookup, no cross-domain logic → **T2**
- Multiple input paths, embeds standards (NEC tables, IFGC charts, manufacturer specs), or produces results that drive purchasing/installation decisions → **T3**

---

## Boundary Rules

1. Calculators do not diagnose
2. Calculators do not declare faults
3. Calculators do not replace technician judgment
4. Results are reference values — the tech makes the call
5. If a calculator result gets handed to a PM or put in a quote, it needs a printable report (T3)

---

## When to Add vs Expand

**New calculator:** The use case has its own distinct input set and doesn't share a UI with an existing tool.

**Expand existing:** The new feature is a natural extension of an existing calculator's scope (e.g., adding FHP belt sections to belt-length, adding a hard start kit section to motor-start-controls).

**Promote tier:** If a T2 calculator grows to need multiple input paths or embedded code tables, reclassify it as T3 and add the report modal.

---

## Color Reference

Used in the tools tab button grid and in each calculator's header badge.

| Tier | Border | Text | Badge label |
|------|--------|------|-------------|
| T1 | `#606060` | `#909090` | `utility` |
| T2 | `#1a4a7a` | `#4a9de8` | `field` |
| T3 | `#9a4a00` | `#e86d10` | `advanced` |
