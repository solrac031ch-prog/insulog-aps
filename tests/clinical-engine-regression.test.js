"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

function dose(result) {
  return { am: result.am, pm: result.pm, scheme: result.schemeFinal };
}

let result = engine.suggestInitialScheme({ hba1c: 10, initiationCriteria: [] });
assert.equal(result.criteria.length, 0);
result = engine.suggestInitialScheme({ hba1c: 10.1, initiationCriteria: [] });
assert.equal(result.criteria.length, 1);
result = engine.suggestInitialScheme({ initiationCriteria: ["Deseo del paciente"] });
assert.equal(result.criteria.length, 0);
assert.equal(result.patientPreference, true);
result = engine.suggestInitialScheme({ casual: 300, catabolic: [] });
assert.equal(result.criteria.length, 0, "glicemia casual ≥300 sin síntomas no se usa aislada en este flujo");
result = engine.suggestInitialScheme({ casual: 300, catabolic: ["Poliuria marcada"] });
assert.ok(result.criteria.length >= 1);
result = engine.suggestInitialScheme({ catabolic: ["Sospecha de cetosis"] });
assert.equal(result.emergency, true);

assert.equal(engine.assessInsulinSensitivity({ age: 71, bmi: 35, egfr: 90 }).factor, 0.1);
assert.equal(engine.assessInsulinSensitivity({ age: 60, bmi: 19.9, egfr: 90 }).factor, 0.1);
assert.equal(engine.assessInsulinSensitivity({ age: 60, bmi: 35, egfr: 59 }).factor, 0.1);
assert.equal(engine.assessInsulinSensitivity({ age: 60, bmi: 30, egfr: 60 }).factor, 0.2);

const roundCases = [[0,0],[0.49,0],[0.5,1],[4.49,4],[4.5,5],[14.49,14],[14.5,15],[-1,0]];
for (const [input, expected] of roundCases) assert.equal(engine.roundUnits(input), expected);

const target7 = [
  { value: 79, percent: -10 },
  { value: 80, percent: 0 },
  { value: 130, percent: 0 },
  { value: 131, percent: 10 },
  { value: 180, percent: 10 },
  { value: 181, percent: 20 }
];
for (const testCase of target7) {
  const analysis = engine.analyzeGlucose([testCase.value, testCase.value, testCase.value], "Ayunas");
  assert.equal(engine.calculateAdjustment(analysis, "PM", 20, 7).percent, testCase.percent);
}
assert.equal(engine.calculateAdjustment(engine.analyzeGlucose([69, 100, 120], "Ayunas"), "PM", 20, 7).percent, -20);

assert.deepEqual(engine.targetProfile(8), { hba1c: 8, lower: 100, upper: 150, high10: 200 });
assert.deepEqual(engine.targetProfile(8.5), { hba1c: 8.5, lower: 100, upper: 160, high10: 220 });

const discordant = engine.calculateFollowup({
  weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20,
  fastingValues: [100, 100, 100, 300], targetA1c: 7
});
assert.equal(discordant.minAy, 100);
assert.equal(discordant.promAy, 150);
assert.deepEqual(dose(discordant), { am: 0, pm: 20, scheme: "pm" });
assert.deepEqual(discordant.discordantes, ["Ayunas 300 mg/dL"]);
assert.match(discordant.explicacion, /no se excluyen automáticamente/);

const pmWithHighPreLunch = engine.calculateFollowup({
  weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20,
  fastingValues: [100, 110, 120], preLunchValues: [220, 230, 240], targetA1c: 7
});
assert.deepEqual(dose(pmWithHighPreLunch), { am: 0, pm: 20, scheme: "pm" });

const double = engine.calculateFollowup({
  weightKg: 100, regimenType: "2", amDose: 15, pmDose: 15,
  fastingValues: [160, 170, 180], preLunchValues: [181, 190, 200], targetA1c: 7
});
assert.deepEqual(dose(double), { am: 18, pm: 17, scheme: "2" });

const hypo = engine.calculateFollowup({
  weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20,
  fastingValues: [60, 110, 120], preLunchValues: [250, 250, 250], targetA1c: 7
});
assert.equal(hypo.pm, 16);
assert.equal(hypo.am, 0);
assert.match(hypo.explicacion, /Hipoglicemia registrada/);

assert.equal(engine.assessDoseSafety(0.399).level, "standard");
assert.equal(engine.assessDoseSafety(0.4).level, "review");
assert.equal(engine.assessDoseSafety(0.499).blocksAutomaticEscalation, false);
assert.equal(engine.assessDoseSafety(0.5).blocksAutomaticEscalation, true);

const blocked = engine.calculateFollowup({
  weightKg: 100, regimenType: "pm", amDose: 0, pmDose: 49,
  fastingValues: [181, 190, 200], targetA1c: 7
});
assert.equal(blocked.pm, 49);
assert.equal(blocked.automaticEscalationBlocked, true);
assert.equal(blocked.blocksAutomaticEscalation, true);
assert.equal(blocked.requiresHighDoseReview, true);
assert.match(blocked.explicacion, /bloqueó el aumento automático/);

console.log("Clinical engine r2 regression checks passed");
