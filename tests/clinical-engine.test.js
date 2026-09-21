"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

assert.equal(engine.roundUnits(14.4), 14);
assert.equal(engine.roundUnits(14.5), 15);
assert.equal(engine.roundEven(14.5), 15, "alias de compatibilidad");

assert.equal(engine.assessInsulinSensitivity({ age: 72, bmi: 31, egfr: 80 }).factor, 0.1);
assert.equal(engine.assessInsulinSensitivity({ age: 60, bmi: 32, egfr: 80 }).category, "resistant");
assert.equal(engine.assessInsulinSensitivity({ age: 60, bmi: 25, egfr: 80 }).category, "usual");
assert.equal(engine.assessInsulinSensitivity({ age: 60, bmi: 32, egfr: 45 }).category, "sensitive", "VFG baja prima sobre IMC");

let decision = engine.suggestInitialScheme({ hba1c: 10, fasting: 150, casual: 250 });
assert.equal(decision.criteria.length, 0, "HbA1c 10% aislada no supera el umbral >10%");

decision = engine.suggestInitialScheme({ hba1c: 10.1, fasting: 150, age: 60, bmi: 25, egfr: 90 });
assert.equal(decision.criteria.length, 1);
assert.equal(decision.scheme, "monodosis_pm");
assert.equal(decision.factor, 0.2);

decision = engine.suggestInitialScheme({ hba1c: 11, fasting: 110, age: 60, bmi: 25, egfr: 90 });
assert.equal(decision.scheme, "monodosis_am", "ayuno en rango favorece NPH diurna");

decision = engine.suggestInitialScheme({ initiationCriteria: ["Deseo del paciente"] });
assert.equal(decision.criteria.length, 0);
assert.equal(decision.patientPreference, true, "la preferencia no es una indicación independiente");

decision = engine.suggestInitialScheme({ catabolic: ["Sospecha de cetosis o cetonuria / crisis hiperglicémica reciente"] });
assert.equal(decision.emergency, true);
assert.equal(decision.scheme, "stop");
assert.match(decision.emergencyReason, /Emergencia Hospitalaria/);

const monodose = engine.calculateInitialDose({ weightKg: 70, factor: 0.3, scheme: "monodosis_pm" });
assert.equal(monodose.factorApplied, 0.2, "0,3 UI/kg no se permite en monodosis");
assert.deepEqual({ total: monodose.total, am: monodose.am, pm: monodose.pm }, { total: 14, am: 0, pm: 14 });

const morningDose = engine.calculateInitialDose({ weightKg: 70, factor: 0.2, scheme: "monodosis_am" });
assert.deepEqual({ am: morningDose.am, pm: morningDose.pm }, { am: 14, pm: 0 });

const analysis = engine.analyzeGlucose([100, 100, 300], "Ayunas");
assert.equal(analysis.min, 100);
assert.equal(Math.round(analysis.promedio), 167);
assert.equal(engine.calculateAdjustment(analysis, "PM", 20, 7).newDose, 20, "titula con el menor de los controles, no con el promedio");

const adjustmentCases = [
  { values: [60, 90, 100], dose: 20, target: 7, percent: -20, next: 16 },
  { values: [75, 90, 100], dose: 20, target: 7, percent: -10, next: 18 },
  { values: [80, 100, 130], dose: 20, target: 7, percent: 0, next: 20 },
  { values: [131, 160, 180], dose: 20, target: 7, percent: 10, next: 22 },
  { values: [181, 200, 250], dose: 20, target: 7, percent: 20, next: 24 },
  { values: [151, 180, 200], dose: 20, target: 8, percent: 10, next: 22 },
  { values: [201, 210, 220], dose: 20, target: 8, percent: 20, next: 24 },
  { values: [161, 180, 220], dose: 20, target: 8.5, percent: 10, next: 22 },
  { values: [221, 230, 240], dose: 20, target: 8.5, percent: 20, next: 24 }
];
for (const testCase of adjustmentCases) {
  const a = engine.analyzeGlucose(testCase.values, "Ayunas");
  const result = engine.calculateAdjustment(a, "PM", testCase.dose, testCase.target);
  assert.equal(result.percent, testCase.percent);
  assert.equal(result.newDose, testCase.next);
}

let followup = engine.calculateFollowup({
  weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20,
  fastingValues: [160, 170, 180], targetA1c: 7
});
assert.deepEqual({ am: followup.am, pm: followup.pm, scheme: followup.schemeFinal }, { am: 0, pm: 22, scheme: "pm" });

followup = engine.calculateFollowup({
  weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20,
  fastingValues: [100, 100, 300], targetA1c: 7
});
assert.equal(followup.pm, 20, "un valor alto discordante no fuerza aumento si el menor está en meta");

followup = engine.calculateFollowup({
  weightKg: 100, regimenType: "2", amDose: 16, pmDose: 16,
  fastingValues: [160, 160, 160], preLunchValues: [181, 181, 181], targetA1c: 7
});
assert.deepEqual({ am: followup.am, pm: followup.pm }, { am: 19, pm: 18 });

followup = engine.calculateFollowup({
  weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 34,
  fastingValues: [181, 181, 181], targetA1c: 7
});
assert.equal(followup.pm, 34, "bloquea aumento que llevaría a ≥0,5 UI/kg/día");
assert.equal(followup.blocksAutomaticEscalation, true);
assert.match(followup.explicacion, /bloqueó el aumento automático/);

assert.equal(engine.classifyHypoglycemia([69], false).nivel, 1);
assert.equal(engine.classifyHypoglycemia([53], false).nivel, 2);
assert.equal(engine.classifyHypoglycemia([], true).nivel, 3, "nivel 3 no depende de una cifra registrada");
assert.equal(engine.classifyHypoglycemia([], true).urgent, true);

let level3 = engine.recommendLevel3HypoglycemiaAdjustment({
  regimenType: "2", amDose: 12, pmDose: 12, timing: "fasting", reversibleCause: "none"
});
assert.equal(level3.automaticRecommendation, true);
assert.equal(level3.implicatedDose, "pm");
assert.deepEqual({ am: level3.am, pm: level3.pm }, { am: 12, pm: 10 });
assert.equal(level3.reductionPercent, 20);

level3 = engine.recommendLevel3HypoglycemiaAdjustment({
  regimenType: "2", amDose: 20, pmDose: 18, timing: "daytime", reversibleCause: "none"
});
assert.equal(level3.automaticRecommendation, true);
assert.equal(level3.implicatedDose, "am");
assert.deepEqual({ am: level3.am, pm: level3.pm }, { am: 16, pm: 18 });

level3 = engine.recommendLevel3HypoglycemiaAdjustment({
  regimenType: "2", amDose: 12, pmDose: 12, timing: "fasting", reversibleCause: "reduced_intake"
});
assert.equal(level3.automaticRecommendation, false);
assert.equal(level3.requiresMedicalAdjustment, true);

level3 = engine.recommendLevel3HypoglycemiaAdjustment({
  regimenType: "2", amDose: 12, pmDose: 12, timing: "unclear", reversibleCause: "none"
});
assert.equal(level3.automaticRecommendation, false);

level3 = engine.recommendLevel3HypoglycemiaAdjustment({
  regimenType: "pm", amDose: 0, pmDose: 24, timing: "fasting", reversibleCause: "none", severeNeurologic: true
});
assert.equal(level3.automaticRecommendation, false);
assert.match(level3.reason, /pérdida de conciencia|convulsión/i);

console.log("Clinical engine r3 checks passed");
