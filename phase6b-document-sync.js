"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de phase6b-document-sync.js");

  const actions = runtime.actions;
  const state = runtime.state;

  function safeNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function init() {
    actions.decorate("show-document", (next) => (context) => {
      const data = state.snapshot();
      if (data.professionalDecision !== "aceptada" && data.professionalDecision !== "modificada") {
        return next(context);
      }

      const original = { am: data.am, pm: data.pm, dosisKg: data.dosisKg };
      const am = safeNumber(data.professionalAm);
      const pm = safeNumber(data.professionalPm);
      state.patch({ am, pm, dosisKg: data.professionalDosePerKg ?? data.dosisKg });

      const result = next(context);

      requestAnimationFrame(() => {
        state.patch(original);
      });

      return result;
    });
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({ version: "2026.09.14-phase6b" });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
