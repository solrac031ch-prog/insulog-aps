"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const documents = window.InsulogDocuments;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de document-flow.js");
  if (!documents) throw new Error("InsulogDocuments debe cargarse antes de document-flow.js");

  const { go } = runtime.navigation;
  const state = runtime.state;
  const actions = runtime.actions;
  const FRAME_ID = "pdf-preview-frame";
  const PRINT_BUTTON_ID = "imprimir-documento-btn";

  function stagingPDF() {
    return document.getElementById("pdf");
  }

  function previewFrame() {
    return document.getElementById(FRAME_ID);
  }

  function previewPDF() {
    return previewFrame()?.contentDocument?.getElementById("pdf") || null;
  }

  function setPreviewReady(ready) {
    const frame = previewFrame();
    const button = document.getElementById(PRINT_BUTTON_ID);
    if (frame) {
      frame.dataset.ready = ready ? "true" : "false";
      frame.setAttribute("aria-busy", String(!ready));
    }
    if (button) button.disabled = !ready;
  }

  function limpiarVistaPrevia() {
    const staging = stagingPDF();
    if (staging) {
      staging.innerHTML = "";
      staging.className = "imprimible-container pdf-render-staging";
    }

    const destino = previewPDF();
    if (destino) {
      destino.innerHTML = "";
      destino.className = "imprimible-container";
    }

    setPreviewReady(false);
  }

  function copiarVistaPreviaAlFrame() {
    const staging = stagingPDF();
    const frame = previewFrame();
    if (!staging || !frame || !staging.innerHTML.trim()) return false;

    const copiar = () => {
      const destino = previewPDF();
      if (!destino) return false;

      const clases = new Set(Array.from(staging.classList));
      clases.delete("pdf-render-staging");
      clases.add("imprimible-container");

      destino.className = Array.from(clases).join(" ");
      destino.innerHTML = staging.innerHTML;
      frame.contentWindow?.scrollTo(0, 0);
      setPreviewReady(true);
      return true;
    };

    if (copiar()) return true;

    frame.addEventListener("load", () => copiar(), { once: true });
    return false;
  }

  function enfocarNombre() {
    requestAnimationFrame(() => document.getElementById("nombre-paciente")?.focus());
  }

  function prepararFrame() {
    const frame = previewFrame();
    if (!frame) return;

    frame.addEventListener("load", () => {
      setPreviewReady(false);
      if (stagingPDF()?.innerHTML.trim()) copiarVistaPreviaAlFrame();
    });

    if (frame.contentDocument?.readyState === "complete") {
      setPreviewReady(false);
    }
  }

  function abrirDocumento({ element } = {}) {
    const tipo = element?.dataset.documentType || state.get("tipoDocumento") || "seguimiento";
    state.patch({ tipoDocumento: tipo });
    limpiarVistaPrevia();
    go(6);
    enfocarNombre();
  }

  function mostrarDocumento({ element } = {}) {
    const input = document.getElementById("nombre-paciente");
    const nombre = input?.value.trim() || "";

    if (!nombre) {
      alert("Ingrese el nombre del paciente antes de generar el documento.");
      input?.focus();
      return undefined;
    }

    const tipo = element?.dataset.documentType || state.get("tipoDocumento") || "seguimiento";
    state.patch({ tipoDocumento: tipo });
    setPreviewReady(false);
    go(7);

    requestAnimationFrame(() => {
      documents.generate(tipo);
      queueMicrotask(() => copiarVistaPreviaAlFrame());
    });

    return tipo;
  }

  function volverPreparacionDocumento() {
    go(6);
    enfocarNombre();
  }

  function imprimirDocumentoAislado() {
    const frame = previewFrame();
    if (!frame || frame.dataset.ready !== "true" || !previewPDF()?.innerHTML.trim()) {
      alert("La vista previa aún no está lista para imprimir.");
      return;
    }

    frame.contentWindow?.focus();
    frame.contentWindow?.print();
  }

  actions.register("open-document", abrirDocumento);
  actions.register("show-document", mostrarDocumento);
  actions.register("back-document", volverPreparacionDocumento);
  actions.register("print-document", imprimirDocumentoAislado);

  actions.decorate("finish", (next) => (context) => {
    const resultado = next(context);
    if (document.getElementById("p0")?.classList.contains("active")) {
      limpiarVistaPrevia();
    }
    return resultado;
  });

  prepararFrame();
})();
