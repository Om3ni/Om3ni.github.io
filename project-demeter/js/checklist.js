// Project Demeter — Checklist source-of-truth + helpers.
// Items A1–G4 lifted verbatim (name / failure-mode / method / AGIQ ref)
// from the v1.1 monolith. Item ids re-keyed to spec scheme so the spec's
// cross-references (C9 voids measured state, "Group B is failed and
// modules array is empty", C5/C6 vs C9 distinction) line up with code.
// C9 is net-new in v1.2 and authored from SPEC §Tab 3 → Group C.
//
// Pure data + pure helpers. No DOM. No state mutation.

export const EVIDENCE_BASIS_OPTIONS = [
  'Measured', 'Observed', 'Documented', 'Inferred', 'Not Verified'
];

export const STATUS_VALUES = ['pass', 'fail', 'na'];

export const PRIORITY_LABELS = ['Critical', 'High', 'Medium', 'Low'];

// Group B items that read structured fields off placed equipment modules.
// When one of these is failed and APP.equipmentModules is empty, the
// view surfaces "no equipment module recorded" rather than ambiguous
// "missing data" (per SPEC §Tab 2 → Equipment Modules).
const REQUIRES_EQUIPMENT_MODULE = new Set(['B1', 'B2', 'B5', 'B6', 'B7']);

export const CHECKLIST_HEADER_NOTE =
  'AgronomicIQ.com · 1-833-327-AGIQ\n' +
  'Original project files and submittals may be available from ' +
  'AgronomicIQ for projects they engineered.';

// C9 detail panel content (new in v1.2). Failure-mode / method /
// field-note-on-fail / AGIQ ref expanded out of the standard item shape
// because SPEC requires the extended copy be rendered prominently.
export const C9_DETAIL = {
  failureMode:
    'Sensor housing, location, or local microclimate causes reported ' +
    'value to diverge from true canopy air. Controls action based on ' +
    'invalid input cannot produce valid output. Distinct from C5 ' +
    '(sensor location at canopy height) and C6 (sensor housing ' +
    'shielded/aspirated). C5 and C6 verify conditions for validity; ' +
    'C9 verifies output validity.',
  method:
    'Under operating lights at steady-state (not during sunrise/sunset ' +
    'transition), compare each canopy sensor against a hand-held ' +
    'aspirated reference at the same elevation and within 12 inches ' +
    'lateral. Delta >2°F dry bulb or >3% RH indicates the sensor is ' +
    'not reporting true conditions.',
  fieldNoteOnFail:
    'Magnitude of delta, suspected cause (radiant load, microclimate, ' +
    'dead pocket, gang-box effect, drift, other).',
  agiqRef:
    'Design Guide Ch. 9 — Sensor Placement / Optimal Room Control Strategies'
};

