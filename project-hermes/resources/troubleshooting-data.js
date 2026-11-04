/**
 * resources/troubleshooting-data.js
 * Charge troubleshooting: symptom patterns + lessons. Single source of truth for
 *   - resources/charge-troubleshooting.html (the chart page)
 *   - tools/refrigeration.html               (pattern matching in Refrigeration Analysis)
 *
 * Pattern codes per reading: "u" high, "d" low, "n" normal; "n/d" = normal or low.
 * A cell is either a code string or [code, noteNumber].
 * Readings: sp suction pressure, lp liquid pressure, sh superheat, sc subcooling, a amps.
 *
 * Lessons (why / looksLike / confirm) are DRAFTS written for owner review.
 * Anything that departs from the original source chart, or is a judgment call,
 * carries a `review` string. Search this file for "review:" to find them all.
 *
 * Cooling mode only. Patterns are typical, not exclusive: problems overlap and
 * stack. The app presents matches as things to check, never as a diagnosis.
 */

const NOTES = Object.freeze({
  2: "At part load, superheat and suction pressure can look normal. A coil that is very short of charge may frost.",
  3: "Pressures equalize very quickly after the compressor stops.",
  4: "The valve may hunt trying to control a low load, or because flash gas is reaching it.",
  5: "Can look normal if the system is also overcharged.",
  6: "Gauges can show subcooling that isn’t really there: the non-condensable gas adds pressure in the condenser. A sight glass may still show bubbles.",
  7: "Liquid pressure reads low only when it is measured after the restriction. Read at the condenser or before the drier, it can be normal."
});

// Order shown for each metering type.
const ORDER = Object.freeze({
  fixed: ["overcharge", "undercharge", "restriction", "lowAirflow", "dirtyCondenser", "lowAmbient", "weakCompressor", "nonCondensables"],
  txv:   ["overcharge", "undercharge", "restriction", "lowAirflow", "dirtyCondenser", "lowAmbient", "weakCompressor", "bulbLoose", "bulbLostCharge", "bulbUninsulated", "nonCondensables"]
});

function p(sp, lp, sh, sc, a, rh) { return { sp, lp, sh, sc, a, rh }; }

