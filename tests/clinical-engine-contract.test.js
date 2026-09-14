"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

for (const [value, level, review, block] of [
  [0.49, "standard", false, false],
  [0.5, "high", true, true],
  [0.8, "high", true, true]
]) {
  const result = engine.assessDoseSafety(value);
  assert.equal(result.level, level);
  assert.equal(result.requiresHighDoseReview, review);
  assert.equal(result.blocksAutomaticEscalation, block);
  assert.equal(Object.isFrozen(result), true);
}

assert.equal(engine.assessDoseSafety(Number.NaN).level, "unknown");
assert.match(engine.assessDoseSafety(0.5).warning, /0,5 UI\/kg\/día/);

assert.equal(engine.classifyHypoglycemia([70], false), null);
assert.equal(engine.classifyHypoglycemia([69], false).nivel, 1);
assert.equal(engine.classifyHypoglycemia([53], false).nivel, 2);
assert.equal(engine.classifyHypoglycemia([], true).nivel, 3);

assert.equal(Object.isFrozen(engine), true);
console.log("Clinical engine r2 structured safety contract checks passed");
