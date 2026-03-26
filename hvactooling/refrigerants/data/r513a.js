/**
 * refrigerants/data/r513a.js
 * R-513A saturation data — table only, no logic.
 *
 * Source:    Emerson / Copeland — R-134a, R-450A, R-513A Pressure-Temperature Chart
 *            Document 2021ECT-19 (6/21)
 *            "Saturation Temperature (°F) vs Liquid/Vapor Pressure"
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *            2°F steps, -18°F to 150°F (85 rows).
 *
 *            Source includes sub-atmospheric range (-40°F to ~-20°F) shown
 *            in red as inches of Hg vacuum. Table trimmed at -18°F, the first
 *            row with positive PSIG in both columns.
 *
 *            Note: R-513A is near-azeotropic. Temperature glide is
 *            <0.1 PSIG across the entire range — effectively single-pressure
 *            for field use. Stored as zeotropic for schema correctness.
 *
 * Verified:  8 anchor points checked against Emerson source — all delta 0.0.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r513a = {
  id:          "R-513A",
  name:        "R-513A",
  type:        "HFO/HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.TEMP_INDEXED,
  blend:       "R-1234yf/R-134a (56/44)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         631,
  source:      "Emerson / Copeland — R-134a, R-450A, R-513A PT Chart (2021ECT-19)",
  source_url:  "https://webapps.copeland.com/online-product-information/Publication/LaunchPDF?Index=AEB&PDF=2021ECT-19",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Sub-atmospheric range (-40°F to -20°F) shown as inHg vacuum in source — " +
          "omitted. Table starts at -18°F (1.23 PSIG). Near-azeotropic: " +
          "bubble/dew glide <0.1 PSIG throughout. 8 anchor points verified — all delta 0.0.",
    anchors: [
      { temp_F:  -18, point: "bubble", expected_psig:   1.23, calculated_psig:   1.23, delta: 0.0 },
      { temp_F:    0, point: "bubble", expected_psig:   9.58, calculated_psig:   9.58, delta: 0.0 },
      { temp_F:    0, point: "dew",    expected_psig:   9.52, calculated_psig:   9.52, delta: 0.0 },
      { temp_F:   40, point: "bubble", expected_psig:  40.14, calculated_psig:  40.14, delta: 0.0 },
      { temp_F:   40, point: "dew",    expected_psig:  40.11, calculated_psig:  40.11, delta: 0.0 },
      { temp_F:  100, point: "bubble", expected_psig: 132.12, calculated_psig: 132.12, delta: 0.0 },
      { temp_F:  100, point: "dew",    expected_psig: 132.11, calculated_psig: 132.11, delta: 0.0 },
      { temp_F:  150, point: "bubble", expected_psig: 271.92, calculated_psig: 271.92, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, bubblePSIG, dewPSIG]
  // 2°F steps, -18°F to 150°F. Range derived at runtime.
  table: [
    [ -18,  1.23,  1.16], [ -16,  2.02,  1.96], [ -14,  2.85,  2.78], [ -12,  3.71,  3.64],
    [ -10,  4.60,  4.54], [  -8,  5.53,  5.46], [  -6,  6.48,  6.42], [  -4,  7.48,  7.42],
    [  -2,  8.51,  8.45], [   0,  9.58,  9.52], [   2, 10.68, 10.63], [   4, 11.83, 11.77],
    [   6, 13.01, 12.96], [   8, 14.24, 14.18], [  10, 15.50, 15.45], [  12, 16.81, 16.76],
    [  14, 18.17, 18.12], [  16, 19.56, 19.51], [  18, 21.00, 20.96], [  20, 22.49, 22.45],
    [  22, 24.03, 23.98], [  24, 25.61, 25.57], [  26, 27.24, 27.21], [  28, 28.93, 28.89],
    [  30, 30.66, 30.63], [  32, 32.45, 32.42], [  34, 34.29, 34.26], [  36, 36.18, 36.15],
    [  38, 38.13, 38.11], [  40, 40.14, 40.11], [  42, 42.20, 42.18], [  44, 44.33, 44.30],
    [  46, 46.51, 46.49], [  48, 48.75, 48.73], [  50, 51.06, 51.04], [  52, 53.42, 53.41],
    [  54, 55.86, 55.84], [  56, 58.35, 58.34], [  58, 60.92, 60.90], [  60, 63.55, 63.54],
    [  62, 66.24, 66.24], [  64, 69.01, 69.01], [  66, 71.85, 71.85], [  68, 74.76, 74.76],
    [  70, 77.75, 77.74], [  72, 80.81, 80.80], [  74, 83.94, 83.94], [  76, 87.15, 87.15],
    [  78, 90.44, 90.44], [  80, 93.81, 93.81], [  82, 97.26, 97.26], [  84,100.79,100.79],
    [  86,104.40,104.40], [  88,108.10,108.10], [  90,111.88,111.88], [  92,115.75,115.75],
    [  94,119.70,119.70], [  96,123.75,123.75], [  98,127.89,127.88], [ 100,132.12,132.11],
    [ 102,136.44,136.43], [ 104,140.85,140.85], [ 106,145.37,145.36], [ 108,149.98,149.97],
    [ 110,154.68,154.67], [ 112,159.49,159.48], [ 114,164.40,164.39], [ 116,169.42,169.40],
    [ 118,174.53,174.51], [ 120,179.76,179.74], [ 122,185.09,185.06], [ 124,190.53,190.50],
    [ 126,196.08,196.05], [ 128,201.74,201.71], [ 130,207.52,207.48], [ 132,213.41,213.37],
    [ 134,219.42,219.38], [ 136,225.55,225.50], [ 138,231.80,231.75], [ 140,238.17,238.11],
    [ 142,244.67,244.60], [ 144,251.29,251.22], [ 146,258.04,257.96], [ 148,264.91,264.84],
    [ 150,271.92,271.84]
  ]
};

export default r513a;