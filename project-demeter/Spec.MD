# Project Demeter — Technical Specification v1.2
**Vapor Pressure Deficit · Cannabis Cultivation · © Michael Seth Aaron**
**Deployment:** om3ni.github.io/project-demeter
**Target:** PWA, mobile-first, offline-capable
**Stack:** Vanilla JS ES modules, no framework, no build step

---

## Changelog from v1.1

- **C9 (Critical):** New checklist item — sensor reading validated against reference under operating conditions. Independent commissioning fact distinct from C5 (location) and C6 (housing). See §Tab 3 → Group C.
- **Retest Requirements:** New category for sensor-validity failures. Failed C9 voids prior measured-state readings retroactively. See §Tab 4 → Retest Requirements.
- **Final Assessment template:** Conditional clause when C9 fails — measured condition reported as VOID. See §Tab 4 → Final Assessment.
- **Spatial Summary:** Surfaces sensor count, canopy area, mean spacing as reportable facts. Coverage description is technician-written. See §Tab 2 → Spatial Summary.
- **Evidence Basis:** Applied to every line item in report (passes and failures), not only failure summary. See §Tab 4 → Evidence Basis.
- **Lights state:** Adds `transition` value to capture sunrise/sunset surveys as non-steady-state. See §State.
- **Equipment structured fields:** Per-module structured fields (model, serial, type, reheat) attached to placed equipment modules; checklist Group B reads from these. See §Tab 2 → Equipment Modules.
- **Multi-tier:** Sensor position-on-tier (head/mid/tail) required; per-tier range surfaced. See §Tab 2 → Multi Tier Mode.

All other elements of v1.1 remain in force.

---

## Core Principle — Dual-State Evaluation Model

The system explicitly maintains two independent but coexisting truths:

1. **Measured Environmental State** — What the room is doing right now
2. **System Viability State** — Whether the system can reliably maintain it

These must never override each other. A room can be in range today by accident and out of range tomorrow because nothing is actually controlling it. The report must say both things simultaneously.

**Exception — sensor validity void:** If checklist item C9 (sensor reading validated against reference) fails, the measured environmental state is reported as VOID. This is the single condition under which one state invalidates the other. Justification: if the sensor is not reporting true canopy air, the measured values are not measurements of the room — they are measurements of an artifact. The dual-state model preserves both states only when both states are about the same thing.

---

## Architecture

### File Structure
```
project-demeter/
  index.html
  manifest.json
  service-worker.js
  css/
    app.css
  js/
    math.js
    map.js
    heatmap.js
    checklist.js
    report.js
    app.js
  icons/
    icon-192.png
    icon-512.png
```

### Design System
Dark theme. CSS custom properties:
```css
--orange:     #e8820a
--orange-hi:  #f5a623
--orange-lo:  #7a4510
--orange-dim: #2a1a08
--surface:    #1c1c1c
--surface2:   #141414
--border:     #2e2e2e
--text:       #e8e6e1
--text-dim:   #a09e9a
--text-mute:  #5e5c58
--green:      #6fc876
--teal:       #4ec9b0
--red:        #e06060
--supply:     #e8820a
--return:     #4ec9b0
```
Fonts: Rajdhani (UI headings), Share Tech Mono (data/labels)
VPD status: green = in range · teal = too low · red = too high
Supply elements: orange · Return elements: teal

### PWA
- Manifest: name "Project Demeter", short name "Demeter", display standalone, theme `#111`, background `#111`
- Service worker: cache-first, all assets cached on install
- Fully offline — all math, map, checklist, report generation runs client-side
- Install to home screen as first-class app

---

## Global UI — Header Status Bar

Persistent element visible across all tabs:

```
PROJECT DEMETER          VPD: IN RANGE [green]    VIABILITY: DEFICIENT [red]
```

Both states always visible. Updated reactively from `APP` state. Never hidden.

When C9 fails, VPD displays as `VPD: VOID [red]` with a tooltip/note: "Sensor validity not established."

---

## Entry Point — Survey List

Landing screen on app open. Four states:

- **New Survey** — creates new SurveyRecord, assigns ID, sets timestamps
- **Resume Survey** — list of in-progress surveys, sorted by `updatedAt`
- **Completed Surveys** — delivered surveys, soft-locked
- **Archived** — surveys locked after client delivery; requires confirmation to re-open, prevents accidental post-delivery edits

---

