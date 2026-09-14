from pathlib import Path
import json
import re

EXPECTED = "APS-NPH-2026.09.14-r2"


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text(encoding="utf-8")
    if old not in text:
        raise SystemExit(f"Expected snippet not found in {path}: {old[:100]!r}")
    p.write_text(text.replace(old, new, 1), encoding="utf-8")


# clinical-engine.js: make clinical functions fail closed independently of the UI.
p = Path("clinical-engine.js")
text = p.read_text(encoding="utf-8")
marker = "  function roundUnits(value) {"
insert = '''  const CLINICAL_ENGINE_VERSION = "APS-NPH-2026.09.14-r2";
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

'''
if "const CLINICAL_ENGINE_VERSION" not in text:
    if marker not in text:
        raise SystemExit("roundUnits marker not found")
    text = text.replace(marker, insert + marker, 1)

old = '''    const ageValue = Number(age);
    const bmiValue = Number(bmi);
    const egfrValue = Number(egfr);
    const sensitive = hypoRisk.length > 0 ||'''
new = '''    const ageValue = Number(age);
    const bmiValue = Number(bmi);
    const egfrValue = Number(egfr);
    if (!Number.isFinite(ageValue) || !Number.isFinite(bmiValue) || !Number.isFinite(egfrValue)) {
      return Object.freeze({ category: "uncertain", factor: 0.1, label: "Datos incompletos · inicio conservador" });
    }
    const sensitive = hypoRisk.length > 0 ||'''
if old in text:
    text = text.replace(old, new, 1)

old = '''  function calculateInitialDose({ weightKg, factor, scheme } = {}) {
    const weight = Number(weightKg);
    if (!Number.isFinite(weight) || weight <= 0) return Object.freeze({ total: 0, am: 0, pm: 0, dosePerKg: Number.NaN });'''
new = '''  function calculateInitialDose({ weightKg, factor, scheme } = {}) {
    const weight = Number(weightKg);
    const allowedSchemes = new Set(["monodosis_pm", "monodosis_am", "doble_dosis"]);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 300 || !allowedSchemes.has(scheme)) {
      return Object.freeze({ valid: false, total: 0, am: 0, pm: 0, dosePerKg: Number.NaN, factorApplied: 0 });
    }'''
if old in text:
    text = text.replace(old, new, 1)
text = text.replace(
    "    return Object.freeze({ total, am, pm, dosePerKg: total / weight, factorApplied: safeFactor });",
    "    return Object.freeze({ valid: true, total, am, pm, dosePerKg: total / weight, factorApplied: safeFactor });",
    1,
)

text = re.sub(
    r"  function analyzeGlucose\(values, name\) \{.*?\n  \}\n\n  function classifyHypoglycemia",
    '''  function analyzeGlucose(values, name) {
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

  function classifyHypoglycemia''',
    text,
    count=1,
    flags=re.S,
)
text = text.replace(
    "    const data = values.filter((value) => Number.isFinite(value));\n    const hypoglycemicValues = data.filter((value) => value < 70);",
    "    const data = [...normalizeGlucoseValues(values).valid];\n    const hypoglycemicValues = data.filter((value) => value < 70);",
    1,
)

text = re.sub(
    r"  function calculateAdjustment\(analysis, doseName, currentDose = 0, targetA1c = 7\) \{.*?\n  \}\n\n  function calculateSecondDose",
    '''  function calculateAdjustment(analysis, doseName, currentDose = 0, targetA1c = 7) {
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

  function calculateSecondDose''',
    text,
    count=1,
    flags=re.S,
)
text = text.replace(
    'if (!Number.isFinite(dosePerKg)) return Object.freeze({ level: "unknown", requiresHighDoseReview: false, blocksAutomaticEscalation: false, warning: "" });',
    'if (!Number.isFinite(dosePerKg)) return Object.freeze({ level: "unknown", requiresHighDoseReview: true, blocksAutomaticEscalation: true, warning: "No es posible calcular UI/kg/día de forma segura: revisar peso y dosis antes de titular." });',
    1,
)

