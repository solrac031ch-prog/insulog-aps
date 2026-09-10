"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const clinicalEngine = window.InsulogClinicalEngine;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de app.js");
  if (!clinicalEngine) throw new Error("InsulogClinicalEngine debe cargarse antes de app.js");

  const { byId, all, show } = runtime.dom;
  const { go } = runtime.navigation;
  const state = runtime.state;
  const actions = runtime.actions;

  function exclusion() {
    show(byId("alerta"), true);
  }

  function mostrarInicio() {
    show(byId("criterios"), true);
    requestAnimationFrame(() => byId("hba1c-inicio")?.focus());
  }

  function toggleSeleccion(boton) {
    if (!boton) return;
    boton.classList.toggle("seleccionada");
    boton.setAttribute("aria-pressed", String(boton.classList.contains("seleccionada")));
  }

  function definirEsquemaInicio() {
    const hba1c = parseFloat(byId("hba1c-inicio").value);
    const ayunas = parseFloat(byId("glicemia-ayunas-inicio").value);
    const casual = parseFloat(byId("glicemia-casual-inicio").value);

    const inicio = all(".inicio-btn.seleccionada").map((control) => control.dataset.value);
    const catabolicos = all(".catabolico-btn.seleccionada").map((control) => control.dataset.value);
    const riesgoHipo = all(".riesgo-hipo-btn.seleccionada").map((control) => control.dataset.value);

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
      return undefined;
    }

    byId("factor-dosis").value = String(decision.factor);

    state.patch({
      criteria: decision.criteriaText,
      esquemaInicio: decision.scheme,
      textoEsquemaInicio: decision.schemeText,
      motivoEsquemaInicio: decision.reason,
      catabolicos: decision.catabolicText,
      riesgoHipo: decision.hypoRiskText
    });

    const caja = byId("sugerencia-esquema-inicio");
    if (caja) {
      caja.innerHTML = `<strong>Esquema sugerido:</strong> ${escaparHTML(decision.schemeText)}<br><br><strong>Motivo:</strong> ${escaparHTML(decision.reason)}`;
      show(caja, true);
    }

    mostrarResumenEsquemaInicio();
    go(3);
    return decision;
  }

  function mostrarResumenEsquemaInicio() {
    const data = state.snapshot();
    const caja = byId("resumen-esquema-inicio");
    if (!caja || !data.textoEsquemaInicio) return;

    caja.innerHTML = `<strong>Esquema sugerido:</strong> ${escaparHTML(data.textoEsquemaInicio)}<br><br><strong>Motivo:</strong> ${escaparHTML(data.motivoEsquemaInicio)}`;
    show(caja, true);
  }

  function calcularInicioMejorado() {
    const peso = parseFloat(byId("peso-paciente").value);
    const factor = parseFloat(byId("factor-dosis").value);
    const data = state.snapshot();

    if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
      alert("Ingrese un peso válido entre 1 y 300 kg.");
      return undefined;
    }

    if (!data.criteria) {
      alert("Complete primero los datos disponibles para orientar el esquema inicial.");
      go(2);
      return undefined;
    }

    const resultado = clinicalEngine.calculateInitialDose({
      weightKg: peso,
      factor,
      scheme: data.esquemaInicio
    });

    state.patch({
      am: resultado.am,
      pm: resultado.pm,
      dosisKg: resultado.dosePerKg
    });

    const preview = byId("preview-dosis");
    preview.innerHTML = `
      <strong>Esquema sugerido:</strong> ${escaparHTML(data.textoEsquemaInicio || "NPH monodosis nocturna")}<br><br>
      Dosis total: ${resultado.total} UI/día<br><br>
      • Mañana: ${resultado.am} UI<br>
      • Noche: ${resultado.pm} UI
    `;
    show(preview, true);

    const nota = `INICIO
Paciente con criterios de inicio de insulina bajo ${data.criteria}.
Esquema sugerido: ${data.textoEsquemaInicio || "NPH monodosis nocturna"}
Motivo: ${data.motivoEsquemaInicio || "Inicio conservador con NPH nocturna."}
Se inicia insulina NPH en dosis de:
- ${resultado.am} unidades antes del desayuno
- ${resultado.pm} unidades antes de dormir

Educación por enfermería para inicio de insulina.
Evaluación por nutricionista.
Control médico en 15 días con seguimiento de glicemia en ayunas y Antes de las once.`;

    renderNotaClinica(nota);
    go(5);
    return resultado;
  }

  function prepSeg() {
    const tbody = byId("tabla-seguimiento");
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

    go(4);
  }

  function calcularSeguimientoPro() {
    const peso = parseFloat(byId("peso-seguimiento").value);
    const tipo = byId("tipo-esquema").value;

    if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
      alert("Ingrese un peso válido entre 1 y 300 kg.");
      return undefined;
    }

    let am = parseInt(byId("am-actual").value, 10) || 0;
    let pm = parseInt(byId("pm-actual").value, 10) || 0;

    if (tipo === "am") pm = 0;
    if (tipo === "pm") am = 0;

    if (tipo === "am" && am <= 0) {
      alert("Ingrese la dosis AM actual.");
      return undefined;
    }

    if (tipo === "pm" && pm <= 0) {
      alert("Ingrese la dosis PM actual.");
      return undefined;
    }

    if (tipo === "2" && am <= 0 && pm <= 0) {
      alert("Ingrese al menos una dosis actual de insulina.");
      return undefined;
    }

    const ayunasRaw = all(".ay")
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));

    const preonceRaw = all(".pre")
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));

    if (ayunasRaw.length < 3) {
      alert("Se requieren al menos 3 glicemias en ayunas.");
      return undefined;
    }

    const resultado = clinicalEngine.calculateFollowup({
      weightKg: peso,
      regimenType: tipo,
      amDose: am,
      pmDose: pm,
      fastingValues: ayunasRaw,
      preElevenValues: preonceRaw
    });

    state.patch({
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

    const data = state.snapshot();
    const resumen = byId("resumen-promedios");
    resumen.innerHTML = `
      <strong>Promedios usados:</strong><br>
      Ayunas: ${data.promAy} mg/dL<br>
      Pre-once: ${data.promPre} mg/dL<br>
      Dosis total: ${resultado.am + resultado.pm} UI/día (${resultado.dosisKg.toFixed(2)} UI/kg/día)<br>
      Esquema final: ${resultado.schemeLabel}
    `;
    show(resumen, true);

    if (resultado.requiresHighDoseReview) {
      go(41);
      return resultado;
    }

    const nota = `SEGUIMIENTO APS
Promedios usados: Ayunas ${data.promAy} | Pre-once ${data.promPre}
Promedio global estimado: ${data.promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${data.hba1cEstimada}%
Esquema actual: AM ${data.amActual} UI | PM ${data.pmActual} UI
Nuevo Esquema sugerido: AM ${resultado.am} UI | PM ${resultado.pm} UI
Dosis total: ${resultado.am + resultado.pm} UI/día (${resultado.dosisKg.toFixed(2)} UI/kg/día)
Razonamiento:
${data.explicacion}`;

    renderNotaClinica(nota);
    go(5);
    return resultado;
  }

  function generarNotaDosisAlta() {
    const accionesSeleccionadas = all("#p41 .action-btn.seleccionada").map((action) => action.dataset.value);

    if (accionesSeleccionadas.length > 0) {
      accionesSeleccionadas.unshift("Evaluación y seguimiento por Medicina Interna APS");
    }

    state.patch({ acciones: accionesSeleccionadas.join("\n") });
    const data = state.snapshot();

    const nota = `SEGUIMIENTO APS
Promedios usados: Ayunas ${data.promAy} | Pre-once ${data.promPre}
Promedio global estimado: ${data.promedioGlobal} mg/dL
HbA1c estimada a 90 días si mantiene este patrón: ${data.hba1cEstimada}%
Esquema actual: AM ${data.amActual} UI | PM ${data.pmActual} UI
Nuevo Esquema sugerido: AM ${data.am} UI | PM ${data.pm} UI
Razonamiento: ${data.explicacion}

ALERTA DOSIS ALTA (>0.7 UI/kg):
${data.acciones || "Mantener controles y seguimiento por medicina interna APS."}`;

    renderNotaClinica(nota);
    go(5);
    return nota;
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
    const lower = linea.toLowerCase();

    if (lower.includes("alerta") || lower.includes("hipoglicemia") || lower.includes("<54") || lower.includes("<70") || lower.includes("suspensión")) {
      return "nota-roja";
    }

    if (lower.includes("hba1c estimada")) {
      const valor = parseFloat(linea.replace(",", ".").match(/[\d.]+/)?.[0]);
      if (!Number.isNaN(valor)) {
        if (valor <= 7) return "nota-verde";
        if (valor < 9) return "nota-amarilla";
        return "nota-roja";
      }
    }

    if (lower.includes("nuevo esquema") || lower.includes("dosis sugerida")) return "nota-azul";
    if (lower.includes("esquema actual") || lower.includes("promedios usados") || lower.includes("promedio global")) return "nota-gris";
    return "";
  }

  function renderNotaClinica(texto) {
    const nota = byId("nota-clinica");
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
    const nota = byId("nota-clinica");
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
    const status = byId("copy-status");
    status.textContent = mensaje;
    status.style.color = ok ? "var(--success)" : "var(--danger)";
    window.setTimeout(() => {
      if (status.textContent === mensaje) status.textContent = "";
    }, 3200);
  }

  function finalizar() {
    if (!confirm("¿Desea finalizar el caso actual? Se borrarán los datos para un nuevo paciente.")) return false;

    state.reset();

    all("input").forEach((input) => { input.value = ""; });
    all("select").forEach((select) => { select.selectedIndex = 0; });
    byId("factor-dosis").value = "0.2";
    byId("tipo-esquema").value = "2";
    all(".seleccionada").forEach((button) => {
      button.classList.remove("seleccionada");
      button.setAttribute("aria-pressed", "false");
    });

    ["alerta", "criterios", "sugerencia-esquema-inicio", "resumen-esquema-inicio", "preview-dosis", "resumen-promedios"].forEach((id) => show(byId(id), false));
    byId("tabla-seguimiento").innerHTML = "";
    byId("nota-clinica").innerHTML = "";
    byId("nota-clinica").dataset.rawText = "";
    byId("pdf").innerHTML = "";
    byId("copy-status").textContent = "";
    go(0);
    return true;
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

  actions.register("navigate", ({ element }) => go(Number(element?.dataset.page)));
  actions.register("exclude", exclusion);
  actions.register("show-initial-criteria", mostrarInicio);
  actions.register("toggle-selection", ({ element }) => toggleSeleccion(element));
  actions.register("define-initial-scheme", definirEsquemaInicio);
  actions.register("calculate-initial", calcularInicioMejorado);
  actions.register("prepare-followup", prepSeg);
  actions.register("calculate-followup", calcularSeguimientoPro);
  actions.register("toggle-high-dose-action", ({ element }) => toggleSeleccion(element));
  actions.register("generate-high-dose-note", generarNotaDosisAlta);
  actions.register("copy-note", copiarNota);
  actions.register("finish", finalizar);

  window.InsulogApp = Object.freeze({
    version: "2026.09.10-phase6",
    notes: Object.freeze({ render: renderNotaClinica }),
    inputs: Object.freeze({ handle: handleInput }),
    text: Object.freeze({ escapeHTML: escaparHTML })
  });
})();
