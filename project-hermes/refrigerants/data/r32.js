/**
 * refrigerants/data/r32.js
 * R-32 saturation data — table only, no logic.
 *
 * Source:    Daikin Comfort Technologies / Weitron
 *            "A2L Pressure-Temperature Chart" — PM-A2LPTC-USA_04-24
 *            April 2024
 *
 * Table:     Single pressure column (pure refrigerant).
 *            2°F steps from -38°F to 100°F, 5°F steps from 100°F to 150°F.
 *            All values strictly monotonic.
 *
 * Verified:  8 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE } from "../core/types.js";

const r32 = {
  id:          "R-32",
  name:        "R-32",
  type:        "HFC",
  tableType:   TABLE_TYPE.SINGLE,
  blend:       null,
  safetyClass: SAFETY_CLASS.A2L,
  flammable:   true,
  gwp:         675,
  source:      "Daikin / Weitron — A2L Pressure-Temperature Chart (PM-A2LPTC-USA_04-24)",
  source_url:  "https://cms.hvaclearningcampus.com/docs/default-source/default-document-library/pm-a2lptc-usa_04-24.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "2°F steps -38°F to 100°F, 5°F steps 100°F to 150°F. " +
          "8 anchor points verified against Daikin/Weitron source — all delta 0.0.",
    anchors: [
      { temp_F:  -38, expected_psig:  12.4, calculated_psig:  12.4, delta: 0.0 },
      { temp_F:  -20, expected_psig:  26.8, calculated_psig:  26.8, delta: 0.0 },
      { temp_F:    0, expected_psig:  49.2, calculated_psig:  49.2, delta: 0.0 },
      { temp_F:   20, expected_psig:  80.0, calculated_psig:  80.0, delta: 0.0 },
      { temp_F:   40, expected_psig: 121.0, calculated_psig: 121.0, delta: 0.0 },
      { temp_F:   70, expected_psig: 205.8, calculated_psig: 205.8, delta: 0.0 },
      { temp_F:  100, expected_psig: 325.7, calculated_psig: 325.7, delta: 0.0 },
      { temp_F:  150, expected_psig: 628.8, calculated_psig: 628.8, delta: 0.0 }
    ]
  },

  // Canonical table — [tempF, psig]
  // 2°F steps to 100°F, 5°F steps above. Range derived at runtime.
  table: [
    [ -38, 12.4], [ -36, 13.7], [ -34, 15.2], [ -32, 16.6], [ -30, 18.2],
    [ -28, 19.8], [ -26, 21.4], [ -24, 23.2], [ -22, 25.0], [ -20, 26.8],
    [ -18, 28.7], [ -16, 30.7], [ -14, 32.8], [ -12, 34.9], [ -10, 37.1],
    [  -8, 39.4], [  -6, 41.7], [  -4, 44.1], [  -2, 46.7], [   0, 49.2],
    [   2, 51.9], [   4, 54.7], [   6, 57.5], [   8, 60.5], [  10, 63.5],
    [  12, 66.6], [  14, 69.8], [  16, 73.1], [  18, 76.5], [  20, 80.0],
    [  22, 83.6], [  24, 87.3], [  26, 91.1], [  28, 95.1], [  30, 99.1],
    [  32,103.2], [  34,107.5], [  36,111.8], [  38,116.3], [  40,121.0],
    [  42,125.7], [  44,130.5], [  46,135.5], [  48,140.6], [  50,145.8],
    [  52,151.2], [  54,156.7], [  56,162.4], [  58,168.1], [  60,174.0],
    [  62,180.1], [  64,186.3], [  66,192.7], [  68,199.2], [  70,205.8],
    [  72,212.6], [  74,219.6], [  76,226.7], [  78,234.0], [  80,241.5],
    [  82,249.1], [  84,256.9], [  86,264.9], [  88,273.0], [  90,281.3],
    [  92,289.8], [  94,298.5], [  96,307.4], [  98,316.4], [ 100,325.7],
    [ 105,349.6], [ 110,374.9], [ 115,401.4], [ 120,429.3], [ 125,458.7],
    [ 130,489.5], [ 135,521.8], [ 140,555.8], [ 145,591.4], [ 150,628.8]
  ]
};

export default r32;