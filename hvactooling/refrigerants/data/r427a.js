/**
 * refrigerants/data/r427a.js
 * R-427A (Forane 427A) saturation data — table only, no logic.
 *
 * Source:    Arkema / Forane Refrigerants
 *            "Saturation Pressure-Temperature Data for R-427A (psig)"
 *            Generated using NIST REFPROP Database v9.0
 *            (Lemmon, Huber, McLinden — NIST Standard Reference Database 23)
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *            1°F steps, -32°F to 150°F (183 rows).
 *
 *            Source covers -49°F to 150°F with red italic values indicating
 *            inches of Hg vacuum. Low end trimmed at -32°F where both liquid
 *            (bubble) and vapor (dew) columns are first simultaneously positive:
 *              - Liquid crosses atmospheric between -46°F and -44°F
 *              - Vapor crosses atmospheric between -33°F and -32°F
 *            Temperature glide: ~15.4 PSIG at 40°F, ~25.9 PSIG at 100°F.
 *
 * Verified:  8 anchor points checked against Arkema source — all delta 0.0.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r427a = {
  id:          "R-427A",
  name:        "R-427A",
  type:        "HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.TEMP_INDEXED,
  blend:       "R-32/R-125/R-143a/R-134a (15/25/10/50)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         2138,
  source:      "Arkema / Forane — Saturation Pressure-Temperature Data for R-427A (NIST REFPROP v9.0)",
  source_url:  "https://www.arkema.com/files/live/sites/shared_arkema/files/downloads/products-documentations/forane-427a-pressure-temperature-chart.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "NIST REFPROP-generated source. Sub-atmospheric range omitted — liquid " +
          "column crosses atm between -46°F and -44°F, vapor column crosses between " +
          "-33°F and -32°F. Table starts at -32°F where both columns are positive. " +
          "8 anchor points verified against Arkema source — all delta 0.0.",
    anchors: [
      { temp_F:  -32, point: "bubble", expected_psig:   5.9, calculated_psig:   5.9, delta: 0.0 },
      { temp_F:  -32, point: "dew",    expected_psig:   0.5, calculated_psig:   0.5, delta: 0.0 },
      { temp_F:    0, point: "bubble", expected_psig:  27.9, calculated_psig:  27.9, delta: 0.0 },
      { temp_F:    0, point: "dew",    expected_psig:  18.7, calculated_psig:  18.7, delta: 0.0 },
      { temp_F:   40, point: "bubble", expected_psig:  76.6, calculated_psig:  76.6, delta: 0.0 },
      { temp_F:   40, point: "dew",    expected_psig:  61.2, calculated_psig:  61.2, delta: 0.0 },
      { temp_F:  100, point: "bubble", expected_psig: 215.8, calculated_psig: 215.8, delta: 0.0 },
      { temp_F:  150, point: "bubble", expected_psig: 418.9, calculated_psig: 418.9, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, bubblePSIG, dewPSIG]
  // 1°F steps, -32°F to 150°F. Range derived at runtime.
  table: [
    [ -32,  5.9,  0.5], [ -31,  6.5,  0.9], [ -30,  7.0,  1.3], [ -29,  7.5,  1.7],
    [ -28,  8.1,  2.2], [ -27,  8.6,  2.6], [ -26,  9.2,  3.1], [ -25,  9.7,  3.5],
    [ -24, 10.3,  4.0], [ -23, 10.9,  4.5], [ -22, 11.5,  5.0], [ -21, 12.1,  5.5],
    [ -20, 12.8,  6.0], [ -19, 13.4,  6.5], [ -18, 14.1,  7.1], [ -17, 14.7,  7.6],
    [ -16, 15.4,  8.2], [ -15, 16.1,  8.7], [ -14, 16.8,  9.3], [ -13, 17.5,  9.9],
    [ -12, 18.2, 10.5], [ -11, 19.0, 11.1], [ -10, 19.7, 11.7], [  -9, 20.5, 12.4],
    [  -8, 21.2, 13.0], [  -7, 22.0, 13.7], [  -6, 22.8, 14.4], [  -5, 23.6, 15.0],
    [  -4, 24.5, 15.7], [  -3, 25.3, 16.5], [  -2, 26.2, 17.2], [  -1, 27.0, 17.9],
    [   0, 27.9, 18.7], [   1, 28.8, 19.4], [   2, 29.7, 20.2], [   3, 30.7, 21.0],
    [   4, 31.6, 21.8], [   5, 32.6, 22.6], [   6, 33.5, 23.4], [   7, 34.5, 24.3],
    [   8, 35.5, 25.1], [   9, 36.5, 26.0], [  10, 37.6, 26.9], [  11, 38.6, 27.8],
    [  12, 39.7, 28.7], [  13, 40.8, 29.6], [  14, 41.8, 30.6], [  15, 43.0, 31.5],
    [  16, 44.1, 32.5], [  17, 45.2, 33.5], [  18, 46.4, 34.5], [  19, 47.6, 35.6],
    [  20, 48.8, 36.6], [  21, 50.0, 37.7], [  22, 51.2, 38.7], [  23, 52.5, 39.8],
    [  24, 53.7, 40.9], [  25, 55.0, 42.1], [  26, 56.3, 43.2], [  27, 57.7, 44.4],
    [  28, 59.0, 45.6], [  29, 60.4, 46.8], [  30, 61.7, 48.0], [  31, 63.1, 49.2],
    [  32, 64.6, 50.5], [  33, 66.0, 51.7], [  34, 67.5, 53.0], [  35, 68.9, 54.3],
    [  36, 70.4, 55.7], [  37, 71.9, 57.0], [  38, 73.5, 58.4], [  39, 75.0, 59.8],
    [  40, 76.6, 61.2], [  41, 78.2, 62.6], [  42, 79.8, 64.1], [  43, 81.5, 65.5],
    [  44, 83.1, 67.0], [  45, 84.8, 68.5], [  46, 86.5, 70.1], [  47, 88.2, 71.6],
    [  48, 90.0, 73.2], [  49, 91.8, 74.8], [  50, 93.6, 76.4], [  51, 95.4, 78.0],
    [  52, 97.2, 79.7], [  53, 99.1, 81.4], [  54,101.0, 83.1], [  55,102.9, 84.8],
    [  56,104.8, 86.6], [  57,106.8, 88.4], [  58,108.7, 90.2], [  59,110.7, 92.0],
    [  60,112.8, 93.8], [  61,114.8, 95.7], [  62,116.9, 97.6], [  63,119.0, 99.5],
    [  64,121.1,101.5], [  65,123.3,103.4], [  66,125.4,105.4], [  67,127.6,107.5],
    [  68,129.9,109.5], [  69,132.1,111.6], [  70,134.4,113.7], [  71,136.7,115.8],
    [  72,139.0,118.0], [  73,141.4,120.1], [  74,143.8,122.3], [  75,146.2,124.6],
    [  76,148.6,126.8], [  77,151.1,129.1], [  78,153.6,131.4], [  79,156.1,133.8],
    [  80,158.6,136.1], [  81,161.2,138.5], [  82,163.8,141.0], [  83,166.5,143.4],
    [  84,169.1,145.9], [  85,171.8,148.4], [  86,174.5,151.0], [  87,177.3,153.6],
    [  88,180.1,156.2], [  89,182.9,158.8], [  90,185.7,161.5], [  91,188.6,164.2],
    [  92,191.5,166.9], [  93,194.4,169.7], [  94,197.4,172.5], [  95,200.3,175.3],
    [  96,203.4,178.1], [  97,206.4,181.0], [  98,209.5,184.0], [  99,212.6,186.9],
    [ 100,215.8,189.9], [ 101,219.0,192.9], [ 102,222.2,196.0], [ 103,225.4,199.1],
    [ 104,228.7,202.2], [ 105,232.0,205.4], [ 106,235.3,208.6], [ 107,238.7,211.8],
    [ 108,242.1,215.1], [ 109,245.6,218.4], [ 110,249.1,221.7], [ 111,252.6,225.1],
    [ 112,256.1,228.5], [ 113,259.7,231.9], [ 114,263.3,235.4], [ 115,267.0,238.9],
    [ 116,270.7,242.5], [ 117,274.4,246.1], [ 118,278.2,249.7], [ 119,282.0,253.4],
    [ 120,285.8,257.1], [ 121,289.7,260.9], [ 122,293.6,264.7], [ 123,297.5,268.5],
    [ 124,301.5,272.4], [ 125,305.5,276.3], [ 126,309.6,280.3], [ 127,313.7,284.3],
    [ 128,317.8,288.3], [ 129,322.0,292.4], [ 130,326.2,296.5], [ 131,330.4,300.7],
    [ 132,334.7,304.9], [ 133,339.0,309.2], [ 134,343.4,313.5], [ 135,347.8,317.8],
    [ 136,352.3,322.2], [ 137,356.7,326.7], [ 138,361.3,331.2], [ 139,365.8,335.7],
    [ 140,370.5,340.3], [ 141,375.1,344.9], [ 142,379.8,349.6], [ 143,384.5,354.3],
    [ 144,389.3,359.1], [ 145,394.1,363.9], [ 146,399.0,368.8], [ 147,403.9,373.7],
    [ 148,408.9,378.7], [ 149,413.9,383.7], [ 150,418.9,388.8]
  ]
};

export default r427a;