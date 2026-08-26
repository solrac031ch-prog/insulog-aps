"use strict";

(() => {
  const generarDocumentoBase = window.generarDocumento;

  if (typeof generarDocumentoBase !== "function") {
    console.warn("Insulog: no se encontró generarDocumento para optimizar el registro PDF.");
    return;
  }

  window.generarDocumento = function generarDocumentoOptimizado(tipo) {
    const resultado = generarDocumentoBase(tipo);
    const pdf = document.getElementById("pdf");
    const tabla = pdf?.querySelector(".tabla-registro");

    if (!tabla) return resultado;

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

    return resultado;
  };
})();

(() => {
  const cssHref = "./aps-safety-2026.css?v=20260826-1";
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  const flowSrc = "./followup-flow-2026.js?v=20260826-2";
  const cargarFlujoSeguimiento = () => {
    if (document.querySelector(`script[src="${flowSrc}"]`)) return;
    const flowScript = document.createElement("script");
    flowScript.src = flowSrc;
    flowScript.async = false;
    document.body.appendChild(flowScript);
  };

  const scriptSrc = "./aps-safety-2026.js?v=20260826-1";
  const existente = document.querySelector(`script[src="${scriptSrc}"]`);

  if (existente) {
    if (document.getElementById("tratamiento-concomitante-seguimiento")) {
      cargarFlujoSeguimiento();
    } else {
      existente.addEventListener("load", cargarFlujoSeguimiento, { once: true });
    }
    return;
  }

  const script = document.createElement("script");
  script.src = scriptSrc;
  script.async = false;
  script.addEventListener("load", cargarFlujoSeguimiento, { once: true });
  document.body.appendChild(script);
})();
