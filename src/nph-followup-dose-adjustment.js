/*
 * Insulog APS - Algoritmo de seguimiento y ajuste de NPH
 *
 * Objetivo clínico:
 * - Evitar que pacientes con monodosis de NPH sean ajustados indefinidamente
 *   en una sola dosis cuando el patrón glicémico requiere intensificación a BID.
 *
 * Principios:
 * - NPH PM/nocturna impacta principalmente glicemia de ayunas.
 * - NPH AM/matinal impacta principalmente glicemia de tarde/pre-cena/antes de once.
 * - Si hay hipoglicemia, reducir primero y no intensificar.
 * - Si dosis total >=0.7 UI/kg/día, alertar evaluación clínica/técnica/adherencia.
 *
 * Este archivo está pensado para integrarse en index.html reemplazando la lógica
 * central de calcularSeguimientoPro(), sin cambiar el módulo de inicio.
 */

const INSULOG_NPH_DEFAULTS = {
  fastingLow: 80,
  fastingTarget: 130,
  preDinnerLow: 80,
  preDinnerTarget: 180,
  highGlucose: 250,
  highDoseUiKg: 0.7,
  maxDoseUiKg: 1.0,
  defaultAddOnDose: 4,
  addOnDosePerKg: 0.1,
};

function insulogRoundEven(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.ceil(n / 2) * 2);
}

function insulogClampDose(value, min = 0, max = 99) {
  const dose = insulogRoundEven(value);
  return Math.min(max, Math.max(min, dose));
}

function insulogDoseDelta(avg, target, highGlucose) {
  if (!Number.isFinite(avg)) return 0;
  if (avg <= target) return 0;
  if (avg > highGlucose) return 4;
  if (avg > 180) return 4;
  return 2;
}

function insulogReductionDose(currentDose, severeHypoglycemia = false) {
  const dose = Number(currentDose) || 0;
  if (dose <= 0) return 0;
  const reductionFactor = severeHypoglycemia ? 0.8 : 0.9;
  return insulogClampDose(dose * reductionFactor, 0, 99);
}

function insulogAddOnDose(weightKg, currentDose) {
  const weightBased = insulogRoundEven((Number(weightKg) || 0) * INSULOG_NPH_DEFAULTS.addOnDosePerKg);
  const conservative = Math.max(INSULOG_NPH_DEFAULTS.defaultAddOnDose, weightBased || 0);
  const ceilingByCurrent = currentDose > 0 ? Math.max(INSULOG_NPH_DEFAULTS.defaultAddOnDose, Math.round(currentDose * 0.5)) : conservative;
  return insulogClampDose(Math.min(conservative, ceilingByCurrent), 4, 20);
}

/**
 * Calcula ajuste de NPH en seguimiento.
 *
 * @param {Object} input
 * @param {'pm'|'am'|'2'} input.scheme - esquema actual: solo PM, solo AM o AM+PM.
 * @param {number} input.weightKg
 * @param {number} input.currentAM
 * @param {number} input.currentPM
 * @param {number} input.avgFasting - promedio glicemia ayunas.
 * @param {number} input.avgPreDinner - promedio antes de once/pre-cena.
 * @param {boolean} input.hypoLt70
 * @param {boolean} input.hypoLt54
 * @param {Object} [targets]
 * @returns {Object}
 */
