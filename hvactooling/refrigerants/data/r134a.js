/**
 * refrigerants/data/r134a.js
 * R-134a saturation data — table only, no logic.
 *
 * Source:    Chemours — Freon 134a Thermodynamic Properties (I/P Units)
 *            Table 1: Saturation Properties — Temperature Table
 *            Pressures converted from psia → PSIG (subtract 14.696 psia)
 *
 * Table:     1°F steps, -14°F to 150°F (165 rows).
 *            Trim: table starts at -14°F (0.339 PSIG). Below that pressure
 *            is sub-atmospheric — not a practical field condition for R-134a.
 *
 * Verified:  8 anchor points checked against Chemours source — all delta 0.000.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE } from "../core/types.js";

const r134a = {
  id:          "R-134a",
  name:        "R-134a",
  type:        "HFC",
  tableType:   TABLE_TYPE.SINGLE,
  blend:       null,
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         1430,
  source:      "Chemours — Freon 134a Thermodynamic Properties (I/P Units), Table 1",
  source_url:  "https://www.chemours.com/en/-/media/files/freon/freon-134a-eng-thermodynamic-properties.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.001,
    formula_recomputed: false,
    note: "Source pressures in psia converted to PSIG by subtracting 14.696. " +
          "Table trimmed at -14°F — sub-atmospheric below that point. " +
          "8 anchor points verified against Chemours source — all delta 0.000 PSIG.",
    anchors: [
      { temp_F:  -14, expected_psig:   0.339, calculated_psig:   0.339, delta: 0.000 },
      { temp_F:    0, expected_psig:   6.467, calculated_psig:   6.467, delta: 0.000 },
      { temp_F:   20, expected_psig:  18.433, calculated_psig:  18.433, delta: 0.000 },
      { temp_F:   40, expected_psig:  35.075, calculated_psig:  35.075, delta: 0.000 },
      { temp_F:   70, expected_psig:  71.194, calculated_psig:  71.194, delta: 0.000 },
      { temp_F:  100, expected_psig: 124.300, calculated_psig: 124.300, delta: 0.000 },
      { temp_F:  130, expected_psig: 198.876, calculated_psig: 198.876, delta: 0.000 },
      { temp_F:  150, expected_psig: 263.025, calculated_psig: 263.025, delta: 0.000 }
    ]
  },

  // Canonical table — [tempF, psig], 1°F steps
  // Pressures derived from Chemours psia values minus 14.696.
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [ -14,  0.339], [ -13,  0.724], [ -12,  1.116], [ -11,  1.516], [ -10,  1.924],
    [  -9,  2.341], [  -8,  2.765], [  -7,  3.197], [  -6,  3.638], [  -5,  4.088],
    [  -4,  4.546], [  -3,  5.013], [  -2,  5.488], [  -1,  5.973], [   0,  6.467],
    [   1,  6.970], [   2,  7.482], [   3,  8.004], [   4,  8.535], [   5,  9.076],
    [   6,  9.626], [   7, 10.187], [   8, 10.758], [   9, 11.338], [  10, 11.929],
    [  11, 12.531], [  12, 13.143], [  13, 13.766], [  14, 14.399], [  15, 15.043],
    [  16, 15.699], [  17, 16.365], [  18, 17.043], [  19, 17.732], [  20, 18.433],
    [  21, 19.145], [  22, 19.870], [  23, 20.606], [  24, 21.354], [  25, 22.114],
    [  26, 22.887], [  27, 23.672], [  28, 24.470], [  29, 25.281], [  30, 26.104],
    [  31, 26.940], [  32, 27.790], [  33, 28.653], [  34, 29.529], [  35, 30.419],
    [  36, 31.322], [  37, 32.239], [  38, 33.170], [  39, 34.116], [  40, 35.075],
    [  41, 36.049], [  42, 37.037], [  43, 38.040], [  44, 39.058], [  45, 40.091],
    [  46, 41.139], [  47, 42.202], [  48, 43.280], [  49, 44.374], [  50, 45.484],
    [  51, 46.609], [  52, 47.751], [  53, 48.908], [  54, 50.082], [  55, 51.267],
    [  56, 52.474], [  57, 53.698], [  58, 54.939], [  59, 56.196], [  60, 57.471],
    [  61, 58.763], [  62, 60.073], [  63, 61.400], [  64, 62.744], [  65, 64.107],
    [  66, 65.488], [  67, 66.886], [  68, 68.304], [  69, 69.739], [  70, 71.194],
    [  71, 72.667], [  72, 74.159], [  73, 75.670], [  74, 77.201], [  75, 78.751],
    [  76, 80.320], [  77, 81.910], [  78, 83.519], [  79, 85.148], [  80, 86.798],
    [  81, 88.468], [  82, 90.159], [  83, 91.870], [  84, 93.594], [  85, 95.354],
    [  86, 97.132], [  87, 98.930], [  88,100.748], [  89,102.585], [  90,104.442],
    [  91,106.328], [  92,108.234], [  93,110.162], [  94,112.113], [  95,114.086],
    [  96,116.082], [  97,118.102], [  98,120.144], [  99,122.210], [ 100,124.300],
    [ 101,126.413], [ 102,128.551], [ 103,130.712], [ 104,132.898], [ 105,135.108],
    [ 106,137.343], [ 107,139.602], [ 108,141.887], [ 109,144.197], [ 110,146.531],
    [ 111,148.892], [ 112,151.278], [ 113,153.697], [ 114,156.137], [ 115,158.602],
    [ 116,161.094], [ 117,163.601], [ 118,166.150], [ 119,168.725], [ 120,171.327],
    [ 121,173.956], [ 122,176.612], [ 123,179.296], [ 124,182.007], [ 125,184.747],
    [ 126,187.515], [ 127,190.312], [ 128,193.138], [ 129,195.992], [ 130,198.876],
    [ 131,201.789], [ 132,204.733], [ 133,207.706], [ 134,210.709], [ 135,213.742],
    [ 136,216.806], [ 137,219.901], [ 138,223.027], [ 139,226.184], [ 140,229.372],
    [ 141,232.592], [ 142,235.844], [ 143,239.128], [ 144,242.444], [ 145,245.793],
    [ 146,249.175], [ 147,252.574], [ 148,256.025], [ 149,259.508], [ 150,263.025]
  ]
};

export default r134a;