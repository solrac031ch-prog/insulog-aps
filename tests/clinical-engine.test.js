"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

function approx(actual, expected, epsilon = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
}

// Redondeo y dosis inicial: conserva el comportamiento previo de Insulog.
assert.equal(engine.roundEven(14), 14);
assert.equal(engine.roundEven(14.1), 16);
assert.equal(engine.roundEven(-2), 0);
assert.equal(engine.roundEven(Number.NaN), 0);

const inicioDoble = engine.suggestInitialScheme({
  hba1c: 11,
  fasting: Number.NaN,
  casual: Number.NaN,
  initiationCriteria: [],
  catabolic: [],
  hypoRisk: []
});
assert.equal(inicioDoble.criteriaText, "HbA1c 11%");
assert.equal(inicioDoble.scheme, "doble_dosis");
assert.equal(inicioDoble.factor, 0.2);

const inicioConRiesgo = engine.suggestInitialScheme({
  hba1c: 11,
  fasting: Number.NaN,
  casual: Number.NaN,
  initiationCriteria: [],
  catabolic: [],
  hypoRisk: ["Adulto mayor frágil"]
});
assert.equal(inicioConRiesgo.scheme, "monodosis_pm");
assert.equal(inicioConRiesgo.factor, 0.1);

const dosisDoble = engine.calculateInitialDose({ weightKg: 70, factor: 0.2, scheme: "doble_dosis" });
assert.deepEqual({ total: dosisDoble.total, am: dosisDoble.am, pm: dosisDoble.pm }, { total: 14, am: 10, pm: 4 });
approx(dosisDoble.dosePerKg, 0.2);

const dosisConservadora = engine.calculateInitialDose({ weightKg: 70, factor: 0.1, scheme: "monodosis_pm" });
assert.deepEqual({ total: dosisConservadora.total, am: dosisConservadora.am, pm: dosisConservadora.pm }, { total: 8, am: 0, pm: 8 });

// Análisis de HGT: conserva todos los valores y solo marca discordantes para revisión clínica.
const valores = [100, 100, 100, 200];
const copiaValores = [...valores];
const analisisDiscordante = engine.analyzeGlucose(valores, "Ayunas");
assert.deepEqual(valores, copiaValores, "El motor no debe mutar la entrada");
assert.deepEqual(analisisDiscordante.usados, [100, 100, 100, 200]);
assert.deepEqual(analisisDiscordante.excluidos, []);
assert.deepEqual(analisisDiscordante.discordantes, ["Ayunas 200 mg/dL"]);
assert.equal(analisisDiscordante.promedio, 125);

const casosAjuste = [
  { values: [53, 100, 100], expected: -4 },
  { values: [60, 100, 100], expected: -4 },
  { values: [75, 75, 75], expected: -2 },
  { values: [80, 80, 80], expected: 0 },
  { values: [130, 130, 130], expected: 0 },
  { values: [131, 131, 131], expected: 2 },
  { values: [180, 180, 180], expected: 2 },
  { values: [181, 181, 181], expected: 4 }
];
for (const testCase of casosAjuste) {
  const analysis = engine.analyzeGlucose(testCase.values, "Ayunas");
  assert.equal(engine.calculateAdjustment(analysis, "PM").ajuste, testCase.expected);
}

assert.equal(engine.calculateSecondDose(30), 4);
assert.equal(engine.calculateSecondDose(70), 8);
assert.equal(engine.calculateSecondDose(150), 10);

// Seguimiento: equivalencia de los principales caminos del algoritmo efectivo previo al refactor.
const pmSinPreonce = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 20,
  fastingValues: [160, 160, 160],
  preElevenValues: []
});
assert.deepEqual({ am: pmSinPreonce.am, pm: pmSinPreonce.pm }, { am: 0, pm: 22 });
assert.equal(pmSinPreonce.schemeFinal, "pm");

const pmConPreonceAlta = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 20,
  fastingValues: [160, 160, 160],
  preElevenValues: [160, 160, 160]
});
assert.deepEqual({ am: pmConPreonceAlta.am, pm: pmConPreonceAlta.pm }, { am: 8, pm: 22 });
assert.equal(pmConPreonceAlta.schemeFinal, "2");

const amConAyunasAltas = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "am",
  amDose: 20,
  pmDose: 0,
  fastingValues: [160, 160, 160],
  preElevenValues: []
});
assert.deepEqual({ am: amConAyunasAltas.am, pm: amConAyunasAltas.pm }, { am: 20, pm: 8 });
assert.equal(amConAyunasAltas.schemeFinal, "2");

const dobleAlta = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "2",
  amDose: 20,
  pmDose: 20,
  fastingValues: [160, 160, 160],
  preElevenValues: [160, 160, 160]
});
assert.deepEqual({ am: dobleAlta.am, pm: dobleAlta.pm }, { am: 22, pm: 22 });

const pmConHipo = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 20,
  fastingValues: [60, 105, 110],
  preElevenValues: []
});
assert.deepEqual({ am: pmConHipo.am, pm: pmConHipo.pm }, { am: 0, pm: 16 });
assert.match(pmConHipo.explicacion, /No se agrega dosis AM por presencia de hipoglicemia/);

const discordanteConImpacto = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 20,
  fastingValues: [100, 100, 100, 300],
  preElevenValues: []
});
assert.equal(discordanteConImpacto.promAy, 150);
assert.equal(discordanteConImpacto.pm, 22);
assert.deepEqual(discordanteConImpacto.discordantes, ["Ayunas 300 mg/dL"]);
assert.match(discordanteConImpacto.explicacion, /Se mantienen en el promedio/);

const dosisUnoPorKg = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "2",
  amDose: 50,
  pmDose: 20,
  fastingValues: [100, 100, 100],
  preElevenValues: [100, 100, 100]
});
approx(dosisUnoPorKg.dosisKg, 1);
assert.match(dosisUnoPorKg.explicacion, /Dosis ≥1 UI\/kg\/día/);

console.log("Clinical engine equivalence checks passed");
