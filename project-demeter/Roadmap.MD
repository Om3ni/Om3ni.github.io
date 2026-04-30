# Project Demeter — Implementation Roadmap

**Companion to:** `SPEC_v1.2.md`
**Audience:** Claude Code, working in VS Code, against a clean repo
**Format:** Phases are sequential. Each phase is shippable on its own — the app should run after each phase ends, even if not feature-complete.

---

## Working Principles

These apply across all phases. Claude Code should re-read them at the start of each phase.

1. **Ship runnable code at every phase boundary.** No phase ends with a half-built feature. If a phase introduces a new field, it gets persisted, rendered, included in the report, and migrated. Partial integration is worse than no feature.

2. **Pure functions in `math.js`, period.** No DOM access. No state. No side effects. Every math function is independently testable. If a calculation is needed in the UI, it goes through `math.js`.

3. **State changes flow through one place.** Mutations to `APP` go through a `setState(patch)` function that triggers debounced auto-save and re-render. Direct mutation of `APP.foo = bar` is forbidden after Phase 1.

4. **The dual-state model is load-bearing.** Anywhere measured state and viability state are displayed, both must be present and visually distinct. Don't collapse them. Don't let one override the other in the UI. The C9-fail VOID case is the *only* exception and it is handled explicitly.

5. **Evidence basis is mandatory metadata.** Every fact in the report carries an evidence basis. If a code path produces a reportable fact without setting one, that's a bug.

6. **Offline-first or it's wrong.** If a feature requires network, it doesn't ship. Service worker caches everything. IndexedDB is primary. Test by turning wifi off after first load.

7. **The technician is in charge.** The tool surfaces facts and computes math. It does not interpret. It does not score confidence. It does not infer intent. When in doubt, expose the data and let the field note carry the judgment.

8. **No frameworks, no build step.** Vanilla ES modules. If a feature seems to want React, the feature is wrong, not the constraint.

---

## Phase 0 — Repo & Skeleton (½ day)

**Goal:** Empty app loads. PWA installs. Service worker caches.

**Deliverables:**
- File structure per spec
- `index.html` with tab shell — Survey / Map / Checklist / Report
- `manifest.json`
- `service-worker.js` with cache-first strategy, all listed assets in cache
- `css/app.css` with the design system custom properties
- `js/app.js` with empty `APP` state object, `setState()` stub, tab routing
- Header status bar visible on all tabs (placeholder values OK)
- Icons (192, 512) — placeholder is fine, replace later

**Done when:**
- App loads in browser
- Tabs switch
- App can be installed to home screen on a phone
- After install, app loads with wifi off

**Don't yet:**
- IndexedDB
- Any actual data entry
- Math
- Map rendering

---

## Phase 1 — State, Persistence, Survey Tab (1–2 days)

**Goal:** Survey List screen works. New survey can be created, filled in, auto-saved, resumed. Schema is v2 from day one (no v1 in this codebase).

**Deliverables:**
- IndexedDB wrapper module — `js/storage.js` — with `createSurvey`, `loadSurvey`, `listSurveys(status)`, `saveSurvey`, `archiveSurvey`
- `setState(patch)` in `app.js` triggers debounced save (800ms)
- Survey List landing screen — New / Resume / Completed / Archived
- Survey tab fully functional: all fields editable, including `lights: 'on'|'off'|'transition'`
- Header status bar reads `APP` state (still mostly placeholder values for VPD/viability)
- Device fingerprint generated and stored on each save; collision warning on resume
- SurveyRecord schema enforced on write — versioned at 2

**Done when:**
- Create new survey, fill all Survey-tab fields, refresh browser, resume from list, all data intact
- Open the same survey on a second browser profile, edit, return to first browser, see collision warning
- IndexedDB inspector shows v2 schema records

**Don't yet:**
- Map rendering
- Checklist
- Math
- Report

---

## Phase 2 — Math Module + Stage Targets (½ day)

**Goal:** All calculator math exists, tested, callable from anywhere. Decoder bar works.

**Deliverables:**
- `js/math.js` with all functions per spec
- Lookup table for stage VPD targets (Prop / E-Veg / L-Veg / E-Flwr / L-Flwr) — single source of truth
- Decoder bar component renders below where the map will go, reads `APP.stage` reactively, shows current stage's target band
- Inline tests for each math function — sanity checks on known values
- Unit conversion (F/C, in/ft) routed through `math.js`

**Done when:**
- Stage selector in Survey tab updates decoder bar in real time after switching to a yet-empty Map tab
- Math sanity tests pass — `svp(20)` ≈ 2.339 kPa, `calcVPD(25, 60, 2)` matches reference value, etc.
- Round-tripping `toC(fromC(x)) === x` for representative values

**Don't yet:**
- Heatmap (just the decoder bar)
- Sensor placement

---

## Phase 3 — Map Tab Single-Tier: Geometry & Equipment (2–3 days)

