/**
 * refrigerants/data/r454b.js
 * R-454B saturation data — table only, no logic.
 *
 * Source:    Daikin Comfort Technologies / Weitron
 *            "A2L Pressure-Temperature Chart" — PM-A2LPTC-USA_04-24
 *            April 2024
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *            2°F steps from -38°F to 100°F, 5°F steps from 100°F to 150°F.
 *
 *            Source columns labeled "Liquid Pressure" and "Vapor Pressure".
 *            Convention is inverted from bubble/dew naming:
 *              Source "Vapor Pressure" (lower) = bubble point
 *              Source "Liquid Pressure" (higher) = dew point
 *            Temperature glide: ~5.6 PSIG at 40°F, ~12 PSIG at 100°F.
 *
 * Verified:  8 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r454b = {
  id:          "R-454B",
  name:        "R-454B",
  type:        "HFO/HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.TEMP_INDEXED,
  blend:       "R-32/R-1234yf (68.9/31.1)",
  safetyClass: SAFETY_CLASS.A2L,
  flammable:   true,
  gwp:         466,
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
    note: "Source columns 'Liquid Pressure' (higher) = dew point, " +
          "'Vapor Pressure' (lower) = bubble point — convention is inverted " +
          "from common naming. Columns swapped on import. " +
          "2°F steps -38°F to 100°F, 5°F steps 100°F to 150°F. " +
          "8 anchor points verified against source — all delta 0.0.",
    anchors: [
      { temp_F:  -38, point: "bubble", expected_psig:  10.0, calculated_psig:  10.0, delta: 0.0 },
      { temp_F:  -38, point: "dew",    expected_psig:  11.2, calculated_psig:  11.2, delta: 0.0 },
      { temp_F:    0, point: "bubble", expected_psig:  43.3, calculated_psig:  43.3, delta: 0.0 },
      { temp_F:    0, point: "dew",    expected_psig:  46.1, calculated_psig:  46.1, delta: 0.0 },
      { temp_F:   40, point: "bubble", expected_psig: 107.7, calculated_psig: 107.7, delta: 0.0 },
      { temp_F:   40, point: "dew",    expected_psig: 113.3, calculated_psig: 113.3, delta: 0.0 },
      { temp_F:  100, point: "bubble", expected_psig: 291.6, calculated_psig: 291.6, delta: 0.0 },
      { temp_F:  150, point: "bubble", expected_psig: 568.2, calculated_psig: 568.2, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, bubblePSIG, dewPSIG]
  // 2°F steps to 100°F, 5°F steps above. Range derived at runtime.
  table: [
    [ -38, 10.0, 11.2], [ -36, 11.2, 12.5], [ -34, 12.5, 13.8], [ -32, 13.9, 15.3], [ -30, 15.3, 16.7],
    [ -28, 16.7, 18.2], [ -26, 18.2, 19.8], [ -24, 19.8, 21.4], [ -22, 21.4, 23.1], [ -20, 23.0, 24.9],
    [ -18, 24.8, 26.7], [ -16, 26.6, 28.6], [ -14, 28.4, 30.5], [ -12, 30.3, 32.5], [ -10, 32.3, 34.6],
    [  -8, 34.4, 36.7], [  -6, 36.5, 39.0], [  -4, 38.7, 41.2], [  -2, 40.9, 43.6], [   0, 43.3, 46.1],
    [   2, 45.7, 48.6], [   4, 48.1, 51.2], [   6, 50.7, 53.8], [   8, 53.3, 56.6], [  10, 56.1, 59.5],
    [  12, 58.9, 62.4], [  14, 61.8, 65.4], [  16, 64.7, 68.5], [  18, 67.8, 71.7], [  20, 70.9, 75.0],
    [  22, 74.2, 78.4], [  24, 77.5, 81.8], [  26, 80.9, 85.4], [  28, 84.4, 89.1], [  30, 88.1, 92.9],
    [  32, 91.8, 96.8], [  34, 95.6,100.7], [  36, 99.5,104.8], [  38,103.6,109.0], [  40,107.7,113.3],
    [  42,112.0,117.8], [  44,116.3,122.3], [  46,120.8,126.9], [  48,125.4,131.7], [  50,130.1,136.6],
    [  52,134.9,141.6], [  54,139.8,146.7], [  56,144.9,152.0], [  58,150.1,157.4], [  60,155.4,162.9],
    [  62,160.8,168.6], [  64,166.4,174.3], [  66,172.1,180.2], [  68,178.0,186.3], [  70,184.0,192.5],
    [  72,190.1,198.8], [  74,196.4,205.3], [  76,202.8,211.9], [  78,209.3,218.7], [  80,216.1,225.6],
    [  82,222.9,232.7], [  84,229.9,239.9], [  86,237.1,247.3], [  88,244.4,254.8], [  90,251.9,262.5],
    [  92,259.6,270.4], [  94,267.4,278.4], [  96,275.4,286.6], [  98,283.6,295.0], [ 100,291.6,303.6],
    [ 105,313.6,325.7], [ 110,336.4,348.9], [ 115,360.5,373.4], [ 120,385.8,399.1], [ 125,412.4,426.0],
    [ 130,440.5,454.2], [ 135,470.0,483.8], [ 140,501.0,514.9], [ 145,533.7,547.3], [ 150,568.2,581.4]
  ]
};

export default r454b;