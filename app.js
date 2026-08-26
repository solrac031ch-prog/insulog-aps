"use strict";

let globalData = {
  am: 0,
  pm: 0,
  criteria: "",
  acciones: ""
};

const $ = (id) => document.getElementById(id);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

function showElement(element, visible = true) {
  if (!element) return;
  element.classList.toggle("is-hidden", !visible);
}

function nav(pagina) {
  qsa(".page").forEach((page) => {
    const active = page.id === `p${pagina}`;
    page.classList.toggle("active", active);
    page.setAttribute("aria-hidden", String(!active));
  });

  const target = $(`p${pagina}`);
  const heading = target?.querySelector("h1, h2");

  window.scrollTo({
    top: 0,
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
  });

  if (heading) {
    heading.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => heading.focus({ preventScroll: true }));
  }
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
  const criterios = [];

  if (!Number.isNaN(hba1c) && hba1c > 9) criterios.push(`HbA1c ${hba1c}%`);
  if (!Number.isNaN(ayunas) && ayunas > 250) criterios.push(`Glicemia en ayunas ${ayunas} mg/dL`);
  if (!Number.isNaN(casual) && casual >= 300) criterios.push(`Glicemia casual/post carga/PTGO ${casual} mg/dL`);
  criterios.push(...inicio, ...catabolicos);

  if (criterios.length === 0) {
    alert("Ingrese al menos un dato o criterio de inicio.");
    return;
  }

  let esquema = "monodosis_pm";
  let texto = "NPH monodosis nocturna";
  let motivo = "Datos insuficientes para justificar doble dosis o hiperglicemia principalmente en ayunas; se sugiere inicio conservador.";

  const severidadAlta =
    (!Number.isNaN(hba1c) && hba1c >= 11) ||
    (!Number.isNaN(ayunas) && ayunas >= 250) ||
    (!Number.isNaN(casual) && casual >= 300) ||
    catabolicos.length > 0;

  if (severidadAlta && riesgoHipo.length === 0) {
    esquema = "doble_dosis";
    texto = "NPH doble dosis AM + PM";
    motivo = "HbA1c/glicemias marcadamente elevadas o síntomas catabólicos, compatible con hiperglicemia sostenida.";
  }

  if (riesgoHipo.length > 0) {
    esquema = "monodosis_pm";
    texto = "NPH monodosis nocturna con inicio conservador";
    motivo = "Alto riesgo de hipoglicemia; se sugiere dosis menor, ajuste progresivo y control precoz.";
    $("factor-dosis").value = "0.1";
  } else {
    $("factor-dosis").value = "0.2";
  }

  Object.assign(globalData, {
    criteria: criterios.join(", "),
    esquemaInicio: esquema,
    textoEsquemaInicio: texto,
    motivoEsquemaInicio: motivo,
    catabolicos: catabolicos.join(", "),
    riesgoHipo: riesgoHipo.join(", ")
  });

  const caja = $("sugerencia-esquema-inicio");
  if (caja) {
    caja.innerHTML = `<strong>Esquema sugerido:</strong> ${escaparHTML(texto)}<br><br><strong>Motivo:</strong> ${escaparHTML(motivo)}`;
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

function redondearPar(valor) {
  if (!Number.isFinite(valor)) return 0;
  return Math.max(0, Math.ceil(valor / 2) * 2);
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

  let total = redondearPar(peso * factor);
  total = Math.max(4, total);

  let am = 0;
  let pm = total;

  if (globalData.esquemaInicio === "doble_dosis") {
    am = redondearPar(total * 0.66);
    pm = Math.max(0, total - am);
  }

  globalData.am = am;
  globalData.pm = pm;
  globalData.dosisKg = total / peso;

  const preview = $("preview-dosis");
  preview.innerHTML = `
    <strong>Esquema sugerido:</strong> ${escaparHTML(globalData.textoEsquemaInicio || "NPH monodosis nocturna")}<br><br>
    Dosis total: ${total} UI/día<br><br>
    • Mañana: ${am} UI<br>
    • Noche: ${pm} UI
  `;
  showElement(preview, true);

  const nota = `INICIO
Paciente con criterios de inicio de insulina bajo ${globalData.criteria}.
Esquema sugerido: ${globalData.textoEsquemaInicio || "NPH monodosis nocturna"}
Motivo: ${globalData.motivoEsquemaInicio || "Inicio conservador con NPH nocturna."}
Se inicia insulina NPH en dosis de:
- ${am} unidades antes del desayuno
- ${pm} unidades antes de dormir

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

function analizarGlicemias(valores, nombre) {
  const datos = valores.filter((v) => Number.isFinite(v));
  const excluidos = [];
  let usados = [...datos];

  if (datos.length >= 4) {
    usados = datos.filter((valor, index) => {
      if (valor < 70) return true;

      const resto = datos.filter((_, i) => i !== index);
      const promedioResto = resto.reduce((a, b) => a + b, 0) / resto.length;

      if (valor > promedioResto + 50) {
        excluidos.push(`${nombre} ${valor} mg/dL`);
        return false;
      }
      return true;
    });
  }

  return {
    datos,
    usados,
    promedio: usados.length ? usados.reduce((a, b) => a + b, 0) / usados.length : null,
    min: datos.length ? Math.min(...datos) : null,
    hipoSevera: datos.some((v) => v < 54),
    hipo: datos.some((v) => v < 70),
    excluidos
  };
}

function calcularAjuste(analisis, nombreDosis) {
  if (!analisis || analisis.promedio === null) {
    return { ajuste: 0, texto: `${nombreDosis}: sin datos suficientes para ajuste` };
  }

  if (analisis.hipoSevera) {
    return { ajuste: -4, texto: `${nombreDosis}: reducir 4 UI por glicemia <54 mg/dL. Priorizar seguridad y evaluación clínica` };
  }

  if (analisis.hipo) {
    return { ajuste: -4, texto: `${nombreDosis}: reducir 4 UI por glicemia <70 mg/dL` };
  }

  if (analisis.promedio < 80) {
    return { ajuste: -2, texto: `${nombreDosis}: reducir 2 UI por promedio 70-79 mg/dL` };
  }

  if (analisis.promedio <= 130) {
    return { ajuste: 0, texto: `${nombreDosis}: mantener por promedio en meta 80-130 mg/dL` };
  }

  if (analisis.promedio <= 180) {
    return { ajuste: 2, texto: `${nombreDosis}: aumentar 2 UI por promedio 131-180 mg/dL` };
  }

  return { ajuste: 4, texto: `${nombreDosis}: aumentar 4 UI por promedio >180 mg/dL` };
}

function dosisSegundaDosis(pesoKg) {
  return redondearPar(Math.min(10, Math.max(4, pesoKg * 0.1)));
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

  globalData.amActual = am;
  globalData.pmActual = pm;

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

  const ayunas = analizarGlicemias(ayunasRaw, "Ayunas");
  const preonce = preonceRaw.length >= 3 ? analizarGlicemias(preonceRaw, "Pre-once") : null;
  const metaAyunasAlta = 130;
  const metaPreonceAlta = 130;
  const ajustePM = calcularAjuste(ayunas, "PM");
  const ajusteAM = preonce ? calcularAjuste(preonce, "AM") : { ajuste: 0, texto: "AM: sin datos suficientes de pre-once para ajuste" };
  const hayHipoAyunas = ayunas.hipo || ayunas.hipoSevera;
  const hayHipoPreonce = preonce ? preonce.hipo || preonce.hipoSevera : false;
  const hayHipo = hayHipoAyunas || hayHipoPreonce;

  let nAM = am;
  let nPM = pm;
  let esquemaFinal = tipo;
  const razonamiento = [];
  const advertencias = [];

  if (hayHipo) {
    if (tipo === "pm") {
      nPM = redondearPar(pm + ajustePM.ajuste);
      razonamiento.push(ajustePM.texto);
      razonamiento.push("No se agrega dosis AM por presencia de hipoglicemia; reevaluar causa antes de intensificar.");
    } else if (tipo === "am") {
      nAM = hayHipoPreonce ? redondearPar(am + ajusteAM.ajuste) : redondearPar(am - 2);
      razonamiento.push(hayHipoPreonce ? ajusteAM.texto : "AM: reducir 2 UI por hipoglicemia registrada con monodosis AM.");
      razonamiento.push("No se agrega dosis PM por presencia de hipoglicemia; reevaluar causa antes de intensificar.");
    } else {
      nPM = redondearPar(pm + ajustePM.ajuste);
      nAM = preonce ? redondearPar(am + ajusteAM.ajuste) : am;
      razonamiento.push(ajustePM.texto, ajusteAM.texto);
    }

    advertencias.push("Hipoglicemia: priorizar seguridad. Revisar técnica de administración, horarios, ingesta, ejercicio, función renal y fragilidad.");
  } else if (tipo === "pm") {
    nPM = redondearPar(pm + ajustePM.ajuste);
    razonamiento.push(ajustePM.texto);

    if (preonce && preonce.promedio > metaPreonceAlta) {
      nAM = dosisSegundaDosis(peso);
      esquemaFinal = "2";
      razonamiento.push(`AM: agregar ${nAM} UI de NPH antes del desayuno por promedio pre-once ${Math.round(preonce.promedio)} mg/dL sobre meta. Se intensifica desde monodosis PM a esquema AM + PM.`);
    } else if (preonce) {
      razonamiento.push(`AM: no se agrega dosis matinal porque promedio pre-once ${Math.round(preonce.promedio)} mg/dL está en meta.`);
    } else {
      razonamiento.push("AM: no se puede evaluar intensificación a dosis matinal por falta de al menos 3 glicemias pre-once.");
    }
  } else if (tipo === "am") {
    nAM = preonce ? redondearPar(am + ajusteAM.ajuste) : am;
    razonamiento.push(ajusteAM.texto);

    if (ayunas.promedio > metaAyunasAlta) {
      nPM = dosisSegundaDosis(peso);
      esquemaFinal = "2";
      razonamiento.push(`PM: agregar ${nPM} UI de NPH antes de dormir por promedio ayunas ${Math.round(ayunas.promedio)} mg/dL sobre meta. Se intensifica desde monodosis AM a esquema AM + PM.`);
    } else {
      razonamiento.push(`PM: no se agrega dosis nocturna porque promedio ayunas ${Math.round(ayunas.promedio)} mg/dL está en meta.`);
    }
  } else {
    nPM = redondearPar(pm + ajustePM.ajuste);
    nAM = preonce ? redondearPar(am + ajusteAM.ajuste) : am;
    razonamiento.push(ajustePM.texto, ajusteAM.texto);
  }

  nAM = Math.max(0, nAM);
  nPM = Math.max(0, nPM);

  const dosisKg = (nAM + nPM) / peso;
  const excluidos = [...ayunas.excluidos, ...(preonce ? preonce.excluidos : [])];

  if (ayunas.hipoSevera) {
    advertencias.push("Hipoglicemia severa en ayunas: considerar evaluación clínica precoz y reducción de NPH PM.");
  } else if (ayunas.hipo) {
    advertencias.push("Hipoglicemia en ayunas: reducir NPH PM y evaluar causas.");
  }

  if (preonce?.hipoSevera) {
    advertencias.push("Hipoglicemia severa pre-once: considerar evaluación clínica precoz y reducción de NPH AM.");
  } else if (preonce?.hipo) {
    advertencias.push("Hipoglicemia pre-once: reducir NPH AM y evaluar causas.");
  }

  if (nAM === 0 && (tipo === "2" || tipo === "am")) {
    advertencias.push("Dosis AM queda en 0 UI: interpretar como suspensión de dosis matinal.");
  }

  if (nPM === 0 && (tipo === "2" || tipo === "pm")) {
    advertencias.push("Dosis PM queda en 0 UI: interpretar como suspensión de dosis nocturna.");
  }

  if (dosisKg >= 1) {
    advertencias.push("Dosis ≥1 UI/kg/día: no seguir escalando automáticamente en APS sin evaluación clínica; revisar técnica, adherencia, lipohipertrofia, alimentación y considerar derivación.");
  } else if (dosisKg >= 0.7) {
    advertencias.push("Dosis ≥0.7 UI/kg/día: dosis alta; revisar técnica, adherencia, sitios de punción, alimentación y necesidad de evaluación por Medicina Interna APS.");
  }

  const promediosDisponibles = [
    ayunas.promedio,
    preonce?.promedio ?? null
  ].filter((v) => v !== null);

  const promedioGlobal = promediosDisponibles.length
    ? promediosDisponibles.reduce((a, b) => a + b, 0) / promediosDisponibles.length
    : null;

  const hba1cEstimada = promedioGlobal !== null
    ? ((promedioGlobal + 46.7) / 28.7).toFixed(1)
    : "N/A";

  Object.assign(globalData, {
    am: nAM,
    pm: nPM,
    promAy: ayunas.promedio !== null ? Math.round(ayunas.promedio) : "N/A",
    promPre: preonce?.promedio !== null && preonce ? Math.round(preonce.promedio) : "N/A",
    promedioGlobal: promedioGlobal !== null ? Math.round(promedioGlobal) : "N/A",
    hba1cEstimada,
    dosisKg,
    acciones: "",
    explicacion: [
      `Esquema final sugerido: ${esquemaFinal === "2" ? "NPH AM + PM" : esquemaFinal === "am" ? "NPH solo AM" : "NPH solo PM"}`,
      ...razonamiento,
      excluidos.length ? `Valores altos aislados excluidos del promedio: ${excluidos.join(", ")}` : "",
      advertencias.length ? `Advertencias: ${advertencias.join(" ")}` : ""
    ].filter(Boolean).join("\n")
  });

  const resumen = $("resumen-promedios");
  resumen.innerHTML = `
    <strong>Promedios usados:</strong><br>
    Ayunas: ${globalData.promAy} mg/dL<br>
    Pre-once: ${globalData.promPre} mg/dL<br>
    Dosis total: ${nAM + nPM} UI/día (${dosisKg.toFixed(2)} UI/kg/día)<br>
    Esquema final: ${esquemaFinal === "2" ? "NPH AM + PM" : esquemaFinal === "am" ? "NPH solo AM" : "NPH solo PM"}
  `;
  showElement(resumen, true);

  if (dosisKg >= 0.7) {
    nav(41);
    return;
  }

  const nota = `SEGUIMIENTO APS
Promedios usados: Ayunas ${globalData.promAy} | Pre-once ${globalData.promPre}
Promedio global estimado: ${globalData.promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${globalData.hba1cEstimada}%
Esquema actual: AM ${globalData.amActual} UI | PM ${globalData.pmActual} UI
Nuevo Esquema sugerido: AM ${nAM} UI | PM ${nPM} UI
Dosis total: ${nAM + nPM} UI/día (${dosisKg.toFixed(2)} UI/kg/día)
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

function setupButtonFeedback() {
  document.addEventListener("pointerdown", (event) => {
    const button = event.target.closest(".btn");
    if (button) button.classList.add("is-pressed");
  });

  const release = () => qsa(".btn.is-pressed").forEach((button) => button.classList.remove("is-pressed"));
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
}

function setupAriaPressed() {
  qsa(".selection-btn, .action-btn").forEach((button) => button.setAttribute("aria-pressed", "false"));
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch((error) => {
      console.warn("No se pudo registrar el service worker de Insulog:", error);
    });
  });
}

function init() {
  $("fecha-hoy").textContent = new Date().toLocaleDateString("es-CL");
  document.addEventListener("input", handleInput);
  setupButtonFeedback();
  setupAriaPressed();
  registerServiceWorker();
  nav(0);
}

document.addEventListener("DOMContentLoaded", init);
