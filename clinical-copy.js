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
    schemeText = "NPH basal monodosis nocturna",
    reason = "Inicio de insulina basal según evaluación clínica.",
    sensitivity = "",
    factor = null,
    am = 0,
    pm = 0
  } = {}) {
    const sensitivityLine = sensitivity
      ? `Sensibilidad a insulina: ${sensitivity}${Number.isFinite(Number(factor)) ? ` (${Number(factor).toFixed(1)} UI/kg)` : ""}\n`
      : "";

    return `INICIO
Criterios clínicos documentados: ${criteria || "No consignados"}.
Esquema sugerido: ${schemeText}
Motivo: ${reason}
${sensitivityLine}Se inicia insulina NPH en dosis de:
- ${am} unidades antes del desayuno
- ${pm} unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico según capacidad local, con al menos 3 glicemias de ayuno en días diferentes para titulación.`;
  }

  function buildFollowupNote({
    minAy,
    minPre,
    promAy,
    promPre,
    promedioGlobal,
    targetHba1c = 7,
    amActual,
    pmActual,
    am,
    pm,
    dosisKg,
    explicacion = ""
  } = {}) {
    return `SEGUIMIENTO APS
Meta individual de HbA1c: <${String(targetHba1c).replace(".", ",")}%
Valores usados para titulación MINSAL: menor ayuno ${minAy} mg/dL | menor pre-almuerzo ${minPre} mg/dL
Promedios descriptivos: ayuno ${promAy} mg/dL | pre-almuerzo ${promPre} mg/dL
Promedio capilar global del registro: ${promedioGlobal} mg/dL
Esquema actual: AM ${amActual} UI | PM ${pmActual} UI
Nuevo esquema sugerido: AM ${am} UI | PM ${pm} UI
Dosis total: ${am + pm} UI/día (${Number(dosisKg).toFixed(2)} UI/kg/día)
Razonamiento:
${explicacion}`;
  }

  function buildHighDoseNote({
    minAy,
    minPre,
    promAy,
    promPre,
    promedioGlobal,
    targetHba1c = 7,
    amActual,
    pmActual,
    am,
    pm,
    dosisKg,
    explicacion = "",
    acciones = ""
  } = {}) {
    return `SEGUIMIENTO APS
Meta individual de HbA1c: <${String(targetHba1c).replace(".", ",")}%
Valores usados para titulación MINSAL: menor ayuno ${minAy} mg/dL | menor pre-almuerzo ${minPre} mg/dL
Promedios descriptivos: ayuno ${promAy} mg/dL | pre-almuerzo ${promPre} mg/dL
Promedio capilar global del registro: ${promedioGlobal} mg/dL
Esquema actual: AM ${amActual} UI | PM ${pmActual} UI
Nuevo esquema sugerido: AM ${am} UI | PM ${pm} UI
Dosis total: ${am + pm} UI/día (${Number(dosisKg).toFixed(2)} UI/kg/día)
Razonamiento:
${explicacion}

ALERTA DOSIS BASAL ≥0,5 UI/kg/día / POSIBLE SOBREINSULINIZACIÓN:
${acciones || "No escalar automáticamente. Revisar técnica, adherencia, alimentación, patrón glicémico y necesidad de derivación."}`;
  }

  return Object.freeze({
    buildInitialNote,
    buildFollowupNote,
    buildHighDoseNote
  });
});
