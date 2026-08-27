"use strict";

(() => {
  function limpiarVistaPrevia() {
    const pdf = document.getElementById("pdf");
    if (pdf) pdf.innerHTML = "";
  }

  function enfocarNombre() {
    requestAnimationFrame(() => document.getElementById("nombre-paciente")?.focus());
  }

  function asegurarFarmaciaPopular() {
    // Espera a que el parser termine. Si el service worker ya agregó el módulo,
    // no lo duplica; si la página llegó directa desde GitHub Pages, lo carga aquí.
    window.setTimeout(() => {
      if (!document.querySelector('link[href*="farmacia-popular.css"]')) {
        const link = document.createElement("link");
        link.rel = "stylesheet";
        link.href = "./farmacia-popular.css?v=20260827-2";
        document.head.appendChild(link);
      }

      if (!document.querySelector('script[src*="farmacia-popular.js"]')) {
        const script = document.createElement("script");
        script.src = "./farmacia-popular.js?v=20260827-4";
        script.async = false;
        script.dataset.insulogFarmaciaFallback = "true";
        document.body.appendChild(script);
      }
    }, 0);
  }

  window.abrirDocumento = function abrirDocumentoPreparacion(tipo) {
    globalData.tipoDocumento = tipo || globalData.tipoDocumento || "seguimiento";
    limpiarVistaPrevia();
    nav(6);
    enfocarNombre();
  };

  window.mostrarDocumento = function mostrarDocumento(tipo) {
    const input = document.getElementById("nombre-paciente");
    const nombre = input?.value.trim() || "";

    if (!nombre) {
      alert("Ingrese el nombre del paciente antes de generar el documento.");
      input?.focus();
      return;
    }

    globalData.tipoDocumento = tipo;
    nav(7);
    requestAnimationFrame(() => window.generarDocumento(tipo));
  };

  window.volverPreparacionDocumento = function volverPreparacionDocumento() {
    nav(6);
    enfocarNombre();
  };

  asegurarFarmaciaPopular();
})();
