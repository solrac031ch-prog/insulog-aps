"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const clinicalEngine = window.InsulogClinicalEngine;
  const clinicalCopy = window.InsulogClinicalCopy;
  const notePresenter = window.InsulogNotePresenter;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de app.js");
  if (!clinicalEngine) throw new Error("InsulogClinicalEngine debe cargarse antes de app.js");
  if (!clinicalCopy) throw new Error("InsulogClinicalCopy debe cargarse antes de app.js");
  if (!notePresenter) throw new Error("InsulogNotePresenter debe cargarse antes de app.js");

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

  function mostrarDecisionInicio(decision) {
    const caja = byId("sugerencia-esquema-inicio");
    if (!caja) return;
    caja.classList.remove("alert-info", "alert-danger", "alert-warning");
    caja.classList.add(decision.urgent ? "alert-danger" : decision.canProceed ? "alert-info" : "alert-warning");
    caja.innerHTML = `<strong>${decision.urgent ? "DERIVACIÓN INMEDIATA" : "Resultado clínico"}:</strong> ${notePresenter.escapeHTML(decision.schemeText)}<br><br><strong>Motivo:</strong> ${notePresenter.escapeHTML(decision.reason)}`;
    show(caja, true);
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
      alert("Ingrese al menos un dato clínico para evaluar indicación de insulinización.");
      return undefined;
    }

    state.patch({
      criteria: decision.criteriaText,
      esquemaInicio: decision.scheme,
      textoEsquemaInicio: decision.schemeText,
      motivoEsquemaInicio: decision.reason,
      catabolicos: decision.catabolicText,
      riesgoHipo: decision.hypoRiskText,
      decisionInicio: decision
    });

    mostrarDecisionInicio(decision);

    if (!decision.canProceed) {
      if (decision.urgent) {
        alert("Sospecha de complicación aguda de diabetes: derivación inmediata a Unidad de Emergencia Hospitalaria. Insulog no calculará NPH.");
      }
      return decision;
    }

    mostrarResumenEsquemaInicio();
    go(3);
    return decision;
  }

  function mostrarResumenEsquemaInicio() {
    const data = state.snapshot();
    const caja = byId("resumen-esquema-inicio");
    if (!caja || !data.textoEsquemaInicio) return;

    caja.innerHTML = `<strong>Esquema sugerido:</strong> ${notePresenter.escapeHTML(data.textoEsquemaInicio)}<br><br><strong>Motivo:</strong> ${notePresenter.escapeHTML(data.motivoEsquemaInicio)}`;
    show(caja, true);
  }

  function calcularInicioMejorado() {
    const peso = parseFloat(byId("peso-paciente").value);
    const talla = parseFloat(byId("talla-paciente")?.value);
    const edad = parseFloat(byId("edad-paciente")?.value);
    const egfr = parseFloat(byId("egfr-paciente")?.value);
    const data = state.snapshot();

    if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
      alert("Ingrese un peso válido entre 1 y 300 kg.");
      return undefined;
    }

    if (!data.decisionInicio?.canProceed) {
      alert("Complete primero la evaluación de indicación de insulinización.");
      go(2);
      return undefined;
    }

    const sensitivity = clinicalEngine.determineInsulinSensitivity({
      weightKg: peso,
      heightCm: talla,
      egfr,
      ageYears: edad
    });

    if (!Number.isFinite(sensitivity.factor)) {
      alert("Ingrese edad, talla y VFGe válidas para calcular la dosis inicial según sensibilidad MINSAL.");
      return undefined;
    }

    const factorControl = byId("factor-dosis");
    if (factorControl) factorControl.value = String(sensitivity.factor);

    const resultado = clinicalEngine.calculateInitialDose({
      weightKg: peso,
      factor: sensitivity.factor,
      scheme: data.esquemaInicio
    });

    state.patch({
      am: resultado.am,
      pm: resultado.pm,
      dosisKg: resultado.dosePerKg,
      sensibilidadInsulina: sensitivity.label,
      imcInicio: sensitivity.bmi,
      factorInicio: sensitivity.factor
    });

    const preview = byId("preview-dosis");
    preview.innerHTML = `
      <strong>Esquema sugerido:</strong> ${notePresenter.escapeHTML(data.textoEsquemaInicio || "NPH basal monodosis nocturna")}<br><br>
      Sensibilidad: ${notePresenter.escapeHTML(sensitivity.label)}${Number.isFinite(sensitivity.bmi) ? ` · IMC ${sensitivity.bmi.toFixed(1)} kg/m²` : ""}<br>
      Factor MINSAL: ${sensitivity.factor.toFixed(1)} UI/kg<br><br>
      Dosis total: ${resultado.total} UI/día<br><br>
      • Mañana: ${resultado.am} UI<br>
      • Noche: ${resultado.pm} UI
    `;
    show(preview, true);

    const nota = clinicalCopy.buildInitialNote({
      criteria: data.criteria,
      schemeText: data.textoEsquemaInicio || "NPH basal monodosis nocturna",
      reason: `${data.motivoEsquemaInicio || ""} ${sensitivity.reason}`.trim(),
      sensitivity: sensitivity.label,
      factor: sensitivity.factor,
      am: resultado.am,
      pm: resultado.pm
    });

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
        <td><input class="pre glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia pre-almuerzo" autocomplete="off"></td>
      `;
      tbody.appendChild(row);
    }

    go(4);
  }

  function calcularSeguimientoPro() {
    const peso = parseFloat(byId("peso-seguimiento").value);
    const tipo = byId("tipo-esquema").value;
    const metaHba1c = parseFloat(byId("meta-hba1c-seguimiento")?.value || "7");

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

    if (tipo === "2" && (am <= 0 || pm <= 0)) {
      alert("En esquema AM + PM ingrese ambas dosis actuales.");
      return undefined;
    }

    const ayunasRaw = all(".ay")
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));

    const prealmuerzoRaw = all(".pre")
      .map((input) => parseInt(input.value, 10))
      .filter((value) => Number.isFinite(value));

    if (ayunasRaw.length < 3) {
      alert("Se requieren al menos 3 glicemias de ayuno en días diferentes.");
      return undefined;
    }

    if ((tipo === "am" || tipo === "2") && prealmuerzoRaw.length < 3) {
      alert("Para ajustar NPH AM se requieren al menos 3 glicemias pre-almuerzo en días diferentes.");
      return undefined;
    }

    const resultado = clinicalEngine.calculateFollowup({
      weightKg: peso,
      regimenType: tipo,
      amDose: am,
      pmDose: pm,
      fastingValues: ayunasRaw,
      preElevenValues: prealmuerzoRaw,
      targetHba1c: metaHba1c
    });

    state.patch({
      amActual: resultado.amActual,
      pmActual: resultado.pmActual,
      am: resultado.am,
      pm: resultado.pm,
      promAy: resultado.promAy,
      promPre: resultado.promPre,
      minAy: resultado.minAy,
      minPre: resultado.minPre,
      promedioGlobal: resultado.promedioGlobal,
      dosisKg: resultado.dosisKg,
      metaHba1c,
      acciones: "",
      explicacion: resultado.explicacion
    });

    const data = state.snapshot();
    const resumen = byId("resumen-promedios");
    resumen.innerHTML = `
      <strong>Valores para titulación MINSAL:</strong><br>
      Menor ayuno: ${data.minAy} mg/dL<br>
      Menor pre-almuerzo: ${data.minPre} mg/dL<br>
      <span class="helper-text">Promedios descriptivos: ayuno ${data.promAy} mg/dL · pre-almuerzo ${data.promPre} mg/dL</span><br>
      Dosis total: ${resultado.am + resultado.pm} UI/día (${resultado.dosisKg.toFixed(2)} UI/kg/día)<br>
      Esquema final: ${resultado.schemeLabel}
    `;
    show(resumen, true);

    if (resultado.requiresHighDoseReview) {
      go(41);
      return resultado;
    }

    const nota = clinicalCopy.buildFollowupNote({
      minAy: data.minAy,
      minPre: data.minPre,
      promAy: data.promAy,
      promPre: data.promPre,
      promedioGlobal: data.promedioGlobal,
      targetHba1c: data.metaHba1c,
      amActual: data.amActual,
      pmActual: data.pmActual,
      am: resultado.am,
      pm: resultado.pm,
      dosisKg: resultado.dosisKg,
      explicacion: data.explicacion
    });

    renderNotaClinica(nota);
    go(5);
    return resultado;
  }

  function generarNotaDosisAlta() {
    const accionesSeleccionadas = all("#p41 .action-btn.seleccionada").map((action) => action.dataset.value);

    if (accionesSeleccionadas.length > 0) {
      accionesSeleccionadas.unshift("Evaluación clínica antes de cualquier nueva escalada de NPH basal");
    }

    state.patch({ acciones: accionesSeleccionadas.join("\n") });
    const data = state.snapshot();

    const nota = clinicalCopy.buildHighDoseNote({
      minAy: data.minAy,
      minPre: data.minPre,
      promAy: data.promAy,
      promPre: data.promPre,
      promedioGlobal: data.promedioGlobal,
      targetHba1c: data.metaHba1c,
      amActual: data.amActual,
      pmActual: data.pmActual,
      am: data.am,
      pm: data.pm,
      dosisKg: data.dosisKg,
      explicacion: data.explicacion,
      acciones: data.acciones
    });

    renderNotaClinica(nota);
    go(5);
    return nota;
  }

  function renderNotaClinica(texto) {
    const nota = byId("nota-clinica");
    nota.dataset.rawText = texto;
    nota.innerHTML = notePresenter.toHTML(texto);
  }

  function average(values) {
    return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : "N/A";
  }

  function manejarNivel3Urgente() {
    const ayunas = all(".ay").map((input) => parseInt(input.value, 10)).filter(Number.isFinite);
    const pre = all(".pre").map((input) => parseInt(input.value, 10)).filter(Number.isFinite);
    const am = parseInt(byId("am-actual")?.value, 10) || 0;
    const pm = parseInt(byId("pm-actual")?.value, 10) || 0;

    const nota = `SEGUIMIENTO APS
