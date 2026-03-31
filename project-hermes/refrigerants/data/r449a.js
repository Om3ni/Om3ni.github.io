/**
 * refrigerants/data/r449a.js
 * R-449A (Opteon XP40) saturation data — table only, no logic.
 *
 * Source:    Hudson Technologies — R-449A Pressure Temperature Chart
 *            https://www.hudsontech.com/pdfs/pt-charts/R-449A-Pressure-Temperature-Chart.pdf
 *
 * Table:     Zeotropic blend — rows: [bubbleTempF, bubblePSIG, dewPSIG]
 *            5°F steps, -40°F to 150°F (39 rows).
 *
 *            Source columns labeled "Liquid" and "Vapor Pressure in PSIG".
 *            At a given temperature for this zeotropic blend, bubble point
 *            pressure > dew point pressure:
 *              Source "Liquid" (higher) = bubble point
 *              Source "Vapor" (lower)   = dew point
 *            Temperature glide: ~16.4 PSIG at 40°F, ~28 PSIG at 100°F.
 *
 * Verified:  8 anchor points checked against source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r449a = {
  id:          "R-449A",
  name:        "R-449A",
  type:        "HFO/HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.TEMP_INDEXED,
  blend:       "R-32/R-125/R-1234yf/R-134a (24.3/24.7/25.3/25.7)",
  safetyClass: SAFETY_CLASS.A1,
  flammable:   false,
  gwp:         1282,
  source:      "Hudson Technologies — R-449A Pressure Temperature Chart",
  source_url:  "https://www.hudsontech.com/pdfs/pt-charts/R-449A-Pressure-Temperature-Chart.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Source columns 'Liquid' (higher pressure) = bubble point, " +
          "'Vapor' (lower pressure) = dew point — consistent with R-407C " +
          "and R-448A source conventions. 5°F steps throughout. " +
          "8 anchor points verified against source — all delta 0.0.",
    anchors: [
      { temp_F: -40, point: "bubble", expected_psig:   4.8, calculated_psig:   4.8, delta: 0.0 },
      { temp_F: -40, point: "dew",    expected_psig:   0.0, calculated_psig:   0.0, delta: 0.0 },
      { temp_F:   0, point: "bubble", expected_psig:  33.8, calculated_psig:  33.8, delta: 0.0 },
      { temp_F:   0, point: "dew",    expected_psig:  24.1, calculated_psig:  24.1, delta: 0.0 },
      { temp_F:  40, point: "bubble", expected_psig:  88.0, calculated_psig:  88.0, delta: 0.0 },
      { temp_F:  40, point: "dew",    expected_psig:  71.6, calculated_psig:  71.6, delta: 0.0 },
      { temp_F: 100, point: "bubble", expected_psig: 241.0, calculated_psig: 241.0, delta: 0.0 },
      { temp_F: 150, point: "bubble", expected_psig: 462.0, calculated_psig: 462.0, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, bubblePSIG, dewPSIG]
  // 5°F steps, -40°F to 150°F. Range derived at runtime.
  table: [
    [ -40,  4.8,  0.0], [ -35,  7.4,  2.0], [ -30, 10.2,  4.4], [ -25, 13.3,  6.9],
    [ -20, 16.7,  9.8], [ -15, 20.5, 12.9], [ -10, 24.6, 16.3], [  -5, 29.0, 20.1],
    [   0, 33.8, 24.1], [   5, 39.0, 28.6], [  10, 44.6, 33.4], [  15, 50.6, 38.6],
    [  20, 57.1, 44.3], [  25, 64.0, 50.4], [  30, 71.5, 56.9], [  35, 79.5, 64.0],
    [  40, 88.0, 71.6], [  45, 97.1, 79.7], [  50,107.0, 88.4], [  55,117.0, 97.7],
    [  60,128.0,108.0], [  65,140.0,118.0], [  70,152.0,129.0], [  75,165.0,141.0],
    [  80,179.0,154.0], [  85,193.0,167.0], [  90,208.0,182.0], [  95,224.0,197.0],
    [ 100,241.0,213.0], [ 105,259.0,229.0], [ 110,278.0,247.0], [ 115,297.0,266.0],
    [ 120,318.0,286.0], [ 125,339.0,307.0], [ 130,362.0,329.0], [ 135,385.0,352.0],
    [ 140,410.0,376.0], [ 145,435.0,402.0], [ 150,462.0,429.0]
  ]
};

export default r449a;