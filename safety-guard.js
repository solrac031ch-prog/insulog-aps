"use strict";

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
