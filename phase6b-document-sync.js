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
    registerDocumentSync();
    disableTemporaryHistoryActions();
    removeTemporaryHistoryUI();
    requestAnimationFrame(removeTemporaryHistoryUI);
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({
    version: "2026.09.14-phase6b-document-sync-private-name",
    privacy: Object.freeze({
      patientNameStorage: "none",
      temporaryHistoryEnabled: false
    })
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
