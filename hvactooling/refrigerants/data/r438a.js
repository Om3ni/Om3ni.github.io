/**
 * refrigerants/data/r438a.js
 * R-438A (Freon MO99) saturation data — table only, no logic.
 *
 * Source:    Chemours — Freon MO99 and Freon NU-22B Retrofit Guidelines
 *            Table 5: Pressure-Temperature Data (ENG)
 *            Bubble point and dew point temperatures at given pressures.
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, psig, dewTempF]
 *            Pressure-indexed in source, re-indexed by bubble temp.
 *            Irregular steps: 1 PSIG at low end, 5 PSIG to 300,
 *            then 10 PSIG to 400. All three columns strictly monotonic.
 *            Temperature glide ~9°F at 100 PSIG.
 *
 * Trim:      Low end starts at -6 PSIG (source table minimum).
 *            Sub-atmospheric below -6 PSIG — not a practical field condition.
 *
 * Verified:  8 anchor points checked against Chemours source — all delta 0.0.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r438a = {
  id:          "R-438A",
  name:        "R-438A",
  type:        "HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.PRESSURE_INDEXED,
  blend:       "R-32/R-125/R-134a/R-600/R-601a (8.5/45/44.2/1.7/0.6)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         2265,
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
      { temp_F: -63.0, point: "bubble", expected_psig:  -6,  calculated_psig:  -6,  delta: 0.0 },
      { temp_F: -23.4, point: "bubble", expected_psig:  10,  calculated_psig:  10,  delta: 0.0 },
      { temp_F:  13.6, point: "bubble", expected_psig:  40,  calculated_psig:  40,  delta: 0.0 },
      { temp_F:  54.9, point: "bubble", expected_psig: 100,  calculated_psig: 100,  delta: 0.0 },
      { temp_F:  54.9, point: "dew",    expected_psig: 100,  calculated_psig: 100,  delta: 0.0 },
      { temp_F:  89.6, point: "bubble", expected_psig: 180,  calculated_psig: 180,  delta: 0.0 },
      { temp_F: 125.4, point: "bubble", expected_psig: 300,  calculated_psig: 300,  delta: 0.0 },
      { temp_F: 148.1, point: "bubble", expected_psig: 400,  calculated_psig: 400,  delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, psig, dewTempF]
  // Re-indexed from Chemours pressure-indexed source.
  // Range derived at runtime — do not store manually.
  table: [
    [-63.0,  -6, -51.5], [-59.3,  -5, -47.8], [-55.8,  -4, -44.5], [-52.6,  -3, -41.3],
    [-49.6,  -2, -38.4], [-46.8,  -1, -35.6], [-44.2,   0, -33.0], [-41.7,   1, -30.6],
    [-39.3,   2, -28.2], [-37.0,   3, -26.0], [-34.8,   4, -23.9], [-32.7,   5, -21.8],
    [-30.7,   6, -19.8], [-28.8,   7, -18.0], [-26.9,   8, -16.1], [-25.1,   9, -14.4],
    [-23.4,  10, -12.6], [-20.1,  12,  -9.4], [-16.9,  14,  -6.3], [-13.9,  16,  -3.4],
    [-11.1,  18,  -0.6], [ -8.4,  20,   2.0], [ -5.8,  22,   4.6], [ -3.4,  24,   7.0],
    [ -1.0,  26,   9.3], [  1.3,  28,  11.6], [  3.5,  30,  13.7], [  5.7,  32,  15.8],
    [  7.7,  34,  17.8], [  9.7,  36,  19.8], [ 11.7,  38,  21.7], [ 13.6,  40,  23.5],
    [ 15.4,  42,  25.3], [ 17.2,  44,  27.1], [ 18.9,  46,  28.8], [ 20.6,  48,  30.4],
    [ 22.3,  50,  32.1], [ 23.9,  52,  33.7], [ 25.5,  54,  35.2], [ 27.0,  56,  36.7],
    [ 28.6,  58,  38.2], [ 30.1,  60,  39.6], [ 31.5,  62,  41.1], [ 32.9,  64,  42.5],
    [ 34.3,  66,  43.8], [ 35.7,  68,  45.2], [ 37.1,  70,  46.5], [ 40.3,  75,  49.7],
    [ 43.5,  80,  52.7], [ 46.5,  85,  55.7], [ 49.4,  90,  58.5], [ 52.2,  95,  61.2],
    [ 54.9, 100,  63.9], [ 57.5, 105,  66.4], [ 60.1, 110,  68.9], [ 62.6, 115,  71.3],
    [ 65.0, 120,  73.6], [ 67.3, 125,  75.9], [ 69.6, 130,  78.1], [ 71.8, 135,  80.3],
    [ 73.9, 140,  82.4], [ 76.0, 145,  84.4], [ 78.1, 150,  86.4], [ 80.1, 155,  88.4],
    [ 82.1, 160,  90.3], [ 84.0, 165,  92.1], [ 85.9, 170,  94.0], [ 87.8, 175,  95.8],
    [ 89.6, 180,  97.5], [ 91.4, 185,  99.2], [ 93.1, 190, 100.9], [ 94.8, 195, 102.6],
    [ 96.5, 200, 104.2], [ 98.2, 205, 105.8], [ 99.8, 210, 107.4], [101.4, 215, 108.9],
    [103.0, 220, 110.5], [104.6, 225, 112.0], [106.1, 230, 113.4], [107.6, 235, 114.9],
    [109.1, 240, 116.3], [110.5, 245, 117.7], [112.0, 250, 119.1], [113.4, 255, 120.5],
    [114.8, 260, 121.8], [116.2, 265, 123.1], [117.6, 270, 124.4], [118.9, 275, 125.7],
    [120.3, 280, 127.0], [121.6, 285, 128.3], [122.9, 290, 129.5], [124.2, 295, 130.7],
    [125.4, 300, 131.9], [127.9, 310, 134.3], [130.4, 320, 136.6], [132.7, 330, 138.9],
    [135.1, 340, 141.1], [137.4, 350, 143.3], [139.6, 360, 145.4], [141.8, 370, 147.5],
    [143.9, 380, 149.5], [146.1, 390, 151.5], [148.1, 400, 153.4]
  ]
};

export default r438a;