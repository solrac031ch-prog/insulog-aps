"use strict";

(function exposeClinicalCopy(root, factory) {
  const clinicalCopy = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = clinicalCopy;
  }

  if (root) {
    root.InsulogClinicalCopy = clinicalCopy;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function buildInitialNote({
    criteria = "",
    schemeText = "NPH monodosis nocturna",
    reason = "Inicio conservador con NPH nocturna.",
    am = 0,
    pm = 0
  } = {}) {
    return `INICIO
Paciente con criterios de inicio de insulina bajo ${criteria}.
Esquema sugerido: ${schemeText}
Motivo: ${reason}
Se inicia insulina NPH en dosis de:
- ${am} unidades antes del desayuno
- ${pm} unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico en 15 días con seguimiento de glicemia en ayunas y Antes de las once.`;
  }

  function buildFollowupNote({
    promAy,
    promPre,
    promedioGlobal,
    hba1cEstimada,
    amActual,
    pmActual,
    am,
    pm,
    dosisKg,
    explicacion = ""
  } = {}) {
    return `SEGUIMIENTO APS
Promedios usados: Ayunas ${promAy} | Pre-once ${promPre}
Promedio global estimado: ${promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${hba1cEstimada}%
Esquema actual: AM ${amActual} UI | PM ${pmActual} UI
Nuevo Esquema sugerido: AM ${am} UI | PM ${pm} UI
Dosis total: ${am + pm} UI/día (${Number(dosisKg).toFixed(2)} UI/kg/día)
Razonamiento:
${explicacion}`;
  }

  function buildHighDoseNote({
    promAy,
    promPre,
    promedioGlobal,
    hba1cEstimada,
    amActual,
    pmActual,
    am,
    pm,
    explicacion = "",
    acciones = ""
  } = {}) {
    return `SEGUIMIENTO APS
Promedios usados: Ayunas ${promAy} | Pre-once ${promPre}
Promedio global estimado: ${promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${hba1cEstimada}%
Esquema actual: AM ${amActual} UI | PM ${pmActual} UI
Nuevo Esquema sugerido: AM ${am} UI | PM ${pm} UI
Razonamiento: ${explicacion}

ALERTA DOSIS ALTA (>0.7 UI/kg):
${acciones || "Mantener controles y seguimiento por medicina interna APS."}`;
  }

  return Object.freeze({
    buildInitialNote,
    buildFollowupNote,
    buildHighDoseNote
  });
});
