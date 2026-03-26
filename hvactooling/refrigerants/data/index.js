/**
 * refrigerants/data/index.js
 * Barrel file — imports all refrigerant data modules and exports as a frozen array.
 * This is the only place a new refrigerant needs to be added.
 */

import r22   from "./r22.js";
import r32   from "./r32.js";
import r134a from "./r134a.js";
import r407c from "./r407c.js";
import r410a from "./r410a.js";
import r422b from "./r422b.js";
import r427a from "./r427a.js";
import r438a from "./r438a.js";
import r448a from "./r448a.js";
import r449a from "./r449a.js";
import r450a from "./r450a.js";
import r454b from "./r454b.js";
import r454c from "./r454c.js";
import r507a from "./r507a.js";
import r513a from "./r513a.js";

const dataModules = Object.freeze([
  r22,
  r32,
  r134a,
  r407c,
  r410a,
  r422b,
  r427a,
  r438a,
  r448a,
  r449a,
  r450a,
  r454b,
  r454c,
  r507a,
  r513a
]);

export {
  dataModules,
  r22,
  r32,
  r134a,
  r407c,
  r410a,
  r422b,
  r427a,
  r438a,
  r448a,
  r449a,
  r450a,
  r454b,
  r454c,
  r507a,
  r513a
};

export default dataModules;