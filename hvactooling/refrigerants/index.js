/**
 * refrigerants/index.js
 * Public API entrypoint.
 *
 * Usage:
 *   import { getSatPressure, getSatTemp, getRange, listRefrigerants } from "./refrigerants/index.js";
 *
 *   // Single refrigerants (R-22, R-32, R-410A, etc.)
 *   getSatPressure("R-410A", 40)          // → 118.46 PSIG
 *   getSatTemp("R-410A", 118.46)          // → 40.00 °F
 *
 *   // Zeotropic refrigerants (R-448A, R-407C, R-454B, etc.)
 *   getSatTemp("R-448A", 101, "bubble")   // → 46.5 °F  (liquid line)
 *   getSatTemp("R-448A", 101, "dew")      // → 56.3 °F  (suction line)
 *   getSatPressure("R-448A", 46.5, "bubble") // → ~101 PSIG
 *
 *   // Out of range or unknown refrigerant → null
 *   getSatPressure("R-410A", 999)         // → null
 *   getSatPressure("R-999X", 40)          // → null
 *
 * All lookups return null for unknown refrigerant or out-of-domain input.
 * No silent clamping. Callers handle null.
 */

import dataModules from "./data/index.js";
import { buildRegistry }                                                      from "./core/registry.js";
import { getRangeFromTable, getSatPressureFromData, getSatTempFromData }      from "./core/lookup.js";

// Build and freeze registry at module load time.
// If any data file fails validation, this throws and the module does not load.
const REGISTRY = buildRegistry(dataModules);

/**
 * getRefrigerant(id)
 * Returns the full frozen data object for a refrigerant, or null.
 */
function getRefrigerant(id) {
  return REGISTRY[id] ?? null;
}

/**
 * getSatPressure(id, tempF, point?)
 * Returns saturation pressure (PSIG) for a temperature (°F).
 * Returns null if refrigerant unknown or tempF outside table range.
 *
 * point: "bubble" (default) | "dew"
 *   Ignored for single-type refrigerants.
 *   For zeotropic: "bubble" = liquid line, "dew" = suction line.
 */
function getSatPressure(id, tempF, point = "bubble") {
  const ref = REGISTRY[id];
  if (!ref) return null;
  return getSatPressureFromData(ref, tempF, point);
}

/**
 * getSatTemp(id, psig, point?)
 * Returns saturation temperature (°F) for a pressure (PSIG).
 * Returns null if refrigerant unknown or psig outside table range.
 *
 * point: "bubble" (default) | "dew"
 *   Ignored for single-type refrigerants.
 *   For zeotropic: "bubble" = liquid line sat temp, "dew" = suction line sat temp.
 */
function getSatTemp(id, psig, point = "bubble") {
  const ref = REGISTRY[id];
  if (!ref) return null;
  return getSatTempFromData(ref, psig, point);
}

/**
 * getRange(id)
 * Returns domain bounds derived from the table.
 *
 * Single:    { minTemp_F, maxTemp_F, minPres_PSIG, maxPres_PSIG }
 * Zeotropic: { minBubbleTemp_F, maxBubbleTemp_F, minDewTemp_F, maxDewTemp_F, minPres_PSIG, maxPres_PSIG }
 *
 * Returns null if refrigerant unknown.
 */
function getRange(id) {
  const ref = REGISTRY[id];
  if (!ref) return null;
  return getRangeFromTable(ref);
}

/**
 * listRefrigerants()
 * Returns a summary array of all loaded refrigerants and their status.
 */
function listRefrigerants() {
  return Object.keys(REGISTRY).sort().map(id => {
    const ref = REGISTRY[id];
    return {
      id:                 ref.id,
      name:               ref.name,
      tableType:          ref.tableType,
      tableOrientation:   ref.tableOrientation ?? null,
      safetyClass:        ref.safetyClass,
      verificationStatus: ref.verification.status,
      range:              getRangeFromTable(ref)
    };
  });
}

export { getRefrigerant, getSatPressure, getSatTemp, getRange, listRefrigerants };