start = text.index("  function calculateFollowup(")
end = text.index("\n  return Object.freeze({\n    TARGET_PROFILES", start)
new_followup = r'''  function calculateFollowup({ weightKg, regimenType, amDose, pmDose, fastingValues = [], preLunchValues = [], preElevenValues = [], targetA1c = 7 } = {}) {
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
'''
text = text[:start] + new_followup + text[end:]
text = text.replace(
    "    TARGET_PROFILES, roundUnits, roundEven, normalizeTargetA1c, targetProfile, assessInsulinSensitivity,",
    "    version: CLINICAL_ENGINE_VERSION, TARGET_PROFILES, MIN_REQUIRED_READINGS, GLUCOSE_MIN_MGDL, GLUCOSE_MAX_MGDL, normalizeGlucoseValues, roundUnits, roundEven, normalizeTargetA1c, targetProfile, assessInsulinSensitivity,",
    1,
)
p.write_text(text, encoding="utf-8")

# app.js: refuse to render/commit unsafe results.
p = Path("app.js")
text = p.read_text(encoding="utf-8")
text = text.replace(
    "    const resultado = clinicalEngine.calculateInitialDose({ weightKg: peso, factor, scheme: data.esquemaInicio });\n    state.patch({ am: resultado.am, pm: resultado.pm, dosisKg: resultado.dosePerKg });",
    "    const resultado = clinicalEngine.calculateInitialDose({ weightKg: peso, factor, scheme: data.esquemaInicio });\n    if (resultado.valid === false) { alert(\"No fue posible calcular una dosis inicial segura con los datos ingresados. Revise peso, esquema y factor antes de continuar.\"); return undefined; }\n    state.patch({ am: resultado.am, pm: resultado.pm, dosisKg: resultado.dosePerKg });",
    1,
)
text = text.replace(
    '    if (tipo === "2" && am <= 0 && pm <= 0) { alert("Ingrese al menos una dosis actual de insulina."); return undefined; }',
    '    if (tipo === "2" && (am <= 0 || pm <= 0)) { alert("Para un esquema AM + PM ingrese ambas dosis actuales."); return undefined; }',
    1,
)
text = text.replace(
    '    const resultado = clinicalEngine.calculateFollowup({\n      weightKg: peso, regimenType: tipo, amDose: am, pmDose: pm,\n      fastingValues: ayunasRaw, preLunchValues: preLunchRaw, targetA1c\n    });\n\n    state.patch({',
    '    const resultado = clinicalEngine.calculateFollowup({\n      weightKg: peso, regimenType: tipo, amDose: am, pmDose: pm,\n      fastingValues: ayunasRaw, preLunchValues: preLunchRaw, targetA1c\n    });\n    if (resultado.inputValid === false || resultado.dataSufficient === false) { alert((resultado.validationErrors || []).join("\\n") || "Insulog bloqueó la titulación por datos insuficientes o inválidos."); return undefined; }\n\n    state.patch({',
    1,
)
text = text.replace(
    'if (target.id === "am-actual" || target.id === "pm-actual") sanitizeNumericInput(target, 2, 99);',
    'if (target.id === "am-actual" || target.id === "pm-actual") sanitizeNumericInput(target, 3, 150);',
    1,
)
text = text.replace(
    '    version: "2026.09.14-clinical-r2",\n    notes:',
    '    version: "2026.09.14-clinical-r2",\n    clinicalVersion: "APS-NPH-2026.09.14-r2",\n    notes:',
    1,
)
p.write_text(text, encoding="utf-8")

# app-shell.js: an unexpected critical action exception must stop clinical actions instead of console-only failure.
p = Path("app-shell.js")
text = p.read_text(encoding="utf-8")
old = '''        if (result && typeof result.catch === "function") result.catch((error) => console.error(`Error ejecutando acción ${action}:`, error));
      } catch (error) {
        console.error(`Error ejecutando acción ${action}:`, error);
      }'''
new = '''        if (result && typeof result.catch === "function") result.catch((error) => {
          console.error(`Error ejecutando acción ${action}:`, error);
          window.InsulogSafetyGuard?.reportActionError(action, error);
        });
      } catch (error) {
        console.error(`Error ejecutando acción ${action}:`, error);
        window.InsulogSafetyGuard?.reportActionError(action, error);
      }'''
if old in text:
    text = text.replace(old, new, 1)
p.write_text(text, encoding="utf-8")

