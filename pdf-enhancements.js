"use strict";

(() => {
  const generarDocumentoBase = window.generarDocumento;

  if (typeof generarDocumentoBase !== "function") {
    console.warn("Insulog: no se encontró generarDocumento para optimizar el registro PDF.");
    return;
  }

  // Horarios prácticos para el documento del paciente, basados en fichas técnicas oficiales:
  // metformina IR con comidas; metformina XR con comida de la tarde/noche;
  // empagliflozina en la mañana; dapagliflozina una vez al día con o sin comida;
  // vildagliptina con o sin comida; combinaciones con metformina junto a comidas.
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
    dapagliflozina10: {
      "10 mg/día": "Dapagliflozina 10 mg: 1 comprimido en la mañana, con o sin alimentos."
    },
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
    empaMet12_5_1000: {
      "12,5/1.000 mg/día": "Empagliflozina/metformina 12,5/1.000 mg: 1 comprimido con el desayuno."
    },
    vildaMet: {
      "50/500 mg": "Vildagliptina/metformina 50/500 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "50/850 mg": "Vildagliptina/metformina 50/850 mg: 1 comprimido con el desayuno y 1 comprimido con la cena.",
      "50/1.000 mg": "Vildagliptina/metformina 50/1.000 mg: 1 comprimido con el desayuno y 1 comprimido con la cena."
    }
  };

  function obtenerCajaDosis(pdf) {
    const titulo = Array.from(pdf.querySelectorAll("b"))
      .find((element) => element.textContent.trim().toLowerCase() === "dosis actual indicada");
    return titulo?.parentElement || null;
  }

  function actualizarDosisInsulinaPaciente(pdf) {
    const caja = obtenerCajaDosis(pdf);
    if (!caja) return;

    const am = Number(globalData.am) || 0;
    const pm = Number(globalData.pm) || 0;
    const indicaciones = [];

    if (am > 0) {
      indicaciones.push(`<div style="margin:7px 0;"><b>Dosis AM:</b> <span style="font-size:20px;font-weight:800;">${am} UI</span> — antes del desayuno</div>`);
    }

    if (pm > 0) {
      indicaciones.push(`<div style="margin:7px 0;"><b>Dosis PM:</b> <span style="font-size:20px;font-weight:800;">${pm} UI</span> — antes de dormir</div>`);
    }

    caja.innerHTML = `
      <b style="font-size:14px;color:#0052cc;text-transform:uppercase;letter-spacing:.5px;">Insulina NPH</b>
      <div style="margin-top:9px;font-size:13px;line-height:1.45;">
        ${indicaciones.length ? indicaciones.join("") : "<div>Sin dosis de NPH indicada en este documento.</div>"}
      </div>`;
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

  function instruccionesMedicamentosPaciente(tipo) {
    const scope = tipo === "inicio" ? "inicio" : tipo === "seguimiento" ? "seguimiento" : "";
    if (!scope) return [];

    return Array.from(document.querySelectorAll(`input[data-aps-med="${scope}"]:checked`))
      .map(instruccionMedicamento)
      .filter(Boolean);
  }

  function actualizarTratamientoPaciente(pdf, tipo) {
    pdf.querySelectorAll(".tratamiento-pdf").forEach((node) => node.remove());

    const instrucciones = instruccionesMedicamentosPaciente(tipo);
    if (!instrucciones.length) return;

    const dosis = obtenerCajaDosis(pdf);
    const bloque = document.createElement("div");
    bloque.className = "tratamiento-pdf";
    bloque.style.margin = "12px 0 15px";
    bloque.style.padding = "12px 14px";
    bloque.style.border = "1px solid #ccd5e0";
    bloque.style.borderRadius = "8px";
    bloque.style.background = "#fafbfc";
    bloque.style.fontSize = "12px";
    bloque.style.lineHeight = "1.45";
    bloque.innerHTML = `
      <b style="font-size:13px;color:#1a2b3c;text-transform:uppercase;">Medicamentos para la diabetes</b>
      <ul style="margin:8px 0 0;padding-left:20px;">${instrucciones.map((texto) => `<li style="margin:5px 0;">${texto}</li>`).join("")}</ul>`;

    if (dosis) dosis.insertAdjacentElement("afterend", bloque);
    else pdf.insertAdjacentElement("afterbegin", bloque);
  }

  function finalizarDocumentoPaciente(tipo) {
    const pdf = document.getElementById("pdf");
    if (!pdf) return;
    actualizarDosisInsulinaPaciente(pdf);
    actualizarTratamientoPaciente(pdf, tipo);
  }

  window.generarDocumento = function generarDocumentoOptimizado(tipo) {
    const resultado = generarDocumentoBase(tipo);
    const pdf = document.getElementById("pdf");
    const tabla = pdf?.querySelector(".tabla-registro");

    if (tabla) {
      tabla.classList.add("tabla-registro-hgt");

      const thead = tabla.querySelector("thead");
      const tbody = tabla.querySelector("tbody");

      if (thead) {
        thead.innerHTML = `
          <tr class="grupo-mediciones">
            <th class="col-fecha" rowspan="2">Fecha</th>
            <th colspan="2">Ayunas</th>
            <th colspan="2">Preonce / Precena</th>
          </tr>
          <tr>
            <th class="col-hora-medicion">Hora</th>
            <th class="col-hgt">HGT<br><span class="unidad-tabla">mg/dL</span></th>
            <th class="col-hora-medicion">Hora</th>
            <th class="col-hgt">HGT<br><span class="unidad-tabla">mg/dL</span></th>
          </tr>`;
      }

      if (tbody) {
        tbody.innerHTML = Array.from(
          { length: 15 },
          () => "<tr><td></td><td></td><td></td><td></td><td></td></tr>"
        ).join("");
      }

      if (!pdf.querySelector(".registro-hgt-ayuda")) {
        const ayuda = document.createElement("div");
        ayuda.className = "registro-hgt-ayuda";
        ayuda.innerHTML = "Registrar <strong>hora y valor del hemoglucotest</strong> en ambas mediciones: ayunas y preonce/precena.";
        tabla.insertAdjacentElement("beforebegin", ayuda);
      }

      const indicacionRegistro = Array.from(pdf.querySelectorAll("li"))
        .find((item) => item.textContent.toLowerCase().includes("registro:"));

      if (indicacionRegistro) {
        indicacionRegistro.innerHTML = "<b>Registro:</b> Glicemias capilares en ayunas y preonce/precena, anotando hora y valor de cada medición.";
      }
    }

    // aps-safety-2026.js envuelve esta función después de cargar este módulo y agrega
    // el tratamiento clínico de forma sincrónica. El microtask corre al final de esa
    // cadena y deja el documento final en lenguaje pensado para el paciente.
    queueMicrotask(() => finalizarDocumentoPaciente(tipo));

    return resultado;
  };
})();