export const CHECKLIST_GROUPS = [
  {
    key: 'A',
    title: 'A — Distribution: Mechanical Delivery',
    items: [
      {
        id: 'A1',
        name: 'Fabric duct socks / engineered distribution installed per print',
        priority: 'Critical',
        fail: 'Uncontrolled high-velocity discharge. Dead zones, canopy spotting, severe spatial RH/VPD variation. System cannot distribute supply air as designed.',
        method: 'Visual — confirm against mechanical print',
        agiq: 'AGIQ Ch.6: "There are few factors that have a bigger impact on HVAC performance than airflow and ducting." Fabric socks provide even distribution and correct discharge velocities.'
      },
      {
        id: 'A2',
        name: 'Return air path fully unobstructed — no blocking, sheeting, or damper manipulation',
        priority: 'Critical',
        fail: 'Effective CFM collapses regardless of unit output. Latent removal drops. Any operator field hacks (plastic sheeting, blocked grilles) documented here.',
        method: 'Visual — grilles clear, no blocking, dampers at design position',
        agiq: 'AGIQ: Short cycling occurs when supply air reaches return without distributing through room. Obstruction changes designed air path and creates gradients.'
      },
      {
        id: 'A3',
        name: 'Measurable airflow at all supply points — 40–60 ACH achieved',
        priority: 'Critical',
        fail: 'Dead zones in canopy. Stagnant air creates high-RH microclimates. VPD map will show severe spatial variation. Powdery mildew risk elevated.',
        method: 'Field instrument — vane anemometer at each diffuser/sock terminus',
        agiq: 'AGIQ design guide: Grow rooms require 40–60 air changes/hr vs 4–5 for commercial. Air movement critical for stem strengthening and leaf surface VPD control.'
      },
      {
        id: 'A4',
        name: 'Airflow balanced across room — no supply/return gradients',
        priority: 'Medium',
        fail: 'Plants near supply experience cold/dry conditions; plants near return experience warm/humid. Single-point RH sensor will be unrepresentative of majority of canopy.',
        method: 'Anemometer traverse — compare multiple supply points, check for gradient',
        agiq: 'AGIQ Fig 6.01: Long linear air paths create temperature and humidity gradients. Design should distribute supply air in parallel to canopy, not series.'
      },
      {
        id: 'A5',
        name: 'Air change rate consistent with design — no evidence of system starvation',
        priority: 'Medium',
        fail: 'System may be running but not moving design CFM through the space. Latent removal and VPD control both collapse at reduced ACH.',
        method: 'Calculate from measured CFM at supply vs room volume',
        agiq: ''
      }
    ]
  },
  {
    key: 'B',
    title: 'B — Equipment: Unit Identity & Capability',
    items: [
      {
        id: 'B1',
        name: 'Unit model, serial number, and configuration documented',
        priority: 'Low',
        fail: 'Cannot verify rated capacity against actual load. Cannot pull performance data at design conditions. Cannot contact AGIQ for project file.',
        method: 'Visual — nameplate on unit. Photograph all data plates.',
        agiq: 'AGIQ: Evolution (indoor split with remote dry cooler) vs Compressor Wall (outdoor self-contained) — configuration determines where AHU, heat rejection, and duct paths are located.'
      },
      {
        id: 'B2',
        name: 'Unit type identified — Evolution split system or Compressor Wall',
        priority: 'Low',
        fail: 'Incorrect assumption about equipment configuration leads to incorrect assessment of installation deviations.',
        method: 'Visual inspection of unit and outdoor heat rejection device',
        agiq: 'AGIQ Ch.11: Evolution = indoor AHU + separate outdoor dry cooler via glycol loop. Compressor Wall = outdoor self-contained unit with integrated fluid cooler, ducts directly into space.'
      },
      {
        id: 'B3',
        name: 'Original mechanical submittal / equipment performance data retrieved',
        priority: 'Medium',
        fail: 'Cannot confirm design was sound before chasing installation problems. May scope remediation for a fundamentally undersized system.',
        method: 'Document retrieval — AGIQ project file (call 1-833-327-AGIQ), engineer of record, mechanical contractor',
        agiq: 'AGIQ sizing inputs: room dimensions, purpose, building material, temp/RH start/end of grow, lighting W/sqft, canopy area %, plant count/density, watering rate, watering system type.'
      },
      {
        id: 'B4',
        name: 'Original mechanical prints available and as-built deviation documented',
        priority: 'Medium',
        fail: 'No as-designed baseline. Cannot quantify installation deviation.',
        method: 'Document retrieval — mechanical contractor, engineer of record',
        agiq: ''
      },
      {
        id: 'B5',
        name: 'Commissioning report exists — system verified at design conditions with plants',
        priority: 'High',
        fail: 'No verified baseline. System was never confirmed to meet design intent. All current conditions assumed, not measured.',
        method: 'Document retrieval — may not exist at this site',
        agiq: 'AGIQ Ch.11: "Commissioning can only be completed once the grow room is operating at design conditions." Full commissioning requires plants at load.'
      },
      {
        id: 'B6',
        name: 'Unit connected to internet / AGIQ remote monitoring active',
        priority: 'Low',
        fail: 'No trend data available. Cannot assess chronic vs episodic condition problems. Historical performance data lost.',
        method: 'Check unit controls interface for network status',
        agiq: 'AGIQ strongly recommends ethernet at installation. Remote monitoring enables 24/7 data collection and quick service response.'
      },
      {
        id: 'B7',
        name: 'Reheat type identified — modulating or on/off',
        priority: 'High',
        fail: 'On/off reheat causes temperature and RH swings as unit alternates between overcooling and overheating. Chronic setpoint hunting.',
        method: 'Controls interface or unit submittal',
        agiq: 'AGIQ: Conventional on/off hot gas reheat causes instability. Modulating reheat maintains stable conditions 24/7. Critical for tight VPD control.'
      }
    ]
  },
  {
    key: 'C',
    title: 'C — Controls: Sensing & Command',
    items: [
      {
        id: 'C1',
        name: 'Integrated temperature AND RH control — not thermostat-only',
        priority: 'Critical',
        fail: 'RH completely unmanaged. System responds only to sensible load. Latent load swings freely with transpiration cycle. No path to VPD control.',
        method: 'Visual — inspect wall control devices and unit controls interface',
        agiq: 'AGIQ: VPD control requires HVAC capable of receiving and acting on RH setpoint. Thermostat-only cannot manage the dominant latent load.'
      },
      {
        id: 'C2',
        name: 'Controls configured for cultivation setpoints — not default commercial sequence',
        priority: 'Critical',
        fail: 'Sophisticated hardware running primitive sequence. Functionality purchased but never commissioned.',
        method: 'Controls interface — document active setpoints, control mode, and sequence',
        agiq: 'AGIQ: Grow automation software sends RH setpoint to HVAC. Controls must handle day/night schedule changes and week-to-week setpoint progressions through flower stage.'
      },
      {
        id: 'C3',
        name: 'Control sequence accounts for lights-on vs lights-off load shift',
        priority: 'Critical',
        fail: 'System tuned for one half of 24hr cycle. Swings out of VPD window during lights transition.',
        method: 'Controls interface — verify day/night setpoint scheduling exists and is configured',
        agiq: 'AGIQ Ch.5: Lighting is primary heat load (>90% of sensible). Lights-off dramatically changes sensible/latent ratio. Equipment must modulate to match.'
      },
      {
        id: 'C4',
        name: 'Multiple RH/temp sensors distributed across canopy zone',
        priority: 'High',
        fail: 'Single-point control. Sensor may read best-case condition while majority of canopy drifts. Control decisions based on unrepresentative data.',
        method: 'Visual + count — document number of sensors and locations',
        agiq: 'AGIQ Ch.7: Bare minimum is one canopy sensor. Better design includes sensors at corners, walls, and center. Fig 11.10 shows 9-point grid for typical room.'
      },
      {
        id: 'C5',
        name: 'Sensors located at canopy height — not wall level or ceiling',
        priority: 'High',
        fail: 'Wall/ceiling sensors read conditioned air not plant microclimate. Equipment satisfies sensor while plants are not at setpoint.',
        method: 'Visual — measure sensor height vs actual canopy top',
        agiq: 'AGIQ Ch.4: "The best location for sensing is right in the canopy, among the plants and leaves."'
      },
      {
        id: 'C6',
        name: 'Sensors in shielded/aspirated housings',
        priority: 'High',
        fail: 'Radiant heat from lights causes sensor to read air temperature incorrectly. RH sensor exposed to condensation risk.',
        method: 'Visual inspection of sensor housing type',
        agiq: 'AGIQ Ch.4: "Shielded and aspirated sensor housings will improve the quality of the data gathered."'
      },
      {
        id: 'C7',
        name: 'CO2 strategy documented — sealed room or ventilated',
        priority: 'Medium',
        fail: 'DOAS/fresh air role undefined. If sealed with CO2 enrichment, ventilation air must not be introduced. Latent load calculation changes entirely for ventilated rooms.',
        method: 'Operator interview — CO2 system present? Target ppm? Room sealed?',
        agiq: 'AGIQ: Grow rooms typically run 800–1200 ppm CO2 (3–4x ambient). Introducing OA is counterproductive and dilutes enrichment.'
      },
      {
        id: 'C8',
        name: 'CO2 purge / emergency fresh air mechanism present and functional',
        priority: 'High',
        fail: 'Life safety risk if CO2 valve sticks open. Often required by local building codes.',
        method: 'Controls interface — verify purge mode exists and damper is operational',
        agiq: 'AGIQ Ch.7: "A risk management system for purging CO2 is often overlooked." At 60 ACH, 10% OA purges a space in ~10 minutes.'
      },
      {
        id: 'C9',
        name: 'Sensor reading validated against reference under operating conditions',
        priority: 'Critical',
        fail: C9_DETAIL.failureMode,
        method: C9_DETAIL.method,
        agiq: C9_DETAIL.agiqRef,
        c9: true
      }
    ]
  },
  {
    key: 'D',
    title: 'D — Envelope: Moisture Boundary',
    items: [
      {
        id: 'D1',
        name: 'Vapor barrier present, continuous, and intact',
        priority: 'Medium',
        fail: 'Moisture migrates into wall/ceiling assemblies. Long-term structural damage. Envelope becomes active latent load source. Critical failure mode for coastal retrofit buildings.',
        method: 'Visual — inspect accessible walls, ceiling penetrations, construction joints',
        agiq: 'AGIQ Ch.6: "Poor vapor barriers impact minimum and maximum humidity control in these process spaces."'
      },
      {
        id: 'D2',
        name: 'Door seals and sweeps intact — pressure differential maintained at door events',
        priority: 'Medium',
        fail: 'Primary pathway for corridor air infiltration. At coastal Atlantic City location, OA dewpoints can reach 70°F+.',
        method: 'Visual inspect sweep condition + ribbon/smoke pencil test at door perimeter',
        agiq: ''
      },
      {
        id: 'D3',
        name: 'All ceiling and wall penetrations sealed — conduit, pipe, duct',
        priority: 'Medium',
        fail: 'Uncontrolled infiltration pathways. Every unsealed gap is an active moisture source at this coastal location.',
        method: 'Visual — inspect all conduit, pipe, and duct penetrations through envelope',
        agiq: 'AGIQ Ch.6: Infiltration through gaps impacts space conditions. Coastal location compounds this significantly.'
      },
      {
        id: 'D4',
        name: 'Wall and ceiling insulation adequate for cultivation moisture differential',
        priority: 'Medium',
        fail: 'Heat and moisture move through building assembly. Energy penalty and loss of environmental control precision. Condensation risk in wall cavity.',
        method: 'Visual — inspect exposed insulation, check for signs of moisture damage or gaps',
        agiq: 'AGIQ Ch.6: "Leaky and poorly insulated buildings cost more to heat, cool and control humidity."'
      },
      {
        id: 'D5',
        name: 'Construction type documented — SIPs, wood frame, masonry, or other',
        priority: 'Low',
        fail: 'Cannot assess vapor barrier integrity or thermal performance without knowing construction type.',
        method: 'Visual inspection + document review',
        agiq: 'AGIQ Ch.4: Steel insulated panels (SIPs) preferred — easy cleaning, mold-resistant, effective vapor barrier, good inter-room insulation.'
      }
    ]
  },
  {
    key: 'E',
    title: 'E — Pressurization: Room & Building Cascade',
    items: [
      {
        id: 'E1',
        name: 'Grow room pressure relationship to corridor — established and intentional',
        priority: 'Medium',
        fail: 'Undefined infiltration/exfiltration pattern. Cannot predict moisture movement or contamination behavior.',
        method: 'Field instrument — ribbon/tissue at door gap. Record direction of airflow.',
        agiq: ''
      },
      {
        id: 'E2',
        name: 'Corridor ventilated and at defined pressure relationship to exterior',
        priority: 'Medium',
        fail: 'No buffer zone. Grow rooms potentially exposed directly to exterior conditions via corridor gaps. Marine air ingress unmitigated.',
        method: 'Field instrument — ribbon/tissue at exterior door. Confirm corridor has mechanical ventilation.',
        agiq: ''
      },
      {
        id: 'E3',
        name: 'Pressure cascade maintained: Exterior → Corridor → Grow rooms',
        priority: 'Medium',
        fail: 'Pressure relationships accidental rather than designed. Cannot rely on envelope or pressurization strategy.',
        method: 'Verify all three pressure relationships sequentially with ribbon or manometer',
        agiq: ''
      },
      {
        id: 'E4',
        name: 'Pressure strategy rationale documented — negative (odor) vs positive (envelope)',
        priority: 'Medium',
        fail: 'Pressure strategy may have been set for general industry convention without evaluating site-specific coastal infiltration risk. Negative pressure rooms pull marine air through every envelope gap.',
        method: 'Operator/engineer interview — why is current pressure strategy in use?',
        agiq: 'Note: At coastal locations, positive pressure with carbon scrubbing on exhaust may be mechanically preferable if odor compliance allows.'
      }
    ]
  },
  {
    key: 'F',
    title: 'F — Heat Rejection: Outdoor Equipment',
    items: [
      {
        id: 'F1',
        name: 'Heat rejection type identified — dry cooler, wet cooler, DX condenser, or other',
        priority: 'Medium',
        fail: 'Cannot assess seasonal performance risk. DX systems face winter oil migration risk at this location. Water-cooled systems preferred by AGIQ.',
        method: 'Visual — locate and photograph outdoor heat rejection device',
        agiq: 'AGIQ Ch.5: Water/glycol-cooled systems preferred — smaller refrigerant charge, no oil migration in winter, easier install, safer for plants.'
      },
      {
        id: 'F2',
        name: 'Heat rejection device has adequate clearance — no recirculation risk',
        priority: 'High',
        fail: 'Hot air recirculation causes unit to trip on high pressure. Reduced cooling capacity.',
        method: 'Visual — check clearances on all sides and above unit per manufacturer spec',
        agiq: 'AGIQ Ch.11: Outdoor dry cooler must have sufficient space around it. Placement in pit or against multiple walls significantly impairs performance.'
      },
      {
        id: 'F3',
        name: 'Hydronic loop configuration documented — 1:1, many:1, or many:many',
        priority: 'Medium',
        fail: 'Unknown loop configuration means unknown redundancy level. Many:1 (single cooling plant for all rooms) is single point of failure for entire facility.',
        method: 'Document review or trace piping',
        agiq: 'AGIQ Ch.11 Fig 11.05: Many:many (parallel fluid coolers to parallel AHUs) provides best redundancy.'
      },
      {
        id: 'F4',
        name: 'Economizer closed and sealed — no OA bypass at this coastal location',
        priority: 'High',
        fail: 'Marine OA at high dewpoint introduced directly to conditioning system. Cannot maintain RH setpoint during high-humidity OA events.',
        method: 'Visual — damper position confirmed closed, no bypass gaps, blade seals intact',
        agiq: 'AGIQ explicitly recommends avoiding airside economizers in cannabis. Waterside economizer (cold ambient cools glycol loop in winter) is acceptable alternative.'
      },
      {
        id: 'F5',
        name: 'OA dewpoint documented at time of survey',
        priority: 'Medium',
        fail: 'Cannot contextualize indoor conditions without knowing OA load at time of survey.',
        method: 'Field instrument — measure OA temp + RH at exterior. Compute dewpoint.',
        agiq: ''
      }
    ]
  },
  {
    key: 'G',
    title: 'G — AGIQ Specific: Design & Commissioning',
    items: [
      {
        id: 'G1',
        name: 'AGIQ sizing input data retrievable — room, lighting, plant density, irrigation',
        priority: 'Medium',
        fail: 'Cannot verify equipment was correctly sized. Cannot distinguish installation failure from design failure.',
        method: 'Request from AGIQ (1-833-327-AGIQ): room dimensions, purpose, building material, temp/RH start/end of grow, lighting W/sqft, canopy area %, plant count, watering rate, watering system type.',
        agiq: 'AGIQ Brochure Challenge #3: These are the exact inputs used to size equipment. Grower NDA acceptable to protect grow parameters while sharing HVAC design basis.'
      },
      {
        id: 'G2',
        name: 'Factory or factory-trained technician performed startup',
        priority: 'High',
        fail: 'No expert verification of installation. Controls not configured by qualified personnel.',
        method: 'Document retrieval — startup packet / commissioning sign-off',
        agiq: 'AGIQ Getting Grow Rooms Right Ch.11: "Recommended that a factory or factory-trained HVAC technician be on-site to supervise startup." Every AGIQ unit initialized by factory employee.'
      },
      {
        id: 'G3',
        name: 'Minimum two HVAC units per grow room for failover',
        priority: 'High',
        fail: 'Single unit per room — any maintenance event removes all conditioning. Crop loss risk on equipment failure.',
        method: 'Visual count — how many units serve each room?',
        agiq: 'AGIQ design guide Ch.2: "A well-designed system should feature at least two HVAC units per room as built-in failover." For 7–9 room facility, minimum 14–18 units recommended.'
      },
      {
        id: 'G4',
        name: 'Each room has independent contained HVAC — no cross-room air mixing',
        priority: 'Critical',
        fail: 'Cross-contamination risk. Cannot independently control different stages with different setpoints.',
        method: 'Visual — trace supply and return ductwork to confirm room isolation',
        agiq: 'AGIQ Ch.2: "Quarantine style requires each room has its own contained HVAC system with no mixing of air between rooms. A central HVAC system is therefore inappropriate."'
      }
    ]
  }
];