# Runtime consistency guard.
Path("safety-guard.js").write_text(r'''"use strict";

(() => {
  const EXPECTED_CLINICAL_VERSION = "APS-NPH-2026.09.14-r2";
  const CRITICAL_ACTIONS = new Set([
    "define-initial-scheme", "calculate-initial", "calculate-followup", "generate-high-dose-note",
    "best-review-accept", "best-review-modify-save", "best-review-reassess",
    "open-document", "show-document", "print-document"
  ]);
  let locked = false;
  let lockReason = "";

  function disableCriticalControls() {
    document.querySelectorAll("[data-action]").forEach((element) => {
      if (CRITICAL_ACTIONS.has(element.dataset.action)) {
        element.disabled = true;
        element.setAttribute("aria-disabled", "true");
      }
    });
  }

  function renderLock(reason) {
    let node = document.getElementById("insulog-safety-lock");
    if (!node) {
      node = document.createElement("div");
      node.id = "insulog-safety-lock";
      node.setAttribute("role", "alert");
      node.setAttribute("aria-live", "assertive");
      node.style.cssText = "position:fixed;inset:12px 12px auto;z-index:99999;max-width:760px;margin:auto;padding:16px 18px;border:2px solid #b42318;border-radius:16px;background:#fff1f0;color:#7a271a;font:600 16px/1.45 system-ui,-apple-system,sans-serif;box-shadow:0 12px 36px rgba(0,0,0,.22)";
      document.body.prepend(node);
    }
    node.innerHTML = `<strong>Insulog se bloqueó por seguridad.</strong><br>${String(reason || "Error de consistencia interna.")}<br><small>No utilice una recomendación de dosis de esta sesión. Recargue la aplicación y vuelva a ingresar los datos.</small>`;
  }

  function lock(reason) {
    if (locked) return false;
    locked = true;
    lockReason = String(reason || "Error de consistencia interna.");
    disableCriticalControls();
    renderLock(lockReason);
    return true;
  }

  function selfTest() {
    try {
      const engine = window.InsulogClinicalEngine;
      const app = window.InsulogApp;
      if (!engine || !app) throw new Error("No se cargaron todos los módulos clínicos esenciales.");
      if (engine.version !== EXPECTED_CLINICAL_VERSION || app.clinicalVersion !== EXPECTED_CLINICAL_VERSION) throw new Error("Las versiones del motor clínico y de la interfaz no coinciden.");
      const stable = engine.calculateAdjustment(engine.analyzeGlucose([100, 100, 100], "Autotest"), "PM", 20, 7);
      if (stable.newDose !== 20 || stable.dataSufficient !== true) throw new Error("Falló el autotest de titulación estable.");
      if (!engine.assessDoseSafety(0.5).blocksAutomaticEscalation) throw new Error("Falló el autotest del techo basal de 0,5 UI/kg/día.");
      if (engine.classifyHypoglycemia([53], false)?.nivel !== 2) throw new Error("Falló el autotest de hipoglicemia nivel 2.");
      const insufficient = engine.calculateFollowup({ weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170], targetA1c: 7 });
      if (insufficient.dataSufficient !== false || insufficient.pm !== 20) throw new Error("Falló el autotest de bloqueo por datos insuficientes.");
      const hypoGate = engine.calculateFollowup({ weightKg: 100, regimenType: "2", amDose: 20, pmDose: 20, fastingValues: [69, 90, 100], preLunchValues: [250, 250, 250], targetA1c: 7 });
      if (hypoGate.am > 20 || hypoGate.pm > 20) throw new Error("Falló el autotest de bloqueo de aumentos ante hipoglicemia.");
      return true;
    } catch (error) {
      lock(error?.message || "Falló la verificación interna de seguridad.");
      return false;
    }
  }

  function reportActionError(action, error) {
    if (!CRITICAL_ACTIONS.has(action)) return false;
    return lock(`Error inesperado durante ${action}: ${error?.message || "acción clínica incompleta"}.`);
  }

  window.InsulogSafetyGuard = Object.freeze({
    version: "2026.09.14-safety1",
    expectedClinicalVersion: EXPECTED_CLINICAL_VERSION,
    selfTest, reportActionError,
    isLocked: () => locked,
    reason: () => lockReason
  });

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", selfTest, { once: true });
  else selfTest();
})();
''', encoding="utf-8")

