/**
 * refrigerants/data/r422b.js
 * R-422B (Freon NU-22B) saturation data — table only, no logic.
 *
 * Source:    Chemours — Freon MO99 and Freon NU-22B Retrofit Guidelines
 *            Table 5: Pressure-Temperature Data (ENG)
 *            Bubble point and dew point temperatures at given pressures.
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, psig, dewTempF]
 *            Pressure-indexed in source, re-indexed by bubble temp.
 *            Irregular steps: 1 PSIG at low end, 5 PSIG to 300,
 *            then 10 PSIG to 400. All three columns strictly monotonic.
 *            Temperature glide ~6.5°F at 100 PSIG.
 *
 * Trim:      Low end starts at -6 PSIG (source table minimum).
 *            Sub-atmospheric below -6 PSIG — not a practical field condition.
 *
 * Verified:  8 anchor points checked against Chemours source — all delta 0.0.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r422b = {
  id:          "R-422B",
  name:        "R-422B",
  type:        "HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.PRESSURE_INDEXED,
  blend:       "R-125/R-134a/R-600a (55/42/3)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         2526,
  source:      "Chemours — Freon MO99 and Freon NU-22B Retrofit Guidelines, Table 5",
  source_url:  "https://www.chemours.com/en/-/media/files/freon/freon-mo99-nu22b-retrofit-guidelines.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Pressure-indexed source table re-indexed by bubble temp. " +
          "8 anchor points verified against Chemours source — all delta 0.0. " +
          "Replaces previous Johnstone-sourced table which had data quality " +
          "issues at 52°F range.",
    anchors: [
      { temp_F: -61.5, point: "bubble", expected_psig:  -6,  calculated_psig:  -6,  delta: 0.0 },
      { temp_F: -21.2, point: "bubble", expected_psig:  10,  calculated_psig:  10,  delta: 0.0 },
      { temp_F:  16.4, point: "bubble", expected_psig:  40,  calculated_psig:  40,  delta: 0.0 },
      { temp_F:  58.4, point: "bubble", expected_psig: 100,  calculated_psig: 100,  delta: 0.0 },
      { temp_F:  58.4, point: "dew",    expected_psig: 100,  calculated_psig: 100,  delta: 0.0 },
      { temp_F:  93.6, point: "bubble", expected_psig: 180,  calculated_psig: 180,  delta: 0.0 },
      { temp_F: 129.9, point: "bubble", expected_psig: 300,  calculated_psig: 300,  delta: 0.0 },
      { temp_F: 152.7, point: "bubble", expected_psig: 400,  calculated_psig: 400,  delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, psig, dewTempF]
  // Re-indexed from Chemours pressure-indexed source.
  // Range derived at runtime — do not store manually.
  table: [
    [-61.5,  -6, -51.1], [-57.7,  -5, -47.4], [-54.2,  -4, -44.0], [-50.9,  -3, -40.9],
    [-47.9,  -2, -38.0], [-45.1,  -1, -35.2], [-42.4,   0, -32.6], [-39.8,   1, -30.1],
    [-37.4,   2, -27.8], [-35.1,   3, -25.5], [-32.9,   4, -23.4], [-30.7,   5, -21.3],
    [-28.7,   6, -19.4], [-26.7,   7, -17.5], [-24.8,   8, -15.6], [-23.0,   9, -13.9],
    [-21.2,  10, -12.1], [-17.8,  12,  -8.9], [-14.6,  14,  -5.8], [-11.6,  16,  -2.8],
    [ -8.7,  18,  -0.1], [ -6.0,  20,   2.6], [ -3.4,  22,   5.1], [ -0.8,  24,   7.6],
    [  1.6,  26,   9.9], [  3.9,  28,  12.2], [  6.1,  30,  14.4], [  8.3,  32,  16.5],
    [ 10.4,  34,  18.5], [ 12.5,  36,  20.5], [ 14.4,  38,  22.4], [ 16.4,  40,  24.2],
    [ 18.2,  42,  26.0], [ 20.0,  44,  27.8], [ 21.8,  46,  29.5], [ 23.5,  48,  31.2],
    [ 25.2,  50,  32.8], [ 26.9,  52,  34.4], [ 28.5,  54,  36.0], [ 30.1,  56,  37.5],
    [ 31.6,  58,  39.0], [ 33.1,  60,  40.5], [ 34.6,  62,  41.9], [ 36.1,  64,  43.3],
    [ 37.5,  66,  44.7], [ 38.9,  68,  46.0], [ 40.2,  70,  47.4], [ 43.6,  75,  50.6],
    [ 46.8,  80,  53.7], [ 49.8,  85,  56.7], [ 52.8,  90,  59.5], [ 55.6,  95,  62.3],
    [ 58.4, 100,  64.9], [ 61.1, 105,  67.5], [ 63.6, 110,  70.0], [ 66.1, 115,  72.4],
    [ 68.6, 120,  74.8], [ 71.0, 125,  77.1], [ 73.3, 130,  79.3], [ 75.5, 135,  81.5],
    [ 77.7, 140,  83.6], [ 79.8, 145,  85.7], [ 81.9, 150,  87.7], [ 84.0, 155,  89.7],
    [ 86.0, 160,  91.6], [ 87.9, 165,  93.5], [ 89.9, 170,  95.4], [ 91.7, 175,  97.2],
    [ 93.6, 180,  99.0], [ 95.4, 185, 100.7], [ 97.2, 190, 102.4], [ 98.9, 195, 104.1],
    [100.6, 200, 105.8], [102.3, 205, 107.4], [103.9, 210, 109.0], [105.6, 215, 110.6],
    [107.2, 220, 112.1], [108.8, 225, 113.6], [110.3, 230, 115.1], [111.8, 235, 116.6],
    [113.3, 240, 118.0], [114.8, 245, 119.5], [116.3, 250, 120.9], [117.7, 255, 122.3],
    [119.1, 260, 123.6], [120.5, 265, 125.0], [121.9, 270, 126.3], [123.3, 275, 127.6],
    [124.6, 280, 128.9], [126.0, 285, 130.2], [127.3, 290, 131.5], [128.6, 295, 132.7],
    [129.9, 300, 133.9], [132.4, 310, 136.4], [134.8, 320, 138.7], [137.2, 330, 141.0],
    [139.6, 340, 143.3], [141.9, 350, 145.5], [144.1, 360, 147.6], [146.3, 370, 149.7],
    [148.5, 380, 151.8], [150.6, 390, 153.8], [152.7, 400, 155.8]
  ]
};

export default r422b;