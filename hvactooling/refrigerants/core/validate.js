/**
 * refrigerants/core/validate.js
 * All validation lives here. No refrigerant data file gets its own validation.
 *
 * validateRefrigerant(ref) throws on any structural defect.
 * Called at registry build time — if it fails, the library does not load.
 */

import { SAFETY_CLASS, UNITS, VERIFICATION_STATUS, TABLE_TYPE, TABLE_ORIENTATION } from "./types.js";

const REQUIRED_TOP = [
  "id", "name", "type", "tableType", "safetyClass", "flammable",
  "source", "units", "verification", "table"
];

const REQUIRED_UNITS        = ["temp", "pressure"];
const REQUIRED_VERIFICATION = ["status", "formula_recomputed", "anchors"];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateMetadata(ref) {
  const id = ref.id ?? "(unknown)";

  for (const f of REQUIRED_TOP)
    assert(f in ref, `[refrigerants] ${id}: missing required field "${f}"`);

  assert(typeof ref.id     === "string" && ref.id.length     > 0, `[refrigerants] ${id}: id must be a non-empty string`);
  assert(typeof ref.name   === "string" && ref.name.length   > 0, `[refrigerants] ${id}: name must be a non-empty string`);
  assert(typeof ref.type   === "string" && ref.type.length   > 0, `[refrigerants] ${id}: type must be a non-empty string`);
  assert(typeof ref.source === "string" && ref.source.length > 0, `[refrigerants] ${id}: source must be a non-empty string`);
  assert(typeof ref.flammable === "boolean",                       `[refrigerants] ${id}: flammable must be boolean`);

  // tableType enum
  assert(
    Object.values(TABLE_TYPE).includes(ref.tableType),
    `[refrigerants] ${id}: invalid tableType "${ref.tableType}" — must be "single" or "zeotropic"`
  );

  // tableOrientation — required for zeotropic, must be absent (or undefined) for single
  if (ref.tableType === TABLE_TYPE.ZEOTROPIC) {
    assert(
      Object.values(TABLE_ORIENTATION).includes(ref.tableOrientation),
      `[refrigerants] ${id}: zeotropic refrigerant must have tableOrientation ` +
      `"pressure_indexed" or "temp_indexed", got "${ref.tableOrientation}"`
    );
  }

  // safetyClass enum
  assert(
    Object.values(SAFETY_CLASS).includes(ref.safetyClass),
    `[refrigerants] ${id}: invalid safetyClass "${ref.safetyClass}"`
  );

  // Cross-check safetyClass vs flammable
  const nonFlammable = [SAFETY_CLASS.A1, SAFETY_CLASS.B1];
  const flammable    = [SAFETY_CLASS.A2L, SAFETY_CLASS.A2, SAFETY_CLASS.A3,
                        SAFETY_CLASS.B2L, SAFETY_CLASS.B2, SAFETY_CLASS.B3];

  if (nonFlammable.includes(ref.safetyClass))
    assert(ref.flammable === false, `[refrigerants] ${id}: safetyClass ${ref.safetyClass} requires flammable: false`);
  if (flammable.includes(ref.safetyClass))
    assert(ref.flammable === true,  `[refrigerants] ${id}: safetyClass ${ref.safetyClass} requires flammable: true`);

  // Units block
  assert(ref.units && typeof ref.units === "object", `[refrigerants] ${id}: units must be an object`);
  for (const f of REQUIRED_UNITS)
    assert(f in ref.units, `[refrigerants] ${id}: missing units.${f}`);
  assert(ref.units.temp     === UNITS.TEMP_F,        `[refrigerants] ${id}: units.temp must be "F"`);
  assert(ref.units.pressure === UNITS.PRESSURE_PSIG, `[refrigerants] ${id}: units.pressure must be "PSIG"`);

  // Verification block
  assert(ref.verification && typeof ref.verification === "object", `[refrigerants] ${id}: verification must be an object`);
  for (const f of REQUIRED_VERIFICATION)
    assert(f in ref.verification, `[refrigerants] ${id}: missing verification.${f}`);
  assert(
    Object.values(VERIFICATION_STATUS).includes(ref.verification.status),
    `[refrigerants] ${id}: verification.status "${ref.verification.status}" not in enum`
  );
  assert(typeof ref.verification.formula_recomputed === "boolean", `[refrigerants] ${id}: verification.formula_recomputed must be boolean`);
  assert(Array.isArray(ref.verification.anchors),                  `[refrigerants] ${id}: verification.anchors must be an array`);
}

