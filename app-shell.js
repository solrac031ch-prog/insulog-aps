"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const app = window.InsulogApp;
  const clinicalCopy = window.InsulogClinicalCopy;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de app-shell.js");
  if (!app) throw new Error("InsulogApp debe cargarse antes de app-shell.js");

  const { all, byId } = runtime.dom;
  const actions = runtime.actions;
  const BEST_HISTORY_LIMIT = 100;
  const PWA_UPDATE_PENDING_KEY = "insulog.pwa.update.pending.v1";
  let bestSessionHistory = [];
  let bestReviewStatus = "";
  let bestReviewSignature = "";

  function setupButtonFeedback() {
    document.addEventListener("pointerdown", (event) => {
      const button = event.target.closest(".btn");
      if (button) button.classList.add("is-pressed");
    });
    const release = () => all(".btn.is-pressed").forEach((button) => button.classList.remove("is-pressed"));
    document.addEventListener("pointerup", release);
    document.addEventListener("pointercancel", release);
  }

  function setupAriaPressed() {
    all(".selection-btn, .action-btn").forEach((button) => button.setAttribute("aria-pressed", "false"));
  }

  function setupActionDelegation() {
    document.addEventListener("click", (event) => {
      const element = event.target.closest("[data-action]");
      if (!element || element.disabled) return;
      const action = element.dataset.action;
      if (!action) return;
      try {
        const result = actions.invoke(action, { element, event });
        if (result && typeof result.catch === "function") result.catch((error) => {
          console.error(`Error ejecutando acción ${action}:`, error);
          window.InsulogSafetyGuard?.reportActionError(action, error);
        });
      } catch (error) {
        console.error(`Error ejecutando acción ${action}:`, error);
        window.InsulogSafetyGuard?.reportActionError(action, error);
      }
    });
  }

  function injectClinicalR2Controls() {
    const criteriaGrid = document.querySelector("#criterios .criteria-card .form-grid");
    if (criteriaGrid && !byId("edad-inicio")) {
      criteriaGrid.insertAdjacentHTML("beforeend", `
        <div class="field"><label for="edad-inicio">Edad (años)</label><input type="number" inputmode="numeric" id="edad-inicio" min="18" max="120" placeholder="Ej: 68"></div>
        <div class="field"><label for="imc-inicio">IMC (kg/m²)</label><input type="number" inputmode="decimal" id="imc-inicio" min="10" max="80" step="0.1" placeholder="Ej: 31.4"></div>
        <div class="field"><label for="vfg-inicio">VFG estimada (mL/min/1,73 m²)</label><input type="number" inputmode="numeric" id="vfg-inicio" min="1" max="150" placeholder="Ej: 72"></div>`);
    }

    const preference = document.querySelector('.inicio-btn[data-value="Deseo del paciente"]');
    if (preference) {
      preference.classList.remove("inicio-btn");
      preference.classList.add("aceptacion-btn");
      preference.dataset.value = "Paciente acepta insulinoterapia";
      preference.textContent = "Paciente acepta insulinoterapia";
      preference.title = "Registra aceptación/preferencia, pero no constituye por sí sola una indicación clínica de insulina.";
    }

    const factor = byId("factor-dosis");
    if (factor) {
      factor.innerHTML = '<option value="0.1">0,1 UI/kg · mayor riesgo / inicio conservador</option><option value="0.2">0,2 UI/kg · riesgo habitual</option><option value="0.3">0,3 UI/kg · hiperglicemia marcada / mayor requerimiento inicial</option>';
      factor.disabled = false;
      factor.removeAttribute("aria-disabled");
      factor.setAttribute("aria-describedby", "factor-dosis-ayuda-r2");
      const grid = factor.closest(".dosing-grid");
      if (grid && !byId("factor-dosis-ayuda-r2")) grid.insertAdjacentHTML("afterend", '<p id="factor-dosis-ayuda-r2" class="helper-text">Insulog sugiere esquema y factor según los datos clínicos. El profesional puede elegir monodosis o doble dosis y cualquiera de los factores definidos en la guía: 0,1, 0,2 o 0,3 UI/kg antes de calcular.</p>');
    }

    const guidance = document.querySelector("#p3 .guidance-content");
    if (guidance) guidance.innerHTML = '<ul class="compact-list"><li><strong>0,1 UI/kg:</strong> mayor riesgo de hipoglicemia o mayor sensibilidad a insulina.</li><li><strong>0,2 UI/kg:</strong> inicio estándar.</li><li><strong>0,3 UI/kg:</strong> hiperglicemia marcada o mayor requerimiento inicial, siempre sujeto al juicio clínico.</li></ul>';

    const p4 = byId("p4");
    const tracking = p4?.querySelector(".table-guide");
    if (tracking && !byId("meta-hba1c-seguimiento")) {
      tracking.insertAdjacentHTML("beforebegin", `
        <div class="card card-blue text-left compact-card" id="metas-seguridad-r2">
          <p class="card-title text-center">Meta individual y seguridad</p>
          <div class="form-grid">
            <div class="field"><label for="meta-hba1c-seguimiento">Meta individual de HbA1c</label><select id="meta-hba1c-seguimiento"><option value="7">&lt;7% · preprandial 80–130</option><option value="8">&lt;8% · preprandial 100–150</option><option value="8.5">&lt;8,5% · preprandial 100–160</option></select></div>
          </div>
        </div>`);
    }

    const preHeader = document.querySelector("#p4 thead th:nth-child(3)");
    if (preHeader) preHeader.innerHTML = 'Pre-almuerzo <span class="th-unit">mg/dL</span>';

    const p41 = byId("p41");
    const heading = p41?.querySelector("h2");
    if (heading) heading.textContent = "Revise dosis alta / posible sobreinsulinización";
    const strong = p41?.querySelector(".alert-danger strong");
    if (strong) strong.textContent = "⚠️ dosis alta de insulina basal: no escalar automáticamente si alcanza ≥0,5 UI/kg/día";
    const lead = p41?.querySelector(".lead");
    if (lead) lead.textContent = "La Vía Clínica DM2 2026 establece 0,5 UI/kg/día como dosis máxima de insulina basal. Revise técnica, adherencia, patrón glicémico y necesidad de intensificación o derivación.";
  }

  function escapeHTML(value) {
    const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value ?? "").replace(/[&<>"']/g, (character) => map[character]);
  }

  function injectBestOfStyles() {
    if (byId("best-of-insulog-styles")) return;
    const style = document.createElement("style");
    style.id = "best-of-insulog-styles";
    style.textContent = `
      .best-card { max-width: 760px; }
      .best-card summary { color: var(--text-strong); cursor: pointer; font-weight: 850; }
      .best-trace-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px 16px; margin-top: 14px; }
      .best-trace-item { padding: 12px 14px; border: 1px solid var(--border-color); border-radius: 12px; background: var(--surface-soft); }
      .best-trace-label { margin: 0 0 4px; color: var(--muted); font-size: .76rem; font-weight: 800; text-transform: uppercase; letter-spacing: .035em; }
      .best-trace-value { margin: 0; color: var(--text-strong); font-size: .92rem; line-height: 1.45; }
      .best-review-actions { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 14px; }
      .best-review-status, .best-history-status { min-height: 1.35rem; margin-top: 10px; text-align: center; font-size: .86rem; font-weight: 750; }
      .best-history-entry { margin: 12px 0; padding: 16px; border: 1px solid var(--border-color); border-radius: 14px; background: var(--surface); }
      .best-history-entry p { margin: 5px 0; }
      .best-history-meta { color: var(--muted); font-size: .82rem; }
      .best-history-trend { max-width: 760px; margin: 18px auto; padding: 16px 18px; border: 1px solid #bdd8f8; border-radius: var(--radius); background: #f5f9ff; text-align: left; }
      .best-history-trend strong { color: var(--primary-strong); }
      .best-history-controls { max-width: 760px; margin: 0 auto 14px; }
      .best-history-controls .field { max-width: 430px; margin: 0 auto; }
      .best-history-group-title { margin: 24px auto 10px; color: var(--text-strong); font-size: 1.08rem; font-weight: 850; text-align: left; max-width: 760px; }
      .best-muted { color: var(--muted); }
      @media (max-width: 620px) {
        .best-trace-grid, .best-review-actions { grid-template-columns: 1fr; }
        .best-card { padding: 17px; }
      }
    `;
    document.head.appendChild(style);
  }

  function readBestHistory() {
    return bestSessionHistory.slice();
  }

  function writeBestHistory(entries) {
    bestSessionHistory = entries.slice(0, BEST_HISTORY_LIMIT);
    return readBestHistory();
  }

  function numericValues(selector) {
    return all(selector).map((input) => Number.parseInt(input.value, 10)).filter(Number.isFinite);
  }

  function safeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function doseText(am, pm) {
    const parts = [];
    const amValue = safeNumber(am);
    const pmValue = safeNumber(pm);
    if (amValue !== null) parts.push(`AM ${Math.round(amValue)} UI`);
    if (pmValue !== null) parts.push(`PM ${Math.round(pmValue)} UI`);
    return parts.length ? parts.join(" · ") : "No registrada";
  }

  function totalDose(am, pm) {
    const first = safeNumber(am) ?? 0;
    const second = safeNumber(pm) ?? 0;
    return first + second;
  }

  function noteSignature() {
    return byId("nota-clinica")?.dataset.rawText || byId("nota-clinica")?.innerText || "";
  }

  function currentCaseType(note) {
    if (/HIPOGLICEMIA NIVEL 3|CRISIS HIPERGLICÉMICA|CETOSIS/i.test(note)) return "urgencia";
    if (/^INICIO\b/i.test(note.trim())) return "inicio";
    return "seguimiento";
  }

  function refreshReviewForNote() {
    const signature = noteSignature();
    if (signature !== bestReviewSignature) {
      bestReviewSignature = signature;
      bestReviewStatus = "";
      updateBestReviewUI();
    }
  }

  function setBestStatus(id, message, ok = true) {
    const node = byId(id);
    if (!node) return;
    node.textContent = message;
    node.style.color = ok ? "var(--success)" : "var(--danger)";
  }

  function updateBestReviewUI() {
    const accept = byId("best-review-accept");
    const reassess = byId("best-review-reassess");
    if (accept) accept.setAttribute("aria-pressed", String(bestReviewStatus === "aceptada"));
    if (reassess) reassess.setAttribute("aria-pressed", String(bestReviewStatus === "reevaluar"));
    if (!bestReviewStatus) setBestStatus("best-review-status", "Revisión profesional aún no registrada.", true);
    if (bestReviewStatus === "aceptada") setBestStatus("best-review-status", "✓ Recomendación revisada y aceptada por el profesional.", true);
    if (bestReviewStatus === "reevaluar") setBestStatus("best-review-status", "Recomendación marcada para reevaluación clínica.", false);
  }

  function currentTrace() {
    const data = runtime.state.snapshot();
    const note = noteSignature();
    const type = currentCaseType(note);
    const fasting = numericValues("#tabla-seguimiento .ay");
    const preLunch = numericValues("#tabla-seguimiento .pre");
    const regimen = byId("tipo-esquema")?.value || data.esquemaInicio || "";
    const explanation = type === "inicio"
      ? (data.motivoEsquemaInicio || data.criteria || "Inicio definido por Clinical r2.")
      : (data.explicacion || "Resultado generado por Clinical r2 con los datos registrados.");
    const dosePerKg = safeNumber(data.dosisKg);
    const safety = [];
    if (/HIPOGLICEMIA/i.test(note)) safety.push("Se activó la ruta de seguridad por hipoglicemia.");
    if (dosePerKg !== null && dosePerKg >= 0.5) safety.push("Se alcanzó o revisó el umbral basal de 0,5 UI/kg/día.");
    if (/CRISIS HIPERGLICÉMICA|CETOSIS/i.test(note)) safety.push("Se activó una alerta de posible crisis hiperglicémica/cetosis.");
    if (!safety.length) safety.push("En este resultado no se activó una puerta automática de hipoglicemia, crisis o sobrebasalización.");

    const suggestedFactor = safeNumber(data.factorInicioSugerido);
    const appliedFactor = safeNumber(data.factorInicioAplicado);
    const factorText = (value) => value === null ? "N/A" : value.toFixed(1).replace(".", ",");
    const initialChoiceChanged = Boolean(data.esquemaInicioModificadoPorProfesional || data.factorInicioModificadoPorProfesional);
    const dataUsed = type === "inicio"
      ? `Criterios: ${data.criteria || "registrados en el flujo"}. Sensibilidad: ${data.sensibilidadInsulina || "no consignada"}. Sugerencia Insulog: ${data.textoEsquemaInicioSugerido || data.esquemaInicioSugerido || "N/A"}, factor ${factorText(suggestedFactor)} UI/kg. Selección para cálculo: ${data.textoEsquemaInicio || data.esquemaInicio || "N/A"}, factor ${factorText(appliedFactor)} UI/kg${initialChoiceChanged ? " (modificada por el profesional)" : ""}.`
      : `Ayunas: ${fasting.length} registro(s); pre-almuerzo: ${preLunch.length} registro(s). Menor ayunas: ${data.minAy ?? "N/A"} mg/dL; menor pre-almuerzo: ${data.minPre ?? "N/A"} mg/dL.`;

    return {
      type,
      explanation,
      dataUsed,
      safety: safety.join(" "),
      currentDose: type === "inicio" ? "No aplica" : doseText(data.amActual, data.pmActual),
      recommendedDose: doseText(data.am, data.pm),
      target: type === "inicio" ? "Inicio de NPH" : `HbA1c <${data.targetA1c ?? 7}%`,
      regimen
    };
  }

  function renderBestTrace() {
    const body = byId("best-decision-body");
    if (!body || !noteSignature().trim()) return;
    refreshReviewForNote();
    const trace = currentTrace();
    body.innerHTML = `
      <div class="best-trace-grid">
        <div class="best-trace-item"><p class="best-trace-label">Razón clínica</p><p class="best-trace-value">${escapeHTML(trace.explanation)}</p></div>
        <div class="best-trace-item"><p class="best-trace-label">Datos utilizados</p><p class="best-trace-value">${escapeHTML(trace.dataUsed)}</p></div>
        <div class="best-trace-item"><p class="best-trace-label">Dosis actual</p><p class="best-trace-value">${escapeHTML(trace.currentDose)}</p></div>
        <div class="best-trace-item"><p class="best-trace-label">Recomendación Clinical r2</p><p class="best-trace-value">${escapeHTML(trace.recommendedDose)}</p></div>
        <div class="best-trace-item"><p class="best-trace-label">Meta / flujo</p><p class="best-trace-value">${escapeHTML(trace.target)}</p></div>
        <div class="best-trace-item"><p class="best-trace-label">Seguridad</p><p class="best-trace-value">${escapeHTML(trace.safety)}</p></div>
      </div>`;
  }

  function injectBestOfUI() {
    injectBestOfStyles();

    const evidence = document.querySelector("#p0 .evidence-content");
    if (evidence && !byId("best-history-home-entry")) {
      evidence.insertAdjacentHTML("beforeend", '<button id="best-history-home-entry" type="button" class="btn btn-narrow section-action" data-action="best-history-open">VER HISTORIAL DE LA SESIÓN</button>');
    }

    const decisionCard = document.querySelector("#p5 .decision-card");
    if (decisionCard && !byId("best-professional-review")) {
      decisionCard.insertAdjacentHTML("beforebegin", `
<div id="best-professional-review" class="card compact-card best-card text-left">
          <p class="card-title text-center">Revisión profesional</p>
          <p class="helper-text">Insulog propone una recomendación; la decisión final corresponde al profesional. Registrar esta revisión no modifica el cálculo Clinical r2 ni la nota generada.</p>
          <div class="best-review-actions">
            <button id="best-review-accept" type="button" class="btn btn-success" data-action="best-review-accept" aria-pressed="false">ACEPTAR RECOMENDACIÓN</button>
            <button id="best-review-reassess" type="button" class="btn" data-action="best-review-reassess" aria-pressed="false">MARCAR PARA REEVALUAR</button>
          </div>
          <div id="best-review-status" class="best-review-status" role="status" aria-live="polite"></div>
        </div>
        <div id="best-history-save-card" class="card compact-card best-card text-left">
          <p class="card-title text-center">Historial temporal de la sesión</p>
          <div class="field">
            <label for="best-history-alias">Alias / código local del paciente</label>
            <input id="best-history-alias" type="text" maxlength="60" autocomplete="off" placeholder="Ej: PX-014">
          </div>
          <p class="helper-text">Se conserva sólo durante esta sesión y se borra al recargar o cerrar la app. No se sincroniza con un servidor. Use un alias o código local; no ingrese RUT ni nombre completo.</p>
          <div class="best-review-actions">
            <button type="button" class="btn btn-main" data-action="best-history-save">GUARDAR CASO</button>
            <button type="button" class="btn" data-action="best-history-open">VER HISTORIAL</button>
          </div>
          <div id="best-history-status" class="best-history-status" role="status" aria-live="polite"></div>
        </div>`);
    }

    if (!byId("p8")) {
      const page = document.createElement("section");
      page.id = "p8";
      page.className = "page page-center";
      page.setAttribute("aria-hidden", "true");
      page.innerHTML = `
        <div class="page-label">Historial · sesión actual</div>
        <h2>Historial temporal de la sesión</h2>
        <p class="lead small-lead">Casos guardados temporalmente durante esta sesión. Se borran al recargar o cerrar la app y no se sincronizan con la ficha clínica ni con un servidor.</p>
        <div class="best-history-controls">
          <div class="field"><label for="best-history-filter">Filtrar por alias / código local</label><input id="best-history-filter" type="text" maxlength="60" autocomplete="off" placeholder="Ej: PX-014"></div>
        </div>
        <div id="best-history-list"></div>
        <button type="button" class="btn btn-danger btn-narrow section-action" data-action="best-history-clear">BORRAR HISTORIAL DE LA SESIÓN</button>
        <button type="button" class="btn btn-narrow secondary-nav" data-action="best-history-home">VOLVER AL INICIO</button>`;
      byId("app")?.appendChild(page);
      byId("best-history-filter")?.addEventListener("input", renderBestHistory);
    }

    const noteNode = byId("nota-clinica");
    if (noteNode && !noteNode.dataset.bestObserver) {
      const observer = new MutationObserver(() => renderBestTrace());
      observer.observe(noteNode, { childList: true, subtree: true, characterData: true });
      noteNode.dataset.bestObserver = "1";
    }

    updateBestReviewUI();
    renderBestTrace();
  }

  function buildBestHistoryRecord(alias) {
    const note = noteSignature().trim();
    if (!note) throw new Error("No hay una nota clínica generada para guardar.");
    const data = runtime.state.snapshot();
    const type = currentCaseType(note);
    const fasting = numericValues("#tabla-seguimiento .ay");
    const preLunch = numericValues("#tabla-seguimiento .pre");
    const weightNode = type === "inicio" ? byId("peso-paciente") : byId("peso-seguimiento");
    const normalizedAlias = String(alias || "").trim().slice(0, 60);
    if (!normalizedAlias) throw new Error("Ingrese un alias o código local antes de guardar.");
    if (!bestReviewStatus) throw new Error("Registre primero la revisión profesional: aceptar o reevaluar.");

    return {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      savedAt: new Date().toISOString(),
      alias: normalizedAlias,
      type,
      appVersion: app.version || "",
      review: bestReviewStatus,
      weightKg: safeNumber(weightNode?.value),
      targetA1c: safeNumber(data.targetA1c),
      regimenType: type === "inicio" ? (data.esquemaInicio || "") : (byId("tipo-esquema")?.value || ""),
      previousDose: { am: safeNumber(data.amActual), pm: safeNumber(data.pmActual) },
      recommendedDose: { am: safeNumber(data.am), pm: safeNumber(data.pm) },
      dosePerKg: safeNumber(data.dosisKg),
      fastingValues: fasting.slice(0, 30),
      preLunchValues: preLunch.slice(0, 30),
      minFasting: safeNumber(data.minAy),
      minPreLunch: safeNumber(data.minPre),
      meanFasting: safeNumber(data.promAy),
      meanPreLunch: safeNumber(data.promPre),
      criteria: String(data.criteria || "").slice(0, 1500),
      scheme: String(data.textoEsquemaInicio || "").slice(0, 500),
      explanation: String(data.explicacion || data.motivoEsquemaInicio || "").slice(0, 2500),
      note: note.slice(0, 7000)
    };
  }

  function formatBestDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function trendSequence(entries, selector, formatter = (value) => String(value)) {
    const values = entries.map(selector).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return values.length ? values.map((value) => formatter(Number(value))).join(" → ") : "Sin datos suficientes";
  }

  function renderBestHistory() {
    const host = byId("best-history-list");
    if (!host) return;
    const filter = String(byId("best-history-filter")?.value || "").trim().toLocaleLowerCase("es-CL");
    const allEntries = readBestHistory().sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
    const entries = filter ? allEntries.filter((entry) => String(entry.alias || "").toLocaleLowerCase("es-CL").includes(filter)) : allEntries;

    if (!entries.length) {
      host.innerHTML = '<div class="card compact-card text-left"><strong>No hay registros guardados.</strong><p class="helper-text">Los casos aparecen aquí sólo después de guardarlos manualmente durante la sesión actual.</p></div>';
      return;
    }

    const groups = new Map();
    entries.forEach((entry) => {
      const alias = String(entry.alias || "Sin alias");
      if (!groups.has(alias)) groups.set(alias, []);
      groups.get(alias).push(entry);
    });

    host.innerHTML = Array.from(groups.entries()).map(([alias, group]) => {
      const fastingTrend = trendSequence(group, (entry) => entry.meanFasting, (value) => `${Math.round(value)} mg/dL`);
      const doseTrend = trendSequence(group, (entry) => totalDose(entry.recommendedDose?.am, entry.recommendedDose?.pm), (value) => `${Math.round(value)} UI`);
      const cards = [...group].reverse().map((entry) => {
        const typeLabel = entry.type === "inicio" ? "Inicio" : entry.type === "urgencia" ? "Alerta / urgencia" : "Seguimiento";
        const reviewLabel = entry.review === "aceptada" ? "Aceptada" : entry.review === "reevaluar" ? "Reevaluar" : "No registrada";
        return `<article class="best-history-entry text-left" data-history-entry="${escapeHTML(entry.id)}">
          <p class="card-title">${escapeHTML(typeLabel)} · ${escapeHTML(formatBestDate(entry.savedAt))}</p>
          <p class="best-history-meta">Revisión profesional: ${escapeHTML(reviewLabel)} · ${escapeHTML(entry.appVersion || "versión no registrada")}</p>
          <p><strong>Dosis previa:</strong> ${escapeHTML(doseText(entry.previousDose?.am, entry.previousDose?.pm))}</p>
          <p><strong>Dosis recomendada:</strong> ${escapeHTML(doseText(entry.recommendedDose?.am, entry.recommendedDose?.pm))}</p>
          <p><strong>HGT:</strong> menor ayunas ${escapeHTML(entry.minFasting ?? "N/A")} mg/dL · promedio ayunas ${escapeHTML(entry.meanFasting ?? "N/A")} mg/dL</p>
          <details><summary>Ver nota clínica guardada</summary><pre class="nota">${escapeHTML(entry.note || "")}</pre></details>
          <button type="button" class="btn btn-danger btn-narrow section-action" data-action="best-history-delete" data-history-id="${escapeHTML(entry.id)}">ELIMINAR REGISTRO</button>
        </article>`;
      }).join("");
      return `<h3 class="best-history-group-title">${escapeHTML(alias)}</h3>
        <div class="best-history-trend"><strong>Evolución</strong><p>Promedio ayunas (descriptivo): ${escapeHTML(fastingTrend)}</p><p>Dosis total recomendada: ${escapeHTML(doseTrend)}</p></div>${cards}`;
    }).join("");
  }

  function registerBestOfActions() {
    actions.register("best-review-accept", () => {
      refreshReviewForNote();
      if (!noteSignature().trim()) return undefined;
      bestReviewStatus = "aceptada";
      updateBestReviewUI();
      return bestReviewStatus;
    });

    actions.register("best-review-reassess", () => {
      refreshReviewForNote();
      if (!noteSignature().trim()) return undefined;
      bestReviewStatus = "reevaluar";
      updateBestReviewUI();
      return bestReviewStatus;
    });

    actions.register("best-history-save", () => {
      try {
        refreshReviewForNote();
        const record = buildBestHistoryRecord(byId("best-history-alias")?.value);
        const entries = [record, ...readBestHistory().filter((entry) => entry.id !== record.id)].slice(0, BEST_HISTORY_LIMIT);
        writeBestHistory(entries);
        setBestStatus("best-history-status", `✓ Caso guardado en esta sesión: ${record.alias}`, true);
        return record;
      } catch (error) {
        setBestStatus("best-history-status", error?.message || "No se pudo guardar el caso.", false);
        return undefined;
      }
    });

    actions.register("best-history-open", () => {
      renderBestHistory();
      runtime.navigation.go(8);
      return readBestHistory();
    });

    actions.register("best-history-delete", ({ element }) => {
      const id = element?.dataset.historyId || "";
      if (!id) return;
      writeBestHistory(readBestHistory().filter((entry) => entry.id !== id));
      renderBestHistory();
    });

    actions.register("best-history-clear", () => {
      if (!window.confirm("¿Borrar todos los casos guardados durante esta sesión?")) return;
      writeBestHistory([]);
      renderBestHistory();
    });

    actions.register("best-history-home", () => runtime.navigation.go(0));
  }

  function reloadPendingPwaUpdateIfSafe() {
    const pendingRelease = String(localStorage.getItem(PWA_UPDATE_PENDING_KEY) || "").trim();
    if (!pendingRelease || runtime.navigation.activePageId() !== "p0") return false;
    localStorage.removeItem(PWA_UPDATE_PENDING_KEY);
    window.location.reload();
    return true;
  }

  function observeReturnHomeForPwaUpdate() {
    const home = byId("p0");
    if (!home || home.dataset.pwaUpdateObserver === "1") return;
    home.dataset.pwaUpdateObserver = "1";
    const observer = new MutationObserver(() => {
      if (reloadPendingPwaUpdateIfSafe()) observer.disconnect();
    });
    observer.observe(home, { attributes: true, attributeFilter: ["class", "aria-hidden"] });
  }

  function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) return;

    observeReturnHomeForPwaUpdate();

    navigator.serviceWorker.addEventListener("message", (event) => {
      if (event.data?.type !== "INSULOG_UPDATE_READY") return;
      localStorage.setItem(PWA_UPDATE_PENDING_KEY, String(event.data.release || "ready"));
      reloadPendingPwaUpdateIfSafe();
    });

    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./", updateViaCache: "none" });
        await registration.update();
        reloadPendingPwaUpdateIfSafe();
      } catch (error) {
        console.warn("No se pudo registrar o actualizar el service worker de Insulog:", error);
      }
    });
  }

  function init() {
    const fecha = byId("fecha-hoy");
    if (fecha) fecha.textContent = new Date().toLocaleDateString("es-CL");
    injectClinicalR2Controls();
    injectBestOfUI();
    registerBestOfActions();
    document.addEventListener("input", app.inputs.handle);
    setupActionDelegation();
    setupButtonFeedback();
    setupAriaPressed();
    registerServiceWorker();
    runtime.navigation.go(0);
  }

  window.InsulogShell = Object.freeze({ init });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
