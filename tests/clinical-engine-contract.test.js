"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

const safetyCases = [
  { value: Number.NaN, expected: { level: "unknown", review: true, block: true } },
  { value: 0.39, expected: { level: "standard", review: false, block: false } },
  { value: 0.4, expected: { level: "review", review: true, block: false } },
  { value: 0.499, expected: { level: "review", review: true, block: false } },
  { value: 0.5, expected: { level: "stop", review: true, block: true } },
  { value: 0.8, expected: { level: "stop", review: true, block: true } }
];

for (const testCase of safetyCases) {
  const result = engine.assessDoseSafety(testCase.value);
  assert.equal(result.level, testCase.expected.level);
  assert.equal(result.requiresHighDoseReview, testCase.expected.review);
  assert.equal(result.blocksAutomaticEscalation, testCase.expected.block);
  assert.equal(Object.isFrozen(result), true);
}

assert.match(engine.assessDoseSafety(0.4).warning, /≥0,4 UI\/kg\/día/);
assert.match(engine.assessDoseSafety(0.5).warning, /≥0,5 UI\/kg\/día/);

const hypoglycemiaCases = [
  { values: [70, 90, 120], assistance: false, expected: null },
  { values: [69, 100, 110], assistance: false, expected: { nivel: 1, minimo: 69, urgent: false } },
  { values: [54, 100, 110], assistance: false, expected: { nivel: 1, minimo: 54, urgent: false } },
  { values: [53, 100, 110], assistance: false, expected: { nivel: 2, minimo: 53, urgent: false } },
  { values: [], assistance: true, expected: { nivel: 3, minimo: null, urgent: true } },
  { values: [120, 130], assistance: true, expected: { nivel: 3, minimo: null, urgent: true } }
];

for (const testCase of hypoglycemiaCases) {
  const original = [...testCase.values];
  const result = engine.classifyHypoglycemia(testCase.values, testCase.assistance);
  assert.deepEqual(testCase.values, original);
  if (testCase.expected === null) {
    assert.equal(result, null);
    continue;
  }
  assert.equal(result.nivel, testCase.expected.nivel);
  assert.equal(result.minimo, testCase.expected.minimo);
  assert.equal(result.urgent, testCase.expected.urgent);
  assert.equal(Object.isFrozen(result), true);
}

assert.match(engine.classifyHypoglycemia([], true).nota, /Derivación inmediata a Unidad de Emergencia Hospitalaria/);

const analysis = engine.analyzeGlucose([53, 100, 110], "Ayunas");
assert.equal(analysis.hypoglycemiaLevel2, true);
assert.equal("hipoSevera" in analysis, false, "el motor no debe llamar severa a una glicemia <54 por cifra aislada");

const target = engine.targetProfile(7);
assert.equal(Object.isFrozen(target), true);
assert.deepEqual(target, { hba1c: 7, lower: 80, upper: 130, high10: 180 });

console.log("Clinical engine r2 structured safety contract checks passed");
