"use strict";

(function exposeClinicalEngine(root, factory) {
  const engine = factory();

  if (typeof module === "object" && module.exports) module.exports = engine;
  if (root) root.InsulogClinicalEngine = engine;
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const TARGET_PROFILES = Object.freeze({
    7: Object.freeze({ hba1c: 7, lower: 80, upper: 130, high10: 180 }),
    8: Object.freeze({ hba1c: 8, lower: 100, upper: 150, high10: 200 }),
    8.5: Object.freeze({ hba1c: 8.5, lower: 100, upper: 160, high10: 220 })
  });

  const CLINICAL_ENGINE_VERSION = "APS-NPH-2026.09.21-r3";
  const LEVEL3_NPH_REDUCTION_PERCENT = 20;
  const MIN_REQUIRED_READINGS = 3;
  const GLUCOSE_MIN_MGDL = 1;
  const GLUCOSE_MAX_MGDL = 700;

  function normalizeGlucoseValues(values = []) {
    const valid = [];
    const invalid = [];
    for (const raw of values) {
      const value = Number(raw);
      if (!Number.isFinite(value)) continue;
      if (!Number.isInteger(value) || value < GLUCOSE_MIN_MGDL || value > GLUCOSE_MAX_MGDL) invalid.push(value);
      else valid.push(value);
    }
    return Object.freeze({ valid: Object.freeze(valid), invalid: Object.freeze(invalid) });
  }

  function roundUnits(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.round(value));
  }

  function roundEven(value) { return roundUnits(value); }

  function normalizeTargetA1c(value = 7) {
    const target = Number(value);
    if (target >= 8.5) return 8.5;
    if (target >= 8) return 8;
    return 7;
  }

  function targetProfile(value = 7) { return TARGET_PROFILES[normalizeTargetA1c(value)]; }

  function containsAcuteEmergency(values = []) {
    return values.some((value) => /cetoacidosis|cetosis|cetonuria|hiperosmolar|crisis hiperglic[eé]mica/i.test(String(value)));
  }

  function assessInsulinSensitivity({ age, bmi, egfr, hypoRisk = [] } = {}) {
    const ageValue = Number(age);
    const bmiValue = Number(bmi);
    const egfrValue = Number(egfr);
    if (!Number.isFinite(ageValue) || !Number.isFinite(bmiValue) || !Number.isFinite(egfrValue)) {
      return Object.freeze({ category: "uncertain", factor: 0.1, label: "Datos incompletos · inicio conservador" });
    }
    const sensitive = hypoRisk.length > 0 ||
      (Number.isFinite(bmiValue) && bmiValue < 20) ||
      (Number.isFinite(egfrValue) && egfrValue < 60) ||
      (Number.isFinite(ageValue) && ageValue > 70);

    if (sensitive) return Object.freeze({ category: "sensitive", factor: 0.1, label: "Insulinosensible" });

    const resistant = Number.isFinite(bmiValue) && bmiValue >= 30 &&
      Number.isFinite(egfrValue) && egfrValue >= 60 &&
      Number.isFinite(ageValue) && ageValue < 70;

    if (resistant) return Object.freeze({ category: "resistant", factor: 0.2, label: "Insulinorresistente" });
    return Object.freeze({ category: "usual", factor: 0.2, label: "Sensibilidad usual" });
  }

  function suggestInitialScheme({ hba1c, fasting, casual, initiationCriteria = [], catabolic = [], hypoRisk = [], age, bmi, egfr } = {}) {
    const hba1cValue = Number(hba1c);
    const fastingValue = Number(fasting);
    const casualValue = Number(casual);
    const allClinicalFlags = [...initiationCriteria, ...catabolic];
    const emergency = containsAcuteEmergency(allClinicalFlags);
    const sensitivity = assessInsulinSensitivity({ age, bmi, egfr, hypoRisk });

    if (emergency) {
      return Object.freeze({
        emergency: true,
        emergencyReason: "Sospecha de crisis hiperglicémica/cetosis: este flujo ambulatorio de NPH no corresponde. Derivar inmediatamente a Unidad de Emergencia Hospitalaria.",
        criteria: [], criteriaText: "", patientPreference: initiationCriteria.some((item) => /deseo|acepta/i.test(String(item))),
        scheme: "stop", schemeText: "No iniciar titulación ambulatoria", reason: "Posible complicación hiperglicémica aguda.",
        catabolicText: catabolic.join(", "), hypoRiskText: hypoRisk.join(", "), factor: 0, sensitivity
      });
    }

    const criteria = [];
    const patientPreference = initiationCriteria.some((item) => /deseo|acepta/i.test(String(item)));
    const clinicalInitiationCriteria = initiationCriteria.filter((item) => !/deseo|acepta/i.test(String(item)));

    if (Number.isFinite(hba1cValue) && hba1cValue > 10) criteria.push(`HbA1c ${hba1cValue}% (>10%)`);
    if (Number.isFinite(casualValue) && casualValue >= 300 && catabolic.length > 0) criteria.push(`Glicemia casual ${casualValue} mg/dL con síntomas de descompensación`);
    criteria.push(...clinicalInitiationCriteria, ...catabolic.filter((item) => !containsAcuteEmergency([item])));

    let scheme = "monodosis_pm";
    let schemeText = "NPH monodosis nocturna";
    let reason = "Inicio con insulina basal NPH en monodosis, con titulación posterior según protocolo APS.";

    if (Number.isFinite(fastingValue) && fastingValue <= 130 && criteria.length > 0) {
      scheme = "monodosis_am";
      schemeText = "NPH monodosis matinal";
      reason = "La glicemia de ayuno está en rango; se prioriza NPH diurna para el patrón hiperglicémico no nocturno.";
    }
    if (hypoRisk.length > 0) reason += " Se utiliza inicio conservador por riesgo de hipoglicemia.";

    return Object.freeze({
      emergency: false, emergencyReason: "", criteria, criteriaText: criteria.join(", "), patientPreference,
      scheme, schemeText, reason, catabolicText: catabolic.join(", "), hypoRiskText: hypoRisk.join(", "),
      factor: sensitivity.factor, sensitivity
    });
  }

  function calculateInitialDose({ weightKg, factor, scheme } = {}) {
    const weight = Number(weightKg);
    const allowedSchemes = new Set(["monodosis_pm", "monodosis_am", "doble_dosis"]);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 300 || !allowedSchemes.has(scheme)) {
      return Object.freeze({ valid: false, total: 0, am: 0, pm: 0, dosePerKg: Number.NaN, factorApplied: 0 });
    }

    let safeFactor = Number(factor);
    if (!Number.isFinite(safeFactor)) safeFactor = 0.2;
    if (scheme !== "doble_dosis" && safeFactor > 0.2) safeFactor = 0.2;
    if (scheme === "doble_dosis" && safeFactor > 0.3) safeFactor = 0.3;
    safeFactor = Math.max(0.1, safeFactor);

    const total = Math.max(4, roundUnits(weight * safeFactor));
    let am = 0;
    let pm = total;
    if (scheme === "monodosis_am") { am = total; pm = 0; }
    else if (scheme === "doble_dosis") { am = roundUnits(total * (2 / 3)); pm = Math.max(0, total - am); }

    return Object.freeze({ valid: true, total, am, pm, dosePerKg: total / weight, factorApplied: safeFactor });
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
    const normalized = normalizeGlucoseValues(values);
    const data = [...normalized.valid];
    const minimum = data.length ? Math.min(...data) : null;
    return Object.freeze({
      datos: data, usados: [...data], invalidos: [...normalized.invalid],
      promedio: data.length ? data.reduce((a, b) => a + b, 0) / data.length : null,
      min: minimum, hypoglycemiaLevel2: minimum !== null && minimum < 54, hipo: minimum !== null && minimum < 70,
      excluidos: [], discordantes: detectDiscordantHighs(data, name)
    });
  }

  function reduceNphDoseByPercent(dose, percent = LEVEL3_NPH_REDUCTION_PERCENT) {
    const current = roundUnits(Number(dose));
    if (current <= 0) return 0;
    const boundedPercent = Math.min(100, Math.max(0, Number(percent) || 0));
    let next = roundUnits(current * (1 - boundedPercent / 100));
    if (boundedPercent > 0 && next >= current) next = Math.max(0, current - 1);
    return next;
  }

  function proposeLevel3NphReduction({
    regimenType = "pm",
    amDose = 0,
    pmDose = 0,
    fastingValues = [],
    preLunchValues = []
  } = {}) {
    const regimen = String(regimenType || "pm");
    const currentAm = regimen === "pm" ? 0 : roundUnits(Number(amDose));
    const currentPm = regimen === "am" ? 0 : roundUnits(Number(pmDose));
    const fasting = normalizeGlucoseValues(fastingValues).valid;
    const preLunch = normalizeGlucoseValues(preLunchValues).valid;
    const fastingHypoglycemia = fasting.some((value) => value < 70);
    const preLunchHypoglycemia = preLunch.some((value) => value < 70);

    let am = currentAm;
    let pm = currentPm;
    const implicated = [];

    if (fastingHypoglycemia && currentPm > 0) {
      pm = reduceNphDoseByPercent(currentPm);
      implicated.push("PM");
    }
    if (preLunchHypoglycemia && currentAm > 0) {
      am = reduceNphDoseByPercent(currentAm);
      implicated.push("AM");
    }

    const available = implicated.length > 0;
    const reason = available
      ? `Regla Insulog: reducir 20% la dosis NPH temporalmente implicada por el patrón de hipoglicemia (${implicated.join(" + ")}), redondeada a unidades enteras. La regla requiere revisión clínica y no sustituye la búsqueda de causas reversibles.`
      : "No se puede identificar con suficiente seguridad una dosis NPH temporalmente implicada a partir de los HGT registrados; se requiere ajuste médico individual.";

    return Object.freeze({
      available,
      rule: "INSULOG_LEVEL3_NPH_REDUCTION_20",
      reductionPercent: LEVEL3_NPH_REDUCTION_PERCENT,
      currentAm,
      currentPm,
      am,
      pm,
      fastingHypoglycemia,
      preLunchHypoglycemia,
      implicated: Object.freeze([...implicated]),
      requiresProfessionalReview: true,
      reason
    });
  }

  function classifyHypoglycemia(values = [], requiredAssistance = false) {
    const data = [...normalizeGlucoseValues(values).valid];
    const hypoglycemicValues = data.filter((value) => value < 70);
    const minimum = hypoglycemicValues.length ? Math.min(...hypoglycemicValues) : null;

    if (requiredAssistance) return Object.freeze({
      nivel: 3, minimo: minimum, urgent: true,
      nota: "Hipoglicemia nivel 3 referida: requirió asistencia de otra persona. Derivación inmediata a Unidad de Emergencia Hospitalaria y sin titulación automática de NPH."
    });
    if (!hypoglycemicValues.length) return null;
    if (minimum < 54) return Object.freeze({ nivel: 2, minimo: minimum, urgent: false, nota: "Hipoglicemia nivel 2 detectada (<54 mg/dL): requiere tratamiento inmediato del episodio y reevaluación del esquema." });
    return Object.freeze({ nivel: 1, minimo: minimum, urgent: false, nota: "Hipoglicemia nivel 1 detectada (<70 y ≥54 mg/dL): revisar causas y reforzar prevención." });
  }

  function calculateAdjustment(analysis, doseName, currentDose = 0, targetA1c = 7) {
    const current = Number(currentDose);
    const dose = Number.isFinite(current) && current >= 0 ? roundUnits(current) : 0;
    const count = Array.isArray(analysis?.usados) ? analysis.usados.length : 0;
    const hasInvalid = Array.isArray(analysis?.invalidos) && analysis.invalidos.length > 0;
    if (!analysis || analysis.min === null || count < MIN_REQUIRED_READINGS || hasInvalid) {
      return Object.freeze({
        ajuste: 0, percent: 0, newDose: dose, reference: analysis?.min ?? null,
        target: targetProfile(targetA1c), dataSufficient: false, blocked: true,
        texto: `${doseName}: ajuste bloqueado; se requieren al menos ${MIN_REQUIRED_READINGS} glicemias válidas y sin valores inválidos`
      });
    }

    const profile = targetProfile(targetA1c);
    const reference = analysis.min;
    let percent = 0;
    if (reference < profile.lower) percent = analysis.hipo ? -20 : -10;
    else if (reference <= profile.upper) percent = 0;
    else if (reference <= profile.high10) percent = 10;
    else percent = 20;

    const newDose = Math.max(0, roundUnits(dose * (1 + percent / 100)));
    const ajuste = newDose - dose;
    let action = "mantener";
    if (percent > 0) action = `aumentar ${percent}%`;
    if (percent < 0) action = `disminuir ${Math.abs(percent)}%`;

    return Object.freeze({
      ajuste, percent, newDose, reference, target: profile, dataSufficient: true, blocked: false,
      texto: `${doseName}: ${action} usando el menor de los controles (${reference} mg/dL), meta preprandial ${profile.lower}-${profile.upper} mg/dL para HbA1c objetivo <${profile.hba1c}%.`
    });
  }

  function calculateSecondDose(weightKg) { return Math.max(4, roundUnits(Number(weightKg) * 0.1)); }

  function assessDoseSafety(dosePerKg) {
    if (!Number.isFinite(dosePerKg)) return Object.freeze({ level: "unknown", requiresHighDoseReview: true, blocksAutomaticEscalation: true, warning: "No es posible calcular UI/kg/día de forma segura: revisar peso y dosis antes de titular." });
    if (dosePerKg >= 0.5) return Object.freeze({
      level: "stop", requiresHighDoseReview: true, blocksAutomaticEscalation: true,
      warning: "Dosis basal total ≥0,5 UI/kg/día: no escalar automáticamente. Evaluar posible sobreinsulinización, técnica, adherencia, alimentación, variabilidad/patrón glicémico y necesidad de derivación o intensificación especializada."
    });
    if (dosePerKg >= 0.4) return Object.freeze({
      level: "review", requiresHighDoseReview: true, blocksAutomaticEscalation: false,
      warning: "Dosis basal total ≥0,4 UI/kg/día: revisar técnica, adherencia, patrón glicémico y riesgo de hipoglicemia antes de seguir escalando."
    });
    return Object.freeze({ level: "standard", requiresHighDoseReview: false, blocksAutomaticEscalation: false, warning: "" });
  }

  function regimenLabel(regimenType) {
    if (regimenType === "2") return "NPH AM + PM";
    if (regimenType === "am") return "NPH solo AM";
    return "NPH solo PM";
  }

  function calculateFollowup({ weightKg, regimenType, amDose, pmDose, fastingValues = [], preLunchValues = [], preElevenValues = [], targetA1c = 7 } = {}) {
    const validationErrors = [];
    const weight = Number(weightKg);
    const allowedRegimens = new Set(["pm", "am", "2"]);
    const rawAm = Number(amDose);
    const rawPm = Number(pmDose);

    if (!Number.isFinite(weight) || weight <= 0 || weight > 300) validationErrors.push("Peso inválido: debe ser mayor que 0 y no superar 300 kg.");
    if (!allowedRegimens.has(regimenType)) validationErrors.push("Tipo de esquema no reconocido.");
    if (!Number.isInteger(rawAm) || rawAm < 0 || rawAm > 150) validationErrors.push("Dosis AM inválida: use un entero entre 0 y 150 UI.");
    if (!Number.isInteger(rawPm) || rawPm < 0 || rawPm > 150) validationErrors.push("Dosis PM inválida: use un entero entre 0 y 150 UI.");

    let am = Number.isInteger(rawAm) && rawAm >= 0 ? rawAm : 0;
    let pm = Number.isInteger(rawPm) && rawPm >= 0 ? rawPm : 0;
    if (regimenType === "am") pm = 0;
    if (regimenType === "pm") am = 0;
    if (regimenType === "am" && am <= 0) validationErrors.push("El esquema AM requiere una dosis AM actual mayor que 0.");
    if (regimenType === "pm" && pm <= 0) validationErrors.push("El esquema PM requiere una dosis PM actual mayor que 0.");
    if (regimenType === "2" && (am <= 0 || pm <= 0)) validationErrors.push("El esquema AM + PM requiere ambas dosis actuales mayores que 0.");

    const preValues = preLunchValues.length ? preLunchValues : preElevenValues;
    const fasting = analyzeGlucose(fastingValues, "Ayunas");
    const preLunch = preValues.length ? analyzeGlucose(preValues, "Pre-almuerzo") : null;
    const requiresFasting = regimenType === "pm" || regimenType === "2";
    const requiresPreLunch = regimenType === "am" || regimenType === "2";

    if (fasting.invalidos.length) validationErrors.push(`Glicemias en ayunas inválidas: ${fasting.invalidos.join(", ")} mg/dL.`);
    if (preLunch?.invalidos.length) validationErrors.push(`Glicemias pre-almuerzo inválidas: ${preLunch.invalidos.join(", ")} mg/dL.`);
    if (requiresFasting && fasting.usados.length < MIN_REQUIRED_READINGS) validationErrors.push(`Se requieren al menos ${MIN_REQUIRED_READINGS} glicemias válidas en ayunas.`);
    if (requiresPreLunch && (!preLunch || preLunch.usados.length < MIN_REQUIRED_READINGS)) validationErrors.push(`Se requieren al menos ${MIN_REQUIRED_READINGS} glicemias válidas pre-almuerzo.`);

    const inputValid = validationErrors.length === 0;
    const dataSufficient = inputValid;
    const pmAdjustment = calculateAdjustment(fasting, "PM", pm, targetA1c);
    const amAdjustment = preLunch
      ? calculateAdjustment(preLunch, "AM", am, targetA1c)
      : Object.freeze({ ajuste: 0, percent: 0, newDose: am, dataSufficient: false, blocked: true, texto: "AM: ajuste bloqueado; faltan glicemias pre-almuerzo" });

    let newAm = am;
    let newPm = pm;
    const reasoning = [];
    const warnings = [];

    if (!dataSufficient) {
      reasoning.push("Titulación automática bloqueada por datos insuficientes o inválidos; se mantienen las dosis actuales.");
      warnings.push(...validationErrors);
    } else if (regimenType === "pm") {
      newPm = pmAdjustment.newDose;
      reasoning.push(pmAdjustment.texto);
    } else if (regimenType === "am") {
      newAm = amAdjustment.newDose;
      reasoning.push(amAdjustment.texto);
    } else {
      newPm = pmAdjustment.newDose;
      newAm = amAdjustment.newDose;
      reasoning.push(pmAdjustment.texto, amAdjustment.texto);
    }

    const anyHypo = fasting.hipo || Boolean(preLunch?.hipo);
    if (anyHypo) {
      if (newAm > am) newAm = am;
      if (newPm > pm) newPm = pm;
      warnings.push("Hipoglicemia registrada: se bloqueó cualquier aumento automático de NPH en esta evaluación hasta reevaluar causas y seguridad.");
    }
    if (fasting.hypoglycemiaLevel2) warnings.push("Hipoglicemia nivel 2 en ayunas (<54 mg/dL): tratamiento inmediato del episodio y reevaluación de NPH PM.");
    else if (fasting.hipo) warnings.push("Hipoglicemia nivel 1 en ayunas: reevaluar NPH PM y causas precipitantes.");
    if (preLunch?.hypoglycemiaLevel2) warnings.push("Hipoglicemia nivel 2 pre-almuerzo (<54 mg/dL): tratamiento inmediato del episodio y reevaluación de NPH AM.");
    else if (preLunch?.hipo) warnings.push("Hipoglicemia nivel 1 pre-almuerzo: reevaluar NPH AM y causas precipitantes.");

    const currentPerKg = Number.isFinite(weight) && weight > 0 ? (am + pm) / weight : Number.NaN;
    const projectedPerKg = Number.isFinite(weight) && weight > 0 ? (newAm + newPm) / weight : Number.NaN;
    const projectedSafety = assessDoseSafety(projectedPerKg);
    let automaticEscalationBlocked = false;
    if (newAm + newPm > am + pm && projectedSafety.blocksAutomaticEscalation) {
      automaticEscalationBlocked = true;
      newAm = am;
      newPm = pm;
      warnings.push("La titulación propuesta alcanzaría o superaría 0,5 UI/kg/día de insulina basal; se bloqueó el aumento automático y se requiere reevaluación clínica.");
    }

    const dosePerKg = Number.isFinite(weight) && weight > 0 ? (newAm + newPm) / weight : Number.NaN;
    const doseSafety = assessDoseSafety(dosePerKg);
    if (doseSafety.warning && !validationErrors.length) warnings.push(doseSafety.warning);

    const discordant = [...fasting.discordantes, ...(preLunch ? preLunch.discordantes : [])];
    const availableValues = [...fasting.datos, ...(preLunch ? preLunch.datos : [])];
    const globalAverage = availableValues.length ? availableValues.reduce((a, b) => a + b, 0) / availableValues.length : null;
    if (discordant.length) warnings.push(`Valores discordantes: ${discordant.join(", ")}. Se conservan como dato clínico y no se excluyen automáticamente.`);

    const profile = targetProfile(targetA1c);
    const explanation = [
      `Esquema final sugerido: ${regimenLabel(regimenType)}`,
      `Meta individualizada: HbA1c <${profile.hba1c}% (preprandial ${profile.lower}-${profile.upper} mg/dL).`,
      ...reasoning,
      warnings.length ? `Advertencias: ${warnings.join(" ")}` : ""
    ].filter(Boolean).join("\n");

    return Object.freeze({
      amActual: am, pmActual: pm, am: Math.max(0, newAm), pm: Math.max(0, newPm),
      schemeFinal: regimenType, schemeLabel: regimenLabel(regimenType), fasting, preLunch, preEleven: preLunch,
      promAy: fasting.promedio !== null ? Math.round(fasting.promedio) : "N/A",
      promPre: preLunch?.promedio !== null && preLunch ? Math.round(preLunch.promedio) : "N/A",
      minAy: fasting.min !== null ? fasting.min : "N/A", minPre: preLunch?.min !== null && preLunch ? preLunch.min : "N/A",
      promedioGlobal: globalAverage !== null ? Math.round(globalAverage) : "N/A", dosisKg: dosePerKg, currentDosePerKg: currentPerKg,
      doseSafety,
      inputValid,
      dataSufficient,
      validationErrors: Object.freeze([...validationErrors]),
      blocksDoseChange: !dataSufficient || automaticEscalationBlocked,
      requiresHighDoseReview: automaticEscalationBlocked || doseSafety.requiresHighDoseReview,
      blocksAutomaticEscalation: automaticEscalationBlocked || doseSafety.blocksAutomaticEscalation,
      automaticEscalationBlocked,
      razonamiento: reasoning, advertencias: warnings, excluidos: [], discordantes: discordant, explicacion: explanation,
      targetA1c: normalizeTargetA1c(targetA1c)
    });
  }

  return Object.freeze({
    version: CLINICAL_ENGINE_VERSION, TARGET_PROFILES, MIN_REQUIRED_READINGS, GLUCOSE_MIN_MGDL, GLUCOSE_MAX_MGDL, LEVEL3_NPH_REDUCTION_PERCENT, normalizeGlucoseValues, roundUnits, roundEven, normalizeTargetA1c, targetProfile, assessInsulinSensitivity,
    suggestInitialScheme, calculateInitialDose, detectDiscordantHighs, analyzeGlucose, classifyHypoglycemia, proposeLevel3NphReduction,
    calculateAdjustment, calculateSecondDose, assessDoseSafety, calculateFollowup, regimenLabel
  });
});
