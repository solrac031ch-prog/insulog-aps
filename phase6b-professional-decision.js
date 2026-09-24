"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const notePresenter = window.InsulogNotePresenter;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de phase6b-professional-decision.js");
  if (!notePresenter) throw new Error("InsulogNotePresenter debe cargarse antes de phase6b-professional-decision.js");

  const { all, byId, show } = runtime.dom;
  const actions = runtime.actions;
  const state = runtime.state;
  const recordMeta = new Map();
  let phase6aAcceptBase = null;
  let phase6aReassessBase = null;
  let baseClinicalNote = "";
  let lastComposedNote = "";

  function safeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function doseText(am, pm) {
    const parts = [];
    const amValue = safeNumber(am);
    const pmValue = safeNumber(pm);
    if (amValue !== null && amValue > 0) parts.push(`AM ${Math.round(amValue)} UI`);
    if (pmValue !== null && pmValue > 0) parts.push(`PM ${Math.round(pmValue)} UI`);
    return parts.length ? parts.join(" · ") : "Sin dosis de NPH indicada";
  }

  function totalDose(am, pm) {
    return (safeNumber(am) || 0) + (safeNumber(pm) || 0);
  }

  function rawNote() {
    const node = byId("nota-clinica");
    return node?.dataset.rawText || node?.innerText || "";
  }

  function caseType(note = rawNote()) {
    if (/HIPOGLICEMIA NIVEL 3|CRISIS HIPERGLIC[EÉ]MICA|CETOSIS/i.test(note)) return "urgencia";
    if (/^INICIO\b/i.test(String(note).trim())) return "inicio";
    return "seguimiento";
  }

  function isLevel3Urgency() {
    return /HIPOGLICEMIA NIVEL 3/i.test(baseClinicalNote || rawNote());
  }

  function isHyperglycemicEmergency() {
    return /CRISIS HIPERGLIC[EÉ]MICA|CETOSIS/i.test(baseClinicalNote || rawNote());
  }

  function hasLevel3AutomaticRecommendation() {
    return isLevel3Urgency() && state.get("level3AutomaticRecommendation") === true;
  }

  function clearProfessionalDecision({ keepNote = true } = {}) {
    state.patch({
      professionalDecision: "",
      professionalAm: null,
      professionalPm: null,
      professionalReason: "",
      professionalDosePerKg: null,
      professionalUrgencyAccepted: false
    });
    if (!keepNote) lastComposedNote = "";
  }

  function syncBaseClinicalNote() {
    const current = rawNote().trim();
    if (!current || current === lastComposedNote) return;
    if (current !== baseClinicalNote) {
      baseClinicalNote = current;
      lastComposedNote = "";
      clearProfessionalDecision();
      hideModifyPanel();
    }
  }

  function renderClinicalNote(text) {
    const node = byId("nota-clinica");
    if (!node) return;
    lastComposedNote = text;
    node.dataset.rawText = text;
    node.innerHTML = notePresenter.toHTML(text);
  }

  function currentRecommendation() {
    const data = state.snapshot();
    return { am: safeNumber(data.am) || 0, pm: safeNumber(data.pm) || 0 };
  }

  function currentWeight() {
    const type = caseType(baseClinicalNote || rawNote());
    const input = type === "inicio" ? byId("peso-paciente") : byId("peso-seguimiento");
    return safeNumber(input?.value);
  }

  function decisionLabel(decision = state.get("professionalDecision")) {
    if (decision === "aceptada" && hasLevel3AutomaticRecommendation()) return "Propuesta de reducción Insulog aceptada";
    if (decision === "aceptada" && caseType(baseClinicalNote || rawNote()) === "urgencia") return "Conducta de urgencia de Insulog aceptada";
    if (decision === "aceptada") return "Aceptada sin cambios";
    if (decision === "modificada") return "Modificada por el profesional";
    if (decision === "reevaluar") return "Reevaluar antes de emitir pauta definitiva";
    return "Pendiente";
  }

  function buildDecisionNote() {
    const data = state.snapshot();
    const recommendation = currentRecommendation();
    const lines = [
      String(baseClinicalNote || rawNote()).trim(),
      "",
      "DECISIÓN PROFESIONAL",
      `Recomendación Insulog Clinical r2: ${doseText(recommendation.am, recommendation.pm)}`
    ];

    if (data.professionalDecision === "aceptada") {
      if (hasLevel3AutomaticRecommendation()) {
        lines.push(`Decisión final del profesional: Aceptada la propuesta Insulog (${doseText(data.professionalAm, data.professionalPm)}).`);
        lines.push(`Se mantiene la alerta de hipoglicemia nivel 3. Insulog propuso reducir ${Number(state.get("level3ReductionPercent") || 20)}% la NPH ${String(state.get("level3ImplicatedDose") || "").toUpperCase()} probablemente implicada; la propuesta fue revisada y aceptada por el profesional.`);
      } else if (caseType(baseClinicalNote || rawNote()) === "urgencia") {
        lines.push("Decisión final del profesional: Aceptada la conducta de urgencia de Insulog.");
        lines.push("No se emite una nueva pauta ambulatoria de NPH; se mantiene la alerta original y se requiere reevaluación clínica antes de reiniciar titulación.");
      } else {
        lines.push(`Decisión final del profesional: Aceptada sin cambios (${doseText(data.professionalAm, data.professionalPm)}).`);
      }
    } else if (data.professionalDecision === "modificada") {
      lines.push(`Decisión final del profesional: Modificada (${doseText(data.professionalAm, data.professionalPm)}).`);
      lines.push(`Motivo de modificación: ${String(data.professionalReason || "").trim()}`);
      if (caseType(baseClinicalNote || rawNote()) === "urgencia") {
        lines.push("Advertencia Insulog: Clinical r2 había activado una ruta de urgencia; el profesional decide una pauta alternativa con justificación clínica documentada.");
      }
    } else if (data.professionalDecision === "reevaluar") {
      lines.push("Decisión final del profesional: Reevaluar antes de emitir una pauta definitiva de insulina.");
    }

    return lines.join("\n");
  }

  function applyDecisionNote() {
    if (!state.get("professionalDecision")) return;
    renderClinicalNote(buildDecisionNote());
  }

  function qualityCounts() {
    const fasting = all("#tabla-seguimiento .ay").map((input) => Number.parseInt(input.value, 10)).filter(Number.isFinite);
    const preLunch = all("#tabla-seguimiento .pre").map((input) => Number.parseInt(input.value, 10)).filter(Number.isFinite);
    const regimen = byId("tipo-esquema")?.value || "pm";
    const preRequired = regimen === "am" || regimen === "2";
    return { fasting: fasting.length, preLunch: preLunch.length, preRequired, regimen };
  }

  function qualitySnapshot() {
    const quality = qualityCounts();
    return {
      fastingCount: quality.fasting,
      fastingSufficient: quality.fasting >= 3,
      preLunchCount: quality.preLunch,
      preLunchRequired: quality.preRequired,
      preLunchSufficient: !quality.preRequired || quality.preLunch >= 3,
      sufficient: quality.fasting >= 3 && (!quality.preRequired || quality.preLunch >= 3)
    };
  }


  function setReviewStatus(message, tone = true) {
    const node = byId("best-review-status");
    if (!node) return;
    node.textContent = message;
    node.style.color = tone === "warning"
      ? "var(--warning, #8a5a00)"
      : (tone === false || tone === "danger" ? "var(--danger)" : "var(--success)");
  }

  function hideModifyPanel() {
    show(byId("best-modify-panel"), false);
  }

  function renderDecisionUI() {
    const data = state.snapshot();
    const decision = data.professionalDecision || "";
    const accept = byId("best-review-accept");
    const modify = byId("best-review-modify");
    const reassess = byId("best-review-reassess");
    const urgency = caseType(baseClinicalNote || rawNote()) === "urgencia";
    const level3Automatic = hasLevel3AutomaticRecommendation();
    const hyperglycemicEmergency = isHyperglycemicEmergency();
    if (accept) {
      accept.setAttribute("aria-pressed", String(decision === "aceptada"));
      accept.textContent = urgency
        ? (level3Automatic
          ? "ACEPTAR PROPUESTA INSULOG"
          : (hyperglycemicEmergency ? "DERIVAR A URGENCIA SIN PAUTA" : "AJUSTE MÉDICO REQUERIDO"))
        : "ACEPTAR";
      const acceptDisabled = urgency && !level3Automatic && !hyperglycemicEmergency;
      accept.disabled = acceptDisabled;
      accept.setAttribute("aria-disabled", String(acceptDisabled));
    }
    if (modify) modify.setAttribute("aria-pressed", String(decision === "modificada"));
    if (reassess) reassess.setAttribute("aria-pressed", String(decision === "reevaluar"));

    const summary = byId("best-final-decision-summary");
    if (summary) {
      summary.classList.toggle("is-hidden", !decision);
      if (!decision) {
        summary.innerHTML = "";
      } else if (decision === "reevaluar") {
        summary.innerHTML = '<strong>Decisión final:</strong> reevaluar antes de emitir pauta definitiva.';
      } else if (decision === "aceptada" && level3Automatic) {
        summary.innerHTML = `<strong>Decisión final:</strong> propuesta de reducción Insulog aceptada.<br><strong>Pauta final:</strong> ${notePresenter.escapeHTML(doseText(data.professionalAm, data.professionalPm))}<br><strong>Alerta:</strong> hipoglicemia nivel 3; requiere reevaluación clínica y prevención secundaria.`;
      } else if (decision === "aceptada" && urgency) {
        summary.innerHTML = '<strong>Decisión final:</strong> conducta de urgencia de Insulog aceptada.<br><strong>Pauta final:</strong> no se emite una nueva pauta ambulatoria de NPH.';
      } else {
        const urgencyNotice = decision === "modificada" && caseType(baseClinicalNote || rawNote()) === "urgencia"
          ? '<br><strong>Alerta Clinical r2:</strong> se detectó un criterio de urgencia; la pauta continúa por decisión profesional documentada.'
          : "";
        summary.innerHTML = `<strong>Decisión final:</strong> ${notePresenter.escapeHTML(decisionLabel(decision))}<br><strong>Pauta final:</strong> ${notePresenter.escapeHTML(doseText(data.professionalAm, data.professionalPm))}` +
          (decision === "modificada" ? `<br><strong>Motivo:</strong> ${notePresenter.escapeHTML(data.professionalReason || "")}` : "") + urgencyNotice;
      }
    }

    const professionalDosePerKg = safeNumber(data.professionalDosePerKg);
    const hasProfessionalOverbasalization = decision === "modificada"
      && professionalDosePerKg !== null
      && professionalDosePerKg > 0.5;
    if (summary && hasProfessionalOverbasalization) {
      let warning = byId("best-professional-overbasal-warning");
      if (!warning) {
        warning = document.createElement("div");
        warning.id = "best-professional-overbasal-warning";
        warning.setAttribute("role", "note");
        warning.style.marginTop = "10px";
        warning.style.fontWeight = "700";
        warning.style.color = "var(--warning, #8a5a00)";
        summary.appendChild(warning);
      }
      const formatted = professionalDosePerKg.toFixed(2).replace(".", ",");
      warning.textContent = `⚠ Supera 0,5 UI/kg/día (${formatted} UI/kg/día). Excepción registrada por decisión del profesional con justificación clínica.`;
    } else {
      byId("best-professional-overbasal-warning")?.remove();
    }

    if (!decision) setReviewStatus("", true);
    if (!decision && hyperglycemicEmergency) {
      setReviewStatus("⚠ Posible crisis hiperglicémica/cetosis: puede registrar DERIVAR A URGENCIA SIN PAUTA; Insulog no emitirá una titulación ambulatoria de NPH.", "warning");
    } else if (!decision && urgency && !level3Automatic) {
      setReviewStatus("⚠ Hipoglicemia nivel 3 sin patrón seguro para ajuste automático: MODIFICAR PLAN o REEVALUAR.", "warning");
    } else if (decision === "aceptada" && level3Automatic) {
      setReviewStatus("✓ Propuesta de reducción de Insulog revisada y aceptada por el profesional.", "warning");
    } else if (decision === "aceptada" && urgency) {
      setReviewStatus("✓ Conducta de urgencia de Insulog aceptada. No se emitirá una nueva pauta automática de NPH.", "warning");
    } else if (decision === "aceptada") {
      setReviewStatus("✓ Recomendación revisada y aceptada por el profesional.", true);
    }
    if (decision === "modificada" && caseType(baseClinicalNote || rawNote()) !== "urgencia") setReviewStatus("✓ Plan modificado y documentado como decisión profesional.", true);
    if (decision === "modificada" && caseType(baseClinicalNote || rawNote()) === "urgencia") setReviewStatus("⚠ Clinical r2 detectó un criterio de urgencia. Se conserva la alerta, pero prevalece la pauta modificada por el profesional con justificación documentada.", "warning");
    if (decision === "reevaluar") setReviewStatus("Recomendación marcada para reevaluación clínica; no se emitirá documento con nueva pauta.", false);
  }

  function injectStyles() {
    if (byId("phase6b-styles")) return;
    const style = document.createElement("style");
    style.id = "phase6b-styles";
    style.textContent = `
      .best-review-actions.phase6b-actions { grid-template-columns: repeat(3,minmax(0,1fr)); }
      .best-modify-panel { margin-top: 14px; padding: 18px; border: 1px solid #bdd8f8; border-radius: 18px; background: linear-gradient(180deg, #f8fbff 0%, #f3f8ff 100%); }
      .best-modify-reason-field { width: 100%; max-width: none; margin: 16px 0 0; }
      .best-modify-reason-field label { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
      .phase6b-field-hint { flex: 0 0 auto; padding: 3px 8px; border-radius: 999px; background: #e9f3ff; color: var(--primary-strong); font-size: .72rem; font-weight: 800; letter-spacing: .02em; }
      .best-modify-panel textarea { width: 100%; min-height: 132px; box-sizing: border-box; padding: 14px 16px; resize: vertical; border: 1.5px solid var(--border-color); border-radius: 16px; background: #fff; color: var(--text-strong); font: inherit; font-size: 1rem; line-height: 1.5; box-shadow: 0 4px 14px rgba(15, 39, 71, .05); transition: border-color .15s ease, box-shadow .15s ease, background .15s ease; }
      .best-modify-panel textarea::placeholder { color: #8b98aa; opacity: 1; }
      .best-modify-panel textarea:focus { outline: none; border-color: #2f80ed; background: #fff; box-shadow: 0 0 0 4px rgba(47, 128, 237, .14), 0 6px 18px rgba(15, 39, 71, .07); }
      .phase6b-reason-helper { margin: 8px 2px 0; font-size: .82rem; line-height: 1.4; }
      .best-final-summary { margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--surface-soft); line-height: 1.5; }
      .phase6b-final-dose { margin-top: 5px; }
      @media (max-width: 620px) {
        .best-review-actions.phase6b-actions { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }


  function injectProfessionalDecisionUI() {
    const review = byId("best-professional-review");
    if (!review || byId("best-review-modify")) return;
    review.querySelector(".helper-text")?.remove();

    const actionsHost = review.querySelector(".best-review-actions");
    if (actionsHost) {
      actionsHost.classList.add("phase6b-actions");
      actionsHost.innerHTML = `
        <button id="best-review-accept" type="button" class="btn btn-success" data-action="best-review-accept" aria-pressed="false">ACEPTAR</button>
        <button id="best-review-modify" type="button" class="btn btn-main" data-action="best-review-modify" aria-pressed="false">MODIFICAR PLAN</button>
        <button id="best-review-reassess" type="button" class="btn" data-action="best-review-reassess" aria-pressed="false">REEVALUAR</button>`;
    }

    const status = byId("best-review-status");
    status?.insertAdjacentHTML("beforebegin", `
      <div id="best-modify-panel" class="best-modify-panel is-hidden">
        <p class="card-title text-center">Decisión final del profesional</p>
        <div class="form-grid form-grid-2">
          <div class="field"><label for="best-final-am">NPH final AM (UI)</label><input id="best-final-am" type="number" inputmode="numeric" min="0" max="150" step="1"></div>
          <div class="field"><label for="best-final-pm">NPH final PM (UI)</label><input id="best-final-pm" type="number" inputmode="numeric" min="0" max="150" step="1"></div>
        </div>
        <div class="field best-modify-reason-field">
          <label for="best-modify-reason">Motivo de la modificación <span class="phase6b-field-hint">Obligatorio</span></label>
          <textarea id="best-modify-reason" maxlength="500" rows="4" aria-describedby="best-modify-reason-help" placeholder="Describa brevemente el criterio clínico que justifica el cambio…"></textarea>
          <p id="best-modify-reason-help" class="helper-text phase6b-reason-helper">Ej.: patrón alimentario, riesgo de hipoglicemia, técnica de administración, comorbilidades o contexto del paciente.</p>
        </div>
        <div class="best-review-actions">
          <button type="button" class="btn btn-main" data-action="best-review-modify-save">GUARDAR DECISIÓN</button>
          <button type="button" class="btn" data-action="best-review-modify-cancel">CANCELAR</button>
        </div>
      </div>
      <div id="best-final-decision-summary" class="best-final-summary is-hidden"></div>`);
  }

  function validateModifiedPlan(am, pm, reason) {
    if (!Number.isInteger(am) || !Number.isInteger(pm) || am < 0 || pm < 0 || am > 150 || pm > 150) throw new Error("Ingrese dosis AM y PM enteras entre 0 y 150 UI.");
    if (am + pm <= 0) throw new Error("La pauta final debe contener al menos una dosis de NPH.");
    if (String(reason || "").trim().length < 5) throw new Error("Registre un motivo clínico breve para modificar la recomendación.");
    // El umbral de 0,5 UI/kg/día limita la recomendación automática de Clinical r2.
    // Una pauta manual modificada por el profesional puede superarlo si queda justificada;
    // se conserva como advertencia visible y no como bloqueo de la decisión clínica.
  }

  function finalizeAccepted() {
    syncBaseClinicalNote();
    if (!baseClinicalNote) return undefined;
    const recommendation = currentRecommendation();
    const urgencyAccepted = caseType(baseClinicalNote || rawNote()) === "urgencia";
    const level3Automatic = hasLevel3AutomaticRecommendation();
    const hyperglycemicEmergency = isHyperglycemicEmergency();

    if (urgencyAccepted && !level3Automatic && !hyperglycemicEmergency) {
      setReviewStatus("⚠ Insulog no puede proponer una dosis segura en este escenario. Use MODIFICAR PLAN o REEVALUAR.", "warning");
      return undefined;
    }

    const weight = currentWeight();
    state.patch({
      professionalDecision: "aceptada",
      professionalAm: hyperglycemicEmergency ? null : recommendation.am,
      professionalPm: hyperglycemicEmergency ? null : recommendation.pm,
      professionalReason: hyperglycemicEmergency
        ? "Derivación a urgencia sin pauta ambulatoria de NPH."
        : (level3Automatic
          ? "Propuesta de reducción de Insulog aceptada por el profesional tras hipoglicemia nivel 3."
          : ""),
      professionalDosePerKg: hyperglycemicEmergency
        ? null
        : (weight ? (recommendation.am + recommendation.pm) / weight : safeNumber(state.get("dosisKg"))),
      professionalUrgencyAccepted: urgencyAccepted
    });
    hideModifyPanel();
    applyDecisionNote();
    renderDecisionUI();
    return state.snapshot();
  }

  function finalizeReassess() {
    syncBaseClinicalNote();
    if (!baseClinicalNote) return undefined;
    state.patch({ professionalDecision: "reevaluar", professionalAm: null, professionalPm: null, professionalReason: "", professionalDosePerKg: null, professionalUrgencyAccepted: false });
    hideModifyPanel();
    applyDecisionNote();
    renderDecisionUI();
    return state.snapshot();
  }

  function openModifyPanel() {
    syncBaseClinicalNote();
    if (!baseClinicalNote) return;
    if (caseType(baseClinicalNote) === "urgencia") {
      setReviewStatus("⚠ Clinical r2 detectó un criterio de urgencia. Puede modificar la pauta por criterio profesional; la justificación quedará registrada y la alerta original se conservará.", "warning");
    }
    const recommendation = currentRecommendation();
    byId("best-final-am").value = String(recommendation.am);
    byId("best-final-pm").value = String(recommendation.pm);
    byId("best-modify-reason").value = state.get("professionalDecision") === "modificada" ? String(state.get("professionalReason") || "") : "";
    show(byId("best-modify-panel"), true);
    requestAnimationFrame(() => byId("best-modify-reason")?.focus());
  }

  function saveModifiedPlan() {
    syncBaseClinicalNote();
    const am = Number(byId("best-final-am")?.value);
    const pm = Number(byId("best-final-pm")?.value);
    const reason = String(byId("best-modify-reason")?.value || "").trim();
    try {
      validateModifiedPlan(am, pm, reason);
      const weight = currentWeight();
      state.patch({
        professionalDecision: "modificada",
        professionalAm: am,
        professionalPm: pm,
        professionalReason: reason,
        professionalDosePerKg: weight ? (am + pm) / weight : null,
        professionalUrgencyAccepted: false
      });
      hideModifyPanel();
      applyDecisionNote();
      renderDecisionUI();
      return state.snapshot();
    } catch (error) {
      setReviewStatus(error?.message || "No se pudo registrar la modificación.", false);
      return undefined;
    }
  }

  function syncPhase6aReviewBeforeHistory() {
    const decision = state.get("professionalDecision");
    if ((decision === "aceptada" || decision === "modificada") && typeof phase6aAcceptBase === "function") phase6aAcceptBase({});
    if (decision === "reevaluar" && typeof phase6aReassessBase === "function") phase6aReassessBase({});
    renderDecisionUI();
  }

  function enhanceHistoryDOM() {
    all(".best-history-entry[data-history-entry]").forEach((entry) => {
      const id = entry.dataset.historyEntry;
      const meta = recordMeta.get(id);
      if (!meta || entry.dataset.phase6bEnhanced === "1") return;
      entry.dataset.phase6bEnhanced = "1";
      const header = entry.querySelector(".best-history-meta");
      if (header && meta.professionalDecision === "modificada") header.textContent = header.textContent.replace("Aceptada", "Modificada por profesional");
      const recommended = Array.from(entry.querySelectorAll("p")).find((node) => /Dosis recomendada:/i.test(node.textContent));
      if (recommended) recommended.insertAdjacentHTML("afterend", `<p class="phase6b-final-dose"><strong>Decisión final:</strong> ${notePresenter.escapeHTML(meta.finalDoseText)}</p>`);
    });

    all(".best-history-group-title").forEach((title) => {
      const alias = title.textContent.trim();
      const trend = title.nextElementSibling;
      if (!trend?.classList.contains("best-history-trend") || trend.querySelector("[data-phase6b-final-trend]")) return;
      const records = Array.from(recordMeta.values()).filter((record) => record.alias === alias && record.professionalDecision !== "reevaluar");
      if (!records.length) return;
      const sequence = records.sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt))).map((record) => `${Math.round(record.finalTotal)} UI`).join(" → ");
      trend.insertAdjacentHTML("beforeend", `<p data-phase6b-final-trend><strong>Dosis final profesional:</strong> ${notePresenter.escapeHTML(sequence)}</p>`);
    });
  }

  function canGeneratePatientDocument() {
    syncBaseClinicalNote();
    const decision = state.get("professionalDecision");
    if (decision !== "aceptada" && decision !== "modificada") {
      alert("Registre primero la decisión final del profesional: ACEPTAR o MODIFICAR PLAN.");
      byId("best-professional-review")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    if (decision === "aceptada"
        && caseType(baseClinicalNote || rawNote()) === "urgencia"
        && !hasLevel3AutomaticRecommendation()
        && !isHyperglycemicEmergency()) {
      alert("Este escenario de urgencia no tiene una pauta automática segura. Use MODIFICAR PLAN o REEVALUAR.");
      byId("best-professional-review")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return false;
    }
    return true;
  }

  function registerActions() {
    actions.decorate("best-review-accept", (next) => {
      phase6aAcceptBase = next;
      return (context) => {
        next(context);
        return finalizeAccepted();
      };
    });

    actions.decorate("best-review-reassess", (next) => {
      phase6aReassessBase = next;
      return (context) => {
        next(context);
        return finalizeReassess();
      };
    });

    actions.register("best-review-modify", () => openModifyPanel());
    actions.register("best-review-modify-save", () => saveModifiedPlan());
    actions.register("best-review-modify-cancel", () => hideModifyPanel());

    actions.decorate("best-history-save", (next) => (context) => {
      syncBaseClinicalNote();
      if (!state.get("professionalDecision")) {
        setReviewStatus("Registre primero la decisión profesional.", false);
        return undefined;
      }
      syncPhase6aReviewBeforeHistory();
      const record = next(context);
      if (!record) return record;
      const data = state.snapshot();
      record.review = data.professionalDecision;
      record.professionalDecision = data.professionalDecision;
      record.professionalReason = data.professionalReason || "";
      record.finalDose = { am: safeNumber(data.professionalAm), pm: safeNumber(data.professionalPm) };
      record.dataQuality = qualitySnapshot();
      recordMeta.set(record.id, {
        id: record.id,
        alias: record.alias,
        savedAt: record.savedAt,
        professionalDecision: data.professionalDecision,
        professionalReason: data.professionalReason || "",
        finalDoseText: data.professionalDecision === "reevaluar" ? "Reevaluar antes de pauta definitiva" : doseText(data.professionalAm, data.professionalPm),
        finalTotal: totalDose(data.professionalAm, data.professionalPm)
      });
      return record;
    });

    actions.decorate("best-history-open", (next) => (context) => {
      const result = next(context);
      requestAnimationFrame(enhanceHistoryDOM);
      return result;
    });

    actions.decorate("open-document", (next) => (context) => canGeneratePatientDocument() ? next(context) : undefined);
    actions.decorate("show-document", (next) => (context) => canGeneratePatientDocument() ? next(context) : undefined);
  }

  function observeNoteAndHistory() {
    const note = byId("nota-clinica");
    if (note) {
      const observer = new MutationObserver(() => {
        syncBaseClinicalNote();
        renderDecisionUI();
      });
      observer.observe(note, { childList: true, subtree: true, characterData: true });
    }

    const history = byId("best-history-list");
    if (history) {
      const observer = new MutationObserver(() => requestAnimationFrame(enhanceHistoryDOM));
      observer.observe(history, { childList: true, subtree: true });
    }
  }

  function init() {
    injectStyles();
    injectProfessionalDecisionUI();
    registerActions();
    observeNoteAndHistory();
    renderDecisionUI();
  }

  window.InsulogPhase6B = Object.freeze({ version: "2026.09.24-phase6b-hyperglycemic-emergency-no-dose", qualitySnapshot, canGeneratePatientDocument });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
