# Project Demeter

VPD survey tool for cannabis cultivation HVAC commissioning.
Mobile-first PWA, fully offline, no build step.
© Michael Seth Aaron.

This codebase is governed by two documents. Read both before any work.

- **SPEC_v1.2.md** — the technical specification. The contract.
  Treat as authoritative for behavior, schema, and structure.
- **ROADMAP.md** — the phased implementation plan. The sequence.
  Treat as authoritative for what to build next.

---

## Current Phase

**Phase 9 — Survey Lifecycle Polish** (next; Phases 0–8 complete)

Read the "Working Principles" section of ROADMAP.md at the start of
every session. Read the current phase section in full. Do not begin
the next phase without explicit confirmation from the project owner.

---

## Conventions

- Vanilla ES modules. No frameworks. No build step. No bundler.
- Pure functions in `math.js`. No DOM access. No state. No side effects.
- All `APP` state mutations route through `setState(patch)`.
  Direct mutation of `APP.foo = bar` is forbidden after Phase 1.
- Evidence basis is mandatory metadata on every reportable fact —
  checklist items, equipment rows, sensor readings, failure summary entries.
- The dual-state model (Measured Environmental State / System Viability
  State) is load-bearing. Never collapse them in UI. They coexist as
  independent truths.
- C9-fail VOID is the only condition under which one state invalidates
  the other. When C9 fails, measured state is reported as VOID. This
  case is handled explicitly per spec; do not generalize the pattern.
- Offline-first or it's wrong. Service worker caches everything.
  IndexedDB is primary storage. If a feature requires network, it
  doesn't ship.
- Schema is v2 from day one. There is no v1 in this codebase. The
  migration path documented in the spec is for surveys created on
  earlier deployments, not for code structure.

---

## Out of Scope

See ROADMAP.md → "Out of Scope for v1.2". Do not implement deferred
features without discussion. Specifically:

- No distribution-confidence scoring. The technician's coverage notes
  and C4 checklist call carry that judgment.
- No automated diagnosis. The tool collects evidence; the technician
  interprets it.
- No cloud sync, no auth, no external dependencies.
- No photo attachments in v1.2.
- No branched-duct waypoints in v1.2.
- No per-tier strip map in v1.2.

If a feature seems to want React, the feature is wrong, not the
constraint.

---

## Phase Boundary Discipline

At the end of every phase, before marking it done, run the Phase
Boundary Checklist at the bottom of ROADMAP.md. If any answer is no,
the phase is not done.

Do not start the next phase in the same session as ending the current
phase. Phase boundaries are checkpoints for the project owner.

---

## When Stuck

Stop and ask. Do not invent behavior that is not specified in
SPEC_v1.2.md. Ambiguity in the spec is a question to surface, not a
gap to fill with assumption.

If the spec and roadmap disagree, the spec wins. Flag the discrepancy.

---

## Attribution

© Michael Seth Aaron. No company attribution in UI or reports.
AGIQ references in the checklist are documentation citations, not
endorsements. Treat the AGIQ phone number and URL as reference
information for the reader, not as contacts-of-record for this tool.