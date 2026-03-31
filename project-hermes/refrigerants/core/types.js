/**
 * refrigerants/core/types.js
 * Shared enums and constants for the refrigerant library.
 * Single source of truth — no magic strings anywhere else.
 */

const SAFETY_CLASS = Object.freeze({
  A1:  "A1",
  A2L: "A2L",
  A2:  "A2",
  A3:  "A3",
  B1:  "B1",
  B2L: "B2L",
  B2:  "B2",
  B3:  "B3"
});

const UNITS = Object.freeze({
  TEMP_F:        "F",
  PRESSURE_PSIG: "PSIG"
});

const VERIFICATION_STATUS = Object.freeze({
  ANCHOR_VALIDATED:  "anchor_validated",
  TABLE_TRANSCRIBED: "table_transcribed",
  UNVERIFIED:        "unverified"
});

/**
 * TABLE_TYPE
 *
 * "single"    — Pure refrigerant or azeotropic blend. One pressure per
 *               temperature. Table rows: [tempF, psig]
 *
 * "zeotropic" — Zeotropic blend with temperature glide. Bubble point
 *               (liquid line) and dew point (suction line) differ.
 *               Row format depends on TABLE_ORIENTATION (see below).
 *
 *               Lookup behavior:
 *                 getSatPressure(id, tempF, point)
 *                   point = "bubble" (default) — looks up on bubble curve
 *                   point = "dew"              — looks up on dew curve
 *                 getSatTemp(id, psig, point)
 *                   point = "bubble" (default) — returns bubble temp
 *                   point = "dew"              — returns dew temp
 */
const TABLE_TYPE = Object.freeze({
  SINGLE:    "single",
  ZEOTROPIC: "zeotropic"
});

/**
 * TABLE_ORIENTATION — zeotropic tables only, ignored for single.
 *
 * Zeotropic source data comes in two orientations depending on the source:
 *
 * "pressure_indexed" — Source lists pressure as the key.
 *   Rows: [bubbleTempF, psig, dewTempF]
 *   col 0 = bubble temp  (searched by getSatPressure "bubble")
 *   col 1 = pressure     (searched by getSatTemp)
 *   col 2 = dew temp     (searched by getSatPressure "dew"; returned by getSatTemp "dew")
 *   Sources: R-407C (iGas), R-422B/R-438A (Chemours), R-448A (Honeywell)
 *
 * "temp_indexed" — Source lists temperature as the key.
 *   Rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *   col 0 = bubble temp  (searched by both getSatPressure variants)
 *   col 1 = bubble psig  (returned by getSatPressure "bubble"; searched by getSatTemp "bubble")
 *   col 2 = dew psig     (returned by getSatPressure "dew";    searched by getSatTemp "dew")
 *   Sources: R-427A (Arkema), R-449A (Hudson), R-450A/R-513A (Emerson), R-454B (Daikin)
 */
const TABLE_ORIENTATION = Object.freeze({
  PRESSURE_INDEXED: "pressure_indexed",
  TEMP_INDEXED:     "temp_indexed"
});

export { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION };