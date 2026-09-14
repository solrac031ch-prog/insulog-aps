"use strict";

const assert = require("node:assert/strict");
const copy = require("../clinical-copy.js");

const initial = copy.buildInitialNote({
  criteria: "HbA1c 11%",
  schemeText: "NPH doble dosis AM + PM",
  reason: "HbA1c/glicemias marcadamente elevadas o síntomas catabólicos, compatible con hiperglicemia sostenida.",
  am: 10,
  pm: 4
});

assert.equal(initial, `INICIO
Paciente con criterios de inicio de insulina bajo HbA1c 11%.
Esquema sugerido: NPH doble dosis AM + PM
Motivo: HbA1c/glicemias marcadamente elevadas o síntomas catabólicos, compatible con hiperglicemia sostenida.
Se inicia insulina NPH en dosis de:
- 10 unidades antes del desayuno
- 4 unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico en 15 días con seguimiento de glicemia en ayunas y Antes de las once.`);

const followup = copy.buildFollowupNote({
  promAy: 150,
  promPre: "N/A",
  promedioGlobal: 150,
  hba1cEstimada: "6.9",
  amActual: 0,
  pmActual: 20,
  am: 0,
  pm: 22,
  dosisKg: 22 / 70,
  explicacion: "Esquema final sugerido: NPH solo PM\nPM: aumentar 2 UI por promedio 131-180 mg/dL"
});

assert.equal(followup, `SEGUIMIENTO APS
Promedios usados: Ayunas 150 | Pre-once N/A
Promedio global estimado: 150 mg/dL
HbA1c estimada a 90 días si mantiene este patrón: 6.9%
Esquema actual: AM 0 UI | PM 20 UI
Nuevo Esquema sugerido: AM 0 UI | PM 22 UI
Dosis total: 22 UI/día (0.31 UI/kg/día)
Razonamiento:
Esquema final sugerido: NPH solo PM
PM: aumentar 2 UI por promedio 131-180 mg/dL`);

const highDose = copy.buildHighDoseNote({
  promAy: 100,
  promPre: 100,
  promedioGlobal: 100,
  hba1cEstimada: "5.1",
  amActual: 40,
  pmActual: 30,
  am: 40,
  pm: 30,
  explicacion: "Dosis ≥0.7 UI/kg/día: dosis alta; revisar técnica.",
  acciones: "Evaluación y seguimiento por Medicina Interna APS\nRevisar técnica de inyección"
});

assert.equal(highDose, `SEGUIMIENTO APS
Promedios usados: Ayunas 100 | Pre-once 100
Promedio global estimado: 100 mg/dL
HbA1c estimada a 90 días si mantiene este patrón: 5.1%
Esquema actual: AM 40 UI | PM 30 UI
Nuevo Esquema sugerido: AM 40 UI | PM 30 UI
Razonamiento: Dosis ≥0.7 UI/kg/día: dosis alta; revisar técnica.

ALERTA DOSIS ALTA (>0.7 UI/kg):
Evaluación y seguimiento por Medicina Interna APS
Revisar técnica de inyección`);

assert.equal(Object.isFrozen(copy), true, "El generador de texto clínico debe exponer una API inmutable");
assert.equal(copy.buildInitialNote({ criteria: "criterio" }).includes("NPH monodosis nocturna"), true);
assert.equal(copy.buildHighDoseNote({}).endsWith("Mantener controles y seguimiento por medicina interna APS."), true);

console.log("Clinical copy exact regression checks passed");
