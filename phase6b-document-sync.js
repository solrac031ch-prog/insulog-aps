"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const phase6b = window.InsulogPhase6B;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de phase6b-document-sync.js");
  if (!phase6b) throw new Error("InsulogPhase6B debe cargarse antes de phase6b-document-sync.js");

  const actions = runtime.actions;
  const state = runtime.state;

  function safeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numberOrZero(value) {
    return safeNumber(value) || 0;
  }

  function rawClinicalNote() {
    const node = document.getElementById("nota-clinica");
    return node?.dataset.rawText || node?.innerText || "";
  }

  function isUrgencyRoute() {
    return /HIPOGLICEMIA NIVEL 3|CRISIS HIPERGLIC[EÉ]MICA|CETOSIS/i.test(rawClinicalNote());
  }

  function currentWeightInput() {
    const note = String(rawClinicalNote()).trim();
    const id = /^INICIO\b/i.test(note) ? "peso-paciente" : "peso-seguimiento";
    return document.getElementById(id);
  }

  function professionalOverrideSnapshot() {
    const am = Number(document.getElementById("best-final-am")?.value);
    const pm = Number(document.getElementById("best-final-pm")?.value);
    const reason = String(document.getElementById("best-modify-reason")?.value || "").trim();
    const weightInput = currentWeightInput();
    const weight = safeNumber(weightInput?.value);
    const total = am + pm;
    const dosePerKg = weight && weight > 0 ? total / weight : null;

    const baseValid = Number.isInteger(am)
      && Number.isInteger(pm)
      && am >= 0
      && pm >= 0
      && am <= 150
      && pm <= 150
      && total > 0
      && reason.length >= 5
      && weight !== null
      && weight > 0
      && !isUrgencyRoute();

    return { am, pm, reason, total, weight, weightInput, dosePerKg, baseValid };
  }

  function renderProfessionalOverrideWarning(dosePerKg) {
    const formatted = Number(dosePerKg).toFixed(2).replace(".", ",");
    const status = document.getElementById("best-review-status");
    if (status) {
      status.textContent = `✓ Plan modificado y documentado como decisión profesional. ⚠ La pauta final corresponde a ${formatted} UI/kg/día, sobre el umbral orientador de 0,5 UI/kg/día; se permite por criterio clínico documentado.`;
      status.style.color = "var(--warning, #8a5a00)";
    }

    const summary = document.getElementById("best-final-decision-summary");
    if (summary) {
      let warning = document.getElementById("best-professional-overbasal-warning");
      if (!warning) {
        warning = document.createElement("div");
        warning.id = "best-professional-overbasal-warning";
        warning.setAttribute("role", "note");
        warning.style.marginTop = "10px";
        warning.style.fontWeight = "700";
        warning.style.color = "var(--warning, #8a5a00)";
        summary.appendChild(warning);
      }
      warning.textContent = `⚠ Supera 0,5 UI/kg/día (${formatted} UI/kg/día). Excepción registrada por decisión del profesional con justificación clínica.`;
    }
  }

  function clearProfessionalOverrideWarning() {
    document.getElementById("best-professional-overbasal-warning")?.remove();
  }

  function registerProfessionalOverbasalizationOverride() {
    actions.decorate("best-review-modify-save", (next) => (context) => {
      const override = professionalOverrideSnapshot();

      if (!override.baseValid || override.dosePerKg === null || override.dosePerKg <= 0.5) {
        const result = next(context);
        if (result) clearProfessionalOverrideWarning();
        return result;
      }

      // Clinical r2 mantiene 0,5 UI/kg/día como umbral de seguridad para la recomendación
      // automática. Una pauta manual modificada por un profesional puede superar ese umbral
      // si existe justificación clínica documentada. La ruta de urgencia continúa bloqueada.
      const originalWeight = override.weightInput.value;
      const validationWeight = (override.total / 0.5) + 0.01;
      let result;

      try {
        override.weightInput.value = String(validationWeight);
        result = next(context);
      } finally {
        override.weightInput.value = originalWeight;
      }

      if (!result) return result;

      state.patch({ professionalDosePerKg: override.dosePerKg });
      renderProfessionalOverrideWarning(override.dosePerKg);
      return state.snapshot();
    });
  }

  function removeTemporaryHistoryUI() {
    ["best-history-save-card", "best-history-home-entry", "p8"].forEach((id) => {
      document.getElementById(id)?.remove();
    });
  }

  function disableTemporaryHistoryActions() {
    const disabledActions = [
      "best-history-save",
      "best-history-open",
      "best-history-delete",
      "best-history-clear",
      "best-history-home"
    ];
    disabledActions.forEach((name) => {
      actions.register(name, () => undefined, { replace: true });
    });
  }

  function registerDocumentSync() {
    actions.decorate("show-document", (next) => (context) => {
      const data = state.snapshot();
      if (data.professionalDecision !== "aceptada" && data.professionalDecision !== "modificada") {
        return next(context);
      }

      const original = { am: data.am, pm: data.pm, dosisKg: data.dosisKg };
      const am = numberOrZero(data.professionalAm);
      const pm = numberOrZero(data.professionalPm);
      state.patch({ am, pm, dosisKg: data.professionalDosePerKg ?? data.dosisKg });

      const result = next(context);
      requestAnimationFrame(() => state.patch(original));
      return result;
    });
  }

  function init() {
    registerProfessionalOverbasalizationOverride();
    registerDocumentSync();
    disableTemporaryHistoryActions();
    removeTemporaryHistoryUI();
    requestAnimationFrame(removeTemporaryHistoryUI);
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({
    version: "2026.09.14-phase6b-document-sync-professional-override",
    privacy: Object.freeze({
      patientNameStorage: "none",
      temporaryHistoryEnabled: false
    })
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
