"use strict";

const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

function pickDose(result) {
  return { am: result.am, pm: result.pm, scheme: result.schemeFinal };
}

function hasWarning(result, pattern) {
  assert.match(result.explicacion, pattern);
}

// 1) Límites exactos del inicio de NPH. Estos casos congelan el comportamiento
// actual; no reinterpretan ni corrigen reglas clínicas.
const initialSchemeCases = [
  {
    name: "HbA1c 9 no cumple criterio >9",
    input: { hba1c: 9, fasting: Number.NaN, casual: Number.NaN },
    expected: { criteria: 0, scheme: "monodosis_pm", factor: 0.2 }
  },
  {
    name: "HbA1c 9.1 cumple criterio pero no severidad >=11",
    input: { hba1c: 9.1, fasting: Number.NaN, casual: Number.NaN },
    expected: { criteria: 1, scheme: "monodosis_pm", factor: 0.2 }
  },
  {
    name: "HbA1c 11 activa doble dosis",
    input: { hba1c: 11, fasting: Number.NaN, casual: Number.NaN },
    expected: { criteria: 1, scheme: "doble_dosis", factor: 0.2 }
  },
  {
    name: "Ayunas 250 conserva severidad actual",
    input: { hba1c: Number.NaN, fasting: 250, casual: Number.NaN },
    expected: { criteria: 0, scheme: "doble_dosis", factor: 0.2 }
  },
  {
    name: "Ayunas 251 cumple criterio y doble dosis",
    input: { hba1c: Number.NaN, fasting: 251, casual: Number.NaN },
    expected: { criteria: 1, scheme: "doble_dosis", factor: 0.2 }
  },
  {
    name: "Casual 299 no activa criterio",
    input: { hba1c: Number.NaN, fasting: Number.NaN, casual: 299 },
    expected: { criteria: 0, scheme: "monodosis_pm", factor: 0.2 }
  },
  {
    name: "Casual 300 activa doble dosis",
    input: { hba1c: Number.NaN, fasting: Number.NaN, casual: 300 },
    expected: { criteria: 1, scheme: "doble_dosis", factor: 0.2 }
  },
  {
    name: "Riesgo de hipo siempre fuerza inicio conservador",
    input: { hba1c: 13, fasting: 350, casual: 420, hypoRisk: ["Fragilidad"] },
    expected: { criteria: 3, scheme: "monodosis_pm", factor: 0.1 }
  },
  {
    name: "Síntoma catabólico activa doble dosis",
    input: { hba1c: Number.NaN, fasting: Number.NaN, casual: Number.NaN, catabolic: ["Baja de peso"] },
    expected: { criteria: 1, scheme: "doble_dosis", factor: 0.2 }
  }
];

for (const testCase of initialSchemeCases) {
  const result = engine.suggestInitialScheme({
    initiationCriteria: [],
    catabolic: [],
    hypoRisk: [],
    ...testCase.input
  });
  assert.equal(result.criteria.length, testCase.expected.criteria, testCase.name);
  assert.equal(result.scheme, testCase.expected.scheme, testCase.name);
  assert.equal(result.factor, testCase.expected.factor, testCase.name);
}

// 2) Redondeo y dosis inicial.
const roundCases = [
  [0, 0], [1, 2], [2, 2], [2.01, 4], [3.99, 4], [14.01, 16], [-1, 0]
];
for (const [input, expected] of roundCases) {
  assert.equal(engine.roundEven(input), expected, `roundEven(${input})`);
}

