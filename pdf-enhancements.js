"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const documents = window.InsulogDocuments;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de pdf-enhancements.js");
  if (!documents) throw new Error("InsulogDocuments debe cargarse antes de pdf-enhancements.js");

  const PAUTAS_PACIENTE = {
    metformina850: {
      "850 mg/día": "Metformina 850 mg: 1 comprimido con el desayuno.",
      "1.700 mg/día": "Metformina 850 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "2.550 mg/día (máx.)": "Metformina 850 mg: 1 comprimido con el desayuno, 1 con el almuerzo y 1 con la cena."
    },
    metforminaXR1000: {
      "1.000 mg/día": "Metformina XR 1.000 mg: 1 comprimido con la cena.",
      "2.000 mg/día (máx.)": "Metformina XR 1.000 mg: 2 comprimidos juntos con la cena."
    },
    dapagliflozina10: { "10 mg/día": "Dapagliflozina 10 mg: 1 comprimido en la mañana, con o sin alimentos." },
    vildagliptina50: {
      "50 mg cada 24 h": "Vildagliptina 50 mg: 1 comprimido en la mañana, con o sin alimentos.",
      "50 mg cada 12 h": "Vildagliptina 50 mg: 1 comprimido en la mañana y 1 comprimido en la noche, con o sin alimentos."
    },
    metformina500: {
      "500 mg/día": "Metformina 500 mg: 1 comprimido con la cena.",
      "1.000 mg/día": "Metformina 500 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "1.500 mg/día": "Metformina 500 mg: 1 comprimido con el desayuno, 1 con el almuerzo y 1 con la cena.",
      "2.000 mg/día": "Metformina 500 mg: 2 comprimidos con el desayuno y 2 comprimidos con la cena.",
      "2.500 mg/día": "Metformina 500 mg: 2 comprimidos con el desayuno, 1 con el almuerzo y 2 con la cena."
    },
    metformina750: {
      "750 mg/día": "Metformina 750 mg: 1 comprimido con la cena.",
      "1.500 mg/día": "Metformina 750 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "2.250 mg/día": "Metformina 750 mg: 1 comprimido con el desayuno, 1 con el almuerzo y 1 con la cena."
    },
    empagliflozina: {
      "10 mg/día": "Empagliflozina 10 mg: 1 comprimido en la mañana, con o sin alimentos.",
      "12,5 mg/día": "Empagliflozina 25 mg: ½ comprimido en la mañana, con o sin alimentos.",
      "25 mg/día": "Empagliflozina 25 mg: 1 comprimido en la mañana, con o sin alimentos."
    },
    empaMet12_5_1000: { "12,5/1.000 mg/día": "Empagliflozina/metformina 12,5/1.000 mg: 1 comprimido con el desayuno." },
    vildaMet: {
      "50/500 mg": "Vildagliptina/metformina 50/500 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "50/850 mg": "Vildagliptina/metformina 50/850 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "50/1.000 mg": "Vildagliptina/metformina 50/1.000 mg: 1 comprimido con el desayuno y 1 comprimido con la cena."
    }
  };

  function obtenerCajaDosis(pdf) {
    const cajaSemantica = pdf.querySelector(".pdf-insulina-paciente");
    if (cajaSemantica) return cajaSemantica;
    const titulo = Array.from(pdf.querySelectorAll("b"))
      .find((element) => element.textContent.trim().toLowerCase() === "dosis actual indicada");
    return titulo?.parentElement || null;
  }

  function actualizarDosisInsulinaPaciente(pdf, documentState) {
    const caja = obtenerCajaDosis(pdf);
    if (!caja) return;
    const am = Number(documentState.am) || 0;
    const pm = Number(documentState.pm) || 0;
    const indicaciones = [];
    if (am > 0) indicaciones.push(`<div class="pdf-insulina-line"><span class="pdf-insulina-etiqueta">AM</span><span class="pdf-insulina-horario">antes del desayuno</span><strong>${am} UI</strong></div>`);
    if (pm > 0) indicaciones.push(`<div class="pdf-insulina-line"><span class="pdf-insulina-etiqueta">PM</span><span class="pdf-insulina-horario">antes de dormir</span><strong>${pm} UI</strong></div>`);
    caja.removeAttribute("style");
    caja.className = "pdf-insulina-paciente";
    caja.innerHTML = `<div class="pdf-insulina-title">Insulina NPH indicada</div><div class="pdf-insulina-pautas">${indicaciones.length ? indicaciones.join("") : "<div class=\"pdf-empty-state\">Sin dosis de NPH indicada en este documento.</div>"}</div>`;
  }

  function instruccionMedicamento(input) {
    const key = input.dataset.medKey;
    if (!key) return "";
    const select = input.closest("label")?.querySelector(".aps-med-dose");
    const dosisSeleccionada = select?.value || "";
    const pauta = PAUTAS_PACIENTE[key]?.[dosisSeleccionada];
    if (pauta) return pauta;
    const nombre = input.dataset.baseLabel || input.dataset.label || "Medicamento";
    return `${nombre.split(":")[0]}: tomar según la indicación entregada por su equipo de salud.`;
  }

  function inputsMedicamentosPacienteActuales() {
    const seleccionados = Array.from(document.querySelectorAll('input[data-aps-med]:checked'));
    if (!seleccionados.length) return [];

    const tratamientoActual = String(runtime.state.get("tratamientoConcomitante") || "").trim();
    if (tratamientoActual && tratamientoActual !== "No registrado") {
      for (const scope of ["inicio", "seguimiento"]) {
        const inputs = seleccionados.filter((input) => input.dataset.apsMed === scope);
        const texto = inputs.map((input) => input.dataset.label).filter(Boolean).join("; ");
        if (inputs.length && texto === tratamientoActual) return inputs;
      }
    }

    const nota = document.getElementById("nota-clinica");
    const textoNota = nota?.dataset.rawText || nota?.innerText || "";
    const scopePreferido = /^INICIO\b/i.test(textoNota)
      ? "inicio"
      : /^SEGUIMIENTO\b/i.test(textoNota)
        ? "seguimiento"
        : "";

    if (scopePreferido) {
      const preferidos = seleccionados.filter((input) => input.dataset.apsMed === scopePreferido);
      if (preferidos.length) return preferidos;
    }

    const seguimiento = seleccionados.filter((input) => input.dataset.apsMed === "seguimiento");
    if (seguimiento.length) return seguimiento;
    return seleccionados.filter((input) => input.dataset.apsMed === "inicio");
  }

  function instruccionesMedicamentosPaciente() {
    const vistas = new Set();
    return inputsMedicamentosPacienteActuales()
      .map(instruccionMedicamento)
      .filter((texto) => texto && !vistas.has(texto) && vistas.add(texto));
  }

  function actualizarTratamientoPaciente(pdf) {
    pdf.querySelectorAll(".tratamiento-pdf").forEach((node) => node.remove());
    const instrucciones = instruccionesMedicamentosPaciente();
    if (!instrucciones.length) return;
    const dosis = pdf.querySelector(".pdf-insulina-paciente") || obtenerCajaDosis(pdf);
    const bloque = document.createElement("section");
    bloque.className = "tratamiento-pdf pdf-medicamentos-paciente";
    bloque.innerHTML = `<div class="pdf-section-title pdf-medicamentos-title">Medicamentos para la diabetes</div><ul class="pdf-clean-list">${instrucciones.map((texto) => `<li>${texto}</li>`).join("")}</ul>`;
    if (dosis) dosis.insertAdjacentElement("afterend", bloque);
    else pdf.insertAdjacentElement("afterbegin", bloque);
  }

  function marcarEstructuraCarta(pdf) {
    pdf.classList.add("pdf-carta-una-pagina");
    Array.from(pdf.children).forEach((child) => {
      const texto = child.textContent.replace(/\s+/g, " ").trim();
      if (!texto) return;
      if (texto.includes("Insulog APS - apoyo clínico") || texto.includes("Plataforma de Apoyo Clínico Insulog APS")) child.classList.add("pdf-doc-header");
      else if (texto.startsWith("Paciente")) child.classList.add("pdf-patient-row");
      else if (texto.includes("Indicaciones del facultativo") || texto.includes("Indicaciones de continuidad")) child.classList.add("pdf-indicaciones");
      else if (texto.includes("Registro de control - 15 días") || texto.includes("REGISTRO DE CONTROL (15 DÍAS)")) child.classList.add("pdf-table-title");
      else if (texto.includes("Próximo control") && texto.includes("Firma y timbre médico")) child.classList.add("pdf-firma-control");
      else if (texto.includes("Vía Clínica MINSAL DM2 2026") || texto.includes("Ajuste clínico basado en normas MINSAL")) child.classList.add("pdf-doc-footer");
    });
  }

  function aplicarDensidadDocumento(pdf) {
    const medicamentos = pdf.querySelectorAll(".pdf-medicamentos-paciente li").length;
    pdf.classList.remove("pdf-densidad-amplia", "pdf-densidad-compacta", "pdf-contenido-extenso");
    if (medicamentos > 4) pdf.classList.add("pdf-contenido-extenso");
  }

  function transformarTablaSeguimiento(pdf) {
    const tabla = pdf.querySelector(".tabla-registro");
    if (!tabla) return;
    tabla.classList.add("tabla-registro-hgt");
    const thead = tabla.querySelector("thead");
    const tbody = tabla.querySelector("tbody");
    if (thead) thead.innerHTML = `<tr class="grupo-mediciones"><th class="col-fecha" rowspan="2">Fecha</th><th colspan="2">Ayunas</th><th colspan="2">Pre-almuerzo</th></tr><tr><th class="col-hora-medicion">Hora</th><th class="col-hgt">HGT<br><span class="unidad-tabla">mg/dL</span></th><th class="col-hora-medicion">Hora</th><th class="col-hgt">HGT<br><span class="unidad-tabla">mg/dL</span></th></tr>`;
    if (tbody) tbody.innerHTML = Array.from({ length: 15 }, () => "<tr><td></td><td></td><td></td><td></td><td></td></tr>").join("");
    if (!pdf.querySelector(".registro-hgt-ayuda")) {
      const ayuda = document.createElement("div");
      ayuda.className = "registro-hgt-ayuda";
      ayuda.innerHTML = "Anote <strong>hora y HGT</strong> en ambas mediciones. Use mg/dL.";
      tabla.insertAdjacentElement("beforebegin", ayuda);
    }
    const indicacionRegistro = Array.from(pdf.querySelectorAll("li")).find((item) => item.textContent.toLowerCase().includes("registro:"));
    if (indicacionRegistro) indicacionRegistro.innerHTML = "<strong>Registro:</strong> glicemias capilares en ayunas y pre-almuerzo, anotando hora y valor de cada medición.";
  }

  documents.useEnhancer("patient-pdf-enhancements", ({ pdf, state }) => {
    transformarTablaSeguimiento(pdf);
    actualizarDosisInsulinaPaciente(pdf, state);
    actualizarTratamientoPaciente(pdf);
    marcarEstructuraCarta(pdf);
    aplicarDensidadDocumento(pdf);
  });
})();
