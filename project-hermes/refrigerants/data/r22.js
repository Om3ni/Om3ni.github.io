/**
 * refrigerants/data/r22.js
 * R-22 saturation data — table only, no logic.
 *
 * Source:    iGas USA — R22 Pressure-Temperature Chart
 *            https://www.igasusa.com/files/R22-PT-Chart.pdf
 *            "Saturation Pressure-Temperature Data for R22 (psig)"
 *
 * Table:     1°F steps, -41°F to 150°F (192 rows)
 *            Sub-atmospheric range (-49°F to -42°F) omitted — pressure is
 *            non-monotonic in that region (curve dips to a minimum at -41°F)
 *            and below-atmospheric operation is not a practical field condition.
 *
 * Verified:  10 anchor points checked against iGas source — all delta 0.0 PSIG.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE } from "../core/types.js";

const r22 = {
  id:          "R-22",
  name:        "R-22",
  type:        "HCFC",
  tableType:   TABLE_TYPE.SINGLE,
  safetyClass: "A1",
  flammable:   false,
  gwp:         1760,
  blend:       null,
  source:      "iGas USA — R22 Pressure-Temperature Chart",
  source_url:  "https://www.igasusa.com/files/R22-PT-Chart.pdf",

  units: {
    temp:     "F",
    pressure: "PSIG"
  },

  verification: {
    status:             "anchor_validated",
    tolerance_psig:     0.0,
    formula_recomputed: false,
    note: "1°F step table from iGas USA source. Sub-atmospheric range omitted — " +
          "pressure curve is non-monotonic below -41°F (dips toward 0 then rises), " +
          "making bidirectional lookup undefined in that region. " +
          "10 anchor points checked against source — all delta 0.0 PSIG.",
    anchors: [
      { temp_F:  -41, expected_psig:   0.2, calculated_psig:   0.2, delta: 0.0 },
      { temp_F:  -35, expected_psig:   2.6, calculated_psig:   2.6, delta: 0.0 },
      { temp_F:  -20, expected_psig:  10.2, calculated_psig:  10.2, delta: 0.0 },
      { temp_F:    0, expected_psig:  24.0, calculated_psig:  24.0, delta: 0.0 },
      { temp_F:   15, expected_psig:  37.8, calculated_psig:  37.8, delta: 0.0 },
      { temp_F:   40, expected_psig:  68.6, calculated_psig:  68.6, delta: 0.0 },
      { temp_F:   70, expected_psig: 121.4, calculated_psig: 121.4, delta: 0.0 },
      { temp_F:  100, expected_psig: 195.9, calculated_psig: 195.9, delta: 0.0 },
      { temp_F:  120, expected_psig: 260.0, calculated_psig: 260.0, delta: 0.0 },
      { temp_F:  150, expected_psig: 381.7, calculated_psig: 381.7, delta: 0.0 }
    ]
  },

  // Canonical table — [temp_F, pressure_PSIG], 1°F steps
  // Range is derived from this table at runtime — do not store manually.
  table: [
    [-41,0.2], [-40,0.6], [-39,1.0],  [-38,1.4],  [-37,1.8],
    [-36,2.2], [-35,2.6], [-34,3.1],  [-33,3.5],  [-32,4.0],
    [-31,4.5], [-30,4.9], [-29,5.4],  [-28,5.9],  [-27,6.4],
    [-26,6.9], [-25,7.4], [-24,8.0],  [-23,8.5],  [-22,9.1],
    [-21,9.6], [-20,10.2],[-19,10.8], [-18,11.4], [-17,12.0],
    [-16,12.6],[-15,13.2],[-14,13.9], [-13,14.5], [-12,15.2],
    [-11,15.9],[-10,16.5],[-9, 17.2], [-8, 17.9], [-7, 18.7],
    [-6, 19.4],[-5, 20.1],[-4, 20.9], [-3, 21.7], [-2, 22.4],
    [-1, 23.2],[0,  24.0],[1,  24.9],  [2,  25.7],  [3,  26.5],
    [4,  27.4],[5,  28.3],[6,  29.2],  [7,  30.1],  [8,  31.0],
    [9,  31.9],[10, 32.8],[11, 33.8],  [12, 34.8],  [13, 35.8],
    [14, 36.8],[15, 37.8],[16, 38.8],  [17, 39.9],  [18, 40.9],
    [19, 42.0],[20, 43.1],[21, 44.2],  [22, 45.3],  [23, 46.5],
    [24, 47.6],[25, 48.8],[26, 50.0],  [27, 51.2],  [28, 52.4],
    [29, 53.7],[30, 55.0],[31, 56.2],  [32, 57.5],  [33, 58.8],
    [34, 60.2],[35, 61.5],[36, 62.9],  [37, 64.3],  [38, 65.7],
    [39, 67.1],[40, 68.6],[41, 70.0],  [42, 71.5],  [43, 73.0],
    [44, 74.5],[45, 76.1],[46, 77.6],  [47, 79.2],  [48, 80.8],
    [49, 82.4],[50, 84.1],[51, 85.7],  [52, 87.4],  [53, 89.1],
    [54, 90.8],[55, 92.6],[56, 94.4],  [57, 96.1],  [58, 98.0],
    [59, 99.8],[60,101.6],[61,103.5],  [62,105.4],  [63,107.3],
    [64,109.3],[65,111.3],[66,113.2],  [67,115.3],  [68,117.3],
    [69,119.4],[70,121.4],[71,123.6],  [72,125.7],  [73,127.8],
    [74,130.0],[75,132.2],[76,134.5],  [77,136.7],  [78,139.0],
    [79,141.3],[80,143.6],[81,146.0],  [82,148.4],  [83,150.8],
    [84,153.2],[85,155.7],[86,158.2],  [87,160.7],  [88,163.2],
    [89,165.8],[90,168.4],[91,171.0],  [92,173.7],  [93,176.4],
    [94,179.1],[95,181.8],[96,184.6],  [97,187.4],  [98,190.2],
    [99,193.0],[100,195.9],[101,198.8],[102,201.8],  [103,204.7],
    [104,207.7],[105,210.8],[106,213.8],[107,216.9], [108,220.0],
    [109,223.2],[110,226.4],[111,229.6],[112,232.8], [113,236.1],
    [114,239.4],[115,242.8],[116,246.1],[117,249.5], [118,253.0],
    [119,256.5],[120,260.0],[121,263.5],[122,267.1], [123,270.7],
    [124,274.3],[125,278.0],[126,281.7],[127,285.4], [128,289.2],
    [129,293.0],[130,296.9],[131,300.8],[132,304.7], [133,308.7],
    [134,312.6],[135,316.7],[136,320.7],[137,324.8], [138,329.0],
    [139,333.2],[140,337.4],[141,341.6],[142,345.9], [143,350.3],
    [144,354.6],[145,359.0],[146,363.5],[147,368.0], [148,372.5],
    [149,377.1],[150,381.7]
  ]
};

export default r22;