# Static HTML fallback must be safe even before JS hydration.
p = Path("index.html")
text = p.read_text(encoding="utf-8")
if 'name="insulog-clinical-version"' not in text:
    text = text.replace(
        '<meta name="description" content="Herramienta de apoyo clínico para inicio, seguimiento y ajuste de insulina NPH en Atención Primaria de Salud.">',
        '<meta name="description" content="Herramienta de apoyo clínico para inicio, seguimiento y ajuste de insulina NPH en Atención Primaria de Salud.">\n  <meta name="referrer" content="no-referrer">\n  <meta name="insulog-clinical-version" content="APS-NPH-2026.09.14-r2">',
        1,
    )
text = text.replace("El factor mostrado se propone según la evaluación previa y puede revisarse antes de calcular.", "El factor de inicio se determina automáticamente según la evaluación clínica previa.")
text = text.replace('<option value="0.3">Bajo riesgo → hiperglicemia marcada</option>', '')
text = text.replace('<li><strong>0.3 UI/kg:</strong> hiperglicemia marcada o descompensación</li>', '<li><strong>0,3 UI/kg:</strong> no se propone automáticamente en el flujo basal 2026 de Insulog.</li>')
text = text.replace("Antes de la once <span class=\"th-unit\">mg/dL</span>", "Pre-almuerzo <span class=\"th-unit\">mg/dL</span>")
text = text.replace("⚠️ Paciente en dosis alta de insulina (≥0.7 UI/kg/día)", "⚠️ Dosis basal en umbral de seguridad (≥0,5 UI/kg/día)")
text = text.replace("Rango permitido por campo de dosis: 04–99 UI.", "Rango permitido por dosis activa: 1–150 UI.")
text = text.replace('maxlength="2" placeholder="00" autocomplete="off">', 'maxlength="3" placeholder="0" autocomplete="off">')
if "./safety-guard.js" not in text:
    text = text.replace('<script src="./patient-document.js?', '<script src="./safety-guard.js?v=__RELEASE__"></script>\n  <script src="./patient-document.js?', 1)
p.write_text(text, encoding="utf-8")

# Atomic PWA shell and release fingerprint include the guard.
p = Path("sw.js")
text = p.read_text(encoding="utf-8")
if "./safety-guard.js" not in text:
    match = re.search(r'  "\./app\.js\?v=[^"]+",', text)
    if not match:
        raise SystemExit("app.js shell entry missing")
    text = text[:match.end()] + '\n  "./safety-guard.js?v=__RELEASE__",' + text[match.end():]
p.write_text(text, encoding="utf-8")
replace_once("scripts/app_shell_release.py", '    "app.js",\n    "patient-document.js",', '    "app.js",\n    "safety-guard.js",\n    "patient-document.js",')
replace_once("scripts/check_atomic_shell.py", '    "./app.js",\n    "./patient-document.js",', '    "./app.js",\n    "./safety-guard.js",\n    "./patient-document.js",')

# Governance metadata.
proto = json.loads(Path("clinical-protocol.json").read_text(encoding="utf-8"))
proto["hardeningRevision"] = "2026.09.14-safety1"
proto["safetyGuards"] = [
    "El motor no titula con menos de 3 glicemias válidas del perfil requerido.",
    "Valores de glicemia inválidos bloquean la titulación automática en vez de ser ignorados silenciosamente.",
    "Cualquier hipoglicemia registrada bloquea todos los aumentos automáticos de NPH durante esa evaluación.",
    "Peso, esquema o dosis actuales inconsistentes fallan cerrados y mantienen la dosis sin cambios.",
    "Un autotest de versión e invariantes clínicos bloquea acciones críticas si detecta una carga incoherente."
]
if "tests/clinical-engine-hardening.test.js" not in proto.get("regressionMatrix", []):
    proto.setdefault("regressionMatrix", []).append("tests/clinical-engine-hardening.test.js")
