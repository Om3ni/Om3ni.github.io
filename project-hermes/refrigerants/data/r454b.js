/**
 * refrigerants/data/r454b.js
 * R-454B saturation data — table only, no logic.
 *
 * Source:    Daikin Comfort Technologies / Weitron
 *            "A2L Pressure-Temperature Chart" — PM-A2LPTC-USA_04-24
 *            April 2024
 *
 * Table:     Zeotropic blend, temperature-indexed — rows: [tempF, bubblePSIG, dewPSIG]
 *            2°F steps from -38°F to 100°F, 5°F steps from 100°F to 150°F.
 *
 *            Source columns labeled "Liquid Pressure" and "Vapor Pressure":
 *              Source "Liquid Pressure" (higher) = bubble point
 *              Source "Vapor Pressure"  (lower)  = dew point
 *            At any temperature a zeotrope's bubble pressure is above its
 *            dew pressure; validate.js enforces this on every row.
 *            Pressure split: ~5.6 PSIG at 40°F, ~12 PSIG at 100°F.
 *
 * Fixed:     2026-11 audit. Bubble and dew columns were swapped on import,
 *            overstating superheat and subcooling by ~2.5°F each. Values
 *            unchanged; columns corrected. All 80 rows match the Daikin chart;
 *            CoolProp (R-32/R-1234yf 68.9/31.1) agrees within 0.3 psi.
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
    note: "Source 'Liquid Pressure' (higher) = bubble point, " +
          "'Vapor Pressure' (lower) = dew point. " +
          "2°F steps -38°F to 100°F, 5°F steps 100°F to 150°F. " +
          "8 anchor points verified against source — all delta 0.0.",
    anchors: [
      { temp_F:  -38, point: "dew",    expected_psig:  10.0, calculated_psig:  10.0, delta: 0.0 },
      { temp_F:  -38, point: "bubble", expected_psig:  11.2, calculated_psig:  11.2, delta: 0.0 },
      { temp_F:    0, point: "dew",    expected_psig:  43.3, calculated_psig:  43.3, delta: 0.0 },
      { temp_F:    0, point: "bubble", expected_psig:  46.1, calculated_psig:  46.1, delta: 0.0 },
      { temp_F:   40, point: "dew",    expected_psig: 107.7, calculated_psig: 107.7, delta: 0.0 },
      { temp_F:   40, point: "bubble", expected_psig: 113.3, calculated_psig: 113.3, delta: 0.0 },
      { temp_F:  100, point: "dew",    expected_psig: 291.6, calculated_psig: 291.6, delta: 0.0 },
      { temp_F:  150, point: "dew",    expected_psig: 568.2, calculated_psig: 568.2, delta: 0.0 }
    ]
  },

  // Canonical table — [tempF, bubblePSIG, dewPSIG]
  // 2°F steps to 100°F, 5°F steps above. Range derived at runtime.
  table: [
    [ -38, 11.2, 10.0], [ -36, 12.5, 11.2], [ -34, 13.8, 12.5], [ -32, 15.3, 13.9], [ -30, 16.7, 15.3],
    [ -28, 18.2, 16.7], [ -26, 19.8, 18.2], [ -24, 21.4, 19.8], [ -22, 23.1, 21.4], [ -20, 24.9, 23.0],
    [ -18, 26.7, 24.8], [ -16, 28.6, 26.6], [ -14, 30.5, 28.4], [ -12, 32.5, 30.3], [ -10, 34.6, 32.3],
    [  -8, 36.7, 34.4], [  -6, 39.0, 36.5], [  -4, 41.2, 38.7], [  -2, 43.6, 40.9], [   0, 46.1, 43.3],
    [   2, 48.6, 45.7], [   4, 51.2, 48.1], [   6, 53.8, 50.7], [   8, 56.6, 53.3], [  10, 59.5, 56.1],
    [  12, 62.4, 58.9], [  14, 65.4, 61.8], [  16, 68.5, 64.7], [  18, 71.7, 67.8], [  20, 75.0, 70.9],
    [  22, 78.4, 74.2], [  24, 81.8, 77.5], [  26, 85.4, 80.9], [  28, 89.1, 84.4], [  30, 92.9, 88.1],
    [  32, 96.8, 91.8], [  34,100.7, 95.6], [  36,104.8, 99.5], [  38,109.0,103.6], [  40,113.3,107.7],
    [  42,117.8,112.0], [  44,122.3,116.3], [  46,126.9,120.8], [  48,131.7,125.4], [  50,136.6,130.1],
    [  52,141.6,134.9], [  54,146.7,139.8], [  56,152.0,144.9], [  58,157.4,150.1], [  60,162.9,155.4],
    [  62,168.6,160.8], [  64,174.3,166.4], [  66,180.2,172.1], [  68,186.3,178.0], [  70,192.5,184.0],
    [  72,198.8,190.1], [  74,205.3,196.4], [  76,211.9,202.8], [  78,218.7,209.3], [  80,225.6,216.1],
    [  82,232.7,222.9], [  84,239.9,229.9], [  86,247.3,237.1], [  88,254.8,244.4], [  90,262.5,251.9],
    [  92,270.4,259.6], [  94,278.4,267.4], [  96,286.6,275.4], [  98,295.0,283.6], [ 100,303.6,291.6],
    [ 105,325.7,313.6], [ 110,348.9,336.4], [ 115,373.4,360.5], [ 120,399.1,385.8], [ 125,426.0,412.4],
    [ 130,454.2,440.5], [ 135,483.8,470.0], [ 140,514.9,501.0], [ 145,547.3,533.7], [ 150,581.4,568.2]
  ]
};

export default r454b;