## Tab Structure
Four tabs: **Survey · Map · Checklist · Report**

---

## Tab 1 — Survey

Job intake form. First thing completed on site before anything else.

### Fields
- Customer / Client name
- Facility name
- Room name / number
- Equipment serving room (free text — high-level summary; structured per-unit data lives on placed equipment modules in Map tab)
- Growth stage selector: Prop / E-Veg / L-Veg / E-Flwr / L-Flwr
- Lights cycle toggle: On / Off / **Transition**
- Technician name
- Date (auto-populated from system, editable)
- Field narrative / notes textarea

### Lights Transition State

When `lights = 'transition'` is selected:
- Header bar appends a third badge: `STATE: TRANSITION [orange]`
- Report Final Assessment includes a transition-state caveat clause
- Measured state and viability state are still reported, but the report explicitly notes that values reflect a non-steady-state period and should not be used to evaluate setpoint compliance

Justification: Per AGIQ Ch. 9, lights-on/off transitions are deliberate sunrise/sunset events lasting 15–30 minutes during which the room is intentionally between two operating conditions. Surveys taken during this window will show readings that look like deviations and aren't.

All calculator math lives in `math.js` and is called by the map tab. No calculator UI in this tab.

---

## Tab 2 — Map

### Room Mode Toggle
**Single Tier** | **Multi Tier**
Toggle lives at top of Map tab.

---

### Single Tier Mode

#### Workflow Order
UI enforces this sequence — each step unlocks the next:

1. Enter room dimensions → grid appears
2. Place equipment modules (S or R)
3. Draw duct runs from modules → registers auto-place at terminus
4. Place canopy zones
5. Place dead zones
6. Place sensors → enter readings → heatmap populates live

#### Room Dimensions
- Length (ft) and Width (ft) inputs
- Grid renders immediately on valid input
- Canvas scales proportionally to phone screen width, aspect ratio preserved

#### Grid
- Renders on valid dimension input
- Lines at 5ft intervals for rooms >20ft, 2ft for smaller
- Axis labels in feet on left and top edges
- Light lines — reference scaffold only, don't compete with map elements

#### Decoder Bar
- Horizontal color scale, weather-map style
- Full VPD range low → high
- Current stage target band clearly marked
- Always visible, sits below map
- Reads `APP.stage` directly — updates reactively when stage changes in Survey tab
- Teal = too low · Green = in range · Red = too high

#### Airflow Confidence Flag
```
Airflow Confidence: UNKNOWN | LOW | ASSUMED
```
- User-set, not computed
- No airflow simulation — acknowledges limitation explicitly
- Flows into report

---

#### Map Elements

**Equipment Modules**
- Rectangle with S (Supply) or R (Return) designation
- Supply = orange, Return = teal
- User-defined label (e.g. "Unit 1", "AHU-2")
- Tap to place, tap to select
- Edit panel:
  - Position: X, Y, W, H (ft)
  - Label
  - S/R toggle
  - **Structured fields (new in v1.2):** Model, serial number, unit type (Evolution split / Compressor Wall / Other), reheat type (modulating / on-off / none), commissioning report present (Y/N), internet-connected (Y/N)
  - Delete
- Draggable, resizable by edge/corner handles
- Checklist Group B reads structured fields from placed modules. If a Group B item is failed and no module-level data is present, the failure references "no equipment module recorded" rather than ambiguous "missing data."

**Duct Runs**
- Single straight line segment — no waypoints, no routing
- Each line represents one path of conditioned air from module to terminus. Branched trunks are represented as multiple radial lines from the equipment module. This is a deliberate abstraction and not a finding.
- Initiated from selected equipment module via "Add Duct Run" button
- Tap destination point to complete
- Inherits S/R color from parent module
- Register/diffuser symbol auto-placed at terminal point on completion
- Multiple runs per module supported — each is a separate straight line radiating from the module
- Each run independently selectable, moveable at either endpoint, deletable

**Register / Diffuser Symbol**
- Standard HVAC register symbol placed at duct terminus
- Auto-placed on duct completion; also placeable independently
- Inherits S/R color from parent
- Label field (e.g. "Sock 1", "Missing — per print")
- Selectable, moveable, deletable

**Canopy Zones**
- Green outlined semi-transparent rectangle
- Tap two corners to define
- Edit panel: X, Y, W, H, label
- Draggable, resizable by edge/corner handles

