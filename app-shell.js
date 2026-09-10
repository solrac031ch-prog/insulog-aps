"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de app-shell.js");

  const { all, byId } = runtime.dom;

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

    if (typeof handleInput !== "function") {
      throw new Error("La validación de entradas clínicas no está disponible");
    }

    document.addEventListener("input", handleInput);
    setupButtonFeedback();
    setupAriaPressed();
    registerServiceWorker();
    runtime.navigation.go(0);
  }

  window.InsulogShell = Object.freeze({ init });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
