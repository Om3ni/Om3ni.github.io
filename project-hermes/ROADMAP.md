# Hermes Roadmap

## Shared readings between tools (planned, not built)

The old job workflow carried return air, CFM and ambient readings between modules on the same unit. With jobs removed, each tool starts fresh. Carrying readings across tools would save re-typing, but done carelessly it puts a stale reading from one unit into the next unit's calculation, which is worse than typing it twice.

Design constraints:

- **Session, not storage.** Shared readings live in `sessionStorage` (one visit), never `localStorage`. Closing the app clears them.
- **Expire.** Each reading carries a timestamp; anything older than about 30 minutes is not offered.
- **Offer, don't fill.** A tool shows "Return air 75 °F from Airflow, 4 min ago — Use" next to the input. Nothing is entered without a tap. Inputs filled this way stay visibly marked until edited.
- **Explicit list.** Only readings that mean the same thing everywhere are shared: return air dry bulb, return wet bulb, outdoor ambient, CFM, supply voltage, refrigerant type. Supply air and delta T are not shared (they differ between heating and cooling).
- **One owner.** A small `tools/shared/readings.js` module (get / offer / clear) used by every tool, so the rules live in one place. The shell gets a "Clear readings" control and clears them when a new unit is started.
- **Tests first.** Expiry and "never auto-fill" are tested before any tool adopts it.

## Refrigerant PT data verification (done 2026-11)

All 15 tables were checked against independent data (CoolProp and manufacturer charts). Three were wrong and are fixed: R-407C (wrong orientation and swapped bubble/dew), R-454B (swapped bubble/dew), R-454C (single bubble column replaced with Honeywell's two-curve chart). `core/validate.js` now rejects swapped bubble/dew columns and implausible glide at load, and `refrigerants/tests/reference.test.mjs` checks every refrigerant against independent values (run with `node`). Any data change must keep that test passing and bump `CACHE_VERSION` in `sw.js`.

Still single-sourced: R-427A, R-449A, R-513A (model agreement only, within 0.7°F). R-410A drifts ~0.6°F low above 130°F (Chemours source).

## PT Chart tool (next)

Unblocked by the audit: a standalone pressure–temperature lookup built on the verified library, showing bubble and dew for blends.

## Tool redesigns (in progress)

Each tool is rebuilt on the shared layout (`tools/shared/tool.css`) and shared, tested rule modules, then released through the gate in CALCULATORS.md.

- Done: Motor Analysis, Pump Sizing (2026-11).
- Next: the audit's Critical tools (MCA/MOCP, Gas Pipe, Combustion Air, Start Controls, Ventilation), then the rest of the hidden list. Capacitor and Electrical Analysis move onto `refs.js` so capacitor tolerance and unbalance follow one rule.
- Pump Sizing later: open systems (cooling towers) with suction-surface static head and an NPSH caution.
