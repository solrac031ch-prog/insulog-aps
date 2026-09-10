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
