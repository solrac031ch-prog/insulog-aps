"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

const safetyCases = [
  {
    value: Number.NaN,
    expected: { level: "unknown", requiresHighDoseReview: false, blocksAutomaticEscalation: false }
  },
  {
    value: 0.69,
    expected: { level: "standard", requiresHighDoseReview: false, blocksAutomaticEscalation: false }
  },
  {
    value: 0.7,
    expected: { level: "high", requiresHighDoseReview: true, blocksAutomaticEscalation: false }
  },
  {
    value: 0.999,
    expected: { level: "high", requiresHighDoseReview: true, blocksAutomaticEscalation: false }
  },
  {
    value: 1,
    expected: { level: "stop", requiresHighDoseReview: true, blocksAutomaticEscalation: true }
  }
];

for (const testCase of safetyCases) {
  const result = engine.assessDoseSafety(testCase.value);
  assert.equal(result.level, testCase.expected.level, `nivel para ${testCase.value}`);
  assert.equal(result.requiresHighDoseReview, testCase.expected.requiresHighDoseReview, `revisión para ${testCase.value}`);
  assert.equal(result.blocksAutomaticEscalation, testCase.expected.blocksAutomaticEscalation, `bloqueo para ${testCase.value}`);
  assert.equal(Object.isFrozen(result), true, "El contrato de seguridad debe ser inmutable");
}

assert.equal(engine.assessDoseSafety(0.69).warning, "");
assert.match(engine.assessDoseSafety(0.7).warning, /Dosis ≥0\.7 UI\/kg\/día/);
assert.match(engine.assessDoseSafety(1).warning, /Dosis ≥1 UI\/kg\/día/);

const hypoglycemiaCases = [
  { values: [70, 90, 120], assistance: false, expected: null },
  { values: [69, 100, 110], assistance: false, expected: { nivel: 1, minimo: 69 } },
  { values: [54, 100, 110], assistance: false, expected: { nivel: 1, minimo: 54 } },
  { values: [53, 100, 110], assistance: false, expected: { nivel: 2, minimo: 53 } },
  { values: [69, 53, 110], assistance: false, expected: { nivel: 2, minimo: 53 } },
  { values: [60, 100, 110], assistance: true, expected: { nivel: 3, minimo: 60 } }
];

for (const testCase of hypoglycemiaCases) {
  const original = [...testCase.values];
  const result = engine.classifyHypoglycemia(testCase.values, testCase.assistance);
  assert.deepEqual(testCase.values, original, "La clasificación de hipoglicemia no debe mutar la entrada");

  if (testCase.expected === null) {
    assert.equal(result, null);
    continue;
  }

  assert.equal(result.nivel, testCase.expected.nivel);
  assert.equal(result.minimo, testCase.expected.minimo);
  assert.equal(Object.isFrozen(result), true, "La clasificación de hipoglicemia debe ser inmutable");
}

assert.match(engine.classifyHypoglycemia([69], false).nota, /nivel 1/);
assert.match(engine.classifyHypoglycemia([53], false).nota, /nivel 2/);
assert.match(engine.classifyHypoglycemia([60], true).nota, /nivel 3 referida/);

const atPointSeven = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 40,
  pmDose: 30,
  fastingValues: [100, 100, 100],
  preElevenValues: [100, 100, 100]
});
assert.equal(atPointSeven.dosisKg, 0.7);
assert.equal(atPointSeven.doseSafety.level, "high");
assert.equal(atPointSeven.requiresHighDoseReview, true);
assert.equal(atPointSeven.blocksAutomaticEscalation, false);
assert.match(atPointSeven.explicacion, /Dosis ≥0\.7 UI\/kg\/día/);

const atOne = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 60,
  pmDose: 40,
  fastingValues: [100, 100, 100],
  preElevenValues: [100, 100, 100]
});
assert.equal(atOne.dosisKg, 1);
assert.equal(atOne.doseSafety.level, "stop");
assert.equal(atOne.requiresHighDoseReview, true);
assert.equal(atOne.blocksAutomaticEscalation, true);
assert.match(atOne.explicacion, /Dosis ≥1 UI\/kg\/día/);

console.log("Clinical engine structured safety contract checks passed");
