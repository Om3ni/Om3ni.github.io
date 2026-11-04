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

## Guidance and How-tos

Field guidance inside a tool (how-to dropdowns, measurement notes) is the **owner's judgment call, made case by case**. The test is whether the guidance helps a tech take a good reading, or gives someone confidence to attempt work that needs training and could damage equipment, property or themselves.

- **Generally fine:** how to take a good measurement (wet bulb, probe and gauge placement, letting a system stabilize, zeroing leads), and low-skill, low-liability diagnostics the owner has walked people through in the field.
- **Generally not:** step-by-step procedures where a mistake is costly or dangerous and the right answer is training. Pump Sizing and Motor Analysis get no general how-to for this reason.
- **Every procedure** cites its source (manufacturer or training material), states its limits (which equipment it applies to and which it doesn't), and leads with "use the proper tool first" where a purpose-built tester exists, linking to it.
- **Example of an approved exception:** Motor Analysis → "Run an ECM without a tester" (Genteq constant-torque motors, 9 V / 24 VAC tap test). Owner-approved as low-skill, low-liability.
- **Recommended-tool links** (`tools/shared/recommend.js`) go on every tool that has a fitting instrument.

---

## Release Gate

A tool is listed in the app only after it passes all three steps. Tools that fail are kept in the repo but marked `hidden: true` in the `TOOLS` catalog in `index.html` (out of the catalog, search, Recent, Favorites and deep links). Their pages also load `tools/shared/withdrawn.js`, which shows a non-dismissable "Withdrawn — under review" banner with the known problem to anyone arriving by a direct link or old bookmark.

**1. Engineering review**
- Method re-derived from the governing source (NEC, IFGC/NFPA 54, IMC, ASHRAE, ACCA, manufacturer data), cited in the file.
- Every Critical and High finding in the latest audit fixed, and its reproduction case now gives the correct answer.
- Code limits are respected in the safe direction: maximums round down, minimums round up, tables use the next row rather than interpolating where the code says so.
- Independent reference test where practical (as `refrigerants/tests/reference.test.mjs` does for PT data), and it passes.

**2. UX review**
- Rebuilt to the current Hermes tool layout and checked at 390 px.
- Assumptions and inputs that drive the answer are shown with the result; no silent defaults.
- Boundary rules above hold: no verdicts that diagnose or declare faults.
- No stale results after inputs change or become invalid; bad input is flagged, not computed.

**3. Owner sign-off**, then remove `hidden: true` from the catalog, remove the `withdrawn.js` banner line right after `<body>` in the tool's page, and bump `CACHE_VERSION` in `sw.js`.

### Hidden pending the gate (audit 2026-11)

| Tool | Reason |
|---|---|
| Gas Pipe | Critical: runs over 100 ft, row interpolation, propane factor |
| Combustion Air | Critical: indoor and horizontal-duct opening methods missing |
| Ventilation Sizing | Critical: fuel-fired rooms preset negative, labs preset positive |
| Start Controls | Critical: overload rule inverted, starter size, capacitor math |
| Line Set Charge | High: rates 30–45% high, no factory allowance |
| Long Line Set | High: same rates, fixed pressure drop, no limits |
| Belt Length | High: section correction sign |
| Belt Deflection | High: force table |
| Enthalpy | High: saturation-pressure constant |
| Breaker Sizing | Hidden by owner before the audit (audit: OK with issues) |

### Released through the gate

| Tool | Released | Notes |
|---|---|---|
| Motor Analysis | 2026-11 | Rebuilt by test on `tools/shared/refs.js` (IEEE 43 / NEMA MG-1 references, printed capacitor tolerance, highest-leg load). Tests: `tools/shared/refs.test.mjs`. |
| Pump Sizing | 2026-11 | Rebuilt on `tools/shared/fluids.js` (Dow / Melinder data) and `tools/shared/hydronics.js`. Closed loops only. Tests: `tools/shared/hydronics.test.mjs`. |
| MCA / MOCP | 2026-11 | Rebuilt on `tools/shared/nec.js` (NEC 2023 440.33, 440.22(A) rounded down, 240.6(A), Table 310.16). Nameplate first. Tests: `tools/shared/nec.test.mjs`. |

Findings, reproductions and suggested fixes: [audit/2026-11](audit/2026-11/README.md).

---

## When to Add vs Expand

**New calculator:** The use case has its own distinct input set and doesn't share a UI with an existing tool.

**Expand existing:** The new feature is a natural extension of an existing calculator's scope (e.g., adding FHP belt sections to belt-length, adding a hard start kit section to motor-start-controls).

**Promote tier:** If a T2 calculator grows to need multiple input paths or embedded code tables, reclassify it as T3 and add the report modal.

---

## Color Reference

Used in each calculator's own header badge. The app's tool list does not use tier colors: it groups tools by trade and tags T3 calculators **Report** and the multi-reading modules **Analyzer**.

| Tier | Border | Text | Badge label |
|------|--------|------|-------------|
| T1 | `#606060` | `#909090` | `utility` |
| T2 | `#1a4a7a` | `#4a9de8` | `field` |
| T3 | `#9a4a00` | `#e86d10` | `advanced` |

---

## Adding a Tool to the App

The app shell (`index.html`) builds its catalog, search and favorites from the `TOOLS` array near the top of its script. A new calculator needs:

1. Its file in `tools/calculators/` (or `tools/` for an analyzer module).
2. An entry in `TOOLS`: `id` (the file name without `.html`), `kind` (`calc` or `tool`), `name`, `desc`, `cat` (index into `CATS`), optional `tag` (`Report` for T3, `Analyzer` for modules) and `kw` (extra search words techs would type).
3. Its path in `sw.js` `APP_SHELL`, and a bump of `CACHE_VERSION`, so it works offline.
