"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const app = window.InsulogApp;
  const clinicalCopy = window.InsulogClinicalCopy;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de app-shell.js");
  if (!app) throw new Error("InsulogApp debe cargarse antes de app-shell.js");

  const { all, byId } = runtime.dom;
  const actions = runtime.actions;

  function setupButtonFeedback() {
    document.addEventListener("pointerdown", (event) => {
      const button = event.target.closest(".btn");
      if (button) button.classList.add("is-pressed");
    });
    const release = () => all(".btn.is-pressed").forEach((button) => button.classList.remove("is-pressed"));
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
  }

  function setupAriaPressed() {
    all(".selection-btn, .action-btn").forEach((button) => button.setAttribute("aria-pressed", "false"));
  }

  function setupActionDelegation() {
    document.addEventListener("click", (event) => {
      const element = event.target.closest("[data-action]");
      if (!element || element.disabled) return;
      const action = element.dataset.action;
      if (!action) return;
      try {
        const result = actions.invoke(action, { element, event });
        if (result && typeof result.catch === "function") result.catch((error) => console.error(`Error ejecutando acción ${action}:`, error));
      } catch (error) {
        console.error(`Error ejecutando acción ${action}:`, error);
      }
    });
  }

  function injectClinicalR2Controls() {
    const criteriaGrid = document.querySelector("#criterios .criteria-card .form-grid");
    if (criteriaGrid && !byId("edad-inicio")) {
      criteriaGrid.insertAdjacentHTML("beforeend", `
        <div class="field"><label for="edad-inicio">Edad (años)</label><input type="number" inputmode="numeric" id="edad-inicio" min="18" max="120" placeholder="Ej: 68"></div>
        <div class="field"><label for="imc-inicio">IMC (kg/m²)</label><input type="number" inputmode="decimal" id="imc-inicio" min="10" max="80" step="0.1" placeholder="Ej: 31.4"></div>
        <div class="field"><label for="vfg-inicio">VFG estimada (mL/min/1,73 m²)</label><input type="number" inputmode="numeric" id="vfg-inicio" min="1" max="150" placeholder="Ej: 72"></div>`);
    }

    const preference = document.querySelector('.inicio-btn[data-value="Deseo del paciente"]');
    if (preference) {
      preference.classList.remove("inicio-btn");
      preference.classList.add("aceptacion-btn");
      preference.dataset.value = "Paciente acepta insulinoterapia";
      preference.textContent = "Paciente acepta insulinoterapia";
      preference.title = "Registra aceptación/preferencia, pero no constituye por sí sola una indicación clínica de insulina.";
    }

    const factor = byId("factor-dosis");
    if (factor) {
      factor.innerHTML = '<option value="0.1">0,1 UI/kg · insulinosensible / alto riesgo</option><option value="0.2">0,2 UI/kg · sensibilidad usual o insulinorresistente en monodosis</option>';
      factor.disabled = true;
      factor.setAttribute("aria-describedby", "factor-dosis-ayuda-r2");
      const grid = factor.closest(".dosing-grid");
      if (grid && !byId("factor-dosis-ayuda-r2")) grid.insertAdjacentHTML("afterend", '<p id="factor-dosis-ayuda-r2" class="helper-text">El factor se determina automáticamente con edad, IMC, VFG y riesgo de hipoglicemia. En monodosis no se permite 0,3 UI/kg.</p>');
    }

    const guidance = document.querySelector("#p3 .guidance-content");
    if (guidance) guidance.innerHTML = '<ul class="compact-list"><li><strong>0,1 UI/kg:</strong> insulinosensible, VFG &lt;60, edad &gt;70 años o alto riesgo de hipoglicemia.</li><li><strong>0,2 UI/kg:</strong> sensibilidad usual o insulinorresistente cuando se usa monodosis.</li><li><strong>0,3 UI/kg:</strong> reservado por protocolo MINSAL para NPH doble dosis en insulinorresistencia; Insulog no lo propone automáticamente como inicio basal 2026.</li></ul>';

    const p4 = byId("p4");
    const tracking = p4?.querySelector(".table-guide");
    if (tracking && !byId("meta-hba1c-seguimiento")) {
      tracking.insertAdjacentHTML("beforebegin", `
        <div class="card card-blue text-left compact-card" id="metas-seguridad-r2">
          <p class="card-title text-center">Meta individual y seguridad</p>
          <div class="form-grid">
            <div class="field"><label for="meta-hba1c-seguimiento">Meta individual de HbA1c</label><select id="meta-hba1c-seguimiento"><option value="7">&lt;7% · preprandial 80–130</option><option value="8">&lt;8% · preprandial 100–150</option><option value="8.5">&lt;8,5% · preprandial 100–160</option></select></div>
          </div>
        </div>`);
    }

    const preHeader = document.querySelector("#p4 thead th:nth-child(3)");
    if (preHeader) preHeader.innerHTML = 'Pre-almuerzo <span class="th-unit">mg/dL</span>';

    const p41 = byId("p41");
    const heading = p41?.querySelector("h2");
    if (heading) heading.textContent = "Revise dosis alta / posible sobreinsulinización";
    const strong = p41?.querySelector(".alert-danger strong");
    if (strong) strong.textContent = "⚠️ dosis alta de insulina basal: no escalar automáticamente si alcanza ≥0,5 UI/kg/día";
    const lead = p41?.querySelector(".lead");
    if (lead) lead.textContent = "La Vía Clínica DM2 2026 establece 0,5 UI/kg/día como dosis máxima de insulina basal. Revise técnica, adherencia, patrón glicémico y necesidad de intensificación o derivación.";
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
        await registration.update();
      } catch (error) {
        console.warn("No se pudo registrar o actualizar el service worker de Insulog:", error);
      }
    });
  }

  function init() {
    const fecha = byId("fecha-hoy");
    if (fecha) fecha.textContent = new Date().toLocaleDateString("es-CL");
    injectClinicalR2Controls();
    document.addEventListener("input", app.inputs.handle);
    setupActionDelegation();
    setupButtonFeedback();
    setupAriaPressed();
    registerServiceWorker();
    runtime.navigation.go(0);
  }

  window.InsulogShell = Object.freeze({ init });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