// Build a flat id → item map (with group key attached) for O(1) lookup.
const ITEM_INDEX = (() => {
  const m = new Map();
  for (const g of CHECKLIST_GROUPS) {
    for (const it of g.items) m.set(it.id, { ...it, group: g.key });
  }
  return m;
})();

export function getItemById(id) {
  return ITEM_INDEX.get(id) || null;
}

export function flatItems() {
  const out = [];
  for (const g of CHECKLIST_GROUPS) {
    for (const it of g.items) out.push({ ...it, group: g.key });
  }
  return out;
}

export function defaultItemState() {
  return { status: null, evidenceBasis: 'Not Verified', note: '' };
}

export function getItemState(checklistState, id) {
  return checklistState[id] || defaultItemState();
}

export function requiresEquipmentModule(id) {
  return REQUIRES_EQUIPMENT_MODULE.has(id);
}

// C9 fail flag — drives header VOID (Phase 6) and report VOID block.
// Anything other than explicit 'fail' is non-fail (null / pass / na /
// missing entry all count as not-failed).
export function c9Failed(checklistState) {
  if (!checklistState) return false;
  const s = checklistState['C9'];
  return !!(s && s.status === 'fail');
}

// Per-group counts: { pass, fail, na, open, total }. "Open" counts
// every item without an explicit P/F/N status, including missing
// entries. Used to render the count summary in collapsed group headers.
export function groupCounts(checklistState, groupKey) {
  const acc = { pass: 0, fail: 0, na: 0, open: 0, total: 0 };
  const g = CHECKLIST_GROUPS.find((gr) => gr.key === groupKey);
  if (!g) return acc;
  const state = checklistState || {};
  for (const it of g.items) {
    acc.total++;
    const s = state[it.id];
    if (!s || s.status == null) acc.open++;
    else if (s.status === 'pass') acc.pass++;
    else if (s.status === 'fail') acc.fail++;
    else if (s.status === 'na') acc.na++;
  }
  return acc;
}
