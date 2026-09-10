"use strict";

(function exposeClinicalEngine(root, factory) {
  const engine = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  }

  if (root) {
    root.InsulogClinicalEngine = engine;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function roundEven(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.ceil(value / 2) * 2);
  }

  function suggestInitialScheme({
    hba1c,
    fasting,
    casual,
    initiationCriteria = [],
    catabolic = [],
    hypoRisk = []
  } = {}) {
    const criteria = [];

    if (!Number.isNaN(hba1c) && hba1c > 9) criteria.push(`HbA1c ${hba1c}%`);
    if (!Number.isNaN(fasting) && fasting > 250) criteria.push(`Glicemia en ayunas ${fasting} mg/dL`);
    if (!Number.isNaN(casual) && casual >= 300) criteria.push(`Glicemia casual/post carga/PTGO ${casual} mg/dL`);
    criteria.push(...initiationCriteria, ...catabolic);

    let scheme = "monodosis_pm";
    let schemeText = "NPH monodosis nocturna";
    let reason = "Datos insuficientes para justificar doble dosis o hiperglicemia principalmente en ayunas; se sugiere inicio conservador.";

    const highSeverity =
      (!Number.isNaN(hba1c) && hba1c >= 11) ||
      (!Number.isNaN(fasting) && fasting >= 250) ||
      (!Number.isNaN(casual) && casual >= 300) ||
      catabolic.length > 0;

    if (highSeverity && hypoRisk.length === 0) {
      scheme = "doble_dosis";
      schemeText = "NPH doble dosis AM + PM";
      reason = "HbA1c/glicemias marcadamente elevadas o síntomas catabólicos, compatible con hiperglicemia sostenida.";
    }

    let factor = 0.2;
    if (hypoRisk.length > 0) {
      scheme = "monodosis_pm";
      schemeText = "NPH monodosis nocturna con inicio conservador";
      reason = "Alto riesgo de hipoglicemia; se sugiere dosis menor, ajuste progresivo y control precoz.";
      factor = 0.1;
    }

    return {
      criteria,
      criteriaText: criteria.join(", "),
      scheme,
      schemeText,
      reason,
      catabolicText: catabolic.join(", "),
      hypoRiskText: hypoRisk.join(", "),
      factor
    };
  }

  function calculateInitialDose({ weightKg, factor, scheme } = {}) {
    let total = roundEven(weightKg * factor);
    total = Math.max(4, total);

    let am = 0;
    let pm = total;

    if (scheme === "doble_dosis") {
      am = roundEven(total * 0.66);
      pm = Math.max(0, total - am);
    }

    return {
      total,
      am,
      pm,
      dosePerKg: total / weightKg
    };
  }

  function detectDiscordantHighs(values, name) {
    const data = values.filter((value) => Number.isFinite(value));
    if (data.length < 4) return [];

    return data.flatMap((value, index) => {
      if (value < 70) return [];

      const rest = data.filter((_, currentIndex) => currentIndex !== index);
      const restAverage = rest.reduce((a, b) => a + b, 0) / rest.length;
      return value > restAverage + 50 ? [`${name} ${value} mg/dL`] : [];
    });
  }

  function analyzeGlucose(values, name) {
    const data = values.filter((value) => Number.isFinite(value));
    const discordant = detectDiscordantHighs(data, name);

    return {
      datos: data,
      usados: [...data],
      promedio: data.length ? data.reduce((a, b) => a + b, 0) / data.length : null,
      min: data.length ? Math.min(...data) : null,
      hipoSevera: data.some((value) => value < 54),
      hipo: data.some((value) => value < 70),
      excluidos: [],
      discordantes: discordant
    };
  }

  function calculateAdjustment(analysis, doseName) {
    if (!analysis || analysis.promedio === null) {
      return { ajuste: 0, texto: `${doseName}: sin datos suficientes para ajuste` };
    }

    if (analysis.hipoSevera) {
      return { ajuste: -4, texto: `${doseName}: reducir 4 UI por glicemia <54 mg/dL. Priorizar seguridad y evaluación clínica` };
    }

    if (analysis.hipo) {
      return { ajuste: -4, texto: `${doseName}: reducir 4 UI por glicemia <70 mg/dL` };
    }

    if (analysis.promedio < 80) {
      return { ajuste: -2, texto: `${doseName}: reducir 2 UI por promedio 70-79 mg/dL` };
    }

    if (analysis.promedio <= 130) {
      return { ajuste: 0, texto: `${doseName}: mantener por promedio en meta 80-130 mg/dL` };
    }

    if (analysis.promedio <= 180) {
      return { ajuste: 2, texto: `${doseName}: aumentar 2 UI por promedio 131-180 mg/dL` };
    }

    return { ajuste: 4, texto: `${doseName}: aumentar 4 UI por promedio >180 mg/dL` };
  }

  function calculateSecondDose(weightKg) {
    return roundEven(Math.min(10, Math.max(4, weightKg * 0.1)));
  }

  function assessDoseSafety(dosePerKg) {
    if (!Number.isFinite(dosePerKg)) {
      return Object.freeze({
        level: "unknown",
        requiresHighDoseReview: false,
        blocksAutomaticEscalation: false,
        warning: ""
      });
    }

    if (dosePerKg >= 1) {
      return Object.freeze({
        level: "stop",
        requiresHighDoseReview: true,
        blocksAutomaticEscalation: true,
        warning: "Dosis ≥1 UI/kg/día: no seguir escalando automáticamente en APS sin evaluación clínica; revisar técnica, adherencia, lipohipertrofia, alimentación y considerar derivación."
      });
    }

    if (dosePerKg >= 0.7) {
      return Object.freeze({
        level: "high",
        requiresHighDoseReview: true,
        blocksAutomaticEscalation: false,
        warning: "Dosis ≥0.7 UI/kg/día: dosis alta; revisar técnica, adherencia, sitios de punción, alimentación y necesidad de evaluación por Medicina Interna APS."
      });
    }

    return Object.freeze({
      level: "standard",
      requiresHighDoseReview: false,
      blocksAutomaticEscalation: false,
      warning: ""
    });
  }

  function regimenLabel(regimenType) {
    if (regimenType === "2") return "NPH AM + PM";
    if (regimenType === "am") return "NPH solo AM";
    return "NPH solo PM";
  }

  function calculateFollowup({
    weightKg,
    regimenType,
    amDose,
    pmDose,
    fastingValues = [],
    preElevenValues = []
  } = {}) {
    let am = Number(amDose) || 0;
    let pm = Number(pmDose) || 0;

    if (regimenType === "am") pm = 0;
    if (regimenType === "pm") am = 0;

    const fasting = analyzeGlucose(fastingValues, "Ayunas");
    const preEleven = preElevenValues.length >= 3 ? analyzeGlucose(preElevenValues, "Pre-once") : null;
    const fastingUpperTarget = 130;
    const preElevenUpperTarget = 130;
    const pmAdjustment = calculateAdjustment(fasting, "PM");
    const amAdjustment = preEleven
      ? calculateAdjustment(preEleven, "AM")
      : { ajuste: 0, texto: "AM: sin datos suficientes de pre-once para ajuste" };
    const fastingHypo = fasting.hipo || fasting.hipoSevera;
    const preElevenHypo = preEleven ? preEleven.hipo || preEleven.hipoSevera : false;
    const anyHypo = fastingHypo || preElevenHypo;

    let newAm = am;
    let newPm = pm;
    let finalRegimen = regimenType;
    const reasoning = [];
    const warnings = [];

    if (anyHypo) {
      if (regimenType === "pm") {
        newPm = roundEven(pm + pmAdjustment.ajuste);
        reasoning.push(pmAdjustment.texto);
        reasoning.push("No se agrega dosis AM por presencia de hipoglicemia; reevaluar causa antes de intensificar.");
      } else if (regimenType === "am") {
        newAm = preElevenHypo ? roundEven(am + amAdjustment.ajuste) : roundEven(am - 2);
        reasoning.push(preElevenHypo ? amAdjustment.texto : "AM: reducir 2 UI por hipoglicemia registrada con monodosis AM.");
        reasoning.push("No se agrega dosis PM por presencia de hipoglicemia; reevaluar causa antes de intensificar.");
      } else {
        newPm = roundEven(pm + pmAdjustment.ajuste);
        newAm = preEleven ? roundEven(am + amAdjustment.ajuste) : am;
        reasoning.push(pmAdjustment.texto, amAdjustment.texto);
      }

      warnings.push("Hipoglicemia: priorizar seguridad. Revisar técnica de administración, horarios, ingesta, ejercicio, función renal y fragilidad.");
    } else if (regimenType === "pm") {
      newPm = roundEven(pm + pmAdjustment.ajuste);
      reasoning.push(pmAdjustment.texto);

      if (preEleven && preEleven.promedio > preElevenUpperTarget) {
        newAm = calculateSecondDose(weightKg);
        finalRegimen = "2";
        reasoning.push(`AM: agregar ${newAm} UI de NPH antes del desayuno por promedio pre-once ${Math.round(preEleven.promedio)} mg/dL sobre meta. Se intensifica desde monodosis PM a esquema AM + PM.`);
      } else if (preEleven) {
        reasoning.push(`AM: no se agrega dosis matinal porque promedio pre-once ${Math.round(preEleven.promedio)} mg/dL está en meta.`);
      } else {
        reasoning.push("AM: no se puede evaluar intensificación a dosis matinal por falta de al menos 3 glicemias pre-once.");
      }
    } else if (regimenType === "am") {
      newAm = preEleven ? roundEven(am + amAdjustment.ajuste) : am;
      reasoning.push(amAdjustment.texto);

      if (fasting.promedio > fastingUpperTarget) {
        newPm = calculateSecondDose(weightKg);
        finalRegimen = "2";
        reasoning.push(`PM: agregar ${newPm} UI de NPH antes de dormir por promedio ayunas ${Math.round(fasting.promedio)} mg/dL sobre meta. Se intensifica desde monodosis AM a esquema AM + PM.`);
      } else {
        reasoning.push(`PM: no se agrega dosis nocturna porque promedio ayunas ${Math.round(fasting.promedio)} mg/dL está en meta.`);
      }
    } else {
      newPm = roundEven(pm + pmAdjustment.ajuste);
      newAm = preEleven ? roundEven(am + amAdjustment.ajuste) : am;
      reasoning.push(pmAdjustment.texto, amAdjustment.texto);
    }

    newAm = Math.max(0, newAm);
    newPm = Math.max(0, newPm);

    const dosePerKg = (newAm + newPm) / weightKg;
    const doseSafety = assessDoseSafety(dosePerKg);
    const excluded = [...fasting.excluidos, ...(preEleven ? preEleven.excluidos : [])];
    const discordant = [...fasting.discordantes, ...(preEleven ? preEleven.discordantes : [])];

    if (fasting.hipoSevera) {
      warnings.push("Hipoglicemia severa en ayunas: considerar evaluación clínica precoz y reducción de NPH PM.");
    } else if (fasting.hipo) {
      warnings.push("Hipoglicemia en ayunas: reducir NPH PM y evaluar causas.");
    }

    if (preEleven?.hipoSevera) {
      warnings.push("Hipoglicemia severa pre-once: considerar evaluación clínica precoz y reducción de NPH AM.");
    } else if (preEleven?.hipo) {
      warnings.push("Hipoglicemia pre-once: reducir NPH AM y evaluar causas.");
    }

    if (newAm === 0 && (regimenType === "2" || regimenType === "am")) {
      warnings.push("Dosis AM queda en 0 UI: interpretar como suspensión de dosis matinal.");
    }

    if (newPm === 0 && (regimenType === "2" || regimenType === "pm")) {
      warnings.push("Dosis PM queda en 0 UI: interpretar como suspensión de dosis nocturna.");
    }

    if (doseSafety.warning) {
      warnings.push(doseSafety.warning);
    }

    const availableAverages = [
      fasting.promedio,
      preEleven?.promedio ?? null
    ].filter((value) => value !== null);

    const globalAverage = availableAverages.length
      ? availableAverages.reduce((a, b) => a + b, 0) / availableAverages.length
      : null;

    const estimatedHba1c = globalAverage !== null
      ? ((globalAverage + 46.7) / 28.7).toFixed(1)
      : "N/A";

    const explanation = [
      `Esquema final sugerido: ${regimenLabel(finalRegimen)}`,
      ...reasoning,
      excluded.length ? `Valores altos aislados excluidos del promedio: ${excluded.join(", ")}` : "",
      discordant.length ? `Valores discordantes: ${discordant.join(", ")}. Se mantienen en el promedio; verificar técnica, horario, alimentación y contexto clínico antes de excluirlos manualmente.` : "",
      warnings.length ? `Advertencias: ${warnings.join(" ")}` : ""
    ].filter(Boolean).join("\n");

    return {
      amActual: am,
      pmActual: pm,
      am: newAm,
      pm: newPm,
      schemeFinal: finalRegimen,
      schemeLabel: regimenLabel(finalRegimen),
      fasting,
      preEleven,
      promAy: fasting.promedio !== null ? Math.round(fasting.promedio) : "N/A",
      promPre: preEleven?.promedio !== null && preEleven ? Math.round(preEleven.promedio) : "N/A",
      promedioGlobal: globalAverage !== null ? Math.round(globalAverage) : "N/A",
      hba1cEstimada: estimatedHba1c,
      dosisKg: dosePerKg,
      doseSafety,
      requiresHighDoseReview: doseSafety.requiresHighDoseReview,
      blocksAutomaticEscalation: doseSafety.blocksAutomaticEscalation,
      razonamiento: reasoning,
      advertencias: warnings,
      excluidos: excluded,
      discordantes: discordant,
      explicacion: explanation
    };
  }

  return Object.freeze({
    roundEven,
    suggestInitialScheme,
    calculateInitialDose,
    detectDiscordantHighs,
    analyzeGlucose,
    calculateAdjustment,
    calculateSecondDose,
    assessDoseSafety,
    calculateFollowup,
    regimenLabel
  });
});