const PROBLEMS = Object.freeze({
  overcharge: {
    name: "Refrigerant overcharge",
    pattern: {
      fixed: p("u", "u", "d", "u", "u", "Poor"),
      txv:   p("n", "u", "n", "u", "u", "Normal")
    },
    why: {
      fixed: "Extra refrigerant sits as liquid in the condenser and takes up surface that should be condensing, so head pressure climbs. Higher head pushes more refrigerant through the piston and floods the evaporator: superheat falls and suction rises.",
      txv:   "Extra refrigerant sits as liquid in the condenser, so subcooling and head pressure rise. The TXV keeps metering to its superheat setting, so suction and superheat stay close to normal. High subcooling is the giveaway."
    },
    looksLike: [
      { id: "dirtyCondenser", tell: "Also high head pressure, but a dirty condenser shows low or normal subcooling: the refrigerant isn't stacked up, it just can't shed heat. High subcooling points to charge." },
      { id: "nonCondensables", tell: "Also high head. Non-condensables keep head high even with a clean coil and a correct charge; check standing pressure with the system off." }
    ],
    confirm: "With airflow verified and both coils clean, compare against the manufacturer's charging target (subcooling on a TXV, target superheat on a fixed orifice). Recover in small amounts and let the system settle between adjustments."
  },

  undercharge: {
    name: "Refrigerant undercharge",
    pattern: {
      fixed: p("d", "d", "u", "d", "d", "Ice / poor"),
      txv:   p(["n/d", 2], "d", ["n/u", 2], "d", "d", "Ice / normal")
    },
    why: {
      fixed: "There isn't enough refrigerant to keep the liquid line full. Vapor reaches the piston, flow drops, and the evaporator starves: superheat rises, pressures fall, and with no liquid backed up in the condenser, subcooling is low.",
      txv:   "The TXV opens wider to keep the coil fed, so superheat can look normal until the charge is well short. Subcooling drops first, because there is no spare liquid in the condenser to hold back."
    },
    looksLike: [
      { id: "restriction", tell: "Same arrows except subcooling. A restriction holds refrigerant back in the condenser, so subcooling is high. An undercharged system has nothing to hold back, so subcooling is low." }
    ],
    confirm: "Measure the temperature drop across the drier; more than about 3°F points to a restriction, not charge. Find and fix the leak before adding refrigerant."
  },

  restriction: {
    name: "Liquid restriction (drier)",
    pattern: {
      fixed: p("d", ["d", 7], "u", "u", "d", "Ice / poor"),
      txv:   p("d", ["d", 7], "u", "u", "d", "Ice / poor")
    },
    why: "A plugged drier, kinked line or stuck solenoid holds refrigerant back. Liquid stacks up in the condenser (subcooling high) while the evaporator downstream is starved (superheat high, suction low).",
    review: "Liquid pressure ↓ kept from the source chart; added note 7 because it depends on where the gauge reads relative to the restriction.",
    looksLike: [
      { id: "undercharge", tell: "Starved evaporator in both. Subcooling separates them: high with a restriction, low with an undercharge." },
      { id: "bulbLostCharge", tell: "(TXV) Identical arrows: a valve that has lost its bulb charge closes and becomes the restriction. No temperature drop across the drier points to the valve." },
      { id: "lowAmbient", tell: "(Fixed orifice) Identical arrows on a cool day. Outdoor temperature, and no drop across the drier, point to low head pressure instead." }
    ],
    confirm: "Measure the liquid line before and after the drier (and any filter or solenoid). A drop of more than about 3°F, or sweating or frost at the component, locates the restriction."
  },

  lowAirflow: {
    name: "Low evaporator airflow (low load)",
    pattern: {
      fixed: p("d", "d", "d", "u", "d", "Ice / normal"),
      txv:   p("d", "d", ["n", 4], "n", "d", "Ice / normal")
    },
    why: {
      fixed: "Too little air across the coil means too little heat to boil the refrigerant. The piston keeps feeding at the same rate, so the coil floods: superheat low, suction and coil temperature low, and the coil can freeze.",
      txv:   "Too little air means too little heat to boil the refrigerant. The TXV throttles back to hold superheat, so superheat stays near normal while suction pressure and coil temperature fall. The coil can freeze."
    },
    looksLike: [
      { id: "overcharge", tell: "(Fixed orifice) Both show low superheat, but an overcharge raises suction and head pressure; low airflow lowers both." },
      { id: "undercharge", tell: "(TXV) Both can show low suction with near-normal superheat. Subcooling is low with an undercharge and normal with low airflow." }
    ],
    confirm: "Check airflow before touching the charge: filter, blower speed and wheel, coil face, ductwork and dampers. Measure the temperature split and external static pressure. Expect evaporator saturation about 35°F below return air at 400 CFM/ton."
  },

  dirtyCondenser: {
    name: "Dirty condenser",
    pattern: {
      fixed: p("u", "u", "d", "d", "u", "Poor"),
      txv:   p("n", "u", "n", "n", "u", "Normal")
    },
    why: {
      fixed: "The condenser can't shed its heat, so head pressure rises. Higher head pushes more refrigerant through the piston: superheat drops. Subcooling stays low because the refrigerant isn't backing up in the condenser, it's just hot.",
      txv:   "The condenser can't shed its heat, so head pressure and amps rise. The TXV holds superheat, so suction, superheat and subcooling stay near normal; the high head pressure is the sign."
    },
    looksLike: [
      { id: "overcharge", tell: "Both raise head pressure. Subcooling separates them: high with an overcharge, low or normal with a dirty condenser." },
      { id: "nonCondensables", tell: "Both raise head pressure. If head stays high after the coil is clean and the fan and clearances check out, suspect non-condensables." }
    ],
    confirm: "Compare condensing temperature with outdoor air. A difference well above the design value (+20 to +30°F depending on efficiency) with the fan running points to the condenser side. Clean the coil, check the fan, clearances and hot-air recirculation, then re-read."
  },

  lowAmbient: {
    name: "Low outdoor ambient",
    pattern: {
      fixed: p("d", "d", "u", "u", "d", "Ice / normal"),
      txv:   p(["n", 4], "d", ["n", 4], "n", "d", "Normal")
    },
    why: {
      fixed: "Cool outdoor air drops head pressure, so less refrigerant is pushed through the piston. The evaporator starves (superheat high, suction low) and the refrigerant that isn't moving waits in the condenser (subcooling high).",
      txv:   "Cool outdoor air drops head pressure. The TXV opens to compensate and holds superheat, so mainly liquid pressure is low. Below about 100 psi of drop across the valve on R-22, or 160 psi on R-410A, it can't keep up and starts to act like a restriction."
    },
    looksLike: [
      { id: "restriction", tell: "(Fixed orifice) Identical arrows. Outdoor temperature is the tell, and there is no temperature drop across the drier." }
    ],
    confirm: "Restrict condenser airflow to raise head pressure to a 90–95°F-day equivalent, then re-read superheat and subcooling. Don't charge a fixed-orifice system under these conditions."
  },

  weakCompressor: {
    name: "Inefficient compressor",
    note: 3,
    pattern: {
      fixed: p("u", "d", "u", "d", "d", "Poor"),
      txv:   p("u", "d", "u", "d", "d", "Poor")
    },
    why: "Worn valves or rings let gas leak back inside the compressor, so it moves less refrigerant. Suction pressure rises, head pressure falls and amps drop. Refrigerant the compressor isn't moving stays on the low side, so the condenser holds less liquid and subcooling is low.",
    review: "Source chart shows subcooling ↑ for both metering types; changed to ↓ on the reasoning above. Superheat ↑ kept from the source. Please confirm both.",
    looksLike: [],
    confirm: "Look for a low compression ratio for the conditions, amps below expected, and pressures that equalize within seconds of shutdown. On a heat pump, rule out a reversing valve leaking across, which also gives high suction and low head."
  },

  bulbLoose: {
    name: "TXV bulb loose",
    pattern: { txv: p("u", "u", "d", ["d", 5], "u", "Poor") },
    why: "The bulb senses the warmer air around it instead of the suction line, so the valve thinks superheat is high and opens. The coil floods: superheat low, suction up, and liquid can reach the compressor.",
    looksLike: [
      { id: "overcharge", tell: "Both can push suction up. An overcharge raises subcooling; a loose bulb lowers it, because the refrigerant has moved into the flooded evaporator." },
      { id: "bulbUninsulated", tell: "Same direction, usually milder. Check mounting first, then insulation." }
    ],
    confirm: "Check the bulb: tight against a clean, straight section of suction line, held with metal straps (not tape or zip ties), at about 4 or 8 o'clock on lines 7/8″ and larger, and insulated. Re-read once it has settled.",
    review: "Bulb position guidance (4/8 o'clock on 7/8″+) added from general practice; confirm against the valve manufacturers you work with."
  },

  bulbLostCharge: {
    name: "TXV bulb lost its charge",
    pattern: { txv: p("d", "d", "u", "u", "d", "Ice / poor") },
    why: "The bulb's charge is what pushes the valve open. Without it the valve closes and starves the coil: superheat high, suction low, and refrigerant backs up in the condenser.",
    looksLike: [
      { id: "restriction", tell: "Identical arrows. Check for a temperature drop across the drier first; if there is none, suspect the valve." },
      { id: "undercharge", tell: "Starved coil in both, but subcooling is high here and low with an undercharge." }
    ],
    confirm: "Warm the bulb in your hand (or remove it and warm it). A working valve opens and suction pressure rises within a minute; no change means a dead power head."
  },

  bulbUninsulated: {
    name: "TXV bulb poorly insulated",
    pattern: { txv: p("u", "u", "d", "d", "u", "Poor") },
    why: "Warm surrounding air reaches the bulb, so it reads warmer than the suction line really is and the valve overfeeds, like a loose bulb but usually milder.",
    looksLike: [
      { id: "bulbLoose", tell: "Same pattern. Check that the bulb is tight before adding insulation." }
    ],
    confirm: "Insulate the bulb and the line around it, then re-read after the system settles."
  },

  nonCondensables: {
    name: "Non-condensables",
    pattern: {
      fixed: p("u", "u", "d", ["n", 6], "u", "Poor"),
      txv:   p("n", "u", ["n", 4], ["n", 6], "u", "Poor / normal")
    },
    why: "Air or nitrogen left in the system collects in the condenser and adds its own pressure to the refrigerant's. Head pressure runs high even with a clean coil, and gauge-based subcooling can look normal when the liquid isn't truly subcooled.",
    looksLike: [
      { id: "dirtyCondenser", tell: "Both raise head pressure. A clean coil with a working fan and good clearances that still runs high head points to non-condensables." }
    ],
    confirm: "With the system off long enough to sit at outdoor temperature, compare standing pressure with the saturation pressure at that temperature. Noticeably higher means non-condensables: recover, evacuate to a deep vacuum, replace the drier and recharge."
  }
});

