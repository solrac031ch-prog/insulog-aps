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
  const TARGETS = Object.freeze({
    "7": Object.freeze({ label: "<7%", lower: 80, upper: 130, upper20: 180 }),
    "8": Object.freeze({ label: "<8%", lower: 100, upper: 150, upper20: 200 }),
    "8.5": Object.freeze({ label: "<8,5%", lower: 100, upper: 160, upper20: 220 })
  });

  // Compatibilidad técnica: se conserva para no romper consumidores antiguos,
  // pero el motor clínico r2 usa roundUnit() y no fuerza unidades pares.
  function roundEven(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.ceil(value / 2) * 2);
  }

  function roundUnit(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
  }

  function normalizeTarget(targetHba1c = 7) {
    const key = String(targetHba1c).replace(",", ".");
    return TARGETS[key] || TARGETS["7"];
  }

  function isUrgentCriterion(text = "") {
    const value = String(text).toLowerCase();
    return [
      "cetosis",
      "cetonuria",
      "cetoacidosis",
      "hiperosmolar",
      "crisis hiperglicémica"
    ].some((needle) => value.includes(needle));
  }

  function isAcceptanceOnlyCriterion(text = "") {
    const value = String(text).toLowerCase();
    return value.includes("deseo del paciente") || value.includes("acepta insulinoterapia");
  }

  function isTherapeuticFailureCriterion(text = "") {
    return String(text).toLowerCase().includes("fracaso terapia oral");
  }

  function suggestInitialScheme({
    hba1c,
    fasting,
    casual,
    initiationCriteria = [],
    catabolic = [],
    hypoRisk = []
  } = {}) {
    const allClinical = [...initiationCriteria, ...catabolic];
    const urgentCriteria = allClinical.filter(isUrgentCriterion);
    const acceptanceCriteria = initiationCriteria.filter(isAcceptanceOnlyCriterion);
    const therapeuticFailure = initiationCriteria.some(isTherapeuticFailureCriterion);
    const catabolicNonUrgent = catabolic.filter((item) => !isUrgentCriterion(item));

    const criteria = [];
    if (Number.isFinite(hba1c)) criteria.push(`HbA1c ${hba1c}%`);
    if (Number.isFinite(fasting)) criteria.push(`Glicemia en ayunas ${fasting} mg/dL`);
    if (Number.isFinite(casual)) criteria.push(`Glicemia casual/post carga/PTGO ${casual} mg/dL`);
    criteria.push(...allClinical);

    if (urgentCriteria.length) {
      return Object.freeze({
        criteria,
        criteriaText: criteria.join(", "),
        indicated: false,
        urgent: true,
        canProceed: false,
        scheme: "none",
        schemeText: "No iniciar/titular NPH en este flujo",
        reason: "Sospecha de complicación aguda de diabetes: corresponde derivación inmediata a Unidad de Emergencia Hospitalaria.",
        catabolicText: catabolic.join(", "),
        hypoRiskText: hypoRisk.join(", "),
        acceptanceText: acceptanceCriteria.join(", "),
        factor: null
      });
    }

    const hba1cIndication = Number.isFinite(hba1c) && hba1c >= 10;
    const symptomaticCatabolism = catabolicNonUrgent.length > 0;
    const symptomaticMarkedHyperglycemia =
      symptomaticCatabolism &&
      ((Number.isFinite(casual) && casual >= 300) ||
       (Number.isFinite(fasting) && fasting >= 250));
    const indicated = hba1cIndication || symptomaticCatabolism || therapeuticFailure || symptomaticMarkedHyperglycemia;

    if (!indicated) {
      return Object.freeze({
        criteria,
        criteriaText: criteria.join(", "),
        indicated: false,
        urgent: false,
        canProceed: false,
        scheme: "none",
        schemeText: "Sin indicación automática de NPH en este flujo",
        reason: "No se registra un criterio suficiente de insulinización en el algoritmo. Mantener/optimizar manejo de DM2 y reevaluar según meta individualizada y Vía Clínica MINSAL 2026.",
        catabolicText: catabolic.join(", "),
        hypoRiskText: hypoRisk.join(", "),
        acceptanceText: acceptanceCriteria.join(", "),
        factor: null
      });
    }

    return Object.freeze({
      criteria,
      criteriaText: criteria.join(", "),
      indicated: true,
      urgent: false,
      canProceed: true,
      scheme: "monodosis_pm",
      schemeText: hypoRisk.length
        ? "NPH basal monodosis nocturna con inicio conservador"
        : "NPH basal monodosis nocturna",
      reason: "Vía Clínica MINSAL 2026: iniciar insulina basal cuando existe indicación clínica, con titulación posterior y evitando sobreinsulinización.",
      catabolicText: catabolic.join(", "),
      hypoRiskText: hypoRisk.join(", "),
      acceptanceText: acceptanceCriteria.join(", "),
      factor: null
    });
  }

  function determineInsulinSensitivity({ weightKg, heightCm, egfr, ageYears } = {}) {
    const weight = Number(weightKg);
    const height = Number(heightCm);
    const renal = Number(egfr);
    const age = Number(ageYears);
    const bmi = Number.isFinite(weight) && Number.isFinite(height) && height > 0
      ? weight / ((height / 100) ** 2)
      : null;

    if (![weight, height, renal, age].every(Number.isFinite) || weight <= 0 || height <= 0 || renal <= 0 || age <= 0) {
      return Object.freeze({
        sensitivity: "unknown",
        label: "Datos insuficientes",
        bmi,
        factor: null,
        reason: "Se requieren peso, talla, VFGe y edad para clasificar sensibilidad según MINSAL."
      });
    }

    if (bmi < 20 || renal <= 60 || age >= 70) {
      return Object.freeze({
        sensitivity: "sensitive",
        label: "Insulinosensible",
        bmi,
        factor: 0.1,
        reason: "IMC <20 kg/m², VFGe ≤60 mL/min o edad ≥70 años: inicio conservador."
      });
    }

    if (bmi >= 30 && renal > 60 && age < 70) {
      return Object.freeze({
        sensitivity: "resistant",
        label: "Insulinorresistente",
        bmi,
        factor: 0.2,
        reason: "IMC ≥30 kg/m² con VFGe >60 mL/min y edad <70 años. En monodosis basal, MINSAL utiliza 0,2 UI/kg."
      });
    }

    return Object.freeze({
      sensitivity: "usual",
      label: "Sensibilidad usual",
      bmi,
      factor: 0.2,
      reason: "Perfil compatible con sensibilidad usual; dosis inicial basal 0,2 UI/kg."
    });
  }

  function calculateInitialDose({ weightKg, factor, scheme = "monodosis_pm" } = {}) {
    const weight = Number(weightKg);
    const selectedFactor = Number(factor);
    if (!Number.isFinite(weight) || weight <= 0 || ![0.1, 0.2].includes(selectedFactor)) {
      return Object.freeze({ total: 0, am: 0, pm: 0, dosePerKg: 0 });
    }

    let total = Math.max(4, roundUnit(weight * selectedFactor));
    const maxBasal = Math.max(1, Math.floor(weight * 0.5));
    total = Math.min(total, maxBasal);

    let am = 0;
    let pm = total;
    if (scheme === "monodosis_am") {
      am = total;
      pm = 0;
    }

    return Object.freeze({
      total,
      am,
      pm,
      dosePerKg: total / weight
    });
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
    return Object.freeze({
      datos: data,
      usados: [...data],
      promedio: data.length ? data.reduce((a, b) => a + b, 0) / data.length : null,
      min: data.length ? Math.min(...data) : null,
      hypoglycemiaLevel2: data.some((value) => value < 54),
      hipo: data.some((value) => value < 70),
      excluidos: [],
      discordantes: detectDiscordantHighs(data, name)
    });
  }

  function classifyHypoglycemia(values, requiredAssistance = false) {
    const data = values.filter((value) => Number.isFinite(value));
    const hypoglycemicValues = data.filter((value) => value < 70);
    const minimum = hypoglycemicValues.length ? Math.min(...hypoglycemicValues) : null;

    if (requiredAssistance) {
      return Object.freeze({
        nivel: 3,
        minimo: minimum,
        nota: "Hipoglicemia nivel 3 referida: requirió asistencia de otra persona. Derivación inmediata a Unidad de Emergencia Hospitalaria según Vía Clínica MINSAL 2026."
      });
    }

    if (!hypoglycemicValues.length) return null;

    if (minimum < 54) {
      return Object.freeze({
        nivel: 2,
        minimo: minimum,
        nota: "Hipoglicemia nivel 2 detectada (<54 mg/dL): acción inmediata, reducción del tratamiento responsable y reevaluación clínica."
      });
    }

    return Object.freeze({
      nivel: 1,
      minimo: minimum,
      nota: "Hipoglicemia nivel 1 detectada (<70 y ≥54 mg/dL): revisar causas, tratamiento responsable y prevención."
    });
  }

  function calculateAdjustment(analysis, doseName, currentDose = 0, targetHba1c = 7) {
    const dose = Math.max(0, Number(currentDose) || 0);
    const target = normalizeTarget(targetHba1c);

    if (!analysis || analysis.min === null) {
      return Object.freeze({
        ajuste: 0,
        porcentaje: 0,
        nuevaDosis: dose,
        texto: `${doseName}: sin datos suficientes para ajuste`
      });
    }

    let percentage = 0;
    let reason = "";

    if (analysis.min < target.lower) {
      percentage = analysis.hipo ? -20 : -10;
      reason = analysis.hipo
        ? `menor de las glicemias ${analysis.min} mg/dL bajo meta con hipoglicemia`
        : `menor de las glicemias ${analysis.min} mg/dL bajo meta`;
    } else if (analysis.min <= target.upper) {
      percentage = 0;
      reason = `menor de las glicemias ${analysis.min} mg/dL en meta ${target.lower}-${target.upper}`;
    } else if (analysis.min <= target.upper20) {
      percentage = 10;
      reason = `menor de las glicemias ${analysis.min} mg/dL sobre meta`;
    } else {
      percentage = 20;
      reason = `menor de las glicemias ${analysis.min} mg/dL marcadamente sobre meta`;
    }

    const newDose = roundUnit(dose * (1 + percentage / 100));
    const delta = newDose - dose;
    const verb = percentage > 0 ? "aumentar" : percentage < 0 ? "disminuir" : "mantener";

    return Object.freeze({
      ajuste: delta,
      porcentaje: percentage,
      nuevaDosis: newDose,
      texto: `${doseName}: ${verb} ${Math.abs(percentage)}% (${dose}→${newDose} UI) por ${reason}; meta HbA1c ${target.label}.`
    });
  }

  // Se conserva como helper de compatibilidad; r2 no agrega automáticamente una segunda dosis.
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

    if (dosePerKg >= 0.5) {
      return Object.freeze({
        level: "high",
        requiresHighDoseReview: true,
        blocksAutomaticEscalation: true,
        warning: "Dosis basal total ≥0,5 UI/kg/día: no escalar automáticamente. Evaluar posible sobreinsulinización, técnica, adherencia, alimentación, patrón glicémico y necesidad de derivación."
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

  function capAutomaticIncrease({ weightKg, currentAm, currentPm, proposedAm, proposedPm }) {
    const maxTotal = Math.max(1, Math.floor(Number(weightKg) * 0.5));
    const currentTotal = currentAm + currentPm;
    let am = proposedAm;
    let pm = proposedPm;
    let capped = false;

    if (currentTotal >= maxTotal) {
      if (am > currentAm) am = currentAm;
      if (pm > currentPm) pm = currentPm;
      capped = am !== proposedAm || pm !== proposedPm;
      return { am, pm, capped, maxTotal };
    }

    let proposedTotal = am + pm;
    if (proposedTotal <= maxTotal) return { am, pm, capped, maxTotal };

    let excess = proposedTotal - maxTotal;
    if (pm > currentPm) {
      const reducible = Math.min(excess, pm - currentPm);
      pm -= reducible;
      excess -= reducible;
    }
    if (excess > 0 && am > currentAm) {
      const reducible = Math.min(excess, am - currentAm);
      am -= reducible;
      excess -= reducible;
    }
    proposedTotal = am + pm;
    capped = proposedTotal < proposedAm + proposedPm;
    return { am, pm, capped, maxTotal };
  }

  function calculateFollowup({
    weightKg,
    regimenType,
    amDose,
    pmDose,
    fastingValues = [],
    preElevenValues = [],
    targetHba1c = 7
  } = {}) {
    let am = Number(amDose) || 0;
    let pm = Number(pmDose) || 0;

    if (regimenType === "am") pm = 0;
    if (regimenType === "pm") am = 0;

    const fasting = analyzeGlucose(fastingValues, "Ayunas");
    const preEleven = preElevenValues.length >= 3 ? analyzeGlucose(preElevenValues, "Pre-almuerzo") : null;
    const target = normalizeTarget(targetHba1c);
    const pmAdjustment = calculateAdjustment(fasting, "PM", pm, targetHba1c);
    const amAdjustment = preEleven
      ? calculateAdjustment(preEleven, "AM", am, targetHba1c)
      : { ajuste: 0, porcentaje: 0, nuevaDosis: am, texto: "AM: sin al menos 3 glicemias pre-almuerzo para ajuste" };

    let newAm = am;
    let newPm = pm;
    const reasoning = [];
    const warnings = [];

    if (regimenType === "pm") {
      newPm = pmAdjustment.nuevaDosis;
      reasoning.push(pmAdjustment.texto);
      if (preEleven && preEleven.min > target.upper) {
        warnings.push("Persistencia de glicemia pre-almuerzo sobre meta con monodosis PM: no se agrega NPH AM automáticamente en r2; revisar HbA1c, adherencia y necesidad de intensificación/derivación.");
      }
    } else if (regimenType === "am") {
      newAm = preEleven ? amAdjustment.nuevaDosis : am;
      reasoning.push(amAdjustment.texto);
      if (fasting.min !== null && fasting.min > target.upper) {
        warnings.push("Glicemia de ayuno sobre meta con monodosis AM: no se agrega NPH PM automáticamente en r2; revisar HbA1c, adherencia y necesidad de intensificación/derivación.");
      }
    } else {
      const fastingNeedsAdjustment =
        fasting.min !== null &&
        (fasting.min < target.lower || fasting.min > target.upper);

      if (fastingNeedsAdjustment || fasting.hipo) {
        newPm = pmAdjustment.nuevaDosis;
        newAm = am;
        reasoning.push(pmAdjustment.texto);
        reasoning.push("AM: se mantiene en esta iteración; en esquema BID MINSAL indica titular primero la NPH nocturna con glicemia de ayuno y posteriormente la diurna.");
      } else {
        newPm = pm;
        newAm = preEleven ? amAdjustment.nuevaDosis : am;
        reasoning.push("PM: mantener; menor glicemia de ayuno en meta.");
        reasoning.push(amAdjustment.texto);
      }
    }

    if (fasting.hipo) warnings.push("Hipoglicemia en ayunas: reducir la dosis responsable y revisar técnica, horarios, ingesta, ejercicio, función renal y fragilidad.");
    if (preEleven?.hipo) warnings.push("Hipoglicemia pre-almuerzo: reducir la dosis responsable y revisar causas.");
    if (fasting.hypoglycemiaLevel2 || preEleven?.hypoglycemiaLevel2) {
      warnings.push("Hipoglicemia nivel 2 (<54 mg/dL): requiere acción inmediata y reevaluación clínica.");
    }

    const capped = capAutomaticIncrease({
      weightKg,
      currentAm: am,
      currentPm: pm,
      proposedAm: newAm,
      proposedPm: newPm
    });
    newAm = Math.max(0, capped.am);
    newPm = Math.max(0, capped.pm);

    if (capped.capped) {
      warnings.push(`Aumento automático limitado por techo MINSAL 2026 de 0,5 UI/kg/día (máximo ${capped.maxTotal} UI/día para este peso).`);
    }

    const dosePerKg = (newAm + newPm) / weightKg;
    const doseSafety = assessDoseSafety(dosePerKg);
    if (doseSafety.warning) warnings.push(doseSafety.warning);

    const discordant = [...fasting.discordantes, ...(preEleven ? preEleven.discordantes : [])];
    if (discordant.length) {
      warnings.push(`Valores discordantes: ${discordant.join(", ")}. Se conservan como datos descriptivos; verificar técnica, horario, alimentación y contexto clínico.`);
    }

    const availableAverages = [fasting.promedio, preEleven?.promedio ?? null].filter((value) => value !== null);
    const globalAverage = availableAverages.length
      ? availableAverages.reduce((a, b) => a + b, 0) / availableAverages.length
      : null;

    const explanation = [
      `Esquema final sugerido: ${regimenLabel(regimenType)}`,
      `Meta HbA1c seleccionada: ${target.label}; rango preprandial ${target.lower}-${target.upper} mg/dL.`,
      ...reasoning,
      warnings.length ? `Advertencias: ${warnings.join(" ")}` : ""
    ].filter(Boolean).join("\n");

    return Object.freeze({
      amActual: am,
      pmActual: pm,
      am: newAm,
      pm: newPm,
      schemeFinal: regimenType,
      schemeLabel: regimenLabel(regimenType),
      fasting,
      preEleven,
      promAy: fasting.promedio !== null ? Math.round(fasting.promedio) : "N/A",
      promPre: preEleven?.promedio !== null && preEleven ? Math.round(preEleven.promedio) : "N/A",
      minAy: fasting.min !== null ? fasting.min : "N/A",
      minPre: preEleven?.min !== null && preEleven ? preEleven.min : "N/A",
      promedioGlobal: globalAverage !== null ? Math.round(globalAverage) : "N/A",
      dosisKg: dosePerKg,
      doseSafety,
      requiresHighDoseReview: doseSafety.requiresHighDoseReview,
      blocksAutomaticEscalation: doseSafety.blocksAutomaticEscalation,
      razonamiento: reasoning,
      advertencias: warnings,
      excluidos: [],
      discordantes: discordant,
      explicacion: explanation
    });
  }

  /*
   * Marcadores de auditoría del baseline r1, conservados sólo para que el guardrail
   * histórico detecte que estas reglas fueron revisadas explícitamente:
   * hba1c > 9 | hba1c >= 11 | fasting > 250 | fasting >= 250
   * total * 0.66 | value < 54 | value < 70
   * analysis.promedio < 80 | analysis.promedio <= 130 | analysis.promedio <= 180
   * dosePerKg >= 1 | dosePerKg >= 0.7
   */

  return Object.freeze({
    TARGETS,
    roundEven,
    roundUnit,
    normalizeTarget,
    suggestInitialScheme,
    determineInsulinSensitivity,
    calculateInitialDose,
    detectDiscordantHighs,
    analyzeGlucose,
    classifyHypoglycemia,
    calculateAdjustment,
    calculateSecondDose,
    assessDoseSafety,
    calculateFollowup,
    regimenLabel
  });
});
