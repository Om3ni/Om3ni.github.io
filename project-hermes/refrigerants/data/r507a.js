/**
 * refrigerants/data/r507a.js
 * R-507A saturation data — table only, no logic.
 *
 * Source:    Manufacturer saturation property table — 1°F step data
 *            Vapor (dew point) column used as canonical pressure.
 *
 * Table:     Single pressure column — 1°F steps, -49°F to 150°F (200 rows).
 *
 *            R-507A is a near-azeotropic blend. Max liquid/vapor pressure
 *            glide is 0.3 PSIG across the entire -49°F to 150°F range —
 *            within field gauge accuracy. Both columns validated monotonic.
 *            Treated as TABLE_TYPE.SINGLE for engine simplicity.
 *
 * Verified:  5 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE } from "../core/types.js";

const r507a = {
  id:          "R-507A",
  name:        "R-507A",
  type:        "HFC blend",
  tableType:   TABLE_TYPE.SINGLE,
  blend:       "R-125/R-143a (50/50)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         3985,
  source:      "Manufacturer saturation property table — 1°F step data",
  source_url:  null,

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.1,
    formula_recomputed: false,
    note: "Vapor/dew column used as canonical pressure value. Near-azeotrope — " +
          "max liquid/vapor glide is 0.3 PSIG across full range, within field " +
          "gauge accuracy. Both columns clean and strictly monotonic. " +
          "5 anchor points verified against source — all delta 0.0.",
    anchors: [
      { temp_F:  -49, expected_psig:   1.3, calculated_psig:   1.3, delta: 0.0 },
      { temp_F:    1, expected_psig:  35.8, calculated_psig:  35.8, delta: 0.0 },
      { temp_F:   51, expected_psig: 109.9, calculated_psig: 109.9, delta: 0.0 },
      { temp_F:  101, expected_psig: 245.6, calculated_psig: 245.6, delta: 0.0 },
      { temp_F:  150, expected_psig: 467.2, calculated_psig: 467.2, delta: 0.0 }
    ]
  },

  // Canonical table — [tempF, psig], 1°F steps, -49°F to 150°F
  // Dew point (vapor) pressure column. Range derived at runtime.
  table: [
    [ -49,  1.3], [ -48,  1.7], [ -47,  2.1], [ -46,  2.6], [ -45,  3.0],
    [ -44,  3.5], [ -43,  4.0], [ -42,  4.4], [ -41,  4.9], [ -40,  5.4],
    [ -39,  5.9], [ -38,  6.4], [ -37,  7.0], [ -36,  7.5], [ -35,  8.1],
    [ -34,  8.6], [ -33,  9.2], [ -32,  9.8], [ -31, 10.4], [ -30, 11.0],
    [ -29, 11.6], [ -28, 12.2], [ -27, 12.8], [ -26, 13.5], [ -25, 14.1],
    [ -24, 14.8], [ -23, 15.5], [ -22, 16.2], [ -21, 16.9], [ -20, 17.6],
    [ -19, 18.3], [ -18, 19.1], [ -17, 19.8], [ -16, 20.6], [ -15, 21.4],
    [ -14, 22.2], [ -13, 23.0], [ -12, 23.8], [ -11, 24.7], [ -10, 25.5],
    [  -9, 26.4], [  -8, 27.2], [  -7, 28.1], [  -6, 29.0], [  -5, 30.0],
    [  -4, 30.9], [  -3, 31.9], [  -2, 32.8], [  -1, 33.8], [   0, 34.8],
    [   1, 35.8], [   2, 36.8], [   3, 37.9], [   4, 38.9], [   5, 40.0],
    [   6, 41.1], [   7, 42.2], [   8, 43.4], [   9, 44.5], [  10, 45.7],
    [  11, 46.8], [  12, 48.0], [  13, 49.2], [  14, 50.5], [  15, 51.7],
    [  16, 53.0], [  17, 54.3], [  18, 55.6], [  19, 56.9], [  20, 58.2],
    [  21, 59.6], [  22, 61.0], [  23, 62.4], [  24, 63.8], [  25, 65.2],
    [  26, 66.7], [  27, 68.1], [  28, 69.6], [  29, 71.1], [  30, 72.7],
    [  31, 74.2], [  32, 75.8], [  33, 77.4], [  34, 79.0], [  35, 80.7],
    [  36, 82.3], [  37, 84.0], [  38, 85.7], [  39, 87.4], [  40, 89.2],
    [  41, 90.9], [  42, 92.7], [  43, 94.6], [  44, 96.4], [  45, 98.3],
    [  46,100.1], [  47,102.0], [  48,104.0], [  49,105.9], [  50,107.9],
    [  51,109.9], [  52,111.9], [  53,114.0], [  54,116.1], [  55,118.2],
    [  56,120.3], [  57,122.5], [  58,124.6], [  59,126.8], [  60,129.1],
    [  61,131.3], [  62,133.6], [  63,135.9], [  64,138.3], [  65,140.6],
    [  66,143.0], [  67,145.4], [  68,147.9], [  69,150.4], [  70,152.9],
    [  71,155.4], [  72,157.9], [  73,160.5], [  74,163.1], [  75,165.8],
    [  76,168.5], [  77,171.2], [  78,173.9], [  79,176.7], [  80,179.5],
    [  81,182.3], [  82,185.1], [  83,188.0], [  84,191.0], [  85,193.9],
    [  86,196.9], [  87,199.9], [  88,202.9], [  89,206.0], [  90,209.1],
    [  91,212.3], [  92,215.4], [  93,218.7], [  94,221.9], [  95,225.2],
    [  96,228.5], [  97,231.8], [  98,235.2], [  99,238.6], [ 100,242.1],
    [ 101,245.6], [ 102,249.1], [ 103,252.6], [ 104,256.2], [ 105,259.9],
    [ 106,263.5], [ 107,267.2], [ 108,271.0], [ 109,274.8], [ 110,278.6],
    [ 111,282.4], [ 112,286.3], [ 113,290.3], [ 114,294.2], [ 115,298.3],
    [ 116,302.3], [ 117,306.4], [ 118,310.5], [ 119,314.7], [ 120,318.9],
    [ 121,323.2], [ 122,327.5], [ 123,331.8], [ 124,336.2], [ 125,340.7],
    [ 126,345.1], [ 127,349.7], [ 128,354.2], [ 129,358.8], [ 130,363.5],
    [ 131,368.2], [ 132,372.9], [ 133,377.7], [ 134,382.6], [ 135,387.5],
    [ 136,392.4], [ 137,397.4], [ 138,402.5], [ 139,407.5], [ 140,412.7],
    [ 141,417.9], [ 142,423.1], [ 143,428.4], [ 144,433.8], [ 145,439.2],
    [ 146,444.7], [ 147,450.2], [ 148,455.8], [ 149,461.5], [ 150,467.2]
  ]
};

export default r507a;