const READINGS = Object.freeze([
  { k: "sp", h: "SUCT", name: "Suction pressure" },
  { k: "lp", h: "LIQ",  name: "Liquid pressure" },
  { k: "sh", h: "SH",   name: "Superheat" },
  { k: "sc", h: "SC",   name: "Subcooling" },
  { k: "a",  h: "AMPS", name: "Amps" }
]);

function codes(cell) { return (Array.isArray(cell) ? cell[0] : cell).split("/"); }
function noteOf(cell) { return Array.isArray(cell) ? cell[1] : 0; }
function whyFor(problem, meter) { return typeof problem.why === "string" ? problem.why : problem.why[meter]; }
/** Look-alikes that exist for this metering type (entries prefixed "(TXV)" / "(Fixed orifice)" are meter-specific). */
function looksLikeFor(problem, meter) {
  return (problem.looksLike || []).filter((l) => {
    if (!ORDER[meter].includes(l.id)) return false;
    if (/^\(TXV\)/.test(l.tell)) return meter === "txv";
    if (/^\(Fixed orifice\)/.test(l.tell)) return meter === "fixed";
    return true;
  }).map((l) => ({ id: l.id, name: PROBLEMS[l.id].name, tell: l.tell.replace(/^\((TXV|Fixed orifice)\)\s*/, "") }));
}

/**
 * match(meter, readings) → ids of problems whose pattern agrees with every
 * reading given. readings: { sp?, lp?, sh?, sc?, a? } each "u" | "n" | "d".
 * Readings left out are ignored. Returns [] when nothing is given.
 */
function match(meter, readings) {
  const keys = Object.keys(readings).filter((k) => readings[k]);
  if (!keys.length) return [];
  return ORDER[meter].filter((id) => {
    const pat = PROBLEMS[id].pattern[meter];
    return keys.every((k) => codes(pat[k]).includes(readings[k]));
  });
}

/**
 * possible(meter, readings) → { sp: [...], lp: [...], ... }: for each reading,
 * the values ("d" | "n" | "u") that would still leave at least one matching
 * problem, given the other readings already chosen. Used to hide choices that
 * can't match anything.
 */
function possible(meter, readings) {
  const out = {};
  READINGS.forEach(({ k }) => {
    const others = { ...readings }; delete others[k];
    out[k] = ["d", "n", "u"].filter((v) => match(meter, { ...others, [k]: v }).length > 0);
  });
  return out;
}

export { NOTES, ORDER, PROBLEMS, READINGS, codes, noteOf, whyFor, looksLikeFor, match, possible };