**Goal:** Tech can lay out a room. Equipment, ducts, registers, canopy, dead zones. No sensors yet.

**Deliverables:**
- Room dimensions input → grid renders with correct interval logic (5ft >20ft, 2ft otherwise)
- Workflow gating: equipment tool unlocks only after dimensions entered, etc.
- Equipment modules: place, drag, resize, edit panel with all structured fields per spec (model, serial, type, reheat, commissioning Y/N, internet Y/N), S/R toggle, label, delete
- Duct runs: initiated from selected equipment, single straight line, register auto-placed at terminus, multiple per module
- Registers: independent placement also supported, label, delete
- Canopy zones: two-corner placement, drag, resize, label
- Dead zones: same interaction model, distinct visual (crosshatch)
- All elements persist through `setState`/auto-save
- Element edit panel shows X, Y, W, H in feet, editable

**Done when:**
- Lay out a representative room, refresh browser, full layout intact including equipment structured fields
- Each element can be selected, edited via panel, and deleted
- Duct lines visually inherit S/R color from parent module

**Don't yet:**
- Sensors / heatmap
- Multi-tier
- Spatial summary

---

## Phase 4 — Sensors, Heatmap, Spatial Summary (2 days)

**Goal:** Sensor placement, readings, live IDW heatmap, computed spatial facts, technician coverage notes.

**Deliverables:**
- Sensor placement, drag, nudge pad with 0.5/1/2 ft step
- Sensor edit panel inline with temp/RH inputs; live VPD calculated and color-coded
- Sensor readings table below map, mirrors map state both ways
- SVG heatmap, 1 ft × 1 ft cells, IDW power=2, dead zones gray and excluded from interpolation
- Embedded legend in SVG (Measured / Inferred / Not evaluated)
- Computed spatial facts: sensor count, canopy area, mean nearest-neighbor distance, sensors per 100 sq ft
- Coverage notes textarea (technician-written, free text, persisted)
- VPD summary: min/mean/max/range, in-range count and percentage, range >0.3 kPa flag
- Airflow Confidence flag selector

**Done when:**
- Place 3–5 sensors with readings, see live heatmap update
- Move a sensor — heatmap updates immediately, computed facts recompute
- Spatial summary section renders with both computed facts (always) and VPD summary (when ≥2 sensors have readings)
- Refresh browser — everything persists

**Don't yet:**
- Multi-tier
- Checklist
- Report rendering

---

## Phase 5 — Checklist (2 days, including C9)

**Goal:** All 7 groups, all items including C9, evidence basis on every item, field notes, group status summaries.

**Deliverables:**
- Checklist data structure — items defined as data, not UI — single source of truth in `js/checklist.js`
- All items per v1.2 spec including C9 with full failure-mode/method/AGIQ-reference detail
- Per-item UI: Pass/Fail/N/A, evidence basis selector, field note textarea, AGIQ reference where applicable
- Collapsible groups, group header shows pass/fail/open counts
- Group B items reference equipment module structured fields where applicable (UI surfaces "no equipment module recorded" if Group B item is failed and modules array is empty)
- C9 detail panel shows full failure mode description, method, AGIQ reference
- Priority badge displayed on each item per static mapping

**Done when:**
- Toggle every item, fill notes, set evidence basis, refresh — all persists
- Group headers update counts in real time
- Failing C9 produces a flag in `APP` state that the rest of the app can read (header bar, report VOID logic in later phase)

**Don't yet:**
- Report rendering (state is ready for it, render comes next)
- Multi-tier

---

## Phase 6 — Report Generation: Text Report (1 day)

**Goal:** ASCII text report, XOI-pasteable, complete with all sections per spec.

**Deliverables:**
- `js/report.js` — `generateTextReport(snapshot)` returns a string
- All 12 sections per spec, in order
- Viability determination computed from checklist state per the table
- Failure mode summary built from failed items
- Retest requirements auto-generated by failure category, including C9 special case (voids measured state)
- Final assessment uses C9-fail form when C9 fails, default form otherwise
- Lights = transition appended clause when applicable
- Evidence basis displayed on every reported fact (checklist, equipment table, sensor table, failures)
- Header status bar reads `VPD: VOID` when C9 fails
- Generate Report button creates a frozen snapshot in the SurveyRecord, sets `reportGeneratedAt`

**Done when:**
- Build a synthetic survey with C9 passing — report shows full measured state and dual-state final assessment
- Build a synthetic survey with C9 failing — report shows VOID block, C9-fail final assessment form, retest requirements include the C9 retest item
- Build a synthetic survey with `lights = 'transition'` — appended caveat clause appears
- Refresh browser, snapshot is preserved

**Don't yet:**
- PDF rendering
- Multi-tier

---

## Phase 7 — Report Generation: PDF / Print (1–2 days)

**Goal:** Printable PDF report via `window.print()`. Heatmap rasterized cleanly.

