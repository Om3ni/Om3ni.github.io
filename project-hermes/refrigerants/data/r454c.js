/**
 * refrigerants/data/r454c.js
 * R-454C saturation data — table only, no logic.
 *
 * Source:    Honeywell — Solstice® 454C (R-454C) P-T Chart
 *            Pressure-indexed, 0–400 PSIG, separate bubble and dew temperatures.
 *
 * Table:     Pressure-indexed. Rows: [bubbleTempF, psig, dewTempF] (68 rows).
 *            The Honeywell chart heads its columns "VAPOR TEMP °F" (lower) and
 *            "BUBBLE TEMP °F" (higher). At a given pressure a zeotrope's bubble
 *            point is the LOWER temperature and its dew point the HIGHER one, so:
 *              Honeywell "VAPOR TEMP"  (lower)  = bubble point  → col 0
 *              Honeywell "BUBBLE TEMP" (higher) = dew point     → col 2
 *            Confirmed by an independent R-454C Technical Data Sheet (2025) with
 *            explicitly labelled Bubble/Dew columns (bar abs vs °C): agreement
 *            within 0.09°F on all 54 overlapping rows (0–260 PSIG; the sheet's
 *            table ends at 52°C). Glide 9.2–14.2°F.
 *
 * Typos:     Two cells in the published chart are missing a decimal point and
 *            are corrected here: 0 PSIG "-500" → -50.0, 130 PSIG "650" → 65.0
 *            (both confirmed by the Technical Data Sheet and neighbouring rows).
 *
 * Replaces:  A-Gas Doc 614 single-column table (2026-11 audit). That column was
 *            the bubble curve stored as a single value, so suction saturation read
 *            ~15°F low and superheat ~15°F high.
 *
 * Cross-check: Hudson Technologies R-454C chart (single "vapor pressure" column)
 *            matches this bubble curve. CoolProp (R-32/R-1234yf 21.5/78.5) runs
 *            ~0.5–2°F warm, consistent with its known HFO-blend offset.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "../core/types.js";

const r454c = {
  id:          "R-454C",
  name:        "R-454C",
  type:        "HFO/HFC blend",
  tableType:        TABLE_TYPE.ZEOTROPIC,
  tableOrientation: TABLE_ORIENTATION.PRESSURE_INDEXED,
  blend:       "R-32/R-1234yf (21.5/78.5)",
  safetyClass: SAFETY_CLASS.A2L,
  flammable:   true,
  gwp:         148,
  source:      "Honeywell Solstice 454C (R-454C) P-T Chart",
  source_url:  "https://prod-edam.solstice.com/content/dam/honeywell-edam/pmt/oneam/en-us/refrigerants/documents/6580505-ras-chr-solstice-454c-ltr-en.pdf",

  units: {
    temp:     UNITS.TEMP_F,
    pressure: UNITS.PRESSURE_PSIG
  },

  verification: {
    status:             VERIFICATION_STATUS.ANCHOR_VALIDATED,
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "Honeywell 'VAPOR TEMP' (lower) = bubble, 'BUBBLE TEMP' (higher) = dew. " +
          "Two decimal-point typos in the chart corrected (0 PSIG, 130 PSIG). " +
          "Independent Technical Data Sheet with labelled Bubble/Dew columns " +
          "agrees within 0.09°F (0–260 PSIG); Hudson chart matches the bubble curve.",
    anchors: [
      { temp_F:  -50.0, point: "bubble", expected_psig:   0.0, calculated_psig:   0.0, delta: 0.0 },
      { temp_F:  -36.0, point: "dew",    expected_psig:   0.0, calculated_psig:   0.0, delta: 0.0 },
      { temp_F:   -1.9, point: "bubble", expected_psig:  30.0, calculated_psig:  30.0, delta: 0.0 },
      { temp_F:   12.2, point: "dew",    expected_psig:  30.0, calculated_psig:  30.0, delta: 0.0 },
      { temp_F:   32.0, point: "bubble", expected_psig:  70.0, calculated_psig:  70.0, delta: 0.0 },
      { temp_F:   45.9, point: "dew",    expected_psig:  70.0, calculated_psig:  70.0, delta: 0.0 },
      { temp_F:   50.1, point: "bubble", expected_psig: 100.0, calculated_psig: 100.0, delta: 0.0 },
      { temp_F:   63.8, point: "dew",    expected_psig: 100.0, calculated_psig: 100.0, delta: 0.0 },
      { temp_F:   92.6, point: "bubble", expected_psig: 200.0, calculated_psig: 200.0, delta: 0.0 },
      { temp_F:  105.0, point: "dew",    expected_psig: 200.0, calculated_psig: 200.0, delta: 0.0 },
      { temp_F:  122.2, point: "bubble", expected_psig: 300.0, calculated_psig: 300.0, delta: 0.0 },
      { temp_F:  133.2, point: "dew",    expected_psig: 300.0, calculated_psig: 300.0, delta: 0.0 }
    ]
  },

  // Canonical table — [bubbleTempF, psig, dewTempF]
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [ -50.0,   0.0, -36.0], [ -38.5,   5.0, -24.4], [ -29.1,  10.0, -14.9], [ -21.0,  15.0,  -6.9],
    [ -14.0,  20.0,   0.2], [ -11.4,  22.0,   2.8], [  -8.9,  24.0,   5.3], [  -6.5,  26.0,   7.7],
    [  -4.2,  28.0,  10.0], [  -1.9,  30.0,  12.2], [   0.2,  32.0,  14.4], [   2.3,  34.0,  16.4],
    [   4.4,  36.0,  18.5], [   6.3,  38.0,  20.4], [   8.2,  40.0,  22.3], [  10.1,  42.0,  24.2],
    [  11.9,  44.0,  26.0], [  13.7,  46.0,  27.7], [  15.4,  48.0,  29.4], [  17.1,  50.0,  31.1],
    [  21.1,  55.0,  35.1], [  24.9,  60.0,  38.9], [  32.0,  70.0,  45.9], [  38.5,  80.0,  52.3],
    [  44.5,  90.0,  58.3], [  50.1, 100.0,  63.8], [  52.8, 105.0,  66.4], [  55.4, 110.0,  68.9],
    [  57.9, 115.0,  71.4], [  60.3, 120.0,  73.8], [  62.7, 125.0,  76.1], [  65.0, 130.0,  78.4],
    [  67.3, 135.0,  80.6], [  69.5, 140.0,  82.7], [  71.6, 145.0,  84.8], [  73.7, 150.0,  86.8],
    [  75.8, 155.0,  88.8], [  77.8, 160.0,  90.8], [  79.8, 165.0,  92.7], [  81.7, 170.0,  94.6],
    [  83.6, 175.0,  96.4], [  85.5, 180.0,  98.2], [  87.3, 185.0,  99.9], [  89.1, 190.0, 101.7],
    [  90.8, 195.0, 103.4], [  92.6, 200.0, 105.0], [  94.3, 205.0, 106.7], [  95.9, 210.0, 108.3],
    [  97.6, 215.0, 109.8], [  99.2, 220.0, 111.4], [ 102.4, 230.0, 114.4], [ 105.4, 240.0, 117.3],
    [ 108.4, 250.0, 120.2], [ 111.3, 260.0, 122.9], [ 114.1, 270.0, 125.6], [ 116.9, 280.0, 128.2],
    [ 119.6, 290.0, 130.8], [ 122.2, 300.0, 133.2], [ 124.8, 310.0, 135.6], [ 127.3, 320.0, 138.0],
    [ 129.8, 330.0, 140.3], [ 132.2, 340.0, 142.5], [ 134.5, 350.0, 144.7], [ 136.8, 360.0, 146.8],
    [ 139.1, 370.0, 148.9], [ 141.3, 380.0, 150.9], [ 143.5, 390.0, 152.9], [ 145.7, 400.0, 154.9]
  ]
};

export default r454c;
