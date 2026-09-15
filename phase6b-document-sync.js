"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const phase6b = window.InsulogPhase6B;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de phase6b-document-sync.js");
  if (!phase6b) throw new Error("InsulogPhase6B debe cargarse antes de phase6b-document-sync.js");

  const actions = runtime.actions;
  const state = runtime.state;
  const AUTO_BASAL_LIMIT = 0.5;

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

  function currentWeight() {
    const note = String(rawClinicalNote()).trim();
    const id = /^INICIO\b/i.test(note) ? "peso-paciente" : "peso-seguimiento";
    const weight = safeNumber(document.getElementById(id)?.value);
    return weight && weight > 0 ? weight : null;
  }

  function professionalDosePerKg(data = state.snapshot()) {
    const stored = safeNumber(data.professionalDosePerKg);
    if (stored !== null) return stored;
    const weight = currentWeight();
    if (!weight) return null;
    return (numberOrZero(data.professionalAm) + numberOrZero(data.professionalPm)) / weight;
  }

  function formatDosePerKg(value) {
    return Number(value).toFixed(2).replace(".", ",");
  }

  function ensureProfessionalWarning() {
    let warning = document.getElementById("best-professional-overbasal-warning");
    if (warning) return warning;

    const summary = document.getElementById("best-final-decision-summary");
    if (!summary) return null;

    warning = document.createElement("div");
    warning.id = "best-professional-overbasal-warning";
    warning.className = "alert text-left is-hidden";
    warning.setAttribute("role", "status");
    warning.setAttribute("aria-live", "polite");
    warning.style.marginTop = "12px";
    warning.style.borderColor = "#f3b33d";
    warning.style.background = "#fff8e8";
    warning.style.color = "#7a4a00";
    summary.insertAdjacentElement("afterend", warning);
    return warning;
  }

  function clearProfessionalOverrideWarning() {
    const warning = document.getElementById("best-professional-overbasal-warning");
    if (!warning) return;
    warning.classList.add("is-hidden");
    warning.setAttribute("aria-hidden", "true");
    warning.textContent = "";
  }

  function renderProfessionalOverrideState() {
    const data = state.snapshot();
    const warning = ensureProfessionalWarning();
    if (!warning) return;

    const dosePerKg = professionalDosePerKg(data);
    const isManualOverride = data.professionalDecision === "modificada";
    const isOverAutomaticLimit = isManualOverride && dosePerKg !== null && dosePerKg > AUTO_BASAL_LIMIT;

    if (!isOverAutomaticLimit) {
      clearProfessionalOverrideWarning();
      return;
    }

    const formatted = formatDosePerKg(dosePerKg);
    warning.classList.remove("is-hidden");
    warning.setAttribute("aria-hidden", "false");
    warning.innerHTML = `<strong>⚠️ Pauta profesional sobre el umbral automático:</strong> ${formatted} UI/kg/día. Insulog no recomienda escalar automáticamente por sobre 0,5 UI/kg/día; esta pauta puede emitirse porque fue modificada por un profesional y cuenta con justificación clínica documentada.`;

    const status = document.getElementById("best-review-status");
    if (status) {
      status.textContent = "✓ Plan modificado; criterio clínico documentado. Puede continuar con la pauta profesional.";
      status.style.color = "var(--success)";
    }
  }

  function markModificationInProgress() {
    const summary = document.getElementById("best-final-decision-summary");
    if (summary) {
      summary.innerHTML = "<strong>Modificación en edición:</strong> al guardar, la pauta ingresada reemplazará la decisión previa y quedará registrada como criterio profesional.";
    }
    clearProfessionalOverrideWarning();
  }

  function scheduleProfessionalOverrideRender() {
    queueMicrotask(renderProfessionalOverrideState);
    requestAnimationFrame(renderProfessionalOverrideState);
  }

  function registerProfessionalOverbasalizationOverride() {
    if (actions.has("best-review-modify")) {
      actions.decorate("best-review-modify", (next) => (context) => {
        const result = next(context);
        markModificationInProgress();
        return result;
      });
    }

    actions.decorate("best-review-modify-save", (next) => (context) => {
      // Clinical r2 conserva 0,5 UI/kg/día como techo de escalamiento automático.
      // La decisión manual del profesional no se altera ni se recalcula: si la pauta
      // modificada es válida, está justificada y no corresponde a una ruta de urgencia,
      // puede superar el umbral. El exceso queda visible y documentado como advertencia.
      const result = next(context);
      if (!result) return result;

      const data = state.snapshot();
      const dosePerKg = professionalDosePerKg(data);
      if (data.professionalDecision === "modificada" && dosePerKg !== null) {
        state.patch({ professionalDosePerKg: dosePerKg });
      }
      scheduleProfessionalOverrideRender();
      return state.snapshot();
    });

    ["best-review-accept", "best-review-reassess", "best-review-modify-cancel"].forEach((actionName) => {
      if (!actions.has(actionName)) return;
      actions.decorate(actionName, (next) => (context) => {
        const result = next(context);
        scheduleProfessionalOverrideRender();
        return result;
      });
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

      if (isUrgencyRoute()) return next(context);

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
    scheduleProfessionalOverrideRender();
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({
    version: "2026.09.14-phase6b-document-sync-professional-override-v2",
    automaticBasalLimitUiKgDay: AUTO_BASAL_LIMIT,
    privacy: Object.freeze({
      patientNameStorage: "none",
      temporaryHistoryEnabled: false
    })
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