const initialDoseCases = [
  { weightKg: 40, factor: 0.1, scheme: "monodosis_pm", expected: { total: 4, am: 0, pm: 4 } },
  { weightKg: 41, factor: 0.1, scheme: "monodosis_pm", expected: { total: 6, am: 0, pm: 6 } },
  { weightKg: 70, factor: 0.2, scheme: "monodosis_pm", expected: { total: 14, am: 0, pm: 14 } },
  { weightKg: 70, factor: 0.3, scheme: "monodosis_pm", expected: { total: 22, am: 0, pm: 22 } },
  { weightKg: 70, factor: 0.2, scheme: "doble_dosis", expected: { total: 14, am: 10, pm: 4 } },
  { weightKg: 100, factor: 0.2, scheme: "doble_dosis", expected: { total: 20, am: 14, pm: 6 } }
];
for (const testCase of initialDoseCases) {
  const result = engine.calculateInitialDose(testCase);
  assert.deepEqual(
    { total: result.total, am: result.am, pm: result.pm },
    testCase.expected,
    `dosis inicial ${JSON.stringify(testCase)}`
  );
}

// 3) Umbrales exactos del ajuste de glicemia.
const adjustmentCases = [
  { value: 53, expected: -4 },
  { value: 54, expected: -4 },
  { value: 69, expected: -4 },
  { value: 70, expected: -2 },
  { value: 79, expected: -2 },
  { value: 80, expected: 0 },
  { value: 130, expected: 0 },
  { value: 131, expected: 2 },
  { value: 180, expected: 2 },
  { value: 181, expected: 4 }
];
for (const testCase of adjustmentCases) {
  const analysis = engine.analyzeGlucose([testCase.value, testCase.value, testCase.value], "Ayunas");
  const adjustment = engine.calculateAdjustment(analysis, "PM");
  assert.equal(adjustment.ajuste, testCase.expected, `ajuste en ${testCase.value} mg/dL`);
}

// 4) Análisis HGT: no muta entradas y conserva la lógica histórica de outliers.
const rawGlucose = [100, 100, 100, 151];
const rawSnapshot = [...rawGlucose];
const outlier = engine.analyzeGlucose(rawGlucose, "Ayunas");
assert.deepEqual(rawGlucose, rawSnapshot, "analyzeGlucose no debe mutar la entrada");
assert.deepEqual(outlier.usados, [100, 100, 100]);
assert.deepEqual(outlier.excluidos, ["Ayunas 151 mg/dL"]);

const hypoOutlier = engine.analyzeGlucose([60, 100, 100, 220], "Ayunas");
assert.ok(hypoOutlier.usados.includes(60), "Una hipoglicemia nunca se elimina como outlier");
assert.equal(hypoOutlier.hipo, true);

// 5) Segunda dosis: mínimo 4, redondeo par y máximo 10 UI.
const secondDoseCases = [
  [20, 4], [39, 4], [40, 4], [41, 6], [70, 8], [90, 10], [100, 10], [150, 10]
];
for (const [weightKg, expected] of secondDoseCases) {
  assert.equal(engine.calculateSecondDose(weightKg), expected, `segunda dosis para ${weightKg} kg`);
}

// 6) Seguimiento PM: ajuste y criterio de agregar AM.
const pmCases = [
  {
    name: "PM en meta sin pre-once mantiene",
    input: { weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [100, 110, 120], preElevenValues: [] },
    expected: { am: 0, pm: 20, scheme: "pm" }
  },
  {
    name: "PM alta sin pre-once aumenta PM sin intensificar",
    input: { weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 160, 160], preElevenValues: [] },
    expected: { am: 0, pm: 22, scheme: "pm" }
  },
  {
    name: "Dos pre-once no bastan para intensificar",
    input: { weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 160, 160], preElevenValues: [170, 170] },
    expected: { am: 0, pm: 22, scheme: "pm" }
  },
  {
    name: "Tres pre-once altas agregan AM",
    input: { weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 160, 160], preElevenValues: [131, 131, 131] },
    expected: { am: 8, pm: 22, scheme: "2" }
  },
  {
    name: "Pre-once 130 no agrega AM",
    input: { weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 160, 160], preElevenValues: [130, 130, 130] },
    expected: { am: 0, pm: 22, scheme: "pm" }
  }
];
for (const testCase of pmCases) {
  assert.deepEqual(pickDose(engine.calculateFollowup(testCase.input)), testCase.expected, testCase.name);
}

