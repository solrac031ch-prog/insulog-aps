"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const app = window.InsulogApp;

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

  function compactMedicationOption(option) {
    if (!option || option.dataset.compactMedication === "true") return;

    const copy = option.querySelector(".aps-med-copy");
    const efficacy = copy?.querySelector(".aps-med-efficacy");
    const safety = copy?.querySelector(".aps-med-safety");
    if (!copy || (!efficacy && !safety)) return;

    const details = document.createElement("details");
    details.className = "aps-med-details";

    const summary = document.createElement("summary");
    summary.textContent = "Ver eficacia y precauciones";
    details.appendChild(summary);

    const body = document.createElement("div");
    body.className = "aps-med-details-body";
    if (efficacy) body.appendChild(efficacy);
    if (safety) body.appendChild(safety);
    details.appendChild(body);

    copy.appendChild(details);
    option.dataset.compactMedication = "true";
  }

  function compactSecondaryMedicationSection(section) {
    if (!section || section.dataset.compactSection === "true") return;

    const title = section.querySelector(".aps-med-section-title");
    const grid = section.querySelector(".aps-med-grid");
    if (!grid) return;

    const details = document.createElement("details");
    details.className = "aps-med-secondary-details";

    const summary = document.createElement("summary");
    summary.textContent = title?.textContent?.trim() || "Otras opciones / compra particular";
    details.appendChild(summary);
    details.appendChild(grid);

    title?.remove();
    section.appendChild(details);
    section.dataset.compactSection = "true";
  }

  function compactEfficacyNote(note) {
    if (!note || note.dataset.compactNote === "true") return;

    const details = document.createElement("details");
    details.className = "aps-efficacy-details";

    const summary = document.createElement("summary");
    summary.textContent = "Sobre las estimaciones de HbA1c";
    details.appendChild(summary);

    note.parentNode?.insertBefore(details, note);
    details.appendChild(note);
    note.dataset.compactNote = "true";
  }

  function setupProgressiveDisclosure() {
    const p25Label = document.querySelector("#p25 .page-label");
    if (p25Label) p25Label.textContent = "Inicio · tratamiento actual";

    all(".aps-med-option").forEach(compactMedicationOption);
    all(".aps-med-section-secondary").forEach(compactSecondaryMedicationSection);
    all(".aps-efficacy-note").forEach(compactEfficacyNote);
  }

  function setupActionDelegation() {
    document.addEventListener("click", (event) => {
      const element = event.target.closest("[data-action]");
      if (!element || element.disabled) return;

      const action = element.dataset.action;
      if (!action) return;

      try {
        const result = actions.invoke(action, { element, event });
        if (result && typeof result.catch === "function") {
          result.catch((error) => console.error(`Error ejecutando acción ${action}:`, error));
        }
      } catch (error) {
        console.error(`Error ejecutando acción ${action}:`, error);
      }
    });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
        console.warn("No se pudo registrar el service worker de Insulog:", error);
      });
    });
  }

  function init() {
    const fecha = byId("fecha-hoy");
    if (fecha) fecha.textContent = new Date().toLocaleDateString("es-CL");

    setupProgressiveDisclosure();
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
