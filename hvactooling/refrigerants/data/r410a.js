/**
 * refrigerants/data/r410a.js
 * R-410A saturation data — table only, no logic.
 *
 * Source:    Chemours Freon 410A Thermodynamic Properties (SI Units), Table 1
 *            Bubble point vapor pressure equation constants (Page 3)
 *            Converted: kPa abs → PSIG, °C → °F
 *            Generated from equation at 1°F steps, -40°F to 158°F
 *            Formula retained as provenance only — not evaluated at runtime.
 *
 * Note:      R-410A is a near-azeotropic blend. Liquid and vapor pressures
 *            differ by <1.2 PSIG across the full range — treated as single
 *            for field purposes. Table uses bubble point (liquid) pressure.
 *
 * Verified:  6 anchor points checked against Chemours published table values.
 *            All within ±0.6 PSIG — within field gauge accuracy tolerance.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE } from "../core/types.js";

const r410a = {
  id:          "R-410A",
  name:        "R-410A",
  type:        "HFC blend",
  tableType:   TABLE_TYPE.SINGLE,
  blend:       "R-32/R-125 (50/50 by weight)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         2088,
  source:      "Chemours Freon 410A Thermodynamic Properties (SI Units), Table 1",
  source_url:  "https://www.chemours.com/en/-/media/files/freon/freon-410a-si-thermodynamic-properties.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.6,
    formula_recomputed: false,
    note: "Table generated from Chemours bubble point vapor pressure equation " +
          "constants at 1°F steps. Anchor points checked against Chemours " +
          "published SI table values — all within ±0.6 PSIG (field gauge tolerance). " +
          "Near-azeotropic: liquid/vapor pressure split <1.2 PSIG across full range.",
    anchors: [
      { temp_F:  -20, expected_psig:  26.9, calculated_psig:  26.4, delta: -0.5 },
      { temp_F:    0, expected_psig:  48.6, calculated_psig:  48.4, delta: -0.2 },
      { temp_F:   20, expected_psig:  78.3, calculated_psig:  78.5, delta:  0.2 },
      { temp_F:   40, expected_psig: 118.0, calculated_psig: 118.5, delta:  0.5 },
      { temp_F:   80, expected_psig: 235.3, calculated_psig: 235.9, delta:  0.6 },
      { temp_F:  120, expected_psig: 417.7, calculated_psig: 418.1, delta:  0.4 }
    ]
  },

  // Canonical table — [tempF, psig], 1°F steps, -40°F to 158°F
  // Generated from Chemours bubble point equation — hundredths precision.
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [-40,10.86],[-39,11.50],[-38,12.16],[-37,12.84],[-36,13.52],
    [-35,14.22],[-34,14.93],[-33,15.65],[-32,16.39],[-31,17.15],
    [-30,17.91],[-29,18.69],[-28,19.49],[-27,20.30],[-26,21.12],
    [-25,21.96],[-24,22.82],[-23,23.69],[-22,24.58],[-21,25.48],
    [-20,26.40],[-19,27.33],[-18,28.28],[-17,29.25],[-16,30.23],
    [-15,31.23],[-14,32.25],[-13,33.29],[-12,34.34],[-11,35.41],
    [-10,36.50],[ -9,37.60],[ -8,38.73],[ -7,39.87],[ -6,41.03],
    [ -5,42.21],[ -4,43.41],[ -3,44.63],[ -2,45.87],[ -1,47.13],
    [  0,48.41],[  1,49.71],[  2,51.03],[  3,52.37],[  4,53.73],
    [  5,55.11],[  6,56.51],[  7,57.94],[  8,59.38],[  9,60.85],
    [ 10,62.34],[ 11,63.85],[ 12,65.39],[ 13,66.94],[ 14,68.53],
    [ 15,70.13],[ 16,71.76],[ 17,73.41],[ 18,75.08],[ 19,76.78],
    [ 20,78.51],[ 21,80.25],[ 22,82.03],[ 23,83.83],[ 24,85.65],
    [ 25,87.50],[ 26,89.37],[ 27,91.27],[ 28,93.20],[ 29,95.15],
    [ 30,97.13],[ 31,99.14],[ 32,101.18],[ 33,103.24],[ 34,105.33],
    [ 35,107.45],[ 36,109.59],[ 37,111.77],[ 38,113.97],[ 39,116.20],
    [ 40,118.46],[ 41,120.75],[ 42,123.07],[ 43,125.42],[ 44,127.80],
    [ 45,130.21],[ 46,132.65],[ 47,135.13],[ 48,137.63],[ 49,140.17],
    [ 50,142.73],[ 51,145.33],[ 52,147.96],[ 53,150.63],[ 54,153.32],
    [ 55,156.05],[ 56,158.82],[ 57,161.61],[ 58,164.44],[ 59,167.31],
    [ 60,170.21],[ 61,173.14],[ 62,176.11],[ 63,179.12],[ 64,182.16],
    [ 65,185.23],[ 66,188.34],[ 67,191.49],[ 68,194.67],[ 69,197.90],
    [ 70,201.15],[ 71,204.45],[ 72,207.78],[ 73,211.16],[ 74,214.57],
    [ 75,218.02],[ 76,221.50],[ 77,225.03],[ 78,228.60],[ 79,232.20],
    [ 80,235.85],[ 81,239.54],[ 82,243.26],[ 83,247.03],[ 84,250.84],
    [ 85,254.69],[ 86,258.59],[ 87,262.52],[ 88,266.50],[ 89,270.52],
    [ 90,274.58],[ 91,278.69],[ 92,282.84],[ 93,287.04],[ 94,291.28],
    [ 95,295.56],[ 96,299.89],[ 97,304.26],[ 98,308.68],[ 99,313.15],
    [100,317.66],[101,322.22],[102,326.82],[103,331.47],[104,336.17],
    [105,340.92],[106,345.72],[107,350.56],[108,355.45],[109,360.39],
    [110,365.39],[111,370.43],[112,375.52],[113,380.66],[114,385.85],
    [115,391.09],[116,396.39],[117,401.74],[118,407.13],[119,412.58],
    [120,418.09],[121,423.65],[122,429.26],[123,434.92],[124,440.64],
    [125,446.41],[126,452.24],[127,458.12],[128,464.06],[129,470.05],
    [130,476.10],[131,482.21],[132,488.37],[133,494.59],[134,500.87],
    [135,507.21],[136,513.61],[137,520.06],[138,526.57],[139,533.14],
    [140,539.78],[141,546.47],[142,553.22],[143,560.04],[144,566.91],
    [145,573.85],[146,580.85],[147,587.91],[148,595.03],[149,602.22],
    [150,609.47],[151,616.78],[152,624.16],[153,631.60],[154,639.11],
    [155,646.68],[156,654.32],[157,662.03],[158,669.80]
  ]
};

export default r410a;