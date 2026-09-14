"use strict";

const assert = require("node:assert/strict");
const copy = require("../clinical-copy.js");

const initial = copy.buildInitialNote({
  criteria: "HbA1c 10.5%",
  schemeText: "NPH basal monodosis nocturna",
  reason: "Vía Clínica MINSAL 2026.",
  sensitivity: "Sensibilidad usual",
  factor: 0.2,
  am: 0,
  pm: 14
});
assert.match(initial, /Sensibilidad a insulina: Sensibilidad usual \(0\.2 UI\/kg\)/);
assert.match(initial, /3 glicemias de ayuno/);
assert.doesNotMatch(initial, /HbA1c estimada/);

const follow = copy.buildFollowupNote({
  minAy: 160,
  minPre: "N/A",
  promAy: 170,
  promPre: "N/A",
  promedioGlobal: 170,
  targetHba1c: 7,
  amActual: 0,
  pmActual: 20,
  am: 0,
  pm: 22,
  dosisKg: 22 / 70,
  explicacion: "PM: aumentar 10%."
});
assert.match(follow, /menor ayuno 160 mg\/dL/);
assert.match(follow, /Promedios descriptivos/);
assert.doesNotMatch(follow, /HbA1c estimada/);

const high = copy.buildHighDoseNote({
  minAy: 100,
  minPre: 100,
  promAy: 110,
  promPre: 120,
  promedioGlobal: 115,
  targetHba1c: 8,
  amActual: 20,
  pmActual: 30,
  am: 20,
  pm: 30,
  dosisKg: 0.5,
  explicacion: "Techo basal.",
  acciones: "Revisar técnica"
});
assert.match(high, /≥0,5 UI\/kg\/día/);
assert.match(high, /Revisar técnica/);

assert.equal(Object.isFrozen(copy), true);
console.log("Clinical copy r2 regression checks passed");