function validateTable(ref) {
  const id          = ref.id ?? "(unknown)";
  const t           = ref.table;
  const zeotropic   = ref.tableType === TABLE_TYPE.ZEOTROPIC;
  const tempIndexed = zeotropic && ref.tableOrientation === TABLE_ORIENTATION.TEMP_INDEXED;
  const rowLen      = zeotropic ? 3 : 2;

  const rowDesc = zeotropic
    ? (tempIndexed ? "[bubbleTempF, bubblePSIG, dewPSIG]" : "[bubbleTempF, psig, dewTempF]")
    : "[tempF, psig]";

  assert(Array.isArray(t) && t.length >= 2,
    `[refrigerants] ${id}: table must be an array with at least 2 rows`);

  for (let i = 0; i < t.length; i++) {
    const row = t[i];
    assert(Array.isArray(row) && row.length === rowLen,
      `[refrigerants] ${id}: table row ${i} must be ${rowDesc}`);

    for (let col = 0; col < rowLen; col++) {
      assert(Number.isFinite(row[col]),
        `[refrigerants] ${id}: non-finite value at row ${i} col ${col} (${row[col]})`);
    }

    if (i > 0) {
      const prev = t[i - 1];

      // Col 0: bubble temp (or single temp) — strictly increasing in all cases
      assert(row[0] > prev[0],
        `[refrigerants] ${id}: col 0 (temp) not strictly increasing at row ${i} (${prev[0]} → ${row[0]})`);

      if (!zeotropic) {
        // Col 1: pressure — strictly increasing
        assert(row[1] > prev[1],
          `[refrigerants] ${id}: col 1 (pressure) not strictly increasing at row ${i} (${prev[1]} → ${row[1]})`);
      } else if (tempIndexed) {
        // temp_indexed: [bubbleTempF, bubblePSIG, dewPSIG]
        // Col 1 (bubble psig) and col 2 (dew psig) must both be strictly increasing
        assert(row[1] > prev[1],
          `[refrigerants] ${id}: col 1 (bubble psig) not strictly increasing at row ${i} (${prev[1]} → ${row[1]})`);
        assert(row[2] > prev[2],
          `[refrigerants] ${id}: col 2 (dew psig) not strictly increasing at row ${i} (${prev[2]} → ${row[2]})`);
      } else {
        // pressure_indexed: [bubbleTempF, psig, dewTempF]
        // Col 1 (pressure) and col 2 (dew temp) must both be strictly increasing
        assert(row[1] > prev[1],
          `[refrigerants] ${id}: col 1 (pressure) not strictly increasing at row ${i} (${prev[1]} → ${row[1]})`);
        assert(row[2] > prev[2],
          `[refrigerants] ${id}: col 2 (dew temp) not strictly increasing at row ${i} (${prev[2]} → ${row[2]})`);
        // Dew temp must be >= bubble temp (glide is always positive or zero)
        assert(row[2] >= row[0],
          `[refrigerants] ${id}: dew temp (${row[2]}) < bubble temp (${row[0]}) at row ${i} — invalid glide`);
      }
    }
  }
}

function validateRefrigerant(ref) {
  validateMetadata(ref);
  validateTable(ref);
  return true;
}

export { validateRefrigerant };