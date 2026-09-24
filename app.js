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

  function exclusion() { show(byId("alerta"), true); }

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
    const hba1c = parseFloat(byId("hba1c-inicio")?.value);
    const ayunas = parseFloat(byId("glicemia-ayunas-inicio")?.value);
    const casual = parseFloat(byId("glicemia-casual-inicio")?.value);
    const age = parseFloat(byId("edad-inicio")?.value);
    const bmi = parseFloat(byId("imc-inicio")?.value);
    const egfr = parseFloat(byId("vfg-inicio")?.value);

    const inicio = all(".inicio-btn.seleccionada").map((control) => control.dataset.value);
    const catabolicos = all(".catabolico-btn.seleccionada").map((control) => control.dataset.value);
    const riesgoHipo = all(".riesgo-hipo-btn.seleccionada").map((control) => control.dataset.value);

    if (Number.isFinite(ayunas) && (ayunas < 20 || ayunas > 600)) {
      alert("La glicemia de ayuno debe estar entre 20 y 600 mg/dL.");
      return undefined;
    }
    if (Number.isFinite(casual) && (casual < 20 || casual > 700)) {
      alert("La glicemia casual debe estar entre 20 y 700 mg/dL.");
      return undefined;
    }

    const decision = clinicalEngine.suggestInitialScheme({
      hba1c, fasting: ayunas, casual, initiationCriteria: inicio, catabolic: catabolicos,
      hypoRisk: riesgoHipo, age, bmi, egfr
    });

    state.patch({
      edadInicio: Number.isFinite(age) ? age : null,
      imcInicio: Number.isFinite(bmi) ? bmi : null,
      vfgInicio: Number.isFinite(egfr) ? egfr : null,
      inicioCriteriosSeleccionados: [...inicio],
      catabolicosSeleccionados: [...catabolicos],
      riesgoHipoSeleccionado: [...riesgoHipo]
    });

    if (decision.emergency) {
      renderNotaClinica(`INICIO\nALERTA: POSIBLE CRISIS HIPERGLICÉMICA / CETOSIS.\n${decision.emergencyReason}\nNo utilizar este algoritmo para titulación ambulatoria.`);
      go(5);
      return decision;
    }

    const hasAutomaticInitiationCriteria = decision.criteria.length > 0;
    const professionalInitiation = !hasAutomaticInitiationCriteria;
    const criteriaForRecord = hasAutomaticInitiationCriteria
      ? decision.criteriaText
      : (inicio.length ? inicio.join(", ") : "Decisión clínica del profesional");

    const factorInput = byId("factor-dosis");
    if (factorInput) factorInput.value = String(decision.factor);
    const schemeInput = byId("esquema-inicio");
    if (schemeInput) schemeInput.value = decision.scheme;

    state.patch({
      criteria: criteriaForRecord,
      inicioPorDecisionProfesional: professionalInitiation,
      esquemaInicio: decision.scheme,
      textoEsquemaInicio: decision.schemeText,
      esquemaInicioSugerido: decision.scheme,
      textoEsquemaInicioSugerido: decision.schemeText,
      motivoEsquemaInicio: decision.reason,
      sensibilidadInsulina: decision.sensitivity?.label || "",
      catabolicos: decision.catabolicText,
      riesgoHipo: decision.hypoRiskText,
      factorInicioSugerido: decision.factor
    });

    const caja = byId("sugerencia-esquema-inicio");
    if (caja) {
      const decisionMessage = professionalInitiation
        ? '<span class="initial-recommendation-note">Inicio por decisión clínica profesional.</span>'
        : "";
      caja.innerHTML = `<strong>Insulog sugiere:</strong> ${notePresenter.escapeHTML(decision.schemeText)} · ${Number(decision.factor || 0.2).toFixed(1).replace(".", ",")} UI/kg<span class="initial-recommendation-reason">${notePresenter.escapeHTML(decision.reason)}</span>${decisionMessage}`;
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
    caja.innerHTML = `<strong>Insulog sugiere:</strong> ${notePresenter.escapeHTML(data.textoEsquemaInicioSugerido || data.textoEsquemaInicio)} · ${Number(data.factorInicioSugerido || 0.2).toFixed(1).replace(".", ",")} UI/kg<span class="initial-recommendation-reason">${notePresenter.escapeHTML(data.motivoEsquemaInicio)}</span>`;
    show(caja, true);
  }

  function calcularInicioMejorado() {
    const peso = parseFloat(byId("peso-paciente")?.value);
    const factor = parseFloat(byId("factor-dosis")?.value);
    const data = state.snapshot();
    const scheme = byId("esquema-inicio")?.value || data.esquemaInicio;
    const schemeTextByValue = {
      monodosis_pm: "NPH monodosis nocturna",
      monodosis_am: "NPH monodosis matinal",
      doble_dosis: "NPH doble dosis AM + PM"
    };
    const selectedSchemeText = schemeTextByValue[scheme] || data.textoEsquemaInicio || "NPH monodosis nocturna";

    if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
      alert("Ingrese un peso válido entre 1 y 300 kg.");
      return undefined;
    }
    const criteriaForRecord = data.criteria || "Decisión clínica del profesional";
    if (!data.criteria) {
      state.patch({
        criteria: criteriaForRecord,
        inicioPorDecisionProfesional: true
      });
    }

    const resultado = clinicalEngine.calculateInitialDose({ weightKg: peso, factor, scheme });
    if (resultado.valid === false) { alert("No fue posible calcular una dosis inicial segura con los datos ingresados. Revise peso, esquema y factor antes de continuar."); return undefined; }

    const schemeModified = Boolean(data.esquemaInicioSugerido) && data.esquemaInicioSugerido !== scheme;
    const factorModified = Number(data.factorInicioSugerido) !== Number(resultado.factorApplied);
    state.patch({
      am: resultado.am,
      pm: resultado.pm,
      dosisKg: resultado.dosePerKg,
      esquemaInicio: scheme,
      textoEsquemaInicio: selectedSchemeText,
      esquemaInicioModificadoPorProfesional: schemeModified,
      factorInicioAplicado: resultado.factorApplied,
      factorInicioModificadoPorProfesional: factorModified
    });

    const preview = byId("preview-dosis");
    const modificationText = (schemeModified || factorModified)
      ? `<br><br><strong>Decisión previa al cálculo:</strong> el profesional modificó ${[schemeModified ? "el esquema" : "", factorModified ? "el factor" : ""].filter(Boolean).join(" y ")} sugerido por Insulog.`
      : "";
    preview.innerHTML = `<strong>Esquema para el cálculo:</strong> ${notePresenter.escapeHTML(selectedSchemeText)}<br><strong>Factor aplicado:</strong> ${resultado.factorApplied.toFixed(1).replace(".", ",")} UI/kg${modificationText}<br><br>Dosis total: ${resultado.total} UI/día (${resultado.dosePerKg.toFixed(2)} UI/kg/día)<br><br>• Mañana: ${resultado.am} UI<br>• Noche: ${resultado.pm} UI`;
    show(preview, true);

    renderNotaClinica(clinicalCopy.buildInitialNote({
      criteria: criteriaForRecord,
      suggestedSchemeText: data.textoEsquemaInicioSugerido || selectedSchemeText,
      schemeText: selectedSchemeText,
      reason: data.motivoEsquemaInicio || "Inicio con NPH basal.",
      sensitivity: data.sensibilidadInsulina,
      suggestedFactor: data.factorInicioSugerido,
      appliedFactor: resultado.factorApplied,
      schemeModified,
      factorModified,
      am: resultado.am,
      pm: resultado.pm
    }));
    go(5);
    return resultado;
  }

  function prepSeg() {
    const tbody = byId("tabla-seguimiento");
    tbody.innerHTML = "";
    for (let i = 1; i <= 15; i += 1) {
      const row = document.createElement("tr");
      row.innerHTML = `<td><strong>${i}</strong></td><td><input class="ay glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia en ayunas" autocomplete="off"></td><td><input class="pre glicemia" type="text" inputmode="numeric" maxlength="3" aria-label="Día ${i}, glicemia pre-almuerzo" autocomplete="off"></td>`;
      tbody.appendChild(row);
    }
    go(4);
  }

  function calcularSeguimientoPro() {

    const peso = parseFloat(byId("peso-seguimiento")?.value);
    const tipo = byId("tipo-esquema")?.value;
    const targetA1c = parseFloat(byId("meta-hba1c-seguimiento")?.value || "7");

    if (!Number.isFinite(peso) || peso <= 0 || peso > 300) {
      alert("Ingrese un peso válido entre 1 y 300 kg.");
      return undefined;
    }

    let am = parseInt(byId("am-actual")?.value, 10) || 0;
    let pm = parseInt(byId("pm-actual")?.value, 10) || 0;
    if (tipo === "am") pm = 0;
    if (tipo === "pm") am = 0;

    if (tipo === "am" && am <= 0) { alert("Ingrese la dosis AM actual."); return undefined; }
    if (tipo === "pm" && pm <= 0) { alert("Ingrese la dosis PM actual."); return undefined; }
    if (tipo === "2" && (am <= 0 || pm <= 0)) { alert("Para un esquema AM + PM ingrese ambas dosis actuales."); return undefined; }

    const ayunasRaw = all(".ay").map((input) => parseInt(input.value, 10)).filter(Number.isFinite);
    const preLunchRaw = all(".pre").map((input) => parseInt(input.value, 10)).filter(Number.isFinite);

    if (ayunasRaw.length < 3) { alert("Se requieren al menos 3 glicemias en ayunas de días distintos."); return undefined; }
    if ((tipo === "am" || tipo === "2") && preLunchRaw.length < 3) { alert("Para ajustar NPH AM se requieren al menos 3 glicemias pre-almuerzo de días distintos."); return undefined; }

    const resultado = clinicalEngine.calculateFollowup({
      weightKg: peso, regimenType: tipo, amDose: am, pmDose: pm,
      fastingValues: ayunasRaw, preLunchValues: preLunchRaw, targetA1c
    });
    if (resultado.inputValid === false || resultado.dataSufficient === false) { alert((resultado.validationErrors || []).join("\n") || "Insulog bloqueó la titulación por datos insuficientes o inválidos."); return undefined; }

    state.patch({
      amActual: resultado.amActual, pmActual: resultado.pmActual, am: resultado.am, pm: resultado.pm,
      promAy: resultado.promAy, promPre: resultado.promPre, minAy: resultado.minAy, minPre: resultado.minPre,
      promedioGlobal: resultado.promedioGlobal, dosisKg: resultado.dosisKg, targetA1c: resultado.targetA1c,
      currentDosePerKg: resultado.currentDosePerKg,
      doseSafetyLevel: resultado.doseSafety?.level || "",
      doseSafetyWarning: resultado.doseSafety?.warning || "",
      automaticEscalationBlocked: Boolean(resultado.automaticEscalationBlocked),
      blocksAutomaticEscalation: Boolean(resultado.blocksAutomaticEscalation),
      acciones: "", explicacion: resultado.explicacion
    });

    const data = state.snapshot();
    const resumen = byId("resumen-promedios");
    resumen.innerHTML = `<strong>Datos para titulación:</strong><br>Menor ayunas: ${data.minAy} mg/dL<br>Menor pre-almuerzo: ${data.minPre} mg/dL<br>Promedio ayunas (descriptivo): ${data.promAy} mg/dL<br>Promedio pre-almuerzo (descriptivo): ${data.promPre} mg/dL<br>Meta HbA1c: &lt;${data.targetA1c}%<br>Dosis total: ${resultado.am + resultado.pm} UI/día (${resultado.dosisKg.toFixed(2)} UI/kg/día)<br>Esquema final: ${resultado.schemeLabel}`;
    show(resumen, true);

    if (resultado.blocksAutomaticEscalation || resultado.doseSafety?.level === "stop") { go(41); return resultado; }

    renderNotaClinica(clinicalCopy.buildFollowupNote({
      promAy: data.promAy, promPre: data.promPre, minAy: data.minAy, minPre: data.minPre,
      targetA1c: data.targetA1c, amActual: data.amActual, pmActual: data.pmActual,
      am: resultado.am, pm: resultado.pm, dosisKg: resultado.dosisKg, explicacion: data.explicacion
    }));
    go(5);
    return resultado;
  }

  function generarNotaDosisAlta() {
    const accionesSeleccionadas = all("#p41 .action-btn.seleccionada").map((action) => action.dataset.value);
    if (accionesSeleccionadas.length > 0) accionesSeleccionadas.unshift("Evaluación y seguimiento por Medicina Interna APS");
    state.patch({ acciones: accionesSeleccionadas.join("\n") });
    const data = state.snapshot();

    const nota = clinicalCopy.buildHighDoseNote({
      promAy: data.promAy, promPre: data.promPre, minAy: data.minAy, minPre: data.minPre,
      targetA1c: data.targetA1c, amActual: data.amActual, pmActual: data.pmActual,
      am: data.am, pm: data.pm, dosisKg: data.dosisKg, explicacion: data.explicacion, acciones: data.acciones
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

  async function copiarNota() {
    const nota = byId("nota-clinica");
    const text = nota.dataset.rawText || nota.innerText;
    if (!text.trim()) { mostrarEstadoCopia("No hay una nota para copiar.", false); return; }
    try {
      if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
      else copiarNotaFallback(text);
      mostrarEstadoCopia("✓ Nota copiada al portapapeles", true);
    } catch {
      try { copiarNotaFallback(text); mostrarEstadoCopia("✓ Nota copiada al portapapeles", true); }
      catch { mostrarEstadoCopia("No se pudo copiar automáticamente. Seleccione y copie la nota manualmente.", false); }
    }
  }

  function copiarNotaFallback(text) {
    const area = document.createElement("textarea");
    area.value = text; area.setAttribute("readonly", ""); area.style.position = "fixed"; area.style.left = "-9999px";
    document.body.appendChild(area); area.select(); const copied = document.execCommand("copy"); document.body.removeChild(area);
    if (!copied) throw new Error("copy failed");
  }

  function mostrarEstadoCopia(mensaje, ok) {
    const status = byId("copy-status");
    status.textContent = mensaje; status.style.color = ok ? "var(--success)" : "var(--danger)";
    window.setTimeout(() => { if (status.textContent === mensaje) status.textContent = ""; }, 3200);
  }

  function finalizar() {
    if (!confirm("¿Desea finalizar el caso actual? Se borrarán los datos para un nuevo paciente.")) return false;
    state.reset();
    all("input").forEach((input) => { if (input.type === "checkbox") input.checked = false; else input.value = ""; });
    all("select").forEach((select) => { select.selectedIndex = 0; });
    if (byId("factor-dosis")) byId("factor-dosis").value = "0.2";
    if (byId("esquema-inicio")) byId("esquema-inicio").value = "monodosis_pm";
    if (byId("tipo-esquema")) byId("tipo-esquema").value = "2";
    if (byId("meta-hba1c-seguimiento")) byId("meta-hba1c-seguimiento").value = "7";
    all(".seleccionada").forEach((button) => { button.classList.remove("seleccionada"); button.setAttribute("aria-pressed", "false"); });
    ["alerta", "criterios", "sugerencia-esquema-inicio", "resumen-esquema-inicio", "preview-dosis", "resumen-promedios"].forEach((id) => show(byId(id), false));
    byId("tabla-seguimiento").innerHTML = ""; byId("nota-clinica").innerHTML = ""; byId("nota-clinica").dataset.rawText = "";
    byId("pdf").innerHTML = ""; byId("copy-status").textContent = ""; go(0); return true;
  }

  function sanitizeNumericInput(input, maxLength = 3, maxValue = 999) {
    input.value = input.value.replace(/[^0-9]/g, "").slice(0, maxLength);
    if (input.value && Number(input.value) > maxValue) input.value = String(maxValue);
  }

  function handleInput(event) {
    const target = event.target;
    if (target.matches(".glicemia")) target.value = target.value.replace(/[^0-9]/g, "").slice(0, 4);
    if (target.id === "am-actual" || target.id === "pm-actual") sanitizeNumericInput(target, 3, 150);
    if (target.id === "peso-paciente" || target.id === "peso-seguimiento") { if (Number(target.value) > 300) target.value = "300"; }
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
    version: "2026.09.24-clinical-r6",
    clinicalVersion: "APS-NPH-2026.09.24-r6",
    notes: Object.freeze({ render: renderNotaClinica }),
    inputs: Object.freeze({ handle: handleInput }),
    text: Object.freeze({ escapeHTML: notePresenter.escapeHTML })
  });
})();