**Dead Zones**
- Dark crosshatch rectangle
- Same interaction model as canopy zone
- Use to mark equipment alcoves, walkways, columns, irregular room geometry

**Sensors**
- Numbered dot, color coded by VPD status once reading entered, gray until then
- Tap empty space to place
- Tap to select
- Nudge pad: N/S/E/W, step size toggle (0.5 / 1 / 2 ft)
- Selected sensor label shows current coordinates in feet
- Draggable

#### Element Edit Panel
Appears on selection of any element. Contains:
- X, Y in feet (editable)
- W, H in feet where applicable (editable)
- Label field where applicable
- S/R toggle for equipment modules
- Structured fields for equipment modules (see above)
- Delete button
- For sensors: Temp (°F/°C) and RH inputs inline

#### Sensor Readings Table
Below map. One row per sensor:
- Point label, Temp input, RH input, live VPD (colored), delete

#### Heatmap
- Pure SVG `<rect>` grid, 1ft × 1ft cells
- Color per cell via IDW (inverse-distance weighting, power=2) from sensors with readings
- Dead zone cells: neutral gray, no interpolation
- Canopy zone outlined in green
- Equipment modules, duct runs, registers render on top of heatmap
- Sensor dots on top, labeled with point number and VPD value
- Updates live as readings entered
- **Embedded legend** (rendered into the SVG itself, survives PNG rasterization): a small key showing "● Measured (sensor point) · ▦ Inferred (interpolated cell) · ▨ Not evaluated (dead zone)"

#### Spatial Summary

Two parts:

**Computed facts** (always shown when ≥1 sensor placed):
- Sensor count
- Canopy area (sum of canopy zone area in sq ft)
- Mean sensor spacing (mean nearest-neighbor distance, ft)
- Sensors per 100 sq ft canopy

**Computed VPD summary** (shown when ≥2 sensors have readings):
- Min VPD / Mean VPD / Max VPD / Range
- Range flagged red if >0.3 kPa — "Wide distribution — investigate airflow balance"
- In-range count as fraction and percentage

**Coverage description** (technician-written, free-text field, always visible):
- Single textarea labeled "Sensor coverage notes"
- Example placeholder: "Sensors placed in NW quadrant only — east half of canopy unsensed"
- Flows into report verbatim

The computed facts are evidence. The coverage description is interpretation. The tool surfaces the facts; the technician writes the interpretation. Distribution adequacy is evaluated in the checklist (C4), not computed.

---

### Multi Tier Mode

#### Configuration
- Number of tiers (2–6)
- Lighting type: LED / HPS/CMH / Mixed
- AGIQ note displayed: LED rooms require higher air temp setpoint than HPS. HPS produces ~40% more heat for equivalent light output. Multi-tier rooms almost always use LED.

#### Per-Tier Sensor Tables
- One collapsible group per tier, labeled Top / Middle / Bottom (or T1, T2, ... for >3 tiers)
- Each tier has `+ Sensor` button
- Sensor rows: label (T1·S1 etc), **position-on-tier (Head / Middle / Tail dropdown — required field, new in v1.2)**, Temp input, RH input, live VPD colored, delete
- Per-tier summary: in-range count, mean VPD, **min/max/range (new in v1.2)**
- Per-tier range flagged if >0.3 kPa with note: "Within-tier gradient — supply-end vs return-end imbalance suspected"
- No floor plan map

#### Multi-Tier Limitation Note
```
Spatial distribution within tiers is partially evaluated via head/middle/tail
position tagging but no floor-plan map is rendered. Each tier is treated as
an independent environmental zone.

AGIQ: Multi-tier rooms must be sensed independently per tier — tiers are
supplied by different equipment and may experience different conditions.
```

---

## Tab 3 — Checklist

### Layout
- 7 collapsible groups, collapsed by default
- Collapsed header shows: group name + quick status (e.g. "3 pass · 2 fail · 1 open")
- Tap header to expand/collapse

### Header Note
```
AgronomicIQ.com · 1-833-327-AGIQ
Original project files and submittals may be available from AgronomicIQ
for projects they engineered.
```

### Per Item Structure
- Item name (bold)
- Failure mode description (muted)
- Method note (italic, orange-tinted)
- AGIQ reference where applicable (green-tinted, prefixed ◆)
- Pass / Fail / N/A toggle buttons
- **Evidence basis selector (new in v1.2):** Measured / Observed / Documented / Inferred / Not Verified
- Field Note textarea — always visible
- Priority — static, not user-defined (see priority mapping below)

