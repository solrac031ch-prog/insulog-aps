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