"use strict";
const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

assert.equal(engine.version, "APS-NPH-2026.09.24-r6");
assert.equal(engine.MIN_REQUIRED_READINGS, 3);
assert.equal(engine.GLUCOSE_MIN_MGDL, 20);
assert.equal(engine.GLUCOSE_MAX_MGDL, 600);

const incomplete = engine.assessInsulinSensitivity({ age: 60, bmi: 25 });
assert.equal(incomplete.factor, 0.1);
assert.equal(incomplete.category, "uncertain");

const invalidInitial = engine.calculateInitialDose({ weightKg: 70, factor: 0.2, scheme: "desconocido" });
assert.equal(invalidInitial.valid, false);
assert.equal(invalidInitial.total, 0);

let r = engine.calculateFollowup({ weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170], targetA1c: 7 });
assert.equal(r.dataSufficient, false);
assert.equal(r.pm, 20);
assert.equal(r.blocksDoseChange, true);

r = engine.calculateFollowup({ weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170, 601], targetA1c: 7 });
assert.equal(r.inputValid, false);
assert.equal(r.pm, 20);
assert.ok(r.validationErrors.some((item) => /inválid/i.test(item)));

r = engine.calculateFollowup({ weightKg: 100, regimenType: "2", amDose: 20, pmDose: 20, fastingValues: [69, 90, 100], preLunchValues: [250, 250, 250], targetA1c: 7 });
assert.ok(r.pm <= 20);
assert.equal(r.am, 20);
assert.match(r.advertencias.join(" "), /bloqueó cualquier aumento automático/);

r = engine.calculateFollowup({ weightKg: Number.NaN, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170, 180], targetA1c: 7 });
assert.equal(r.inputValid, false);
assert.equal(r.blocksDoseChange, true);

const unknownSafety = engine.assessDoseSafety(Number.NaN);
assert.equal(unknownSafety.blocksAutomaticEscalation, true);
assert.equal(unknownSafety.requiresHighDoseReview, true);
console.log("Clinical engine fail-safe hardening checks passed");

const lowOutOfRange = engine.analyzeGlucose([19, 100, 110], "Ayunas");
assert.deepEqual(lowOutOfRange.invalidos, [19]);