function calculateNphFollowUpAdjustment(input, targets = INSULOG_NPH_DEFAULTS) {
  const scheme = input.scheme || '2';
  const weightKg = Number(input.weightKg) || 0;
  const currentAM = Number(input.currentAM) || 0;
  const currentPM = Number(input.currentPM) || 0;
  const avgFasting = Number(input.avgFasting);
  const avgPreDinner = Number(input.avgPreDinner);
  const hypoLt70 = Boolean(input.hypoLt70);
  const hypoLt54 = Boolean(input.hypoLt54);

  let newAM = currentAM;
  let newPM = currentPM;
  let finalScheme = scheme;
  const actions = [];
  const warnings = [];

  if (!weightKg || weightKg <= 0) {
    throw new Error('Peso inválido para calcular dosis UI/kg.');
  }

  if (hypoLt70 || hypoLt54) {
    const severe = hypoLt54;
    const reductionReason = severe
      ? 'hipoglicemia clínicamente significativa <54 mg/dL'
      : 'hipoglicemia <70 mg/dL';

    if (scheme === 'pm') {
      newPM = insulogReductionDose(currentPM, severe);
      actions.push(`Reducir NPH PM por ${reductionReason}. No intensificar hasta evaluar causa.`);
    } else if (scheme === 'am') {
      newAM = insulogReductionDose(currentAM, severe);
      actions.push(`Reducir NPH AM por ${reductionReason}. No intensificar hasta evaluar causa.`);
    } else {
      if (Number.isFinite(avgFasting) && avgFasting < targets.fastingLow) {
        newPM = insulogReductionDose(currentPM, severe);
        actions.push(`Reducir NPH PM por ayunas bajas/${reductionReason}.`);
      }
      if (Number.isFinite(avgPreDinner) && avgPreDinner < targets.preDinnerLow) {
        newAM = insulogReductionDose(currentAM, severe);
        actions.push(`Reducir NPH AM por glicemia antes de once baja/${reductionReason}.`);
      }
      if (actions.length === 0) {
        newAM = insulogReductionDose(currentAM, severe);
        newPM = insulogReductionDose(currentPM, severe);
        actions.push(`Reducir esquema por ${reductionReason}; revisar técnica, ingesta, ERC y horario.`);
      }
    }

    warnings.push('No intensificar insulina en presencia de hipoglicemia sin evaluación clínica.');
  } else if (scheme === 'pm') {
    if (Number.isFinite(avgPreDinner) && avgPreDinner > targets.preDinnerTarget) {
      finalScheme = '2';
      newAM = insulogAddOnDose(weightKg, currentPM);
      actions.push('Intensificar desde NPH PM única a esquema AM+PM: agregar NPH AM por hiperglicemia antes de once/pre-cena.');
    }

    const deltaPM = insulogDoseDelta(avgFasting, targets.fastingTarget, targets.highGlucose);
    if (deltaPM > 0) {
      newPM = insulogClampDose(currentPM + deltaPM, 0, 99);
      actions.push(`Ajustar NPH PM +${deltaPM} UI por glicemia de ayunas sobre meta.`);
    } else if (finalScheme === 'pm') {
      actions.push('Mantener NPH PM: glicemia de ayunas dentro de meta o sin datos suficientes.');
    }
  } else if (scheme === 'am') {
    if (Number.isFinite(avgFasting) && avgFasting > targets.fastingTarget) {
      finalScheme = '2';
      newPM = insulogAddOnDose(weightKg, currentAM);
      actions.push('Intensificar desde NPH AM única a esquema AM+PM: agregar NPH PM por glicemia de ayunas elevada.');
    }

    const deltaAM = insulogDoseDelta(avgPreDinner, targets.preDinnerTarget, targets.highGlucose);
    if (deltaAM > 0) {
      newAM = insulogClampDose(currentAM + deltaAM, 0, 99);
      actions.push(`Ajustar NPH AM +${deltaAM} UI por glicemia antes de once/pre-cena sobre meta.`);
    } else if (finalScheme === 'am') {
      actions.push('Mantener NPH AM: glicemia antes de once/pre-cena dentro de meta o sin datos suficientes.');
    }
  } else {
    const deltaPM = insulogDoseDelta(avgFasting, targets.fastingTarget, targets.highGlucose);
    const deltaAM = insulogDoseDelta(avgPreDinner, targets.preDinnerTarget, targets.highGlucose);

    if (deltaPM > 0) {
      newPM = insulogClampDose(currentPM + deltaPM, 0, 99);
      actions.push(`Ajustar NPH PM +${deltaPM} UI por glicemia de ayunas sobre meta.`);
    }

    if (deltaAM > 0) {
      newAM = insulogClampDose(currentAM + deltaAM, 0, 99);
      actions.push(`Ajustar NPH AM +${deltaAM} UI por glicemia antes de once/pre-cena sobre meta.`);
    }

    if (deltaPM === 0 && deltaAM === 0) {
      actions.push('Mantener esquema AM+PM: promedios dentro de meta o sin datos suficientes.');
    }
  }

  const totalDailyDose = newAM + newPM;
  const unitsPerKg = totalDailyDose / weightKg;

  if (unitsPerKg >= targets.maxDoseUiKg) {
    warnings.push('Dosis total >=1 UI/kg/día: no seguir titulando automáticamente; evaluar técnica, adherencia, lipohipertrofia, alimentación y derivación.');
  } else if (unitsPerKg >= targets.highDoseUiKg) {
    warnings.push('Dosis total >=0.7 UI/kg/día: dosis alta; evaluar técnica, adherencia, sitio de inyección, alimentación y seguimiento por medicina interna APS.');
  }

  return {
    finalScheme,
    newAM,
    newPM,
    totalDailyDose,
    unitsPerKg: Number(unitsPerKg.toFixed(2)),
    actions,
    warnings,
    shouldIntensifyToBid: finalScheme === '2' && scheme !== '2',
    hadHypoglycemia: hypoLt70 || hypoLt54,
  };
}

function buildNphFollowUpNote(result, input) {
  const schemeText = result.finalScheme === '2' ? 'NPH AM + PM' : result.finalScheme === 'am' ? 'NPH solo AM' : 'NPH solo PM';

  return `SEGUIMIENTO INSULINA NPH
Promedio glicemia ayunas: ${input.avgFasting ?? 'sin dato'} mg/dL.
Promedio antes de once/pre-cena: ${input.avgPreDinner ?? 'sin dato'} mg/dL.

Conducta sugerida:
${result.actions.map(action => `- ${action}`).join('\n')}

Nueva indicación sugerida:
- Esquema: ${schemeText}
- NPH AM: ${result.newAM} UI
- NPH PM: ${result.newPM} UI
- Dosis total diaria: ${result.totalDailyDose} UI (${result.unitsPerKg} UI/kg/día)
${result.warnings.length ? `\nAlertas:\n${result.warnings.map(warning => `- ${warning}`).join('\n')}` : ''}

Reforzar educación, técnica de administración, rotación de sitios, alimentación regular y manejo de hipoglicemia.`;
}

// Export compatible con navegador y pruebas simples.
if (typeof window !== 'undefined') {
  window.calculateNphFollowUpAdjustment = calculateNphFollowUpAdjustment;
  window.buildNphFollowUpNote = buildNphFollowUpNote;
}