// 7) Seguimiento AM: ajuste AM solo con >=3 pre-once y agrega PM por ayunas >130.
const amCases = [
  {
    name: "AM con ayunas 130 no agrega PM",
    input: { weightKg: 70, regimenType: "am", amDose: 20, pmDose: 0, fastingValues: [130, 130, 130], preElevenValues: [] },
    expected: { am: 20, pm: 0, scheme: "am" }
  },
  {
    name: "AM con ayunas 131 agrega PM",
    input: { weightKg: 70, regimenType: "am", amDose: 20, pmDose: 0, fastingValues: [131, 131, 131], preElevenValues: [] },
    expected: { am: 20, pm: 8, scheme: "2" }
  },
  {
    name: "AM con pre-once alta ajusta AM y ayunas altas agregan PM",
    input: { weightKg: 70, regimenType: "am", amDose: 20, pmDose: 0, fastingValues: [160, 160, 160], preElevenValues: [181, 181, 181] },
    expected: { am: 24, pm: 8, scheme: "2" }
  }
];
for (const testCase of amCases) {
  assert.deepEqual(pickDose(engine.calculateFollowup(testCase.input)), testCase.expected, testCase.name);
}

// 8) Hipoglicemia bloquea intensificación automática.
const pmHypo = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "pm",
  amDose: 0,
  pmDose: 20,
  fastingValues: [60, 100, 110],
  preElevenValues: [200, 200, 200]
});
assert.deepEqual(pickDose(pmHypo), { am: 0, pm: 16, scheme: "pm" });
hasWarning(pmHypo, /No se agrega dosis AM por presencia de hipoglicemia/);

const amHypo = engine.calculateFollowup({
  weightKg: 70,
  regimenType: "am",
  amDose: 20,
  pmDose: 0,
  fastingValues: [200, 200, 200],
  preElevenValues: [60, 100, 110]
});
assert.equal(amHypo.pm, 0, "Con hipoglicemia no se debe agregar PM");
assert.equal(amHypo.schemeFinal, "am");
hasWarning(amHypo, /No se agrega dosis PM por presencia de hipoglicemia/);

// 9) Doble dosis: cada bloque responde a su ventana de glicemia.
const doubleMixed = engine.calculateFollowup({
  weightKg: 80,
  regimenType: "2",
  amDose: 20,
  pmDose: 20,
  fastingValues: [181, 181, 181],
  preElevenValues: [75, 75, 75]
});
assert.deepEqual(pickDose(doubleMixed), { am: 18, pm: 24, scheme: "2" });

// 10) Umbrales de dosis alta se conservan exactamente.
const atPointSeven = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 40,
  pmDose: 30,
  fastingValues: [100, 100, 100],
  preElevenValues: [100, 100, 100]
});
assert.equal(atPointSeven.dosisKg, 0.7);
hasWarning(atPointSeven, /Dosis ≥0\.7 UI\/kg\/día/);

const justBelowPointSeven = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 38,
  pmDose: 30,
  fastingValues: [100, 100, 100],
  preElevenValues: [100, 100, 100]
});
assert.equal(justBelowPointSeven.dosisKg, 0.68);
assert.doesNotMatch(justBelowPointSeven.explicacion, /Dosis ≥0\.7 UI\/kg\/día/);

const atOne = engine.calculateFollowup({
  weightKg: 100,
  regimenType: "2",
  amDose: 60,
  pmDose: 40,
  fastingValues: [100, 100, 100],
  preElevenValues: [100, 100, 100]
});
assert.equal(atOne.dosisKg, 1);
hasWarning(atOne, /Dosis ≥1 UI\/kg\/día/);

console.log(`Clinical regression matrix passed: ${initialSchemeCases.length + roundCases.length + initialDoseCases.length + adjustmentCases.length + secondDoseCases.length + pmCases.length + amCases.length + 7} grouped cases`);
