"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de patient-document.js");

  const { byId } = runtime.dom;
  const state = runtime.state;
  const enhancers = [];

  function escapeHTML(texto = "") {
    return String(texto)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function bloqueControlFirma() {
    return `
      <div class="pdf-firma-control">
        <div class="pdf-control-box">
          <div><strong>Próximo control:</strong> ____/____/____</div>
          <div><strong>Hora:</strong> __________</div>
        </div>
        <div class="pdf-signature">
          <span class="pdf-signature-line">Firma y timbre médico</span>
        </div>
      </div>`;
  }

  function useEnhancer(name, handler) {
    if (!name || typeof handler !== "function") {
      throw new TypeError("useEnhancer requiere nombre y función");
    }
    if (enhancers.some((entry) => entry.name === name)) {
      throw new Error(`El enhancer de documento ${name} ya está registrado`);
    }
    enhancers.push({ name, handler });
  }

  function bloqueDosis(am, pm) {
    const lineas = [];

    if (am > 0) {
      lineas.push(`
        <div class="pdf-insulina-line">
          <span class="pdf-insulina-etiqueta">AM</span>
          <span class="pdf-insulina-horario">antes del desayuno</span>
          <strong>${am} UI</strong>
        </div>`);
    }

    if (pm > 0) {
      lineas.push(`
        <div class="pdf-insulina-line">
          <span class="pdf-insulina-etiqueta">PM</span>
          <span class="pdf-insulina-horario">antes de dormir</span>
          <strong>${pm} UI</strong>
        </div>`);
    }

    return `
      <section class="pdf-insulina-paciente">
        <div class="pdf-insulina-title">Insulina NPH indicada</div>
        <div class="pdf-insulina-pautas">
          ${lineas.length ? lineas.join("") : "<div class=\"pdf-empty-state\">Sin dosis de NPH indicada en este documento.</div>"}
        </div>
      </section>`;
  }

  function tablaRegistro() {
    return `
      <div class="pdf-table-title">Registro de control - 15 días</div>
      <div class="registro-hgt-ayuda">Anote <strong>hora y HGT</strong> en ambas mediciones. Use mg/dL.</div>
      <table class="tabla-registro tabla-registro-hgt">
        <thead>
          <tr class="grupo-mediciones">
            <th class="col-fecha" rowspan="2">Fecha</th>
            <th colspan="2">Ayunas</th>
            <th colspan="2">Pre-almuerzo</th>
          </tr>
          <tr>
            <th class="col-hora-medicion">Hora</th>
            <th class="col-hgt">HGT<br><span class="unidad-tabla">mg/dL</span></th>
            <th class="col-hora-medicion">Hora</th>
            <th class="col-hgt">HGT<br><span class="unidad-tabla">mg/dL</span></th>
          </tr>
        </thead>
        <tbody>${Array.from({ length: 15 }, () => "<tr><td></td><td></td><td></td><td></td><td></td></tr>").join("")}</tbody>
      </table>`;
  }

  function bloqueIndicaciones(titulo, items) {
    return `
      <section class="pdf-indicaciones">
        <div class="pdf-section-title">${escapeHTML(titulo)}</div>
        <ul class="pdf-clean-list">${items.map((item) => `<li>${item}</li>`).join("")}</ul>
      </section>`;
  }

  function generarDocumento(tipo = state.get("tipoDocumento") || "seguimiento") {
    state.patch({ tipoDocumento: tipo });
    const data = state.snapshot();
    const nombre = byId("nombre-paciente").value.trim() || "_________________________________";
    const fecha = new Date().toLocaleDateString("es-CL");

    const titulos = {
      inicio: "Inicio de insulina NPH",
      seguimiento: "Seguimiento y ajuste de insulina NPH",
      pscv: "Control en Programa de Salud Cardiovascular"
    };

    const subtitulos = {
      inicio: "Indicaciones para el paciente y registro de hemoglucotest",
      seguimiento: "Indicaciones para el paciente y registro de hemoglucotest",
      pscv: "Resumen de indicaciones para continuidad de cuidados"
    };

    const tituloDoc = titulos[tipo] || titulos.seguimiento;
    const subtituloDoc = subtitulos[tipo] || subtitulos.seguimiento;
    const am = Number(data.am) || 0;
    const pm = Number(data.pm) || 0;

    const header = `
      <header class="pdf-doc-header">
        <div class="pdf-doc-brand">
          <div class="pdf-doc-kicker">Insulog APS - apoyo clínico</div>
          <h1 class="pdf-doc-title">${escapeHTML(tituloDoc)}</h1>
          <div class="pdf-doc-subtitle">${escapeHTML(subtituloDoc)}</div>
        </div>
        <div class="pdf-doc-meta"><strong>Fecha</strong><br>${escapeHTML(fecha)}</div>
      </header>
      <div class="pdf-patient-row">
        <span class="pdf-patient-label">Paciente</span>
        <span class="pdf-patient-name">${escapeHTML(nombre)}</span>
      </div>`;

    const dosis = bloqueDosis(am, pm);
    let cuerpo = "";

    if (tipo === "inicio") {
      cuerpo = `
        ${dosis}
        ${bloqueIndicaciones("Indicaciones del facultativo", [
          "<strong>Educación:</strong> coordinar con enfermería técnica de administración y sitios de punción.",
          "<strong>Nutrición:</strong> evaluación por nutricionista para ajuste de plan alimentario.",
          "<strong>Seguimiento:</strong> control médico en 15 días con este registro completo."
        ])}
        ${tablaRegistro()}
        ${bloqueControlFirma()}`;
    } else if (tipo === "seguimiento") {
      const acciones = data.acciones
        ? data.acciones
          .split("\n")
          .filter(Boolean)
          .map((accion) => escapeHTML(accion.replace("- ", "")))
        : [];

      cuerpo = `
        ${dosis}
        ${bloqueIndicaciones("Indicaciones de continuidad", [
          "Mantener rotación de sitios de punción (abdomen, muslos, brazos).",
          "<strong>Registro:</strong> glicemias capilares en ayunas y pre-almuerzo, anotando hora y valor de cada medición.",
          ...acciones
        ])}
        ${tablaRegistro()}
        ${bloqueControlFirma()}`;
    } else {
      cuerpo = `
        ${dosis}
        <section class="pdf-alert-important">
          <div class="pdf-section-title">Indicación importante</div>
          <p>Si el glucómetro es propiedad del CESFAM, favor devolverlo en la oficina de dirección (2do piso) con la encargada Susan al finalizar este ciclo.</p>
        </section>
        <section class="pdf-program-note">
          <div class="pdf-section-title">Control de programa</div>
          <p>Continuar controles regulares según cronograma en su Programa de Salud Cardiovascular (PSCV), de acuerdo con la evaluación clínica de su equipo tratante.</p>
        </section>
        ${bloqueControlFirma()}`;
    }

    const footer = `
      <footer class="pdf-doc-footer">
        <div>
          <strong>Vacunas:</strong> verificar COVID, influenza y neumococo según vigencia.<br>
          Apoyo clínico alineado con Vía Clínica MINSAL DM2 2026 y Protocolo de Insulinización MINSAL 2022.
        </div>
        <div class="pdf-author">
          <strong>Dr. Carlos Herrera Malaver</strong><br>
          Médico Internista<br>
          Insulog APS
        </div>
      </footer>`;

    const pdf = byId("pdf");
    pdf.innerHTML = header + cuerpo + footer;

    enhancers.forEach(({ handler }) => handler({ pdf, tipo, state: state.snapshot() }));

    requestAnimationFrame(() => pdf.scrollIntoView({ behavior: "smooth", block: "start" }));
    return pdf;
  }

  window.InsulogDocuments = Object.freeze({
    version: "2026.09.16-phase8c-pdf-isolated",
    generate: generarDocumento,
    useEnhancer
  });
})();
