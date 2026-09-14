"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const phase6b = window.InsulogPhase6B;
  const notePresenter = window.InsulogNotePresenter;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de phase6b-document-sync.js");
  if (!phase6b) throw new Error("InsulogPhase6B debe cargarse antes de phase6b-document-sync.js");
  if (!notePresenter) throw new Error("InsulogNotePresenter debe cargarse antes de phase6b-document-sync.js");

  const { byId } = runtime.dom;
  const actions = runtime.actions;
  const state = runtime.state;
  const HISTORY_LIMIT = 100;
  let sessionHistory = [];

  function safeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numberOrZero(value) {
    return safeNumber(value) || 0;
  }

  function escapeHTML(value) {
    return notePresenter.escapeHTML(String(value ?? ""));
  }

  function doseText(am, pm) {
    const parts = [];
    const amValue = safeNumber(am);
    const pmValue = safeNumber(pm);
    if (amValue !== null && amValue > 0) parts.push(`AM ${Math.round(amValue)} UI`);
    if (pmValue !== null && pmValue > 0) parts.push(`PM ${Math.round(pmValue)} UI`);
    return parts.length ? parts.join(" · ") : "Sin dosis de NPH indicada";
  }

  function totalDose(dose = {}) {
    return numberOrZero(dose.am) + numberOrZero(dose.pm);
  }

  function noteText() {
    const note = byId("nota-clinica");
    return String(note?.dataset.rawText || note?.innerText || "").trim();
  }

  function currentCaseType(note) {
    if (/HIPOGLICEMIA NIVEL 3|CRISIS HIPERGLIC[EÉ]MICA|CETOSIS/i.test(note)) return "urgencia";
    if (/^INICIO\b/i.test(note)) return "inicio";
    return "seguimiento";
  }

  function currentGlucoseValues(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map((input) => Number.parseInt(input.value, 10))
      .filter(Number.isFinite)
      .slice(0, 30);
  }

  function mean(values) {
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  }

  function minimum(values) {
    return values.length ? Math.min(...values) : null;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value || "");
    return new Intl.DateTimeFormat("es-CL", { dateStyle: "short", timeStyle: "short" }).format(date);
  }

  function decisionLabel(value) {
    if (value === "aceptada") return "Aceptada sin cambios";
    if (value === "modificada") return "Modificada por el profesional";
    if (value === "reevaluar") return "Reevaluar";
    return "No registrada";
  }

  function trend(entries, selector, formatter) {
    const values = entries.map(selector).filter((value) => value !== null && value !== undefined && Number.isFinite(Number(value)));
    return values.length ? values.map((value) => formatter(Number(value))).join(" → ") : "Sin datos suficientes";
  }

  function setHistoryStatus(message, ok = true) {
    const node = byId("best-history-status");
    if (!node) return;
    node.textContent = message;
    node.style.color = ok ? "var(--success)" : "var(--danger)";
  }

  function buildHistoryRecord() {
    const note = noteText();
    if (!note) throw new Error("No hay una nota clínica generada para guardar.");

    const alias = String(byId("best-history-alias")?.value || "").trim().slice(0, 60);
    if (!alias) throw new Error("Ingrese un alias o código local antes de guardar.");

    const data = state.snapshot();
    const decision = String(data.professionalDecision || "");
    if (!decision) throw new Error("Registre primero la decisión profesional: ACEPTAR, MODIFICAR o REEVALUAR.");

    const type = currentCaseType(note);
    const systemDose = { am: safeNumber(data.am), pm: safeNumber(data.pm) };
    const finalDose = decision === "reevaluar"
      ? { am: null, pm: null }
      : { am: safeNumber(data.professionalAm), pm: safeNumber(data.professionalPm) };
    const fastingValues = currentGlucoseValues("#tabla-seguimiento .ay");
    const preLunchValues = currentGlucoseValues("#tabla-seguimiento .pre");
    const weightInput = type === "inicio" ? byId("peso-paciente") : byId("peso-seguimiento");

    return {
      id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `hist-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      savedAt: new Date().toISOString(),
      alias,
      type,
      appVersion: window.InsulogApp?.version || "",
      professionalDecision: decision,
      professionalReason: String(data.professionalReason || "").trim(),
      weightKg: safeNumber(weightInput?.value),
      targetA1c: safeNumber(data.targetA1c),
      systemDose,
      finalDose,
      systemDosePerKg: safeNumber(data.dosisKg),
      professionalDosePerKg: safeNumber(data.professionalDosePerKg),
      fastingValues,
      preLunchValues,
      minFasting: minimum(fastingValues),
      minPreLunch: minimum(preLunchValues),
      meanFasting: mean(fastingValues),
      meanPreLunch: mean(preLunchValues),
      dataQuality: phase6b.qualitySnapshot(),
      note: note.slice(0, 9000)
    };
  }

  function renderHistory() {
    const host = byId("best-history-list");
    if (!host) return;

    const filter = String(byId("best-history-filter")?.value || "").trim().toLocaleLowerCase("es-CL");
    const entries = sessionHistory
      .filter((entry) => !filter || entry.alias.toLocaleLowerCase("es-CL").includes(filter))
      .sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));

    if (!entries.length) {
      host.innerHTML = '<div class="card compact-card text-left"><strong>No hay registros guardados.</strong><p class="helper-text">Los casos aparecen aquí sólo después de guardarlos manualmente durante la sesión actual.</p></div>';
      return;
    }

    const groups = new Map();
    entries.forEach((entry) => {
      if (!groups.has(entry.alias)) groups.set(entry.alias, []);
      groups.get(entry.alias).push(entry);
    });

    host.innerHTML = Array.from(groups.entries()).map(([alias, group]) => {
      const fastingTrend = trend(group, (entry) => entry.meanFasting, (value) => `${Math.round(value)} mg/dL`);
      const systemDoseTrend = trend(group, (entry) => totalDose(entry.systemDose), (value) => `${Math.round(value)} UI`);
      const finalDoseTrend = trend(group, (entry) => entry.professionalDecision === "reevaluar" ? null : totalDose(entry.finalDose), (value) => `${Math.round(value)} UI`);

      const cards = [...group].reverse().map((entry) => {
        const typeLabel = entry.type === "inicio" ? "Inicio" : entry.type === "urgencia" ? "Alerta / urgencia" : "Seguimiento";
        const quality = entry.dataQuality?.sufficient ? "Datos suficientes" : "Datos parciales";
        const finalText = entry.professionalDecision === "reevaluar" ? "Sin pauta definitiva" : doseText(entry.finalDose?.am, entry.finalDose?.pm);

        return `<article class="best-history-entry text-left" data-history-entry="${escapeHTML(entry.id)}">
          <p class="card-title">${escapeHTML(typeLabel)} · ${escapeHTML(formatDate(entry.savedAt))}</p>
          <p class="best-history-meta">Decisión profesional: ${escapeHTML(decisionLabel(entry.professionalDecision))} · ${escapeHTML(quality)} · ${escapeHTML(entry.appVersion || "versión no registrada")}</p>
          <p><strong>Recomendación Insulog Clinical r2:</strong> ${escapeHTML(doseText(entry.systemDose?.am, entry.systemDose?.pm))}</p>
          <p><strong>Decisión final profesional:</strong> ${escapeHTML(finalText)}</p>
          ${entry.professionalReason ? `<p><strong>Motivo:</strong> ${escapeHTML(entry.professionalReason)}</p>` : ""}
          <p><strong>HGT:</strong> menor ayunas ${escapeHTML(entry.minFasting ?? "N/A")} mg/dL · promedio ayunas ${escapeHTML(entry.meanFasting === null ? "N/A" : Math.round(entry.meanFasting))} mg/dL</p>
          <details><summary>Ver nota clínica guardada</summary><pre class="nota">${escapeHTML(entry.note)}</pre></details>
          <button type="button" class="btn btn-danger btn-narrow section-action" data-action="best-history-delete" data-history-id="${escapeHTML(entry.id)}">ELIMINAR REGISTRO</button>
        </article>`;
      }).join("");

      return `<h3 class="best-history-group-title">${escapeHTML(alias)}</h3>
        <div class="best-history-trend"><strong>Evolución</strong><p>Promedio ayunas (descriptivo): ${escapeHTML(fastingTrend)}</p><p>Recomendación Insulog: ${escapeHTML(systemDoseTrend)}</p><p>Dosis final profesional: ${escapeHTML(finalDoseTrend)}</p></div>${cards}`;
    }).join("");
  }

  function replaceFilterListener() {
    const input = byId("best-history-filter");
    if (!input || input.dataset.phase6bHistorySync === "1") return;
    const clone = input.cloneNode(true);
    clone.dataset.phase6bHistorySync = "1";
    input.replaceWith(clone);
    clone.addEventListener("input", renderHistory);
  }

  function registerHistoryActions() {
    actions.register("best-history-save", () => {
      try {
        const record = buildHistoryRecord();
        sessionHistory = [record, ...sessionHistory].slice(0, HISTORY_LIMIT);
        setHistoryStatus(`✓ Caso guardado en esta sesión: ${record.alias}`, true);
        return record;
      } catch (error) {
        setHistoryStatus(error?.message || "No se pudo guardar el caso.", false);
        return undefined;
      }
    }, { replace: true });

    actions.register("best-history-open", () => {
      replaceFilterListener();
      renderHistory();
      runtime.navigation.go(8);
      return sessionHistory.slice();
    }, { replace: true });

    actions.register("best-history-delete", ({ element }) => {
      const id = String(element?.dataset.historyId || "");
      sessionHistory = sessionHistory.filter((entry) => entry.id !== id);
      renderHistory();
    }, { replace: true });

    actions.register("best-history-clear", () => {
      if (!window.confirm("¿Borrar todos los casos guardados durante esta sesión?")) return;
      sessionHistory = [];
      renderHistory();
    }, { replace: true });
  }

  function registerDocumentSync() {
    actions.decorate("show-document", (next) => (context) => {
      const data = state.snapshot();
      if (data.professionalDecision !== "aceptada" && data.professionalDecision !== "modificada") {
        return next(context);
      }

      const original = { am: data.am, pm: data.pm, dosisKg: data.dosisKg };
      const am = numberOrZero(data.professionalAm);
      const pm = numberOrZero(data.professionalPm);
      state.patch({ am, pm, dosisKg: data.professionalDosePerKg ?? data.dosisKg });

      const result = next(context);
      requestAnimationFrame(() => state.patch(original));
      return result;
    });
  }

  function init() {
    registerDocumentSync();
    registerHistoryActions();
    replaceFilterListener();
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({
    version: "2026.09.14-phase6b-history-sync",
    history: Object.freeze({ read: () => sessionHistory.slice(), render: renderHistory })
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
