/**
 * refrigerants/data/r448a.js
 * R-448A (Solstice N40) saturation data — table only, no logic.
 *
 * Source:    Honeywell — Solstice N40 (R-448A) Technical Data Sheet
 *            Document 3820, September 2019
 *            https://www.fsw.uk.com/wp-content/uploads/2023/12/r448a-n40-pt-chart.pdf
 *            Page 2 — Pressure and Temperature table
 *
 * Table:     Pressure-indexed in source (PSIG → bubble/dew °F).
 *            Re-indexed here by bubble temp for engine compatibility.
 *            Rows: [bubbleTempF, psig, dewTempF]
 *            Irregular pressure steps — 1 PSIG at low end, widening at
 *            high end. All three columns strictly monotonic.
 *
 * Note:      Two adjacent rows at 348/349 PSIG are both present in the
 *            Honeywell source table and retained here.
 *
 * Verified:  8 anchor points checked against source table — all delta 0.0.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r448a = {
  id:          "R-448A",
  name:        "R-448A",
  type:        "HFO/HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.PRESSURE_INDEXED,
  blend:       "R-32/R-125/R-134a/R-1234ze(E)/R-1234yf (26/26/21/7/20)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         1387,
  source:      "Honeywell Solstice N40 (R-448A) Technical Data Sheet — Document 3820",
  source_url:  "https://www.fsw.uk.com/wp-content/uploads/2023/12/r448a-n40-pt-chart.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Pressure-indexed source table re-indexed by bubble temp. " +
          "8 anchor points checked against Honeywell source — all delta 0.0. " +
          "Adjacent rows at 348/349 PSIG retained as published.",
    anchors: [
      { temp_F:  -51.0, point: "bubble", expected_psig:   0.0, calculated_psig:   0.0, delta: 0.0 },
      { temp_F:  -30.6, point: "bubble", expected_psig:  10.0, calculated_psig:  10.0, delta: 0.0 },
      { temp_F:    5.5, point: "bubble", expected_psig:  40.0, calculated_psig:  40.0, delta: 0.0 },
      { temp_F:   46.5, point: "bubble", expected_psig: 101.0, calculated_psig: 101.0, delta: 0.0 },
      { temp_F:   80.2, point: "bubble", expected_psig: 181.0, calculated_psig: 181.0, delta: 0.0 },
      { temp_F:  115.9, point: "bubble", expected_psig: 304.0, calculated_psig: 304.0, delta: 0.0 },
      { temp_F:  136.6, point: "bubble", expected_psig: 397.0, calculated_psig: 397.0, delta: 0.0 },
      { temp_F:  146.9, point: "bubble", expected_psig: 450.0, calculated_psig: 450.0, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, psig, dewTempF]
  // Re-indexed from Honeywell pressure-indexed source.
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [-51.0,   0.0, -39.9],
    [-48.6,   1.0, -37.5],
    [-46.2,   2.0, -35.2],
    [-44.0,   3.0, -32.9],
    [-41.9,   4.0, -30.8],
    [-39.8,   5.0, -28.8],
    [-37.8,   6.0, -26.9],
    [-35.9,   7.0, -25.0],
    [-34.1,   8.0, -23.2],
    [-32.4,   9.0, -21.4],
    [-30.6,  10.0, -19.7],
    [-29.0,  11.0, -18.1],
    [-27.4,  12.0, -16.5],
    [-25.8,  13.0, -15.0],
    [-24.3,  14.0, -13.5],
    [-21.4,  16.0, -10.6],
    [-18.6,  18.0,  -7.8],
    [-16.0,  20.0,  -5.2],
    [-13.5,  22.0,  -2.7],
    [-11.0,  24.0,  -0.3],
    [ -8.7,  26.0,   2.0],
    [ -6.5,  28.0,   4.2],
    [ -5.4,  29.0,   5.3],
    [ -3.3,  31.0,   7.4],
    [ -0.2,  34.0,  10.4],
    [  2.7,  37.0,  13.3],
    [  5.5,  40.0,  16.0],
    [  8.2,  43.0,  18.7],
    [ 10.8,  46.0,  21.2],
    [ 13.2,  49.0,  23.7],
    [ 15.6,  52.0,  26.0],
    [ 17.9,  55.0,  28.3],
    [ 20.9,  59.0,  31.2],
    [ 23.8,  63.0,  34.0],
    [ 26.5,  67.0,  36.7],
    [ 36.5,  83.0,  46.6],
    [ 46.5, 101.0,  56.3],
    [ 56.2, 121.0,  65.9],
    [ 65.4, 142.0,  74.9],
    [ 70.2, 154.0,  79.6],
    [ 75.1, 167.0,  84.4],
    [ 80.2, 181.0,  89.3],
    [ 85.3, 196.0,  94.3],
    [ 90.5, 212.0,  99.3],
    [ 95.7, 229.0, 104.3],
    [100.7, 246.0, 109.1],
    [105.6, 264.0, 113.9],
    [110.9, 284.0, 119.0],
    [115.9, 304.0, 123.8],
    [121.0, 325.0, 128.6],
    [126.2, 348.0, 133.6],
    [126.4, 349.0, 133.8],
    [131.4, 372.0, 138.5],
    [136.6, 397.0, 143.4],
    [141.8, 423.0, 148.3],
    [146.9, 450.0, 153.0]
  ]
};

export default r448a;