/**
 * refrigerants/core/lookup.js
 * One lookup engine for all refrigerants — single and zeotropic.
 *
 * Truth model:
 *   - Table is canonical at runtime.
 *   - Out-of-domain inputs return null. No silent clamping.
 *   - Callers are responsible for range checking.
 *   - Precision: hundredths (0.01) — callers decide display rounding.
 *
 * Table formats:
 *
 *   single:
 *     [tempF, psig]
 *
 *   zeotropic, pressure_indexed:
 *     [bubbleTempF, psig, dewTempF]
 *     — source was pressure-indexed (pressure is the single shared key)
 *
 *   zeotropic, temp_indexed:
 *     [bubbleTempF, bubblePSIG, dewPSIG]
 *     — source was temp-indexed (temperature is the key, two pressure columns)
 *
 * Zeotropic lookups accept an optional `point` argument:
 *   "bubble" (default) — liquid line / bubble point
 *   "dew"              — suction line / dew point
 *
 * Binary search used throughout — O(log n).
 */

const PRESSURE_INDEXED = "pressure_indexed";
const TEMP_INDEXED     = "temp_indexed";

/**
 * getRangeFromTable(ref)
 * Returns domain bounds derived from the table.
 */
function getRangeFromTable(ref) {
  const t          = ref.table;
  const zeotropic  = ref.tableType === "zeotropic";
  const first      = t[0];
  const last       = t[t.length - 1];

  if (!zeotropic) {
    return Object.freeze({
      minTemp_F:    first[0],
      maxTemp_F:    last[0],
      minPres_PSIG: first[1],
      maxPres_PSIG: last[1]
    });
  }

  if (ref.tableOrientation === TEMP_INDEXED) {
    // [bubbleTempF, bubblePSIG, dewPSIG]
    return Object.freeze({
      minBubbleTemp_F: first[0],
      maxBubbleTemp_F: last[0],
      minBubblePres_PSIG: first[1],
      maxBubblePres_PSIG: last[1],
      minDewPres_PSIG:    first[2],
      maxDewPres_PSIG:    last[2]
    });
  }

  // pressure_indexed: [bubbleTempF, psig, dewTempF]
  return Object.freeze({
    minBubbleTemp_F: first[0],
    maxBubbleTemp_F: last[0],
    minDewTemp_F:    first[2],
    maxDewTemp_F:    last[2],
    minPres_PSIG:    first[1],
    maxPres_PSIG:    last[1]
  });
}

// ── Binary search ──────────────────────────────────────────────────────────

/**
 * bsearch(t, col, val)
 * Returns [lo, hi] bracket where t[lo][col] <= val <= t[hi][col].
 * Assumes column `col` is strictly increasing.
 * Returns null if val is out of range.
 */
function bsearch(t, col, val) {
  if (val < t[0][col] || val > t[t.length - 1][col]) return null;
  if (val === t[0][col])             return [0, 0];
  if (val === t[t.length - 1][col]) return [t.length - 1, t.length - 1];

  let lo = 0, hi = t.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >>> 1;
    if (val < t[mid][col]) hi = mid;
    else lo = mid;
  }
  if (val === t[lo][col]) return [lo, lo];
  if (val === t[hi][col]) return [hi, hi];
  return [lo, hi];
}

/**
 * interpolate(x, x0, x1, y0, y1)
 * Linear interpolation, rounded to 2 decimal places.
 */