### Priority Mapping (Static)

**Critical**
- Airflow at supply points / ACH achieved
- Return air path unobstructed
- Integrated temp + RH control
- Control sequence configured for cultivation
- **Sensor reading validated against reference (C9, new in v1.2)**
- Each room has independent contained HVAC

**High**
- Sensor placement at canopy height
- Multiple sensors distributed across room
- Sensor housings shielded/aspirated
- Lights-on/off sequence in controls
- Unit redundancy (min 2 units per room)
- Commissioning report exists
- Reheat type identified
- Heat rejection device adequate clearance
- Economizer closed and sealed
- Factory or factory-trained startup
- Minimum two HVAC units per grow room
- CO2 purge / emergency fresh air present and functional

**Medium**
- Airflow balance across room
- ACH consistent with design
- Vapor barrier integrity
- Pressurization cascade
- Hydronic loop configuration documented
- CO2 strategy documented
- Original mechanical submittal retrieved
- Original mechanical prints / as-built deviation
- All ceiling/wall penetrations sealed
- Door seals and sweeps intact
- Wall and ceiling insulation adequate
- Grow room pressure relationship to corridor
- Corridor ventilated and at defined pressure
- Pressure cascade maintained
- Pressure strategy rationale documented
- Heat rejection type identified
- Hydronic loop configuration
- OA dewpoint at survey
- AGIQ sizing input data retrievable

**Low**
- Unit model/serial/configuration documented
- Unit type identified
- Unit connected to internet / AGIQ remote monitoring
- Construction type documented
- Non-critical documentation gaps

### Groups & Items

**A — Distribution: Mechanical Delivery**
1. Fabric duct socks / engineered distribution installed per print — Critical
2. Return air path fully unobstructed — Critical
3. Measurable airflow at all supply points — 40–60 ACH achieved — Critical
4. Airflow balanced across room — no supply/return gradients — Medium
5. Air change rate consistent with design — no system starvation — Medium

**B — Equipment: Unit Identity & Capability**
*Reads structured fields from placed equipment modules in Map tab where applicable.*
1. Unit model, serial number, and configuration documented — Low
2. Unit type identified — Evolution split system or Compressor Wall — Low
3. Original mechanical submittal / equipment performance data retrieved — Medium
4. Original mechanical prints available and as-built deviation documented — Medium
5. Commissioning report exists — system verified at design conditions with plants — High
6. Unit connected to internet / AGIQ remote monitoring active — Low
7. Reheat type identified — modulating or on/off — High

**C — Controls: Sensing & Command**
1. Integrated temperature AND RH control — not thermostat-only — Critical
2. Controls configured for cultivation setpoints — not default commercial sequence — Critical
3. Control sequence accounts for lights-on vs lights-off load shift — Critical
4. Multiple RH/temp sensors distributed across canopy zone — High
5. Sensors located at canopy height — not wall level or ceiling — High
6. Sensors in shielded/aspirated housings — High
7. CO2 strategy documented — sealed room or ventilated — Medium
8. CO2 purge / emergency fresh air mechanism present and functional — High
9. **Sensor reading validated against reference under operating conditions — Critical (new in v1.2)**

**C9 — Detail**

> **Failure mode:** Sensor housing, location, or local microclimate causes reported value to diverge from true canopy air. Controls action based on invalid input cannot produce valid output. Distinct from C5 (sensor location at canopy height) and C6 (sensor housing shielded/aspirated). C5 and C6 verify *conditions for validity*; C9 verifies *output validity*.
>
> **Method:** Under operating lights at steady-state (not during sunrise/sunset transition), compare each canopy sensor against a hand-held aspirated reference at the same elevation and within 12 inches lateral. Delta >2°F dry bulb or >3% RH indicates the sensor is not reporting true conditions.
>
> **Field note required on fail:** Magnitude of delta, suspected cause (radiant load, microclimate, dead pocket, gang-box effect, drift, other).
>
> **AGIQ reference:** ◆ Design Guide Ch. 9 — Sensor Placement / Optimal Room Control Strategies

**D — Envelope: Moisture Boundary**
1. Vapor barrier present, continuous, and intact — Medium
2. Door seals and sweeps intact — Medium
3. All ceiling and wall penetrations sealed — Medium
4. Wall and ceiling insulation adequate for cultivation moisture differential — Medium
5. Construction type documented — SIPs, wood frame, masonry, or other — Low

