/**
 * refrigerants/core/registry.js
 * Builds the refrigerant registry from data modules.
 * Validates every entry at load time.
 * Deep-freezes the registry — no mutation after boot.
 */

import { validateRefrigerant } from "./validate.js";

function deepFreeze(obj) {
  if (obj === null || typeof obj !== "object" || Object.isFrozen(obj)) return obj;
  Object.freeze(obj);
  for (const key of Object.getOwnPropertyNames(obj)) {
    deepFreeze(obj[key]);
  }
  return obj;
}

/**
 * buildRegistry(dataModules)
 * @param {Array} dataModules - array of refrigerant data objects
 * @returns frozen registry object keyed by refrigerant id
 * @throws if any entry fails validation or a duplicate id is found
 */
function buildRegistry(dataModules) {
  const registry = {};

  for (const ref of dataModules) {
    validateRefrigerant(ref);

    if (ref.id in registry)
      throw new Error(`[refrigerants] duplicate id: "${ref.id}"`);

    registry[ref.id] = ref;
  }

  return deepFreeze(registry);
}

export { buildRegistry };