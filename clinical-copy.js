"use strict";

(function exposeClinicalCopy(root, factory) {
  const clinicalCopy = factory();

  if (typeof module === "object" && module.exports) module.exports = clinicalCopy;
  if (root) root.InsulogClinicalCopy = clinicalCopy;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function buildInitialNote({ criteria = "", schemeText = "NPH monodosis nocturna", reason = "Inicio con NPH basal.", am = 0, pm = 0, sensitivity = "" } = {}) {
    return `INICIO
Paciente con criterio(s) de inicio de insulina: ${criteria || "criterio clínico documentado"}.
Esquema sugerido: ${schemeText}
Motivo: ${reason}${sensitivity ? `\nSensibilidad a insulina: ${sensitivity}` : ""}
Se inicia insulina NPH en dosis de:
- ${am} unidades antes del desayuno
- ${pm} unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico en 15 días con al menos 3 glicemias en ayunas y, si usa NPH AM, al menos 3 glicemias pre-almuerzo.`;
  }

  function buildFollowupNote({ promAy, promPre, minAy, minPre, targetA1c = 7, amActual, pmActual, am, pm, dosisKg, explicacion = "" } = {}) {
    return `SEGUIMIENTO APS
Promedios descriptivos: Ayunas ${promAy} mg/dL | Pre-almuerzo ${promPre} mg/dL
Valores usados para titular (menor de ≥3): Ayunas ${minAy} mg/dL | Pre-almuerzo ${minPre} mg/dL
Meta individual de HbA1c: <${targetA1c}%
Esquema actual: AM ${amActual} UI | PM ${pmActual} UI
Nuevo Esquema sugerido: AM ${am} UI | PM ${pm} UI
Dosis total: ${am + pm} UI/día (${Number(dosisKg).toFixed(2)} UI/kg/día)
Razonamiento:
${explicacion}`;
  }

  function buildHighDoseNote({ promAy, promPre, minAy, minPre, targetA1c = 7, amActual, pmActual, am, pm, dosisKg, explicacion = "", acciones = "" } = {}) {
    return `SEGUIMIENTO APS
Promedios descriptivos: Ayunas ${promAy} mg/dL | Pre-almuerzo ${promPre} mg/dL
Valores usados para titular (menor de ≥3): Ayunas ${minAy} mg/dL | Pre-almuerzo ${minPre} mg/dL
Meta individual de HbA1c: <${targetA1c}%
Esquema actual: AM ${amActual} UI | PM ${pmActual} UI
Nuevo Esquema sugerido: AM ${am} UI | PM ${pm} UI
Dosis total: ${am + pm} UI/día (${Number(dosisKg).toFixed(2)} UI/kg/día)
Razonamiento: ${explicacion}

ALERTA DOSIS BASAL ALTA / POSIBLE SOBREINSULINIZACIÓN (≥0,5 UI/kg/día):
${acciones || "No escalar automáticamente. Reevaluar técnica, adherencia, patrón glicémico, alimentación y necesidad de derivación o intensificación especializada."}`;
  }

  function buildLevel3HypoglycemiaNote() {
    return `SEGUIMIENTO APS
ALERTA: HIPOGLICEMIA NIVEL 3 REFERIDA.
El episodio requirió asistencia de otra persona.
No se realiza ajuste automático de NPH.
Conducta: derivación inmediata a Unidad de Emergencia Hospitalaria para evaluación y manejo.
Reevaluar posteriormente el esquema de insulina y las causas del evento antes de reiniciar cualquier titulación ambulatoria.`;
  }

  return Object.freeze({ buildInitialNote, buildFollowupNote, buildHighDoseNote, buildLevel3HypoglycemiaNote });
});