**E — Pressurization: Room & Building Cascade**
1. Grow room pressure relationship to corridor — established and intentional — Medium
2. Corridor ventilated and at defined pressure relationship to exterior — Medium
3. Pressure cascade maintained: Exterior → Corridor → Grow rooms — Medium
4. Pressure strategy rationale documented — negative (odor) vs positive (envelope) — Medium

**F — Heat Rejection: Outdoor Equipment**
1. Heat rejection type identified — dry cooler, wet cooler, DX condenser, or other — Medium
2. Heat rejection device has adequate clearance — no recirculation risk — High
3. Hydronic loop configuration documented — 1:1, many:1, or many:many — Medium
4. Economizer closed and sealed — no OA bypass — High
5. OA dewpoint documented at time of survey — Medium

**G — AGIQ Specific: Design & Commissioning**
1. AGIQ sizing input data retrievable — room, lighting, plant density, irrigation — Medium
2. Factory or factory-trained technician performed startup — High
3. Minimum two HVAC units per grow room for failover — High
4. Each room has independent contained HVAC — no cross-room air mixing — Critical

---

## Tab 4 — Report

### Inputs
Pulled from Survey tab, editable:
- Technician name
- Client / Facility
- Field narrative

---

### System Viability Determination

Computed automatically from checklist state:

| Status | Condition |
|---|---|
| COMMISSIONED | All items pass + commissioning verified |
| FUNCTIONAL | All items pass + no commissioning report |
| DEFICIENT | Any Critical or High item fails |
| NOT VERIFIED | Missing commissioning data + critical documentation gaps |

---

### Evidence Basis Enum

Applied per item across the entire report — checklist, equipment layout, sensor table, failure summary. Every reported fact carries its evidence basis.

- **Measured** — instrument reading taken and logged
- **Observed** — visual confirmation on site
- **Documented** — sourced from print, submittal, or report
- **Inferred** — derived from other evidence, not directly confirmed
- **Not Verified** — condition could not be assessed during survey

---

### Text Report (ASCII)
XOI-pasteable. Sections in order:

1. **Header** — Project Demeter, timestamp, technician, client, room
2. **Site Information** — all Survey tab fields, including lights state (on/off/transition)
3. **Measured Environmental State**
   - Primary VPD — mean of sensor readings if available
   - Spatial range (kPa), range flag if >0.3 kPa
   - In-range percentage
   - Target RH by stage at measured dry bulb
   - **If C9 fails: this section displays VOID and a note: "Sensor validity not established. Reported VPD values cannot be assumed to represent canopy conditions. See C9 in Site Checklist."**
4. **System Viability**
   - Status: COMMISSIONED / FUNCTIONAL / DEFICIENT / NOT VERIFIED
   - Deterministic statement: "The room is currently [VPD state], however system viability is [status]. Measured conditions cannot be assumed stable due to [failure domains]."
   - If lights = transition: appended clause "Survey performed during sunrise/sunset transition; measured values reflect non-steady-state period."
5. **Spatial Data**
   - Single tier:
     - Computed facts: sensor count, canopy area, mean spacing, sensors per 100 sq ft
     - Sensor table (point, position, temp, RH, VPD, status, evidence basis)
     - VPD summary
     - Coverage description (technician-written)
     - Airflow confidence flag
   - Multi tier: per-tier sensor tables (with head/mid/tail position) and per-tier summary including range
6. **Equipment Layout** — all placed modules with structured fields (model, serial, type, reheat, commissioning, internet), duct runs, registers with coordinates, labels, S/R designation, evidence basis per row
7. **Site Checklist** — all 7 groups, all items, status, priority, evidence basis, field notes
8. **Failure Mode Summary** — failed items structured as:
   ```
   ✗ [Item Name]                    Priority: Critical

   Existing Condition:  [Observed issue]
   Required Condition:  [What must be true for proper operation]
   Impact:              [System-level consequence]
   Basis:               [Evidence type]
   Field Note:          [Technician entry]
   ```
