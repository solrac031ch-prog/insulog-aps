"use strict";

/* Base document builder extracted from app.js. Presentation remains isolated by document-flow.js. */

function generarPDF(esSeguimiento) {
  abrirDocumento(esSeguimiento ? "seguimiento" : "pscv");
}

function abrirDocumento(tipo) {
  globalData.tipoDocumento = tipo;
  nav(6);
  requestAnimationFrame(() => generarDocumento(tipo));
}

function generarDocumento(tipo = globalData.tipoDocumento || "seguimiento") {
  globalData.tipoDocumento = tipo;
  const nombre = $("nombre-paciente").value.trim() || "_________________________________";
  const fecha = new Date().toLocaleDateString("es-CL");

  const titulos = {
    inicio: "INICIO DE INSULINA NPH",
    seguimiento: "SEGUIMIENTO Y AJUSTE DE INSULINA NPH",
    pscv: "CONTROL EN PROGRAMA DE SALUD CARDIOVASCULAR"
  };

  const tituloDoc = titulos[tipo] || titulos.seguimiento;
  const am = Number(globalData.am) || 0;
  const pm = Number(globalData.pm) || 0;

  const dosis = `
    <div style="margin:15px 0;padding:15px;border:2px solid #0052cc;border-radius:10px;background:#f0f7ff;">
      <b style="font-size:14px;color:#0052cc;text-transform:uppercase;letter-spacing:.5px;">Dosis Actual Indicada</b>
      <div style="margin-top:10px;display:flex;justify-content:space-around;align-items:center;">
        <div style="text-align:center;"><span style="font-size:11px;color:#555;">MAÑANA (AM)</span><br><b style="font-size:24px;">${am} <small style="font-size:14px;">UI</small></b></div>
        <div style="height:40px;border-left:1px solid #bcd9ff;"></div>
        <div style="text-align:center;"><span style="font-size:11px;color:#555;">NOCHE (PM)</span><br><b style="font-size:24px;">${pm} <small style="font-size:14px;">UI</small></b></div>
      </div>
    </div>`;

  const tabla = `
    <div style="margin-top:15px;margin-bottom:5px;"><b style="font-size:12px;color:#1a2b3c;">REGISTRO DE CONTROL (15 DÍAS)</b></div>
    <table class="tabla-registro">
      <thead><tr><th class="col-fecha">Fecha</th><th class="col-hora">Hora</th><th class="col-glic">Glicemia Ayunas</th><th class="col-glic">Antes de las once</th></tr></thead>
      <tbody>${Array.from({ length: 15 }, () => "<tr><td></td><td></td><td></td><td></td></tr>").join("")}</tbody>
    </table>`;

  const header = `
    <div style="border-bottom:2px solid #0052cc;padding-bottom:10px;margin-bottom:15px;display:flex;justify-content:space-between;align-items:flex-end;gap:16px;">
      <div><b style="font-size:18px;color:#0052cc;">${tituloDoc}</b><br><span style="font-size:12px;color:#666;">Plataforma de Apoyo Clínico Insulog APS</span></div>
      <div style="text-align:right;font-size:12px;"><b>Fecha:</b> ${fecha}</div>
    </div>
    <div style="margin-bottom:15px;font-size:14px;"><b>Paciente:</b> <span style="border-bottom:1px dotted #333;">${escaparHTML(nombre)}</span></div>`;

  let cuerpo = "";

  if (tipo === "inicio") {
    cuerpo = `
      ${dosis}
      <div style="margin:15px 0;">
        <b style="font-size:12px;text-transform:uppercase;">Indicaciones del Facultativo:</b>
        <ul style="margin-top:5px;padding-left:20px;font-size:12px;line-height:1.5;">
          <li><b>Educación:</b> Coordinar con enfermería técnica de administración y sitios de punción.</li>
          <li><b>Nutrición:</b> Evaluación por nutricionista para ajuste de plan alimentario.</li>
          <li><b>Seguimiento:</b> Control médico en 15 días con este registro completo.</li>
        </ul>
      </div>
      ${tabla}
      ${bloqueControlFirma()}`;
  } else if (tipo === "seguimiento") {
    const acciones = globalData.acciones
      ? globalData.acciones.split("\n").filter(Boolean).map((a) => `<li>${escaparHTML(a.replace("- ", ""))}</li>`).join("")
      : "";

    cuerpo = `
      ${dosis}
      <div style="margin:15px 0;">
        <b style="font-size:12px;text-transform:uppercase;">Indicaciones de Continuidad:</b>
        <ul style="margin-top:5px;padding-left:20px;font-size:12px;line-height:1.5;">
          <li>Mantener rotación estricta de sitios de punción (abdomen, muslos, brazos).</li>
          <li><b>Registro:</b> Glicemias capilares en ayunas y antes de la cena (antes de las once).</li>
          ${acciones}
        </ul>
      </div>
      ${tabla}
      ${bloqueControlFirma()}`;
  } else {
    cuerpo = `
      ${dosis}
      <div style="background:#fff4e6;padding:15px;border:1px solid #ffd8a8;border-radius:8px;margin:20px 0;font-size:13px;color:#856404;">
        <b>⚠️ INDICACIÓN IMPORTANTE:</b><br>
        Si el glucómetro es propiedad del CESFAM, favor devolverlo en la oficina de dirección (2do piso) con la encargada Susan al finalizar este ciclo.
      </div>
      <p style="font-size:13px;line-height:1.5;"><b>CONTROL DE PROGRAMA:</b> El paciente se encuentra compensado. Continuar controles regulares según cronograma en su Programa de Salud Cardiovascular (PSCV).</p>
      <div style="text-align:center;width:220px;border-top:1.5px solid #000;margin:60px auto 0;padding-top:5px;"><b style="font-size:13px;">Firma y Timbre Médico</b></div>`;
  }

  const footer = `
    <div style="margin-top:28px;border-top:1px solid #eee;padding-top:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:20px;">
        <div style="font-size:11px;color:#555;line-height:1.35;">
          <b>Vacunatorio:</b> COVID, Influenza, Neumococo (Verificar vigencia).<br>
          Ajuste clínico basado en normas MINSAL, ADA 2024 y ALAD.<br>
          <i>Documento generado por Insulog APS ®</i>
        </div>
        <div style="text-align:right;font-size:11px;color:#1a2b3c;min-width:190px;"><b>Autor de la aplicación:</b><br>Dr. Carlos Herrera Malaver<br>Médico Internista</div>
      </div>
    </div>`;

  $("pdf").innerHTML = header + cuerpo + footer;
  requestAnimationFrame(() => $("pdf").scrollIntoView({ behavior: "smooth", block: "start" }));
}

function bloqueControlFirma() {
  return `
    <div style="display:flex;justify-content:space-between;margin-top:15px;font-size:12px;gap:20px;">
      <div style="background:#f9f9f9;padding:10px;border-radius:5px;border:1px solid #eee;"><b>Próximo Control:</b> ____/____/____<br><b>Hora:</b> ________</div>
      <div style="text-align:center;width:200px;border-top:1px solid #000;margin-top:35px;padding-top:5px;"><b>Firma y Timbre Médico</b></div>
    </div>`;
}

