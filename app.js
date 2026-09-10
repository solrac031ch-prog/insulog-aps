"use strict";

const clinicalEngine = window.InsulogClinicalEngine;
if (!clinicalEngine) {
  throw new Error("InsulogClinicalEngine debe cargarse antes de app.js");
}

function exclusion() {
  showElement($("alerta"), true);
}

function mostrarInicio() {
  showElement($("criterios"), true);
  requestAnimationFrame(() => $("hba1c-inicio")?.focus());
}

function toggleSeleccion(boton) {
  boton.classList.toggle("seleccionada");
  boton.setAttribute("aria-pressed", String(boton.classList.contains("seleccionada")));
}

function definirEsquemaInicio() {
  const hba1c = parseFloat($("hba1c-inicio").value);
  const ayunas = parseFloat($("glicemia-ayunas-inicio").value);
  const casual = parseFloat($("glicemia-casual-inicio").value);

  const inicio = qsa(".inicio-btn.seleccionada").map((c) => c.dataset.value);
  const catabolicos = qsa(".catabolico-btn.seleccionada").map((c) => c.dataset.value);
  const riesgoHipo = qsa(".riesgo-hipo-btn.seleccionada").map((c) => c.dataset.value);

  const decision = clinicalEngine.suggestInitialScheme({
    hba1c,
    fasting: ayunas,
    casual,
    initiationCriteria: inicio,
    catabolic: catabolicos,
    hypoRisk: riesgoHipo
  });

  if (decision.criteria.length === 0) {
    alert("Ingrese al menos un dato o criterio de inicio.");
    return;
  }

  $("factor-dosis").value = String(decision.factor);

  Object.assign(globalData, {
    criteria: decision.criteriaText,
    esquemaInicio: decision.scheme,
    textoEsquemaInicio: decision.schemeText,
    motivoEsquemaInicio: decision.reason,
    catabolicos: decision.catabolicText,
    riesgoHipo: decision.hypoRiskText
  });

  const caja = $("sugerencia-esquema-inicio");
  if (caja) {
    caja.innerHTML = `<strong>Esquema sugerido:</strong> ${escaparHTML(decision.schemeText)}<br><br><strong>Motivo:</strong> ${escaparHTML(decision.reason)}`;
    showElement(caja, true);
  }

  mostrarResumenEsquemaInicio();
  nav(3);
}

function mostrarResumenEsquemaInicio() {
  const caja = $("resumen-esquema-inicio");
  if (!caja || !globalData.textoEsquemaInicio) return;

  caja.innerHTML = `<strong>Esquema sugerido:</strong> ${escaparHTML(globalData.textoEsquemaInicio)}<br><br><strong>Motivo:</strong> ${escaparHTML(globalData.motivoEsquemaInicio)}`;
  showElement(caja, true);
}

// Adaptadores de compatibilidad. Las reglas viven en clinical-engine.js.
function redondearPar(valor) {
  return clinicalEngine.roundEven(valor);
}

function analizarGlicemias(valores, nombre) {
  return clinicalEngine.analyzeGlucose(valores, nombre);
}

function calcularAjuste(analisis, nombreDosis) {
  return clinicalEngine.calculateAdjustment(analisis, nombreDosis);
}

function dosisSegundaDosis(pesoKg) {
  return clinicalEngine.calculateSecondDose(pesoKg);
}

function calcularInicioMejorado() {
  const peso = parseFloat($("peso-paciente").value);
  const factor = parseFloat($("factor-dosis").value);

  if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
    alert("Ingrese un peso válido entre 1 y 300 kg.");
    return;
  }

  if (!globalData.criteria) {
    alert("Complete primero los datos disponibles para orientar el esquema inicial.");
    nav(2);
    return;
  }

  const resultado = clinicalEngine.calculateInitialDose({
    weightKg: peso,
    factor,
    scheme: globalData.esquemaInicio
  });

  globalData.am = resultado.am;
  globalData.pm = resultado.pm;
  globalData.dosisKg = resultado.dosePerKg;

  const preview = $("preview-dosis");
  preview.innerHTML = `
    <strong>Esquema sugerido:</strong> ${escaparHTML(globalData.textoEsquemaInicio || "NPH monodosis nocturna")}<br><br>
    Dosis total: ${resultado.total} UI/día<br><br>
    • Mañana: ${resultado.am} UI<br>
    • Noche: ${resultado.pm} UI
  `;
  showElement(preview, true);

  const nota = `INICIO
Paciente con criterios de inicio de insulina bajo ${globalData.criteria}.
Esquema sugerido: ${globalData.textoEsquemaInicio || "NPH monodosis nocturna"}
Motivo: ${globalData.motivoEsquemaInicio || "Inicio conservador con NPH nocturna."}
Se inicia insulina NPH en dosis de:
- ${resultado.am} unidades antes del desayuno
- ${resultado.pm} unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico en 15 días con seguimiento de glicemia en ayunas y Antes de las once.`;

  renderNotaClinica(nota);
  nav(5);
}

