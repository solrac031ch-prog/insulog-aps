"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

assert.equal(engine.roundUnit(14.4), 14);
assert.equal(engine.roundUnit(14.5), 15);

const urgent = engine.suggestInitialScheme({
  hba1c: 12,
  catabolic: ["Sospecha de cetosis o cetonuria / crisis hiperglicémica reciente"]
});
assert.equal(urgent.urgent, true);
assert.equal(urgent.canProceed, false);
assert.equal(urgent.scheme, "none");

const noIndication = engine.suggestInitialScheme({ hba1c: 9.2, initiationCriteria: ["Deseo del paciente"] });
assert.equal(noIndication.indicated, false);
assert.equal(noIndication.canProceed, false);

const highA1c = engine.suggestInitialScheme({ hba1c: 10 });
assert.equal(highA1c.indicated, true);
assert.equal(highA1c.scheme, "monodosis_pm");

const failure = engine.suggestInitialScheme({ initiationCriteria: ["Fracaso terapia oral"] });
assert.equal(failure.indicated, true);

const sensitive = engine.determineInsulinSensitivity({ weightKg: 70, heightCm: 175, egfr: 55, ageYears: 55 });
assert.equal(sensitive.sensitivity, "sensitive");
assert.equal(sensitive.factor, 0.1);

const usual = engine.determineInsulinSensitivity({ weightKg: 70, heightCm: 175, egfr: 90, ageYears: 55 });
assert.equal(usual.sensitivity, "usual");
assert.equal(usual.factor, 0.2);

const resistant = engine.determineInsulinSensitivity({ weightKg: 100, heightCm: 170, egfr: 90, ageYears: 55 });
assert.equal(resistant.sensitivity, "resistant");
assert.equal(resistant.factor, 0.2);

const dose = engine.calculateInitialDose({ weightKg: 70, factor: 0.2, scheme: "monodosis_pm" });
assert.deepEqual({ total: dose.total, am: dose.am, pm: dose.pm }, { total: 14, am: 0, pm: 14 });

const invalid03 = engine.calculateInitialDose({ weightKg: 70, factor: 0.3, scheme: "monodosis_pm" });
assert.equal(invalid03.total, 0);

const analysis = engine.analyzeGlucose([100, 100, 300], "Ayunas");
assert.equal(analysis.min, 100);
assert.equal(Math.round(analysis.promedio), 167);

const adjKeep = engine.calculateAdjustment(analysis, "PM", 20, 7);
assert.equal(adjKeep.porcentaje, 0);
assert.equal(adjKeep.nuevaDosis, 20);

const adj10 = engine.calculateAdjustment(engine.analyzeGlucose([160, 170, 180], "Ayunas"), "PM", 20, 7);
assert.equal(adj10.porcentaje, 10);
assert.equal(adj10.nuevaDosis, 22);

const adj20 = engine.calculateAdjustment(engine.analyzeGlucose([181, 190, 200], "Ayunas"), "PM", 20, 7);
assert.equal(adj20.porcentaje, 20);
assert.equal(adj20.nuevaDosis, 24);

const hypo = engine.calculateAdjustment(engine.analyzeGlucose([69, 100, 110], "Ayunas"), "PM", 20, 7);
assert.equal(hypo.porcentaje, -20);
assert.equal(hypo.nuevaDosis, 16);

const lowNoHypo = engine.calculateAdjustment(engine.analyzeGlucose([75, 100, 110], "Ayunas"), "PM", 20, 7);
assert.equal(lowNoHypo.porcentaje, -10);
assert.equal(lowNoHypo.nuevaDosis, 18);

const target8 = engine.calculateAdjustment(engine.analyzeGlucose([151, 160, 170], "Ayunas"), "PM", 20, 8);
assert.equal(target8.porcentaje, 10);

const target85Keep = engine.calculateAdjustment(engine.analyzeGlucose([160, 170, 180], "Ayunas"), "PM", 20, 8.5);
assert.equal(target85Keep.porcentaje, 0);

const lvl1 = engine.classifyHypoglycemia([54, 90], false);
assert.equal(lvl1.nivel, 1);
const lvl2 = engine.classifyHypoglycemia([53, 90], false);
assert.equal(lvl2.nivel, 2);
const lvl3NoReading = engine.classifyHypoglycemia([], true);
assert.equal(lvl3NoReading.nivel, 3);
assert.match(lvl3NoReading.nota, /derivación inmediata/i);

const follow = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 20,
  fastingValues: [160, 170, 180],
  preElevenValues: [200, 210, 220],
  targetHba1c: 7
});
assert.equal(follow.pm, 22);
assert.equal(follow.am, 0);
assert.equal(follow.schemeFinal, "pm");
assert.match(follow.explicacion, /no se agrega NPH AM automáticamente/i);
assert.equal("hba1cEstimada" in follow, false);

const ceiling = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 34,
  fastingValues: [181, 190, 200],
  targetHba1c: 7
});
assert.equal(ceiling.pm, 35);
assert.ok(ceiling.dosisKg <= 0.5);
assert.equal(ceiling.requiresHighDoseReview, true);
assert.equal(ceiling.blocksAutomaticEscalation, true);

const bidFirstNight = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 20,
  pmDose: 20,
  fastingValues: [160, 170, 180],
  preElevenValues: [181, 190, 200],
  targetHba1c: 7
});
assert.equal(bidFirstNight.pm, 22);
assert.equal(bidFirstNight.am, 20);
assert.match(bidFirstNight.explicacion, /titular primero la NPH nocturna/i);

const bidThenDay = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 20,
  pmDose: 20,
  fastingValues: [100, 110, 120],
  preElevenValues: [181, 190, 200],
  targetHba1c: 7
});
assert.equal(bidThenDay.pm, 20);
assert.equal(bidThenDay.am, 24);

console.log("Clinical engine r2 checks passed");
