"use strict";

const assert = require("node:assert/strict");
const copy = require("../clinical-copy.js");

const initial = copy.buildInitialNote({
  criteria: "HbA1c 11% (>10%)",
  schemeText: "NPH monodosis nocturna",
  reason: "Inicio con insulina basal NPH en monodosis, con titulación posterior según protocolo APS.",
  sensitivity: "Sensibilidad usual",
  am: 0,
  pm: 14
});

assert.equal(initial, `INICIO
Paciente con criterio(s) de inicio de insulina: HbA1c 11% (>10%).
Esquema sugerido: NPH monodosis nocturna
Motivo: Inicio con insulina basal NPH en monodosis, con titulación posterior según protocolo APS.
Sensibilidad a insulina: Sensibilidad usual
Se inicia insulina NPH en dosis de:
- 0 unidades antes del desayuno
- 14 unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico en 15 días con al menos 3 glicemias en ayunas y, si usa NPH AM, al menos 3 glicemias pre-almuerzo.`);

const followup = copy.buildFollowupNote({
  promAy: 170,
  promPre: "N/A",
  minAy: 160,
  minPre: "N/A",
  targetA1c: 7,
  amActual: 0,
  pmActual: 20,
  am: 0,
  pm: 22,
  dosisKg: 22 / 70,
  explicacion: "PM: aumentar 10% usando el menor de los controles (160 mg/dL)."
});

assert.equal(followup, `SEGUIMIENTO APS
Promedios descriptivos: Ayunas 170 mg/dL | Pre-almuerzo N/A mg/dL
Valores usados para titular (menor de ≥3): Ayunas 160 mg/dL | Pre-almuerzo N/A mg/dL
Meta individual de HbA1c: <7%
Esquema actual: AM 0 UI | PM 20 UI
Nuevo Esquema sugerido: AM 0 UI | PM 22 UI
Dosis total: 22 UI/día (0.31 UI/kg/día)
Razonamiento:
PM: aumentar 10% usando el menor de los controles (160 mg/dL).`);

const highDose = copy.buildHighDoseNote({
  promAy: 100,
  promPre: 100,
  minAy: 100,
  minPre: 100,
  targetA1c: 7,
  amActual: 20,
  pmActual: 30,
  am: 20,
  pm: 30,
  dosisKg: 0.5,
  explicacion: "Dosis basal total ≥0,5 UI/kg/día: no escalar automáticamente.",
  acciones: "Evaluación y seguimiento por Medicina Interna APS\nRevisar técnica de inyección"
});

assert.match(highDose, /ALERTA DOSIS BASAL ALTA \/ POSIBLE SOBREINSULINIZACIÓN \(≥0,5 UI\/kg\/día\):/);
assert.doesNotMatch(highDose, /HbA1c estimada/);
assert.doesNotMatch(highDose, /Pre-once/);

const level3 = copy.buildLevel3HypoglycemiaNote();
assert.match(level3, /HIPOGLICEMIA NIVEL 3/);
assert.match(level3, /derivación inmediata a Unidad de Emergencia Hospitalaria/);
assert.match(level3, /No se realiza ajuste automático/);

assert.equal(Object.isFrozen(copy), true);
console.log("Clinical copy r2 exact regression checks passed");