**Deliverables:**
- New tab opens with light-theme print stylesheet, monospace font
- All sections per spec rendered as HTML
- Heatmap SVG → offscreen canvas at 2x → PNG → embedded as base64 `<img>`
- Embedded legend survives rasterization
- All structured equipment fields rendered in equipment table
- VOID block renders correctly when C9 fails
- `window.print()` invoked after rasterization completes
- Print preview matches what a real print would output

**Done when:**
- Print to PDF in browser produces a clean, paginated report
- Heatmap PNG is sharp, legend visible, sensor labels readable
- Both C9-pass and C9-fail variants render correctly

**Don't yet:**
- Multi-tier
- Archive workflow polish

---

## Phase 8 — Multi-Tier Mode (1–2 days)

**Goal:** Multi-tier configuration and per-tier sensor tables with head/mid/tail position.

**Deliverables:**
- Mode toggle on Map tab (Single Tier / Multi Tier)
- In multi-tier mode: tier count selector (2–6), lighting type selector, AGIQ note displayed
- Per-tier collapsible groups, sensor rows with head/mid/tail position dropdown (required field)
- Per-tier summary: in-range count, mean VPD, min/max/range
- Per-tier range >0.3 kPa flag with within-tier-gradient note
- Multi-tier limitation note rendered on Map tab and in report
- Report sections 5 (Spatial Data) and 6 (Room Map) handle multi-tier branch correctly
- Single-tier and multi-tier persist independently — switching modes preserves both branches in state

**Done when:**
- Configure 3 tiers, place sensors in each, switch tiers, refresh — everything persists
- Generate report — multi-tier section is correct, no single-tier heatmap renders
- Switch back to single-tier — single-tier layout is preserved

---

## Phase 9 — Survey Lifecycle Polish (½ day)

**Goal:** Clean up the lifecycle edges. Archive, re-open, completed surveys.

**Deliverables:**
- Mark survey complete after report generation (status flips to `complete`)
- Archive workflow with confirmation dialog
- Re-open archived survey requires explicit confirmation
- Completed survey list is read-only by default, can be re-opened with confirmation
- Survey list shows status badges and key metadata (client, room, date, status)
- Sort by `updatedAt` desc

**Done when:**
- Full lifecycle exercised: create → edit → generate report → mark complete → archive → re-open → confirm
- Archived surveys cannot be edited without explicit unlock

---

## Phase 10 — Polish & Hardening (1 day)

**Goal:** Edges, error states, accessibility basics, install experience.

**Deliverables:**
- Final icons (192, 512)
- Splash / install affordance polish
- Empty states across the app (no surveys, no sensors, no equipment, etc.)
- Form validation messages where missing
- Keyboard navigation works for primary flows
- Touch targets ≥44px on mobile
- Performance check: app installs in <1s on cached load, heatmap renders <100ms with 10 sensors

**Done when:**
- A real technician can pick up the app cold, on a phone, with no instructions, and complete a survey end-to-end without getting stuck

---

## Cut Lines

If time pressure forces cuts, cut from the bottom:

- **Phase 10** can be skipped entirely for a working v1.2 — the app functions, polish comes later
- **Phase 9** can ship as Phase 1's stub (lifecycle states exist as enums but no UI flows) — minor pain, not breaking
- **Phase 8** is the only optional content phase — the v1.1 multi-tier minimum is acceptable; the head/mid/tail and per-tier range can land in v1.3

Below Phase 8 (Phases 0–7), nothing is optional. Phases 0–7 are v1.2 minimum viable.

---

## Out of Scope for v1.2

These are deferred to a later version. Document why each is deferred so the deferral is intentional, not lost.

- **Per-tier strip map (1D heatmap per tier)** — proposed in earlier review, deferred until field feedback validates the head/mid/tail tagging is sufficient.
- **Branched duct waypoints** — current single-segment-per-run abstraction is documented as deliberate; revisit only if field use surfaces a real ambiguity.
- **Distribution confidence scoring** — explicitly rejected in design discussion. The technician's coverage notes and C4 checklist call carry this judgment. Tool does not score it.
- **Cloud sync / multi-device merge** — out of scope by architecture. Device collision warning is the v1.2 mitigation.
- **Photo attachments** — useful, not minimum viable. Add when storage strategy for binary blobs is decided.

---

## Phase Boundary Checklist

At the end of every phase, before marking it done:

1. Does the app load with wifi off?
2. Does refreshing the browser preserve all state added this phase?
3. Does the schema migration logic still produce valid v2 records?
4. Are there any direct mutations of `APP.foo = bar` outside `setState()`?
5. Does any new reportable fact have an evidence basis?
6. If a feature needed math, did it route through `math.js`?
7. If a feature added UI text, is it neutral about endorsement of AGIQ?
8. Does the dual-state header bar still display both states correctly?
9. If C9 failure logic was touched, does VOID still propagate everywhere?

If any answer is no, the phase is not done.

---

*Project Demeter — Implementation Roadmap, paired with SPEC_v1.2*