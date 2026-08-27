"use strict";

(() => {
  function limpiarVistaPrevia() {
    const pdf = document.getElementById("pdf");
    if (pdf) pdf.innerHTML = "";
  }

  function enfocarNombre() {
    requestAnimationFrame(() => document.getElementById("nombre-paciente")?.focus());
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
})();
