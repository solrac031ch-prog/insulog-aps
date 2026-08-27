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
  const p4 = document.getElementById("p4");
  const alerta = p4?.querySelector(".aps-safety-box");
  if (!p4 || !alerta) return;

  alerta.id = "alerta-hipoglicemia-ada";
  alerta.classList.remove("hypo-visible");
  alerta.setAttribute("role", "alert");
  alerta.setAttribute("aria-live", "polite");
  alerta.innerHTML = `
    <strong id="hipo-ada-titulo"></strong>
    <p id="hipo-ada-descripcion" class="aps-context-helper"></p>
    <label class="aps-safety-option" style="margin-top:8px;">
      <input type="checkbox" id="hipo-nivel3-evento">
      <span>¿El episodio presentó alteración mental o física y requirió ayuda de otra persona para tratar la hipoglicemia?</span>
    </label>
    <p class="aps-context-helper" style="margin:8px 0 0;">Si la respuesta es sí, ADA 2026 clasifica el evento como hipoglicemia nivel 3, independientemente del valor de glucosa.</p>`;

  function valoresRegistrados() {
    return Array.from(p4.querySelectorAll(".glicemia"))
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));
  }

  function actualizarAlertaHipoglicemia() {
    const valoresHipo = valoresRegistrados().filter((value) => value < 70);
    const nivel3 = document.getElementById("hipo-nivel3-evento");
    const titulo = document.getElementById("hipo-ada-titulo");
    const descripcion = document.getElementById("hipo-ada-descripcion");

    if (!valoresHipo.length) {
      alerta.classList.remove("hypo-visible");
      if (nivel3) nivel3.checked = false;
      if (titulo) titulo.textContent = "";
      if (descripcion) descripcion.textContent = "";
      return;
    }

    alerta.classList.add("hypo-visible");
    const minimo = Math.min(...valoresHipo);

    if (nivel3?.checked) {
      if (titulo) titulo.textContent = "⚠️ Hipoglicemia ADA nivel 3";
      if (descripcion) {
        descripcion.textContent = "Evento grave con alteración mental y/o física que requirió asistencia para el tratamiento. Requiere reevaluación clínica prioritaria del plan terapéutico.";
      }
      return;
    }

    if (minimo < 54) {
      if (titulo) titulo.textContent = "⚠️ Hipoglicemia ADA nivel 2";
      if (descripcion) {
        descripcion.textContent = `Se registró HGT <54 mg/dL (mínimo ${minimo} mg/dL). ADA 2026 recomienda reevaluar el plan terapéutico ante hipoglicemia nivel 2.`;
      }
      return;
    }

    if (titulo) titulo.textContent = "⚠️ Hipoglicemia ADA nivel 1";
    if (descripcion) {
      descripcion.textContent = `Se registró HGT entre 54 y 69 mg/dL (mínimo ${minimo} mg/dL). Revisar causas, prevención y seguridad del tratamiento.`;
    }
  }

  p4.addEventListener("input", (event) => {
    if (event.target.matches(".glicemia")) actualizarAlertaHipoglicemia();
  });

  p4.addEventListener("change", (event) => {
    if (event.target.id === "hipo-nivel3-evento") actualizarAlertaHipoglicemia();
  });

  const prepSegBase = window.prepSeg;
  if (typeof prepSegBase === "function") {
    window.prepSeg = function prepSegConAlertaADA() {
      const resultado = prepSegBase();
      requestAnimationFrame(actualizarAlertaHipoglicemia);
      return resultado;
    };
  }

  actualizarAlertaHipoglicemia();
})();

(() => {
  const cssHref = "./aps-safety-2026.css?v=20260826-1";
  if (!document.querySelector(`link[href="${cssHref}"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = cssHref;
    document.head.appendChild(link);
  }

  const scriptSrc = "./aps-safety-2026.js?v=20260826-1";
  if (!document.querySelector(`script[src="${scriptSrc}"]`)) {
    const script = document.createElement("script");
    script.src = scriptSrc;
    script.defer = true;
    document.body.appendChild(script);
  }
})();
