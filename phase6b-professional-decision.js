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

  function clearProfessionalDecision({ keepNote = true } = {}) {
    state.patch({
      professionalDecision: "",
      professionalAm: null,
      professionalPm: null,
      professionalReason: "",
      professionalDosePerKg: null
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
      lines.push(`Decisión final del profesional: Aceptada sin cambios (${doseText(data.professionalAm, data.professionalPm)}).`);
    } else if (data.professionalDecision === "modificada") {
      lines.push(`Decisión final del profesional: Modificada (${doseText(data.professionalAm, data.professionalPm)}).`);
      lines.push(`Motivo de modificación: ${String(data.professionalReason || "").trim()}`);
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

  function renderDataQuality() {
    const card = byId("best-data-quality");
    if (!card) return;
    const quality = qualitySnapshot();
    const fasting = byId("best-quality-fasting");
    const pre = byId("best-quality-pre");
    const summary = byId("best-quality-summary");

    if (fasting) {
      fasting.textContent = `Ayunas ${Math.min(quality.fastingCount, 3)}/3 ${quality.fastingSufficient ? "✓" : ""}`;
      fasting.className = `best-quality-chip ${quality.fastingSufficient ? "is-ok" : "is-pending"}`;
    }
    if (pre) {
      const text = quality.preLunchRequired
        ? `Pre-almuerzo ${Math.min(quality.preLunchCount, 3)}/3 ${quality.preLunchSufficient ? "✓" : ""}`
        : `Pre-almuerzo: no requerido para ajustar NPH PM`;
      pre.textContent = text;
      pre.className = `best-quality-chip ${quality.preLunchSufficient ? "is-ok" : "is-pending"}`;
    }
    if (summary) {
      summary.textContent = quality.sufficient
        ? "Datos suficientes para aplicar la regla de titulación Clinical r2."
        : "Datos parciales: complete los HGT requeridos antes de titular.";
      summary.className = `best-quality-summary ${quality.sufficient ? "is-ok" : "is-pending"}`;
    }
  }

  function setReviewStatus(message, ok = true) {
    const node = byId("best-review-status");
    if (!node) return;
    node.textContent = message;
    node.style.color = ok ? "var(--success)" : "var(--danger)";
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
    if (accept) accept.setAttribute("aria-pressed", String(decision === "aceptada"));
    if (modify) modify.setAttribute("aria-pressed", String(decision === "modificada"));
    if (reassess) reassess.setAttribute("aria-pressed", String(decision === "reevaluar"));

    const summary = byId("best-final-decision-summary");
    if (summary) {
      if (!decision) {
        summary.innerHTML = '<strong>Decisión final:</strong> pendiente de revisión profesional.';
      } else if (decision === "reevaluar") {
        summary.innerHTML = '<strong>Decisión final:</strong> reevaluar antes de emitir pauta definitiva.';
      } else {
        summary.innerHTML = `<strong>Decisión final:</strong> ${notePresenter.escapeHTML(decisionLabel(decision))}<br><strong>Pauta final:</strong> ${notePresenter.escapeHTML(doseText(data.professionalAm, data.professionalPm))}` +
          (decision === "modificada" ? `<br><strong>Motivo:</strong> ${notePresenter.escapeHTML(data.professionalReason || "")}` : "");
      }
    }

    if (!decision) setReviewStatus("Revisión profesional aún no registrada.", true);
    if (decision === "aceptada") setReviewStatus("✓ Recomendación revisada y aceptada por el profesional.", true);
    if (decision === "modificada") setReviewStatus("✓ Plan modificado y documentado como decisión profesional.", true);
    if (decision === "reevaluar") setReviewStatus("Recomendación marcada para reevaluación clínica; no se emitirá documento con nueva pauta.", false);
  }

  function injectStyles() {
    if (byId("phase6b-styles")) return;
    const style = document.createElement("style");
    style.id = "phase6b-styles";
    style.textContent = `
      .best-review-actions.phase6b-actions { grid-template-columns: repeat(3,minmax(0,1fr)); }
      .best-modify-panel { margin-top: 14px; padding: 16px; border: 1px solid #bdd8f8; border-radius: var(--radius); background: #f7fbff; }
      .best-modify-panel textarea { min-height: 88px; resize: vertical; }
      .best-final-summary { margin-top: 12px; padding: 12px 14px; border-radius: 12px; background: var(--surface-soft); line-height: 1.5; }
      .best-quality-card { max-width: 760px; }
      .best-quality-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 10px; }
      .best-quality-chip { display: block; padding: 10px 12px; border-radius: 999px; text-align: center; font-size: .88rem; font-weight: 800; }
      .best-quality-chip.is-ok, .best-quality-summary.is-ok { color: #0b6b3a; background: #edf9f2; }
      .best-quality-chip.is-pending, .best-quality-summary.is-pending { color: #8a5a00; background: #fff7e5; }
      .best-quality-summary { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; text-align: center; font-size: .86rem; font-weight: 750; }
      .phase6b-final-dose { margin-top: 5px; }
      @media (max-width: 620px) {
        .best-review-actions.phase6b-actions, .best-quality-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function injectDataQualityUI() {
    const host = byId("metas-seguridad-r2");
    if (!host || byId("best-data-quality")) return;
    host.insertAdjacentHTML("afterend", `
      <div id="best-data-quality" class="card compact-card best-quality-card text-left">
        <p class="card-title text-center">Suficiencia de datos para titular</p>
        <div class="best-quality-grid">
          <span id="best-quality-fasting" class="best-quality-chip is-pending"></span>
          <span id="best-quality-pre" class="best-quality-chip is-pending"></span>
        </div>
        <p id="best-quality-summary" class="best-quality-summary is-pending"></p>
      </div>`);
    renderDataQuality();
  }

  function injectProfessionalDecisionUI() {
    const review = byId("best-professional-review");
    if (!review || byId("best-review-modify")) return;
    const helper = review.querySelector(".helper-text");
    if (helper) helper.textContent = "Clinical r2 mantiene su recomendación original. El profesional puede aceptarla, modificar la pauta dejando un motivo, o indicar reevaluación. La decisión profesional queda separada del cálculo del algoritmo.";

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
        <div class="field"><label for="best-modify-reason">Motivo de la modificación</label><textarea id="best-modify-reason" maxlength="500" placeholder="Ej: patrón alimentario, técnica, comorbilidad, preferencia clínica o contexto del paciente"></textarea></div>
        <div class="best-review-actions">
          <button type="button" class="btn btn-main" data-action="best-review-modify-save">GUARDAR DECISIÓN</button>
          <button type="button" class="btn" data-action="best-review-modify-cancel">CANCELAR</button>
        </div>
      </div>
      <div id="best-final-decision-summary" class="best-final-summary"><strong>Decisión final:</strong> pendiente de revisión profesional.</div>`);
  }

  function validateModifiedPlan(am, pm, reason) {
    if (caseType(baseClinicalNote || rawNote()) === "urgencia") throw new Error("En una ruta de urgencia no se permite emitir una pauta manual de NPH desde Insulog.");
    if (!Number.isInteger(am) || !Number.isInteger(pm) || am < 0 || pm < 0 || am > 150 || pm > 150) throw new Error("Ingrese dosis AM y PM enteras entre 0 y 150 UI.");
    if (am + pm <= 0) throw new Error("La pauta final debe contener al menos una dosis de NPH.");
    if (String(reason || "").trim().length < 5) throw new Error("Registre un motivo clínico breve para modificar la recomendación.");
    const weight = currentWeight();
    if (weight && (am + pm) / weight > 0.5) throw new Error("La pauta final supera 0,5 UI/kg/día de insulina basal. Reevalue antes de emitirla.");
  }

  function finalizeAccepted() {
    syncBaseClinicalNote();
    if (!baseClinicalNote) return undefined;
    const recommendation = currentRecommendation();
    state.patch({
      professionalDecision: "aceptada",
      professionalAm: recommendation.am,
      professionalPm: recommendation.pm,
      professionalReason: "",
      professionalDosePerKg: safeNumber(state.get("dosisKg"))
    });
    hideModifyPanel();
    applyDecisionNote();
    renderDecisionUI();
    return state.snapshot();
  }

  function finalizeReassess() {
    syncBaseClinicalNote();
    if (!baseClinicalNote) return undefined;
    state.patch({ professionalDecision: "reevaluar", professionalAm: null, professionalPm: null, professionalReason: "", professionalDosePerKg: null });
    hideModifyPanel();
    applyDecisionNote();
    renderDecisionUI();
    return state.snapshot();
  }

  function openModifyPanel() {
    syncBaseClinicalNote();
    if (!baseClinicalNote) return;
    if (caseType(baseClinicalNote) === "urgencia") {
      setReviewStatus("La ruta de urgencia no admite modificación manual de dosis en Insulog.", false);
      return;
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
        professionalDosePerKg: weight ? (am + pm) / weight : null
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
    if (caseType(baseClinicalNote || rawNote()) === "urgencia") {
      alert("Este caso está en una ruta de urgencia. No se debe generar una nueva pauta ambulatoria de NPH desde Insulog.");
      return false;
    }
    if (decision !== "aceptada" && decision !== "modificada") {
      alert("Registre primero la decisión final del profesional: ACEPTAR o MODIFICAR PLAN.");
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
    injectDataQualityUI();
    injectProfessionalDecisionUI();
    registerActions();
    observeNoteAndHistory();
    document.addEventListener("input", (event) => {
      if (event.target.matches("#tabla-seguimiento .ay, #tabla-seguimiento .pre")) renderDataQuality();
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "tipo-esquema") renderDataQuality();
    });
    renderDataQuality();
    renderDecisionUI();
  }

  window.InsulogPhase6B = Object.freeze({ version: "2026.09.14-phase6b", qualitySnapshot, canGeneratePatientDocument });
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