9. **Retest Requirements** — auto-generated from failure categories:
   - Distribution failures → Full spatial remap required
   - Sensor placement failures (C4–C6) → Re-measure at canopy height with corrected housing/location
   - **Sensor validity failures (C9) → Correct sensor housing or location, then re-validate against aspirated reference under operating conditions before re-measuring room state. Room VPD measurements taken prior to C9 correction are void and cannot inform viability assessment.**
   - Control failures → Test lights-on and lights-off cycle independently
   - Pressurization failures → Verify full pressure cascade
   - Equipment/documentation gaps → Verification required before further action
   - Each retest item carries a "minimum retest evidence basis" — the basis at which the item must be re-evaluated (typically Measured or Observed, never Inferred)
10. **Final Assessment**
    - **Default form (C9 passes):**
      ```
      Measured Condition:  [VPD state + spatial summary]
      System Condition:    [Viability status]

      Conclusion:
      [Single deterministic paragraph combining both states]

      Recommended Next Action:
      Correct system deficiencies and retest under operating load.
      ```
    - **C9 fail form:**
      ```
      Measured Condition:  VOID — sensor validity not established.
                           Reported VPD values cannot be assumed to
                           represent canopy conditions.
      System Condition:    [Viability status]

      Conclusion:
      The system viability assessment stands independently of measured
      state. Sensor validity must be established before room conditions
      can be evaluated. See C9 retest requirements.

      Recommended Next Action:
      Correct sensor validity per C9, re-validate, re-measure room state,
      then evaluate measured environmental state.
      ```
    - **Lights = transition appended clause** (if applicable, in either form): "Survey performed during sunrise/sunset transition. Steady-state evaluation requires re-survey during stable lights-on or lights-off period."
11. **Field Narrative** — full technician text
12. **Footer** — © Michael Seth Aaron · Project Demeter · AgronomicIQ.com · 1-833-327-AGIQ

---

### PDF Report (HTML → Print)
Opens new tab, triggers `window.print()`. Light theme, monospace font.

**Heatmap rasterization:**
- SVG heatmap rendered to offscreen canvas at 2x the SVG's rendered dimensions (explicit sizing required — do not inherit)
- Exported as PNG via `canvas.toDataURL('image/png')`
- Embedded as `<img src="data:image/png;base64,...">` in report body
- Survives print pipeline — rasterized PNG prints exactly as rendered
- Embedded legend (Measured/Inferred/Not evaluated) is part of the SVG and survives rasterization

**Sections in order:**
1. Title block — dark header bar, "PROJECT DEMETER" in orange, timestamp
2. Site Information table (includes lights state)
3. Measured Environmental State — large VPD value, badge, gauge SVG, spatial summary; if C9 fails, displays VOID block in place of VPD value
4. System Viability — status badge, deterministic statement
5. Target RH by Stage table
6. Room Map:
   - Single tier: rasterized PNG heatmap with all map elements, embedded legend, airflow confidence flag, computed facts, coverage description, spatial summary
   - Multi tier: per-tier sensor tables with position-on-tier, multi-tier limitation note
7. Equipment Layout table — includes structured fields per module
8. Site Checklist — groups expanded, status, priority, evidence basis, field notes, AGIQ references on failed items
9. Failure Mode Summary — structured format with existing/required/impact/priority/basis
10. Retest Requirements — including minimum retest evidence basis per item
11. Final Assessment — uses C9-fail form when applicable
12. Field Narrative — full text, orange left border
13. Footer — © Michael Seth Aaron · Project Demeter · AgronomicIQ.com · 1-833-327-AGIQ

---

## Math Module (`math.js`)
Pure functions, no DOM, no state:

```js
svp(tC)                               // Magnus–Alduchov 1996, returns kPa
calcVPD(tdbC, rhPct, leafOffsetC)     // returns kPa
rhForVpd(tdbC, targetVpd, leafOffsetC)// back-calc target RH
dewPointApprox(tdbC, rhPct)           // Magnus approximation
toC(tF)                               // °F to °C
fromC(tC)                             // °C to °F
idwInterpolate(x, y, sensors, power=2)// inverse distance weighting
meanNearestNeighborDistance(sensors)  // ft, for spatial summary
canopyArea(zones)                     // sum of canopy zone area, sq ft
```

---

## State (`app.js`)