function interpolate(x, x0, x1, y0, y1) {
  if (x0 === x1) return +y0.toFixed(2);
  return +(y0 + (x - x0) / (x1 - x0) * (y1 - y0)).toFixed(2);
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * getSatPressureFromData(ref, tempF, point?)
 *
 * Returns saturation pressure (PSIG) for a temperature (°F).
 * Returns null if tempF is outside the table domain.
 *
 * point: "bubble" (default) | "dew"  — zeotropic only, ignored for single.
 *
 * pressure_indexed zeotropic [bubbleTempF, psig, dewTempF]:
 *   "bubble" — search col 0 (bubble temps), return col 1 (shared psig)
 *   "dew"    — search col 2 (dew temps),    return col 1 (shared psig)
 *
 * temp_indexed zeotropic [bubbleTempF, bubblePSIG, dewPSIG]:
 *   "bubble" — search col 0 (bubble temps), return col 1 (bubble psig)
 *   "dew"    — search col 0 (bubble temps), return col 2 (dew psig)
 *   Note: both look up by bubble temp since that is the indexed key.
 */
function getSatPressureFromData(ref, tempF, point = "bubble") {
  const t          = ref.table;
  const zeotropic  = ref.tableType === "zeotropic";

  if (!zeotropic) {
    // single: [tempF, psig] — search col 0, return col 1
    const bracket = bsearch(t, 0, tempF);
    if (!bracket) return null;
    const [lo, hi] = bracket;
    if (lo === hi) return t[lo][1];
    return interpolate(tempF, t[lo][0], t[hi][0], t[lo][1], t[hi][1]);
  }

  if (ref.tableOrientation === TEMP_INDEXED) {
    // [bubbleTempF, bubblePSIG, dewPSIG]
    // Both points search col 0 (bubble temp is the key)
    const resultCol = (point === "dew") ? 2 : 1;
    const bracket = bsearch(t, 0, tempF);
    if (!bracket) return null;
    const [lo, hi] = bracket;
    if (lo === hi) return t[lo][resultCol];
    return interpolate(tempF, t[lo][0], t[hi][0], t[lo][resultCol], t[hi][resultCol]);
  }

  // pressure_indexed: [bubbleTempF, psig, dewTempF]
  const searchCol = (point === "dew") ? 2 : 0;
  const bracket = bsearch(t, searchCol, tempF);
  if (!bracket) return null;
  const [lo, hi] = bracket;
  if (lo === hi) return t[lo][1];
  return interpolate(tempF, t[lo][searchCol], t[hi][searchCol], t[lo][1], t[hi][1]);
}

/**
 * getSatTempFromData(ref, psig, point?)
 *
 * Returns saturation temperature (°F) for a pressure (PSIG).
 * Returns null if psig is outside the table domain.
 *
 * point: "bubble" (default) | "dew"  — zeotropic only, ignored for single.
 *
 * pressure_indexed zeotropic [bubbleTempF, psig, dewTempF]:
 *   "bubble" — search col 1 (shared psig), return col 0 (bubble temp)
 *   "dew"    — search col 1 (shared psig), return col 2 (dew temp)
 *
 * temp_indexed zeotropic [bubbleTempF, bubblePSIG, dewPSIG]:
 *   "bubble" — search col 1 (bubble psig), return col 0 (bubble temp)
 *   "dew"    — search col 2 (dew psig),    return col 0 (bubble temp)
 *   Note: both return bubble temp (the indexed key) — this is correct
 *   because the bubble temp is the temperature reference for the refrigerant
 *   at that operating pressure on that curve.
 */
function getSatTempFromData(ref, psig, point = "bubble") {
  const t          = ref.table;
  const zeotropic  = ref.tableType === "zeotropic";

  if (!zeotropic) {
    // single: search col 1, return col 0
    const bracket = bsearch(t, 1, psig);
    if (!bracket) return null;
    const [lo, hi] = bracket;
    if (lo === hi) return t[lo][0];
    return interpolate(psig, t[lo][1], t[hi][1], t[lo][0], t[hi][0]);
  }

  if (ref.tableOrientation === TEMP_INDEXED) {
    // [bubbleTempF, bubblePSIG, dewPSIG]
    const searchCol = (point === "dew") ? 2 : 1;
    const bracket = bsearch(t, searchCol, psig);
    if (!bracket) return null;
    const [lo, hi] = bracket;
    if (lo === hi) return t[lo][0];
    return interpolate(psig, t[lo][searchCol], t[hi][searchCol], t[lo][0], t[hi][0]);
  }

  // pressure_indexed: [bubbleTempF, psig, dewTempF]
  const resultCol = (point === "dew") ? 2 : 0;
  const bracket = bsearch(t, 1, psig);
  if (!bracket) return null;
  const [lo, hi] = bracket;
  if (lo === hi) return t[lo][resultCol];
  return interpolate(psig, t[lo][1], t[hi][1], t[lo][resultCol], t[hi][resultCol]);
}

export { getRangeFromTable, getSatPressureFromData, getSatTempFromData };