function prepSeg() {
  const tbody = $("tabla-seguimiento");
  tbody.innerHTML = "";

  for (let i = 1; i <= 15; i += 1) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${i}</strong></td>
      <td><input class="ay glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia en ayunas" autocomplete="off"></td>
      <td><input class="pre glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia antes de las once" autocomplete="off"></td>
    `;
    tbody.appendChild(row);
  }

  nav(4);
}

function calcularSeguimientoPro() {
  const peso = parseFloat($("peso-seguimiento").value);
  const tipo = $("tipo-esquema").value;

  if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
    alert("Ingrese un peso válido entre 1 y 300 kg.");
    return;
  }

  let am = parseInt($("am-actual").value, 10) || 0;
  let pm = parseInt($("pm-actual").value, 10) || 0;

  if (tipo === "am") pm = 0;
  if (tipo === "pm") am = 0;

  if (tipo === "am" && am <= 0) {
    alert("Ingrese la dosis AM actual.");
    return;
  }

  if (tipo === "pm" && pm <= 0) {
    alert("Ingrese la dosis PM actual.");
    return;
  }

  if (tipo === "2" && am <= 0 && pm <= 0) {
    alert("Ingrese al menos una dosis actual de insulina.");
    return;
  }

  const ayunasRaw = qsa(".ay")
    .map((i) => parseInt(i.value, 10))
    .filter((v) => Number.isFinite(v));

  const preonceRaw = qsa(".pre")
    .map((i) => parseInt(i.value, 10))
    .filter((v) => Number.isFinite(v));

  if (ayunasRaw.length < 3) {
    alert("Se requieren al menos 3 glicemias en ayunas.");
    return;
  }

  const resultado = clinicalEngine.calculateFollowup({
    weightKg: peso,
    regimenType: tipo,
    amDose: am,
    pmDose: pm,
    fastingValues: ayunasRaw,
    preElevenValues: preonceRaw
  });

  Object.assign(globalData, {
    amActual: resultado.amActual,
    pmActual: resultado.pmActual,
    am: resultado.am,
    pm: resultado.pm,
    promAy: resultado.promAy,
    promPre: resultado.promPre,
    promedioGlobal: resultado.promedioGlobal,
    hba1cEstimada: resultado.hba1cEstimada,
    dosisKg: resultado.dosisKg,
    acciones: "",
    explicacion: resultado.explicacion
  });

  const resumen = $("resumen-promedios");
  resumen.innerHTML = `
    <strong>Promedios usados:</strong><br>
    Ayunas: ${globalData.promAy} mg/dL<br>
    Pre-once: ${globalData.promPre} mg/dL<br>
    Dosis total: ${resultado.am + resultado.pm} UI/día (${resultado.dosisKg.toFixed(2)} UI/kg/día)<br>
    Esquema final: ${resultado.schemeLabel}
  `;
  showElement(resumen, true);

  if (resultado.dosisKg >= 0.7) {
    nav(41);
    return;
  }

  const nota = `SEGUIMIENTO APS
Promedios usados: Ayunas ${globalData.promAy} | Pre-once ${globalData.promPre}
Promedio global estimado: ${globalData.promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${globalData.hba1cEstimada}%
Esquema actual: AM ${globalData.amActual} UI | PM ${globalData.pmActual} UI
Nuevo Esquema sugerido: AM ${resultado.am} UI | PM ${resultado.pm} UI
Dosis total: ${resultado.am + resultado.pm} UI/día (${resultado.dosisKg.toFixed(2)} UI/kg/día)
Razonamiento:
${globalData.explicacion}`;

  renderNotaClinica(nota);
  nav(5);
}

function toggleAccion(boton) {
  toggleSeleccion(boton);
}

function generarNotaDosisAlta() {
  const accionesSeleccionadas = qsa("#p41 .action-btn.seleccionada").map((a) => a.dataset.value);

  if (accionesSeleccionadas.length > 0) {
    accionesSeleccionadas.unshift("Evaluación y seguimiento por Medicina Interna APS");
  }

  globalData.acciones = accionesSeleccionadas.join("\n");

  const nota = `SEGUIMIENTO APS
Promedios usados: Ayunas ${globalData.promAy} | Pre-once ${globalData.promPre}
Promedio global estimado: ${globalData.promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${globalData.hba1cEstimada}%
Esquema actual: AM ${globalData.amActual} UI | PM ${globalData.pmActual} UI
Nuevo Esquema sugerido: AM ${globalData.am} UI | PM ${globalData.pm} UI
Razonamiento: ${globalData.explicacion}

ALERTA DOSIS ALTA (>0.7 UI/kg):
${globalData.acciones || "Mantener controles y seguimiento por medicina interna APS."}`;

  renderNotaClinica(nota);
  nav(5);
}

function escaparHTML(texto = "") {
  return String(texto)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function claseNota(linea) {
  const l = linea.toLowerCase();

  if (l.includes("alerta") || l.includes("hipoglicemia") || l.includes("<54") || l.includes("<70") || l.includes("suspensión")) {
    return "nota-roja";
  }

  if (l.includes("hba1c estimada")) {
    const valor = parseFloat(linea.replace(",", ".").match(/[\d.]+/)?.[0]);
    if (!Number.isNaN(valor)) {
      if (valor <= 7) return "nota-verde";
      if (valor < 9) return "nota-amarilla";
      return "nota-roja";
    }
  }

  if (l.includes("nuevo esquema") || l.includes("dosis sugerida")) return "nota-azul";
  if (l.includes("esquema actual") || l.includes("promedios usados") || l.includes("promedio global")) return "nota-gris";
  return "";
}

function renderNotaClinica(texto) {
  const nota = $("nota-clinica");
  nota.dataset.rawText = texto;
  nota.innerHTML = texto
    .split("\n")
    .map((linea) => {
      const clase = claseNota(linea);
      const contenido = escaparHTML(linea) || "&nbsp;";
      return `<span class="nota-linea${clase ? ` ${clase}` : ""}">${contenido}</span>`;
    })
    .join("");
}

async function copiarNota() {
  const nota = $("nota-clinica");
  const text = nota.dataset.rawText || nota.innerText;

  if (!text.trim()) {
    mostrarEstadoCopia("No hay una nota para copiar.", false);
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      copiarNotaFallback(text);
    }
    mostrarEstadoCopia("✓ Nota copiada al portapapeles", true);
  } catch {
    try {
      copiarNotaFallback(text);
      mostrarEstadoCopia("✓ Nota copiada al portapapeles", true);
    } catch {
      mostrarEstadoCopia("No se pudo copiar automáticamente. Seleccione y copie la nota manualmente.", false);
    }
  }
}

function copiarNotaFallback(text) {
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(area);
  if (!copied) throw new Error("copy failed");
}

function mostrarEstadoCopia(mensaje, ok) {
  const status = $("copy-status");
  status.textContent = mensaje;
  status.style.color = ok ? "var(--success)" : "var(--danger)";
  window.setTimeout(() => {
    if (status.textContent === mensaje) status.textContent = "";
  }, 3200);
}

function finalizar() {
  if (!confirm("¿Desea finalizar el caso actual? Se borrarán los datos para un nuevo paciente.")) return;

  globalData = { am: 0, pm: 0, criteria: "", acciones: "" };

  qsa("input").forEach((input) => { input.value = ""; });
  qsa("select").forEach((select) => { select.selectedIndex = 0; });
  $("factor-dosis").value = "0.2";
  $("tipo-esquema").value = "2";
  qsa(".seleccionada").forEach((button) => {
    button.classList.remove("seleccionada");
    button.setAttribute("aria-pressed", "false");
  });

  ["alerta", "criterios", "sugerencia-esquema-inicio", "resumen-esquema-inicio", "preview-dosis", "resumen-promedios"].forEach((id) => showElement($(id), false));
  $("tabla-seguimiento").innerHTML = "";
  $("nota-clinica").innerHTML = "";
  $("nota-clinica").dataset.rawText = "";
  $("pdf").innerHTML = "";
  $("copy-status").textContent = "";
  nav(0);
}

function sanitizeNumericInput(input, maxLength = 3, maxValue = 999) {
  input.value = input.value.replace(/[^0-9]/g, "").slice(0, maxLength);
  if (input.value && Number(input.value) > maxValue) input.value = String(maxValue);
}

function handleInput(event) {
  const target = event.target;

  if (target.matches(".glicemia")) {
    sanitizeNumericInput(target, 3, 999);
  }

  if (target.id === "am-actual" || target.id === "pm-actual") {
    sanitizeNumericInput(target, 2, 99);
  }

  if (target.id === "peso-paciente" || target.id === "peso-seguimiento") {
    if (Number(target.value) > 300) target.value = "300";
  }
}