```js
const APP = {
  // Session
  unitF: true,
  stage: 0,              // 0–4 index into STAGES array
  lights: 'on',          // 'on' | 'off' | 'transition'

  // Survey tab
  customer: '',
  facility: '',
  room: '',
  equipmentServing: '',  // free text — high-level summary
  tech: '',
  date: '',
  narrative: '',

  // Map tab
  mapMode: 'single',     // 'single' | 'multi'
  roomLen: null,
  roomWid: null,
  activeTool: 'sensor',  // 'sensor' | 'canopy' | 'dead' | 'equipment' | 'duct' | 'register'
  nudgeStep: 0.5,
  selectedId: null,
  selectedType: null,    // 'sensor' | 'zone' | 'equipment' | 'duct' | 'register'
  airflowConfidence: 'UNKNOWN', // 'UNKNOWN' | 'LOW' | 'ASSUMED'
  coverageNotes: '',     // technician-written sensor coverage description

  // Map elements
  sensors: [],           // {id, xFt, yFt, tdb, rh}
  zones: [],             // {id, type:'canopy'|'dead', x1Ft, y1Ft, x2Ft, y2Ft, label}
  equipmentModules: [],  // {id, type:'supply'|'return', xFt, yFt, wFt, hFt, label,
                         //  model, serial, unitType, reheatType,
                         //  commissioningPresent, internetConnected}
  ducts: [],             // {id, equipmentId, x1Ft, y1Ft, x2Ft, y2Ft}
  registers: [],         // {id, ductId, xFt, yFt, label}

  // Multi-tier
  tierCount: 2,
  lighting: 'led',       // 'led' | 'hps' | 'mixed'
  tierSensors: {},       // tier# -> [{id, position:'head'|'mid'|'tail', tdb, rh}]

  // Checklist
  checklistState: {},    // itemId -> {status: 'pass'|'fail'|'na'|null,
                         //            evidenceBasis: enum,
                         //            note: ''}

  // Persistence
  surveyId: null,
  createdAt: null,
  updatedAt: null,
  reportGeneratedAt: null,
  lastEditedDevice: null,// device fingerprint for collision warning on resume
  version: 2             // bumped from 1 to 2 — schema change
}
```

---

## Persistence Layer

### Storage
- IndexedDB, primary storage
- No network dependency
- Auto-save on state change, debounced 800ms
- Report generation creates a frozen snapshot — does not mutate live state

### SurveyRecord Schema (v2)
```js
{
  id: string,           // uuid
  status: 'active' | 'complete' | 'archived',
  version: 2,
  createdAt: ISO string,
  updatedAt: ISO string,
  reportGeneratedAt: ISO string | null,
  lastEditedDevice: string | null,
  metadata: {
    customer, facility, room,
    equipmentServing, tech, date, narrative,
    stage, lights, unitF
  },
  mapData: {
    roomLen, roomWid, mapMode,
    airflowConfidence, coverageNotes,
    sensors, zones, equipmentModules,
    ducts, registers,
    tierCount, lighting, tierSensors
  },
  checklistState: {},   // includes evidenceBasis per item
  reportSnapshot: null
}
```

### Schema Migration v1 → v2
On survey load, if `version === 1`:
- Add `lights: 'on'` if not present (or preserve if already 'on'/'off')
- Add `coverageNotes: ''`
- For each `equipmentModules[i]`: add empty structured fields (model, serial, unitType, reheatType, commissioningPresent, internetConnected)
- For each `tierSensors[t][i]`: add `position: 'mid'` as default
- For each `checklistState[itemId]`: add `evidenceBasis: 'Not Verified'` if unset
- Set `version = 2`
- Save

Migration runs once per survey on first v1.2 load, idempotent.

### Lifecycle
```
New Survey → Auto-save → Edit → Generate Report → Freeze Snapshot → Complete → Archive
```

Archived surveys require explicit confirmation to re-open. Prevents post-delivery edits.

### Device Collision
On resume, if `lastEditedDevice` differs from current device fingerprint and `updatedAt` is recent (<1 hour), display warning: "This survey was last edited on a different device at [time]. Continuing here may overwrite changes made there." User confirms to proceed.

---

## What This Tool Does Not Do

- No airflow modeling or simulation
- No automated diagnosis
- No automated distribution-confidence scoring (technician judgment, recorded as field notes)
- No removal of ambiguity from inconclusive findings
- No cloud sync, no authentication, no external dependencies

The tool collects and organizes evidence. The technician interprets it. That boundary holds.

---

## Attribution
© Michael Seth Aaron
No company attribution anywhere in UI or reports.
AGIQ references are documentation citations, not endorsements. The phone number and URL in the checklist header and report footer are reference information for the reader, not contacts-of-record for this tool.

---

*Project Demeter v1.2 — Specification locked*