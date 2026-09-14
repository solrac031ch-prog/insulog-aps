"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de professional-override-policy.js");

  const { byId } = runtime.dom;
  const actions = runtime.actions;
  const state = runtime.state;
  const AUTO_BASAL_LIMIT = 0.5;

  function safeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function currentWeight() {
    const followup = safeNumber(byId("peso-seguimiento")?.value);
    if (followup && followup > 0) return followup;
    const start = safeNumber(byId("peso-paciente")?.value);
    return start && start > 0 ? start : null;
  }

  function professionalDosePerKg(data = state.snapshot()) {
    const stored = safeNumber(data.professionalDosePerKg);
    if (stored !== null) return stored;
    const weight = currentWeight();
    if (!weight) return null;
    const am = safeNumber(data.professionalAm) || 0;
    const pm = safeNumber(data.professionalPm) || 0;
    return (am + pm) / weight;
  }

  function formatDosePerKg(value) {
    return Number(value).toFixed(2).replace(".", ",");
  }

  function ensureWarningNode() {
    let node = byId("best-professional-overbasal-warning");
    if (node) return node;

    const summary = byId("best-final-decision-summary");
    if (!summary) return null;

    node = document.createElement("div");
    node.id = "best-professional-overbasal-warning";
    node.className = "alert text-left is-hidden";
    node.setAttribute("role", "status");
    node.setAttribute("aria-live", "polite");
    node.style.marginTop = "12px";
    node.style.borderColor = "#f3b33d";
    node.style.background = "#fff8e8";
    node.style.color = "#7a4a00";
    summary.insertAdjacentElement("afterend", node);
    return node;
  }

  function renderPolicyState() {
    const data = state.snapshot();
    const warning = ensureWarningNode();
    if (!warning) return;

    const dosePerKg = professionalDosePerKg(data);
    const isManualOverride = data.professionalDecision === "modificada";
    const isOverAutomaticLimit = isManualOverride && dosePerKg !== null && dosePerKg > AUTO_BASAL_LIMIT;

    warning.classList.toggle("is-hidden", !isOverAutomaticLimit);
    warning.setAttribute("aria-hidden", String(!isOverAutomaticLimit));

    if (isOverAutomaticLimit) {
      warning.innerHTML = `<strong>⚠️ Pauta profesional sobre el umbral automático:</strong> ${formatDosePerKg(dosePerKg)} UI/kg/día. Insulog no recomienda escalar automáticamente por sobre 0,5 UI/kg/día; esta pauta puede emitirse porque fue modificada por un profesional y cuenta con justificación clínica documentada.`;

      const status = byId("best-review-status");
      if (status) {
        status.textContent = "✓ Plan modificado; criterio clínico documentado. Puede continuar con la pauta profesional.";
        status.style.color = "var(--success)";
      }
    }
  }

  function markModificationInProgress() {
    const summary = byId("best-final-decision-summary");
    if (!summary) return;
    summary.innerHTML = "<strong>Modificación en edición:</strong> al guardar, la pauta ingresada reemplazará la decisión previa y quedará registrada como criterio profesional.";
  }

  function scheduleRender() {
    queueMicrotask(renderPolicyState);
    requestAnimationFrame(renderPolicyState);
  }

  function init() {
    if (!actions.has("best-review-modify-save")) {
      throw new Error("La acción best-review-modify-save debe existir antes de aplicar la política de override profesional");
    }

    actions.decorate("best-review-modify-save", (next) => (context) => {
      const result = next(context);
      scheduleRender();
      return result;
    });

    if (actions.has("best-review-modify")) {
      actions.decorate("best-review-modify", (next) => (context) => {
        const result = next(context);
        markModificationInProgress();
        return result;
      });
    }

    ["best-review-accept", "best-review-reassess", "best-review-modify-cancel"].forEach((actionName) => {
      if (!actions.has(actionName)) return;
      actions.decorate(actionName, (next) => (context) => {
        const result = next(context);
        scheduleRender();
        return result;
      });
    });

    renderPolicyState();
  }

  window.InsulogProfessionalOverridePolicy = Object.freeze({
    version: "2026.09.14-professional-override-v1",
    automaticBasalLimitUiKgDay: AUTO_BASAL_LIMIT
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
