/**
 * refrigerants/data/r450a.js
 * R-450A saturation data — table only, no logic.
 *
 * Source:    Emerson / Copeland — R-134a, R-450A, R-513A Pressure-Temperature Chart
 *            Document 2021ECT-19 (6/21)
 *            "Saturation Temperature (°F) vs Liquid/Vapor Pressure"
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *            2°F steps, -6°F to 150°F (79 rows).
 *
 *            Source sub-atmospheric range (-40°F to ~-8°F) shown in red as
 *            inches of Hg vacuum — omitted. Source data at -10°F and -8°F
 *            shows inconsistent liquid/vapor readings (near-zero and inverted)
 *            indicating mixed unit presentation at the atmospheric crossover.
 *            Table trimmed at -6°F, first row with consistent positive PSIG
 *            in both columns.
 *            Temperature glide: ~1.0 PSIG at 40°F, ~2.1 PSIG at 100°F.
 *
 * Verified:  8 anchor points checked against Emerson source — all delta 0.0.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r450a = {
  id:          "R-450A",
  name:        "R-450A",
  type:        "HFO/HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.TEMP_INDEXED,
  blend:       "R-1234ze(E)/R-134a (58/42)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         601,
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
    note: "Sub-atmospheric range omitted (source shows inHg vacuum). " +
          "Source rows at -10°F and -8°F show inconsistent readings at the " +
          "atmospheric crossover — omitted. Table starts at -6°F. " +
          "8 anchor points verified against Emerson source — all delta 0.0.",
    anchors: [
      { temp_F:   -6, point: "bubble", expected_psig:   1.53, calculated_psig:   1.53, delta: 0.0 },
      { temp_F:   -6, point: "dew",    expected_psig:   1.10, calculated_psig:   1.10, delta: 0.0 },
      { temp_F:    0, point: "bubble", expected_psig:   4.04, calculated_psig:   4.04, delta: 0.0 },
      { temp_F:   40, point: "bubble", expected_psig:  29.38, calculated_psig:  29.38, delta: 0.0 },
      { temp_F:   40, point: "dew",    expected_psig:  28.40, calculated_psig:  28.40, delta: 0.0 },
      { temp_F:  100, point: "bubble", expected_psig: 108.46, calculated_psig: 108.46, delta: 0.0 },
      { temp_F:  100, point: "dew",    expected_psig: 106.35, calculated_psig: 106.35, delta: 0.0 },
      { temp_F:  150, point: "bubble", expected_psig: 231.53, calculated_psig: 231.53, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, bubblePSIG, dewPSIG]
  // 2°F steps, -6°F to 150°F. Range derived at runtime.
  table: [
    [  -6,  1.53,  1.10], [  -4,  2.34,  1.89], [  -2,  3.17,  2.71], [   0,  4.04,  3.55],
    [   2,  4.94,  4.43], [   4,  5.87,  5.35], [   6,  6.84,  6.29], [   8,  7.84,  7.27],
    [  10,  8.88,  8.29], [  12,  9.95,  9.34], [  14, 11.07, 10.43], [  16, 12.22, 11.56],
    [  18, 13.41, 12.73], [  20, 14.64, 13.93], [  22, 15.91, 15.18], [  24, 17.23, 16.47],
    [  26, 18.58, 17.80], [  28, 19.99, 19.18], [  30, 21.43, 20.60], [  32, 22.93, 22.06],
    [  34, 24.47, 23.58], [  36, 26.05, 25.14], [  38, 27.69, 26.74], [  40, 29.38, 28.40],
    [  42, 31.12, 30.11], [  44, 32.91, 31.87], [  46, 34.75, 33.68], [  48, 36.65, 35.54],
    [  50, 38.60, 37.46], [  52, 40.61, 39.44], [  54, 42.67, 41.47], [  56, 44.80, 43.56],
    [  58, 46.98, 45.71], [  60, 49.22, 47.91], [  62, 51.53, 50.18], [  64, 53.90, 52.51],
    [  66, 56.33, 54.91], [  68, 58.82, 57.36], [  70, 61.38, 59.89], [  72, 64.01, 62.48],
    [  74, 66.71, 65.13], [  76, 69.47, 67.86], [  78, 72.31, 70.65], [  80, 75.21, 73.52],
    [  82, 78.19, 76.46], [  84, 81.25, 79.47], [  86, 84.37, 82.56], [  88, 87.58, 85.72],
    [  90, 90.86, 88.96], [  92, 94.22, 92.27], [  94, 97.66, 95.67], [  96,101.18, 99.15],
    [  98,104.78,102.71], [ 100,108.46,106.35], [ 102,112.23,110.07], [ 104,116.09,113.89],
    [ 106,120.03,117.78], [ 108,124.06,121.77], [ 110,128.19,125.85], [ 112,132.40,130.02],
    [ 114,136.70,134.28], [ 116,141.10,138.63], [ 118,145.59,143.08], [ 120,150.18,147.62],
    [ 122,154.87,152.26], [ 124,159.65,157.00], [ 126,164.54,161.85], [ 128,169.53,166.79],
    [ 130,174.62,171.84], [ 132,179.81,176.99], [ 134,185.11,182.25], [ 136,190.52,187.62],
    [ 138,196.04,193.09], [ 140,201.67,198.68], [ 142,207.41,204.38], [ 144,213.27,210.20],
    [ 146,219.23,216.13], [ 148,225.32,222.18], [ 150,231.53,228.34]
  ]
};

export default r450a;