Path("clinical-protocol.json").write_text(json.dumps(proto, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

# Hardening unit tests.
Path("tests/clinical-engine-hardening.test.js").write_text(r'''"use strict";
const assert = require("node:assert/strict");
const engine = require("../clinical-engine.js");

assert.equal(engine.version, "APS-NPH-2026.09.14-r2");
assert.equal(engine.MIN_REQUIRED_READINGS, 3);
assert.equal(engine.GLUCOSE_MIN_MGDL, 1);
assert.equal(engine.GLUCOSE_MAX_MGDL, 700);

const incomplete = engine.assessInsulinSensitivity({ age: 60, bmi: 25 });
assert.equal(incomplete.factor, 0.1);
assert.equal(incomplete.category, "uncertain");

const invalidInitial = engine.calculateInitialDose({ weightKg: 70, factor: 0.2, scheme: "desconocido" });
assert.equal(invalidInitial.valid, false);
assert.equal(invalidInitial.total, 0);

let r = engine.calculateFollowup({ weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170], targetA1c: 7 });
assert.equal(r.dataSufficient, false);
assert.equal(r.pm, 20);
assert.equal(r.blocksDoseChange, true);

r = engine.calculateFollowup({ weightKg: 70, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170, 999], targetA1c: 7 });
assert.equal(r.inputValid, false);
assert.equal(r.pm, 20);
assert.ok(r.validationErrors.some((item) => /inválid/i.test(item)));

r = engine.calculateFollowup({ weightKg: 100, regimenType: "2", amDose: 20, pmDose: 20, fastingValues: [69, 90, 100], preLunchValues: [250, 250, 250], targetA1c: 7 });
assert.ok(r.pm <= 20);
assert.equal(r.am, 20);
assert.match(r.advertencias.join(" "), /bloqueó cualquier aumento automático/);

r = engine.calculateFollowup({ weightKg: Number.NaN, regimenType: "pm", amDose: 0, pmDose: 20, fastingValues: [160, 170, 180], targetA1c: 7 });
assert.equal(r.inputValid, false);
assert.equal(r.blocksDoseChange, true);

const unknownSafety = engine.assessDoseSafety(Number.NaN);
assert.equal(unknownSafety.blocksAutomaticEscalation, true);
assert.equal(unknownSafety.requiresHighDoseReview, true);
console.log("Clinical engine fail-safe hardening checks passed");
''', encoding="utf-8")

Path("tests/e2e/safety-hardening.spec.js").write_text(r'''"use strict";
const { test, expect } = require("@playwright/test");

test("autotest fail-safe is healthy on normal load", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#insulog-safety-lock")).toHaveCount(0);
  const status = await page.evaluate(() => ({
    guard: Boolean(window.InsulogSafetyGuard), locked: window.InsulogSafetyGuard?.isLocked(),
    engineVersion: window.InsulogClinicalEngine?.version, appVersion: window.InsulogApp?.clinicalVersion
  }));
  expect(status.guard).toBe(true);
  expect(status.locked).toBe(false);
  expect(status.engineVersion).toBe("APS-NPH-2026.09.14-r2");
  expect(status.appVersion).toBe(status.engineVersion);
});

test("critical action error fails closed", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.InsulogSafetyGuard.reportActionError("calculate-followup", new Error("forced test")));
  await expect(page.locator("#insulog-safety-lock")).toBeVisible();
  await expect(page.locator('[data-action="calculate-followup"]')).toBeDisabled();
  await expect(page.locator('[data-action="calculate-initial"]')).toBeDisabled();
});
''', encoding="utf-8")

# Existing contract changes: unknown UI/kg now fails closed.
p = Path("tests/clinical-engine-contract.test.js")
text = p.read_text(encoding="utf-8")
text = text.replace('{ value: Number.NaN, expected: { level: "unknown", review: false, block: false } }', '{ value: Number.NaN, expected: { level: "unknown", review: true, block: true } }')
p.write_text(text, encoding="utf-8")

# Static CI validates the guard and new regression test.
p = Path(".github/workflows/static-check.yml")
text = p.read_text(encoding="utf-8")
if "node --check safety-guard.js" not in text:
    text = text.replace("          node --check app.js\n", "          node --check app.js\n          node --check safety-guard.js\n", 1)
if "node --check tests/clinical-engine-hardening.test.js" not in text:
    text = text.replace("          node --check tests/clinical-engine-contract.test.js\n", "          node --check tests/clinical-engine-contract.test.js\n          node --check tests/clinical-engine-hardening.test.js\n", 1)
if "node tests/clinical-engine-hardening.test.js" not in text:
    text = text.replace("          node tests/clinical-engine-contract.test.js\n", "          node tests/clinical-engine-contract.test.js\n          node tests/clinical-engine-hardening.test.js\n", 1)
p.write_text(text, encoding="utf-8")

print("Safety hardening patch applied")
