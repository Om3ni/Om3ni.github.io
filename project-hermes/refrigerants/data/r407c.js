/**
 * refrigerants/data/r407c.js
 * R-407C saturation data — table only, no logic.
 *
 * Source:    iGas USA — R407C Pressure-Temperature Chart
 *            "Saturation Pressure-Temperature Data for R407C (psig)"
 *            1°F steps, "Liquid" and "Vapor" pressure columns
 *
 * Table:     Temperature-indexed. Rows: [tempF, bubblePSIG, dewPSIG]
 *            Source "Liquid" = bubble point (higher pressure at a given temp)
 *            Source "Vapor"  = dew point    (lower pressure at a given temp)
 *            At any temperature a zeotrope's bubble pressure is above its
 *            dew pressure; validate.js enforces this on every row.
 *
 * Trim:      Low end trimmed at -34°F, where the dew pressure reaches
 *            about 0 PSIG (the source switches to inches of vacuum below
 *            that). Well below any practical field range for R-407C.
 *
 * Fixed:     2026-11 audit. This file previously declared PRESSURE_INDEXED
 *            for temperature-indexed rows and had bubble/dew swapped, so
 *            suction saturation read ~40°F high at a 40°F evaporator.
 *            Values unchanged; orientation and column order corrected.
 *            Checked against CoolProp (R-32/R-125/R-134a 23/25/52): ≤0.13 psi.
 *
 * Verified:  8 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r407c = {
  id:          "R-407C",
  name:        "R-407C",
  type:        "HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.TEMP_INDEXED,
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
    note: "Source 'Liquid' = bubble point, 'Vapor' = dew point. At a given " +
          "temperature bubble pressure > dew pressure. Low end trimmed at -34°F " +
          "(dew reaches 0 PSIG). Anchors are source vapor (dew) values. " +
          "Independently checked against CoolProp: max deviation 0.13 psi.",
    anchors: [
      { temp_F: -34, point: "dew",    expected_psig:   0.1, calculated_psig:   0.1, delta: 0.0 },
      { temp_F: -20, point: "dew",    expected_psig:   6.5, calculated_psig:   6.5, delta: 0.0 },
      { temp_F:   0, point: "dew",    expected_psig:  19.4, calculated_psig:  19.4, delta: 0.0 },
      { temp_F:  20, point: "dew",    expected_psig:  37.9, calculated_psig:  37.9, delta: 0.0 },
      { temp_F:  40, point: "dew",    expected_psig:  63.2, calculated_psig:  63.2, delta: 0.0 },
      { temp_F:  80, point: "dew",    expected_psig: 140.5, calculated_psig: 140.5, delta: 0.0 },
      { temp_F: 120, point: "dew",    expected_psig: 265.8, calculated_psig: 265.8, delta: 0.0 },
      { temp_F: 150, point: "dew",    expected_psig: 402.5, calculated_psig: 402.5, delta: 0.0 }
    ]
  },

  // Canonical table — [tempF, bubblePSIG, dewPSIG]
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [-34,  5.6,  0.1], [-33,  6.1,  0.4], [-32,  6.6,  0.8], [-31,  7.2,  1.2], [-30,  7.7,  1.6],
    [-29,  8.3,  2.1], [-28,  8.8,  2.5], [-27,  9.4,  3.0], [-26, 10.0,  3.5], [-25, 10.6,  3.9],
    [-24, 11.2,  4.4], [-23, 11.8,  4.9], [-22, 12.4,  5.4], [-21, 13.1,  5.9], [-20, 13.7,  6.5],
    [-19, 14.4,  7.0], [-18, 15.1,  7.6], [-17, 15.8,  8.1], [-16, 16.5,  8.7], [-15, 17.2,  9.3],
    [-14, 17.9,  9.9], [-13, 18.7, 10.5], [-12, 19.4, 11.1], [-11, 20.2, 11.7], [-10, 20.9, 12.3],
    [ -9, 21.7, 13.0], [ -8, 22.5, 13.7], [ -7, 23.4, 14.3], [ -6, 24.2, 15.0], [ -5, 25.0, 15.7],
    [ -4, 25.9, 16.4], [ -3, 26.8, 17.2], [ -2, 27.7, 17.9], [ -1, 28.6, 18.7], [  0, 29.5, 19.4],
    [  1, 30.4, 20.2], [  2, 31.4, 21.0], [  3, 32.3, 21.8], [  4, 33.3, 22.6], [  5, 34.3, 23.5],
    [  6, 35.3, 24.3], [  7, 36.4, 25.2], [  8, 37.4, 26.1], [  9, 38.5, 27.0], [ 10, 39.5, 27.9],
    [ 11, 40.6, 28.8], [ 12, 41.7, 29.8], [ 13, 42.9, 30.7], [ 14, 44.0, 31.7], [ 15, 45.2, 32.7],
    [ 16, 46.3, 33.7], [ 17, 47.5, 34.7], [ 18, 48.7, 35.7], [ 19, 50.0, 36.8], [ 20, 51.2, 37.9],
    [ 21, 52.5, 39.0], [ 22, 53.8, 40.1], [ 23, 55.1, 41.2], [ 24, 56.4, 42.3], [ 25, 57.7, 43.5],
    [ 26, 59.1, 44.7], [ 27, 60.5, 45.9], [ 28, 61.9, 47.1], [ 29, 63.3, 48.3], [ 30, 64.7, 49.6],
    [ 31, 66.2, 50.8], [ 32, 67.7, 52.1], [ 33, 69.2, 53.4], [ 34, 70.7, 54.8], [ 35, 72.2, 56.1],
    [ 36, 73.8, 57.5], [ 37, 75.4, 58.9], [ 38, 77.0, 60.3], [ 39, 78.6, 61.7], [ 40, 80.2, 63.2],
    [ 41, 81.9, 64.6], [ 42, 83.6, 66.1], [ 43, 85.3, 67.6], [ 44, 87.0, 69.2], [ 45, 88.8, 70.7],
    [ 46, 90.6, 72.3], [ 47, 92.4, 73.9], [ 48, 94.2, 75.5], [ 49, 96.0, 77.2], [ 50, 97.9, 78.8],
    [ 51, 99.8, 80.5], [ 52,101.7, 82.2], [ 53,103.7, 84.0], [ 54,105.6, 85.7], [ 55,107.6, 87.5],
    [ 56,109.6, 89.3], [ 57,111.7, 91.2], [ 58,113.7, 93.0], [ 59,115.8, 94.9], [ 60,118.0, 96.8],
    [ 61,120.1, 98.7], [ 62,122.3,100.7], [ 63,124.4,102.7], [ 64,126.7,104.7], [ 65,128.9,106.7],
    [ 66,131.2,108.8], [ 67,133.5,110.9], [ 68,135.8,113.0], [ 69,138.2,115.1], [ 70,140.5,117.3],
    [ 71,142.9,119.5], [ 72,145.4,121.7], [ 73,147.8,124.0], [ 74,150.3,126.2], [ 75,152.8,128.6],
    [ 76,155.4,130.9], [ 77,158.0,133.3], [ 78,160.6,135.6], [ 79,163.2,138.1], [ 80,165.8,140.5],
    [ 81,168.5,143.0], [ 82,171.3,145.5], [ 83,174.0,148.1], [ 84,176.8,150.6], [ 85,179.6,153.2],
    [ 86,182.4,155.9], [ 87,185.3,158.5], [ 88,188.2,161.2], [ 89,191.1,163.9], [ 90,194.1,166.7],
    [ 91,197.1,169.5], [ 92,200.1,172.3], [ 93,203.2,175.2], [ 94,206.3,178.1], [ 95,209.4,181.0],
    [ 96,212.5,184.0], [ 97,215.7,186.9], [ 98,219.0,190.0], [ 99,222.2,193.0], [100,225.5,196.1],
    [101,228.8,199.3], [102,232.2,202.4], [103,235.6,205.6], [104,239.0,208.9], [105,242.4,212.1],
    [106,245.9,215.4], [107,249.5,218.8], [108,253.0,222.2], [109,256.6,225.6], [110,260.3,229.0],
    [111,263.9,232.5], [112,267.6,236.1], [113,271.4,239.7], [114,275.1,243.3], [115,279.0,246.9],
    [116,282.8,250.6], [117,286.7,254.3], [118,290.6,258.1], [119,294.6,261.9], [120,298.6,265.8],
    [121,302.6,269.7], [122,306.7,273.6], [123,310.8,277.6], [124,315.0,281.6], [125,319.2,285.7],
    [126,323.4,289.8], [127,327.7,293.9], [128,332.0,298.1], [129,336.4,302.4], [130,340.7,306.7],
    [131,345.2,311.0], [132,349.7,315.4], [133,354.2,319.8], [134,358.7,324.2], [135,363.3,328.8],
    [136,368.0,333.3], [137,372.7,337.9], [138,377.4,342.6], [139,382.1,347.3], [140,387.0,352.1],
    [141,391.8,356.9], [142,396.7,361.7], [143,401.6,366.6], [144,406.6,371.6], [145,411.7,376.6],
    [146,416.7,381.7], [147,421.9,386.8], [148,427.0,392.0], [149,432.2,397.2], [150,437.5,402.5]
  ]
};

export default r407c;