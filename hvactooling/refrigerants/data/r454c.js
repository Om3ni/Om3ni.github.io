/**
 * refrigerants/data/r454c.js
 * R-454C saturation data — table only, no logic.
 *
 * Source:    A-Gas — A2L Refrigerant Pressure Temperature Chart (Doc 614)
 *            Revision Date: 6-6-25
 *            https://www.agas.com/media/r4ep3hqm/doc-614-a2l-refrigerant-pressure-temperature-chart.pdf
 *
 * Table:     Single pressure column — 5°F steps, -15°F to 120°F (28 rows).
 *
 * Note:      R-454C is a zeotropic blend (R-32/R-1234yf 21.5/78.5) with
 *            temperature glide. The A-Gas source provides a single pressure
 *            column per their key representing saturated vapor (dew point)
 *            pressure. A proper bubble/dew dual-column source was not
 *            available at time of writing. This table is stored as SINGLE
 *            type and callers should be aware values represent dew point.
 *            Recommend upgrading to a dual-column source when available.
 *
 * Verified:  6 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE } from "../core/types.js";

const r454c = {
  id:          "R-454C",
  name:        "R-454C",
  type:        "HFO/HFC blend",
  tableType:   TABLE_TYPE.SINGLE,
  blend:       "R-32/R-1234yf (21.5/78.5)",
  safetyClass: SAFETY_CLASS.A2L,
  flammable:   true,
  gwp:         148,
  source:      "A-Gas — A2L Refrigerant Pressure Temperature Chart (Doc 614, Rev 6-6-25)",
  source_url:  "https://www.agas.com/media/r4ep3hqm/doc-614-a2l-refrigerant-pressure-temperature-chart.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Single pressure column from A-Gas source — represents saturated vapor " +
          "(dew point) pressure per source key. R-454C is zeotropic with temperature " +
          "glide; a dual bubble/dew column source is recommended for precise " +
          "liquid-line vs suction-line lookups. 5°F steps throughout. " +
          "6 anchor points verified against source — all delta 0.0.",
    anchors: [
      { temp_F: -15, expected_psig:  19.2, calculated_psig:  19.2, delta: 0.0 },
      { temp_F:   0, expected_psig:  31.8, calculated_psig:  31.8, delta: 0.0 },
      { temp_F:  40, expected_psig:  82.4, calculated_psig:  82.4, delta: 0.0 },
      { temp_F:  70, expected_psig: 141.2, calculated_psig: 141.2, delta: 0.0 },
      { temp_F: 100, expected_psig: 222.5, calculated_psig: 222.5, delta: 0.0 },
      { temp_F: 120, expected_psig: 291.6, calculated_psig: 291.6, delta: 0.0 }
    ]
  },

  // Canonical table — [tempF, psig] — dew point pressure per A-Gas source key
  // 5°F steps, -15°F to 120°F. Range derived at runtime.
  table: [
    [ -15, 19.2], [ -10, 23.8], [  -5, 27.3], [   0, 31.8], [   5, 36.7],
    [  10, 41.9], [  15, 47.6], [  20, 53.6], [  25, 60.1], [  30, 67.1],
    [  35, 74.5], [  40, 82.4], [  45, 90.8], [  50, 99.7], [  55,109.2],
    [  60,119.3], [  65,129.9], [  70,141.2], [  75,153.0], [  80,165.6],
    [  85,178.8], [  90,192.6], [  95,207.2], [ 100,222.5], [ 105,238.6],
    [ 110,255.5], [ 115,273.1], [ 120,291.6]
  ]
};

export default r454c;