ALERTA: HIPOGLICEMIA NIVEL 3 REFERIDA (requirió asistencia de otra persona).
DERIVACIÓN INMEDIATA A UNIDAD DE EMERGENCIA HOSPITALARIA según Vía Clínica MINSAL 2026.
No se realiza ajuste automático de NPH.
Promedios descriptivos del registro: Ayuno ${average(ayunas)} mg/dL | Pre-almuerzo ${average(pre)} mg/dL
Esquema actual: AM ${am} UI | PM ${pm} UI
Conducta: tratar la hipoglicemia según condición clínica, asegurar acompañamiento y derivar de inmediato. Reevaluar posteriormente el esquema, técnica, horarios, ingesta, función renal, fragilidad y causas precipitantes.`;

    renderNotaClinica(nota);
    go(5);
    return Object.freeze({ urgent: true, hypoglycemiaLevel: 3 });
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

    all("input").forEach((input) => {
      if (input.type === "checkbox" || input.type === "radio") input.checked = false;
      else input.value = "";
    });
    all("select").forEach((select) => { select.selectedIndex = 0; });
    if (byId("factor-dosis")) byId("factor-dosis").value = "0.2";
    if (byId("tipo-esquema")) byId("tipo-esquema").value = "2";
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

    if (target.matches(".glicemia")) sanitizeNumericInput(target, 3, 999);
    if (target.id === "am-actual" || target.id === "pm-actual") sanitizeNumericInput(target, 2, 99);
    if (target.id === "edad-paciente") sanitizeNumericInput(target, 3, 120);
    if (target.id === "talla-paciente") sanitizeNumericInput(target, 3, 230);
    if (target.id === "egfr-paciente") sanitizeNumericInput(target, 3, 200);

    if (target.id === "peso-paciente" || target.id === "peso-seguimiento") {
      if (Number(target.value) > 300) target.value = "300";
    }
  }

  function injectField(container, html) {
    if (!container) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = html.trim();
    const element = wrapper.firstElementChild;
    if (element) container.appendChild(element);
  }

  function enhanceClinicalUiR2() {
    const doseGrid = document.querySelector("#p3 .dosing-grid");
    if (doseGrid && !byId("edad-paciente")) {
      injectField(doseGrid, `<div class="field"><label for="edad-paciente">Edad (años)</label><input type="number" inputmode="numeric" id="edad-paciente" min="18" max="120" placeholder="Ej: 68"></div>`);
      injectField(doseGrid, `<div class="field"><label for="talla-paciente">Talla (cm)</label><input type="number" inputmode="numeric" id="talla-paciente" min="120" max="230" placeholder="Ej: 165"></div>`);
      injectField(doseGrid, `<div class="field"><label for="egfr-paciente">VFGe (mL/min/1,73 m²)</label><input type="number" inputmode="numeric" id="egfr-paciente" min="1" max="200" placeholder="Ej: 75"></div>`);
    }

    const factor = byId("factor-dosis");
    if (factor) {
      factor.innerHTML = `
        <option value="0.1">0,1 UI/kg · insulinosensible</option>
        <option value="0.2" selected>0,2 UI/kg · sensibilidad usual / insulinorresistente en monodosis</option>
      `;
      factor.disabled = true;
      factor.setAttribute("aria-describedby", "factor-dosis-r2-help");
      const details = document.querySelector("#p3 .guidance-details .guidance-content");
      if (details) details.innerHTML = `<p id="factor-dosis-r2-help">El factor se calcula automáticamente con edad, IMC y VFGe según el Protocolo MINSAL. En inicio basal monodosis no se usa 0,3 UI/kg.</p>`;
    }

    const followupGrid = document.querySelector("#p4 .followup-setup-card .form-grid");
    if (followupGrid && !byId("meta-hba1c-seguimiento")) {
      injectField(followupGrid, `<div class="field"><label for="meta-hba1c-seguimiento">Meta individual de HbA1c</label><select id="meta-hba1c-seguimiento"><option value="7">&lt;7% · preprandial 80–130</option><option value="8">&lt;8% · preprandial 100–150</option><option value="8.5">&lt;8,5% · preprandial 100–160</option></select></div>`);
    }

    const tableHeader = document.querySelector("#p4 thead th:nth-child(3)");
    if (tableHeader) tableHeader.innerHTML = `Pre-almuerzo <span class="th-unit">mg/dL</span>`;

    const guide = document.querySelector("#p4 .table-guide span");
    if (guide) guide.textContent = "Ingrese al menos 3 mediciones en días diferentes. La titulación usa el menor valor de 3; los promedios se muestran sólo como descripción.";

    const adjustButton = byId("ajustar-seguimiento-btn");
    if (adjustButton && !byId("hipo-nivel3-referida")) {
      const box = document.createElement("label");
      box.className = "aps-safety-box text-left";
      box.innerHTML = `<input id="hipo-nivel3-referida" type="checkbox"> <strong>Desde el último control, ¿hubo una hipoglicemia que requirió asistencia de otra persona?</strong><br><small>Si la respuesta es sí, corresponde hipoglicemia nivel 3 y derivación inmediata a urgencia, aunque no exista un HGT &lt;70 registrado.</small>`;
      adjustButton.insertAdjacentElement("beforebegin", box);
    }

    const p41 = byId("p41");
    if (p41) {
      const strong = p41.querySelector(".alert-danger strong");
      if (strong) strong.textContent = "⚠️ Dosis basal total ≥0,5 UI/kg/día: no escalar automáticamente";
      const heading = p41.querySelector("h2");
      if (heading) heading.textContent = "Revise posible sobreinsulinización antes de continuar";
    }

    const failureButton = Array.from(document.querySelectorAll(".inicio-btn")).find((button) => button.textContent.includes("Fracaso terapia oral"));
    if (failureButton) {
      failureButton.textContent = "Fracaso terapia oral documentado";
      failureButton.dataset.value = "Fracaso terapia oral documentado";
    }

    const acceptanceButton = Array.from(document.querySelectorAll(".inicio-btn")).find((button) => button.textContent.includes("Deseo del paciente"));
    if (acceptanceButton) {
      acceptanceButton.textContent = "Paciente acepta insulinoterapia";
      acceptanceButton.dataset.value = "Paciente acepta insulinoterapia";
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
    version: "2026.09.14-clinical-r2",
    notes: Object.freeze({ render: renderNotaClinica }),
    inputs: Object.freeze({ handle: handleInput }),
    text: Object.freeze({ escapeHTML: notePresenter.escapeHTML })
  });

  window.addEventListener("load", () => {
    enhanceClinicalUiR2();

    actions.decorate("calculate-followup", (next) => (context) => {
      if (byId("hipo-nivel3-referida")?.checked) return manejarNivel3Urgente();
      return next(context);
    });

    byId("hipo-con-ayuda")?.addEventListener("click", () => {
      const flag = byId("hipo-nivel3-referida");
      if (flag) flag.checked = true;
    }, { capture: true });
  });
})();
