/**
 * refrigerants/data/r407c.js
 * R-407C saturation data — table only, no logic.
 *
 * Source:    iGas USA — R407C Pressure-Temperature Chart
 *            "Saturation Pressure-Temperature Data for R407C (psig)"
 *            1°F steps, liquid (dew) and vapor (bubble) pressure columns
 *
 * Table:     Rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *            Source columns labeled "Liquid" and "Vapor" — terminology is
 *            inverted from bubble/dew convention:
 *              Source "Vapor" = bubble point (lower pressure at given temp)
 *              Source "Liquid" = dew point (higher pressure at given temp)
 *
 * Trim:      Low end trimmed at -34°F. Below that the bubble pressure
 *            column is non-monotonic (dips to a minimum of 0.1 PSIG at
 *            -34°F before climbing). -34°F is well below any practical
 *            field operating range for R-407C.
 *
 * Verified:  8 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r407c = {
  id:          "R-407C",
  name:        "R-407C",
  type:        "HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.PRESSURE_INDEXED,
  blend:       "R-32/R-125/R-134a (23/25/52)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         1774,
  source:      "iGas USA — R407C Pressure-Temperature Chart",
  source_url:  "https://www.igasusa.com/files/R407C-PT-Chart.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Source columns labeled 'Liquid' and 'Vapor' — for R-407C at a given " +
          "temperature, dew point pressure (vapor line) > bubble point pressure " +
          "(liquid line), so source 'Vapor' = bubble and source 'Liquid' = dew. " +
          "Low end trimmed at -34°F — bubble pressure non-monotonic below that point. " +
          "8 anchor points verified against source — all delta 0.0.",
    anchors: [
      { temp_F: -34, point: "bubble", expected_psig:   0.1, calculated_psig:   0.1, delta: 0.0 },
      { temp_F: -20, point: "bubble", expected_psig:   6.5, calculated_psig:   6.5, delta: 0.0 },
      { temp_F:   0, point: "bubble", expected_psig:  19.4, calculated_psig:  19.4, delta: 0.0 },
      { temp_F:  20, point: "bubble", expected_psig:  37.9, calculated_psig:  37.9, delta: 0.0 },
      { temp_F:  40, point: "bubble", expected_psig:  63.2, calculated_psig:  63.2, delta: 0.0 },
      { temp_F:  80, point: "bubble", expected_psig: 140.5, calculated_psig: 140.5, delta: 0.0 },
      { temp_F: 120, point: "bubble", expected_psig: 265.8, calculated_psig: 265.8, delta: 0.0 },
      { temp_F: 150, point: "bubble", expected_psig: 402.5, calculated_psig: 402.5, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, bubblePSIG, dewPSIG]
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [-34,  0.1,  5.6], [-33,  0.4,  6.1], [-32,  0.8,  6.6], [-31,  1.2,  7.2], [-30,  1.6,  7.7],
    [-29,  2.1,  8.3], [-28,  2.5,  8.8], [-27,  3.0,  9.4], [-26,  3.5, 10.0], [-25,  3.9, 10.6],
    [-24,  4.4, 11.2], [-23,  4.9, 11.8], [-22,  5.4, 12.4], [-21,  5.9, 13.1], [-20,  6.5, 13.7],
    [-19,  7.0, 14.4], [-18,  7.6, 15.1], [-17,  8.1, 15.8], [-16,  8.7, 16.5], [-15,  9.3, 17.2],
    [-14,  9.9, 17.9], [-13, 10.5, 18.7], [-12, 11.1, 19.4], [-11, 11.7, 20.2], [-10, 12.3, 20.9],
    [ -9, 13.0, 21.7], [ -8, 13.7, 22.5], [ -7, 14.3, 23.4], [ -6, 15.0, 24.2], [ -5, 15.7, 25.0],
    [ -4, 16.4, 25.9], [ -3, 17.2, 26.8], [ -2, 17.9, 27.7], [ -1, 18.7, 28.6], [  0, 19.4, 29.5],
    [  1, 20.2, 30.4], [  2, 21.0, 31.4], [  3, 21.8, 32.3], [  4, 22.6, 33.3], [  5, 23.5, 34.3],
    [  6, 24.3, 35.3], [  7, 25.2, 36.4], [  8, 26.1, 37.4], [  9, 27.0, 38.5], [ 10, 27.9, 39.5],
    [ 11, 28.8, 40.6], [ 12, 29.8, 41.7], [ 13, 30.7, 42.9], [ 14, 31.7, 44.0], [ 15, 32.7, 45.2],
    [ 16, 33.7, 46.3], [ 17, 34.7, 47.5], [ 18, 35.7, 48.7], [ 19, 36.8, 50.0], [ 20, 37.9, 51.2],
    [ 21, 39.0, 52.5], [ 22, 40.1, 53.8], [ 23, 41.2, 55.1], [ 24, 42.3, 56.4], [ 25, 43.5, 57.7],
    [ 26, 44.7, 59.1], [ 27, 45.9, 60.5], [ 28, 47.1, 61.9], [ 29, 48.3, 63.3], [ 30, 49.6, 64.7],
    [ 31, 50.8, 66.2], [ 32, 52.1, 67.7], [ 33, 53.4, 69.2], [ 34, 54.8, 70.7], [ 35, 56.1, 72.2],
    [ 36, 57.5, 73.8], [ 37, 58.9, 75.4], [ 38, 60.3, 77.0], [ 39, 61.7, 78.6], [ 40, 63.2, 80.2],
    [ 41, 64.6, 81.9], [ 42, 66.1, 83.6], [ 43, 67.6, 85.3], [ 44, 69.2, 87.0], [ 45, 70.7, 88.8],
    [ 46, 72.3, 90.6], [ 47, 73.9, 92.4], [ 48, 75.5, 94.2], [ 49, 77.2, 96.0], [ 50, 78.8, 97.9],
    [ 51, 80.5, 99.8], [ 52, 82.2,101.7], [ 53, 84.0,103.7], [ 54, 85.7,105.6], [ 55, 87.5,107.6],
    [ 56, 89.3,109.6], [ 57, 91.2,111.7], [ 58, 93.0,113.7], [ 59, 94.9,115.8], [ 60, 96.8,118.0],
    [ 61, 98.7,120.1], [ 62,100.7,122.3], [ 63,102.7,124.4], [ 64,104.7,126.7], [ 65,106.7,128.9],
    [ 66,108.8,131.2], [ 67,110.9,133.5], [ 68,113.0,135.8], [ 69,115.1,138.2], [ 70,117.3,140.5],
    [ 71,119.5,142.9], [ 72,121.7,145.4], [ 73,124.0,147.8], [ 74,126.2,150.3], [ 75,128.6,152.8],
    [ 76,130.9,155.4], [ 77,133.3,158.0], [ 78,135.6,160.6], [ 79,138.1,163.2], [ 80,140.5,165.8],
    [ 81,143.0,168.5], [ 82,145.5,171.3], [ 83,148.1,174.0], [ 84,150.6,176.8], [ 85,153.2,179.6],
    [ 86,155.9,182.4], [ 87,158.5,185.3], [ 88,161.2,188.2], [ 89,163.9,191.1], [ 90,166.7,194.1],
    [ 91,169.5,197.1], [ 92,172.3,200.1], [ 93,175.2,203.2], [ 94,178.1,206.3], [ 95,181.0,209.4],
    [ 96,184.0,212.5], [ 97,186.9,215.7], [ 98,190.0,219.0], [ 99,193.0,222.2], [100,196.1,225.5],
    [101,199.3,228.8], [102,202.4,232.2], [103,205.6,235.6], [104,208.9,239.0], [105,212.1,242.4],
    [106,215.4,245.9], [107,218.8,249.5], [108,222.2,253.0], [109,225.6,256.6], [110,229.0,260.3],
    [111,232.5,263.9], [112,236.1,267.6], [113,239.7,271.4], [114,243.3,275.1], [115,246.9,279.0],
    [116,250.6,282.8], [117,254.3,286.7], [118,258.1,290.6], [119,261.9,294.6], [120,265.8,298.6],
    [121,269.7,302.6], [122,273.6,306.7], [123,277.6,310.8], [124,281.6,315.0], [125,285.7,319.2],
    [126,289.8,323.4], [127,293.9,327.7], [128,298.1,332.0], [129,302.4,336.4], [130,306.7,340.7],
    [131,311.0,345.2], [132,315.4,349.7], [133,319.8,354.2], [134,324.2,358.7], [135,328.8,363.3],
    [136,333.3,368.0], [137,337.9,372.7], [138,342.6,377.4], [139,347.3,382.1], [140,352.1,387.0],
    [141,356.9,391.8], [142,361.7,396.7], [143,366.6,401.6], [144,371.6,406.6], [145,376.6,411.7],
    [146,381.7,416.7], [147,386.8,421.9], [148,392.0,427.0], [149,397.2,432.2], [150,402.5,437.5]
  ]
};

export default r407c;