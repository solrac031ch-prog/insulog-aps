"use strict";

(() => {
  const runtime = window.InsulogRuntime;
  const phase6b = window.InsulogPhase6B;

  if (!runtime) throw new Error("InsulogRuntime debe cargarse antes de phase6b-document-sync.js");
  if (!phase6b) throw new Error("InsulogPhase6B debe cargarse antes de phase6b-document-sync.js");

  const actions = runtime.actions;
  const state = runtime.state;
  const DRIVE_ENDPOINT_STORAGE_KEY = "insulog.drive.bridge.endpoint.v1";
  const DRIVE_ENDPOINT_PARAM = "driveEndpoint";
  const DRIVE_BRIDGE_VERSION = "2026.09.15-drive-v1";
  const EXPECTED_DRIVE_HOST = /(^|\.)script\.google\.com$/i;
  const transientRetryQueue = [];
  let lastDriveFingerprint = "";
  let lastDriveRecordId = "";

  function safeNumber(value) {
    if (value === null || value === undefined || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function numberOrZero(value) {
    return safeNumber(value) || 0;
  }

  function rawClinicalNote() {
    const node = document.getElementById("nota-clinica");
    return node?.dataset.rawText || node?.innerText || "";
  }

  function isUrgencyRoute() {
    return /HIPOGLICEMIA NIVEL 3|CRISIS HIPERGLIC[EÉ]MICA|CETOSIS/i.test(rawClinicalNote());
  }

  function currentWeightInput() {
    const inicio = document.getElementById("peso-paciente");
    const seguimiento = document.getElementById("peso-seguimiento");
    if (safeNumber(seguimiento?.value) > 0) return seguimiento;
    if (safeNumber(inicio?.value) > 0) return inicio;
    const note = String(rawClinicalNote()).trim();
    return /^INICIO\b/i.test(note) ? inicio : (seguimiento || inicio);
  }

  function professionalOverrideSnapshot() {
    const am = Number(document.getElementById("best-final-am")?.value);
    const pm = Number(document.getElementById("best-final-pm")?.value);
    const reason = String(document.getElementById("best-modify-reason")?.value || "").trim();
    const weightInput = currentWeightInput();
    const weight = safeNumber(weightInput?.value);
    const total = am + pm;
    const dosePerKg = weight && weight > 0 ? total / weight : null;

    const baseValid = Number.isInteger(am)
      && Number.isInteger(pm)
      && am >= 0
      && pm >= 0
      && am <= 150
      && pm <= 150
      && total > 0
      && reason.length >= 5
      && weight !== null
      && weight > 0;

    return { am, pm, reason, total, weight, weightInput, dosePerKg, baseValid };
  }

  function renderProfessionalOverrideWarning(dosePerKg) {
    const formatted = Number(dosePerKg).toFixed(2).replace(".", ",");
    const status = document.getElementById("best-review-status");
    if (status) {
      status.textContent = `✓ Plan modificado y documentado como decisión profesional. ⚠ La pauta final corresponde a ${formatted} UI/kg/día, sobre el umbral orientador de 0,5 UI/kg/día; se permite por criterio clínico documentado.`;
      status.style.color = "var(--warning, #8a5a00)";
    }

    const summary = document.getElementById("best-final-decision-summary");
    if (summary) {
      let warning = document.getElementById("best-professional-overbasal-warning");
      if (!warning) {
        warning = document.createElement("div");
        warning.id = "best-professional-overbasal-warning";
        warning.setAttribute("role", "note");
        warning.style.marginTop = "10px";
        warning.style.fontWeight = "700";
        warning.style.color = "var(--warning, #8a5a00)";
        summary.appendChild(warning);
      }
      warning.textContent = `⚠ Supera 0,5 UI/kg/día (${formatted} UI/kg/día). Excepción registrada por decisión del profesional con justificación clínica.`;
    }
  }

  function clearProfessionalOverrideWarning() {
    document.getElementById("best-professional-overbasal-warning")?.remove();
  }

  function registerProfessionalOverbasalizationOverride() {
    actions.decorate("best-review-modify-save", (next) => (context) => {
      const override = professionalOverrideSnapshot();

      if (!override.baseValid || override.dosePerKg === null || override.dosePerKg <= 0.5) {
        const result = next(context);
        if (result) clearProfessionalOverrideWarning();
        return result;
      }

      // Clinical r2 mantiene 0,5 UI/kg/día como umbral de seguridad para la recomendación
      // automática. Una pauta manual modificada por un profesional puede superar ese umbral
      // si existe justificación clínica documentada. Las alertas de urgencia se conservan,
      // pero no anulan una decisión profesional explícita.
      const originalWeight = override.weightInput.value;
      const validationWeight = (override.total / 0.5) + 0.01;
      let result;

      try {
        override.weightInput.value = String(validationWeight);
        result = next(context);
      } finally {
        override.weightInput.value = originalWeight;
      }

      if (!result) return result;

      state.patch({ professionalDosePerKg: override.dosePerKg });
      renderProfessionalOverrideWarning(override.dosePerKg);
      return state.snapshot();
    });
  }

  function removeTemporaryHistoryUI() {
    ["best-history-save-card", "best-history-home-entry", "p8"].forEach((id) => {
      document.getElementById(id)?.remove();
    });
  }

  function disableTemporaryHistoryActions() {
    const disabledActions = [
      "best-history-save",
      "best-history-open",
      "best-history-delete",
      "best-history-clear",
      "best-history-home"
    ];
    disabledActions.forEach((name) => {
      actions.register(name, () => undefined, { replace: true });
    });
  }

  function injectFollowupHbA1cField() {
    if (document.getElementById("hba1c-control")) return;
    const host = document.querySelector("#metas-seguridad-r2 .form-grid");
    if (!host) return;
    host.insertAdjacentHTML("beforeend", `
      <div class="field">
        <label for="hba1c-control">HbA1c actual (%) <span class="helper-text">opcional</span></label>
        <input id="hba1c-control" type="number" inputmode="decimal" min="3" max="20" step="0.1" placeholder="Ej: 7,8">
      </div>`);
  }

  function injectPatientIdentityFields() {
    const nameField = document.getElementById("nombre-paciente")?.closest(".patient-field");
    if (!nameField || document.getElementById("fecha-nacimiento-paciente")) return;

    nameField.insertAdjacentHTML("afterend", `
      <div class="field patient-field no-print" id="fecha-nacimiento-paciente-field">
        <label for="fecha-nacimiento-paciente">Fecha de nacimiento</label>
        <input type="date" id="fecha-nacimiento-paciente" autocomplete="bday">
        <p class="helper-text">Se usa junto con el nombre para vincular correctamente los controles longitudinales.</p>
      </div>
      <div id="drive-sync-status" class="alert no-print" role="status" aria-live="polite"></div>`);
  }

  function currentPatientBirthDate() {
    const value = String(document.getElementById("fecha-nacimiento-paciente")?.value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  }

  function renderDriveStatus() {
    const node = document.getElementById("drive-sync-status");
    if (!node) return;
    const configured = Boolean(configuredDriveEndpoint());
    node.className = `alert ${configured ? "alert-success" : "alert-warning"} no-print`;
    node.innerHTML = configured
      ? "<strong>✓ Drive conectado</strong><p>Este control se enviará a la base longitudinal al generar el documento.</p>"
      : "<strong>⚠ Drive no configurado</strong><p>El documento puede generarse, pero este control no se guardará en la base longitudinal.</p>";
  }

  function validDriveEndpoint(value) {
    try {
      const url = new URL(String(value || "").trim());
      return url.protocol === "https:" && EXPECTED_DRIVE_HOST.test(url.hostname) && /\/macros\/s\//.test(url.pathname) && /\/exec\/?$/.test(url.pathname);
    } catch {
      return false;
    }
  }

  function configuredDriveEndpoint() {
    const globalEndpoint = String(window.INSULOG_DRIVE_ENDPOINT || "").trim();
    if (validDriveEndpoint(globalEndpoint)) return globalEndpoint;
    const stored = String(localStorage.getItem(DRIVE_ENDPOINT_STORAGE_KEY) || "").trim();
    return validDriveEndpoint(stored) ? stored : "";
  }

  function configureDriveEndpoint(endpoint) {
    const value = String(endpoint || "").trim();
    if (!validDriveEndpoint(value)) throw new Error("URL de Apps Script no válida. Debe terminar en /exec.");
    localStorage.setItem(DRIVE_ENDPOINT_STORAGE_KEY, value);
    renderDriveStatus();
    return value;
  }

  function configureDriveEndpointFromQuery() {
    const url = new URL(window.location.href);
    const endpoint = url.searchParams.get(DRIVE_ENDPOINT_PARAM);
    if (!endpoint) return;
    if (!validDriveEndpoint(endpoint)) {
      console.warn("Insulog: se ignoró un driveEndpoint inválido.");
      return;
    }
    configureDriveEndpoint(endpoint);
    url.searchParams.delete(DRIVE_ENDPOINT_PARAM);
    window.history.replaceState({}, document.title, url.toString());
  }

  function numericInputValues(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map((input) => Number.parseInt(input.value, 10))
      .filter(Number.isFinite);
  }

  function minimum(values) {
    return values.length ? Math.min(...values) : null;
  }

  function totalDose(am, pm) {
    return numberOrZero(am) + numberOrZero(pm);
  }

  function doseLabel(am, pm) {
    const parts = [];
    const amValue = numberOrZero(am);
    const pmValue = numberOrZero(pm);
    if (amValue > 0) parts.push(`AM ${Math.round(amValue)} UI`);
    if (pmValue > 0) parts.push(`PM ${Math.round(pmValue)} UI`);
    return parts.length ? parts.join(" · ") : "0 UI";
  }

  function controlKind(tipo, data) {
    if (tipo === "inicio") return "Inicio";
    const current = totalDose(data.amActual, data.pmActual);
    const final = totalDose(data.professionalAm, data.professionalPm);
    return current !== final ? "Ajuste" : "Seguimiento";
  }

  function makeRecordId() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    return `insulog-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function stableRecordId(fingerprint) {
    if (fingerprint === lastDriveFingerprint && lastDriveRecordId) return lastDriveRecordId;
    lastDriveFingerprint = fingerprint;
    lastDriveRecordId = makeRecordId();
    return lastDriveRecordId;
  }

  function buildDriveRecord(tipo, data) {
    const patientName = String(document.getElementById("nombre-paciente")?.value || "").trim();
    const patientBirthDate = currentPatientBirthDate();
    if (!patientName) return null;

    const fastingValues = numericInputValues("#tabla-seguimiento .ay");
    const preLunchValues = numericInputValues("#tabla-seguimiento .pre");
    const minFasting = minimum(fastingValues);
    const minPreLunch = minimum(preLunchValues);
    const observedMinimums = [minFasting, minPreLunch].filter((value) => value !== null);
    const lowestGlucose = observedMinimums.length ? Math.min(...observedMinimums) : null;
    const weight = safeNumber(currentWeightInput()?.value);
    const hba1c = tipo === "inicio"
      ? safeNumber(document.getElementById("hba1c-inicio")?.value)
      : safeNumber(document.getElementById("hba1c-control")?.value);
    const egfr = tipo === "inicio" ? safeNumber(document.getElementById("vfg-inicio")?.value) : null;
    const currentAm = tipo === "inicio" ? 0 : numberOrZero(data.amActual);
    const currentPm = tipo === "inicio" ? 0 : numberOrZero(data.pmActual);
    const recommendedAm = numberOrZero(data.am);
    const recommendedPm = numberOrZero(data.pm);
    const finalAm = numberOrZero(data.professionalAm);
    const finalPm = numberOrZero(data.professionalPm);
    const decision = data.professionalDecision === "modificada" ? "Modificada" : "Aceptada";
    const note = rawClinicalNote();
    const fingerprint = [patientName, patientBirthDate, tipo, note, decision, finalAm, finalPm, hba1c ?? ""].join("|");

    return {
      bridgeVersion: DRIVE_BRIDGE_VERSION,
      recordId: stableRecordId(fingerprint),
      sourceOrigin: window.location.origin,
      timestamp: new Date().toISOString(),
      patientName,
      patientBirthDate,
      documentType: tipo,
      controlKind: controlKind(tipo, data),
      weightKg: weight,
      hba1c,
      egfr,
      currentAm,
      currentPm,
      currentTotal: totalDose(currentAm, currentPm),
      fastingAverage: safeNumber(data.promAy),
      preLunchAverage: safeNumber(data.promPre),
      fastingValues,
      preLunchValues,
      hypoglycemia70: lowestGlucose !== null && lowestGlucose < 70,
      hypoglycemia54: lowestGlucose !== null && lowestGlucose < 54,
      lowestGlucose,
      recommendedAm,
      recommendedPm,
      recommendedTotal: totalDose(recommendedAm, recommendedPm),
      recommendationText: doseLabel(recommendedAm, recommendedPm),
      finalAm,
      finalPm,
      finalTotal: totalDose(finalAm, finalPm),
      professionalDecision: decision,
      professionalReason: String(data.professionalReason || "").trim(),
      professionalDosePerKg: safeNumber(data.professionalDosePerKg),
      urgencyRoute: isUrgencyRoute(),
      clinicalEngineVersion: window.InsulogClinicalEngine?.version || "",
      documentModuleVersion: window.InsulogDocuments?.version || "",
      appRuntimeVersion: runtime.version || ""
    };
  }

  async function postDriveRecord(record) {
    const endpoint = configuredDriveEndpoint();
    if (!endpoint || !record) return { configured: Boolean(endpoint), sent: false };

    await fetch(endpoint, {
      method: "POST",
      mode: "no-cors",
      cache: "no-store",
      keepalive: true,
      headers: { "Content-Type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(record)
    });

    return { configured: true, sent: true };
  }

  async function sendDriveRecord(record) {
    if (!record) return;
    try {
      const result = await postDriveRecord(record);
      if (!result.configured) {
        console.info("Insulog: seguimiento Drive aún no configurado; no se almacenó información identificatoria localmente.");
      }
    } catch (error) {
      transientRetryQueue.push(record);
      console.error("Insulog: no se pudo enviar el control a Drive; se reintentará mientras esta pestaña siga abierta.", error);
    }
  }

  async function flushTransientRetryQueue() {
    if (!configuredDriveEndpoint() || !transientRetryQueue.length) return;
    const pending = transientRetryQueue.splice(0, transientRetryQueue.length);
    for (const record of pending) {
      try {
        await postDriveRecord(record);
      } catch (error) {
        transientRetryQueue.push(record);
        console.error("Insulog: reintento de Drive fallido.", error);
        break;
      }
    }
  }

  function registerDocumentSync() {
    actions.decorate("show-document", (next) => (context) => {
      const data = state.snapshot();
      if (data.professionalDecision !== "aceptada" && data.professionalDecision !== "modificada") {
        return next(context);
      }

      if (configuredDriveEndpoint() && !currentPatientBirthDate()) {
        alert("Ingrese la fecha de nacimiento antes de generar el documento. Se utiliza junto con el nombre para identificar correctamente al paciente en el seguimiento longitudinal.");
        document.getElementById("fecha-nacimiento-paciente")?.focus();
        return undefined;
      }

      const original = { am: data.am, pm: data.pm, dosisKg: data.dosisKg };
      const am = numberOrZero(data.professionalAm);
      const pm = numberOrZero(data.professionalPm);
      const tipo = context?.element?.dataset.documentType || state.get("tipoDocumento") || "seguimiento";
      const driveRecord = buildDriveRecord(tipo, data);

      state.patch({ am, pm, dosisKg: data.professionalDosePerKg ?? data.dosisKg });
      const result = next(context);
      requestAnimationFrame(() => state.patch(original));

      if (result && driveRecord) void sendDriveRecord(driveRecord);
      return result;
    });
  }

  function init() {
    configureDriveEndpointFromQuery();
    injectFollowupHbA1cField();
    injectPatientIdentityFields();
    renderDriveStatus();
    registerProfessionalOverbasalizationOverride();
    registerDocumentSync();
    disableTemporaryHistoryActions();
    removeTemporaryHistoryUI();
    requestAnimationFrame(removeTemporaryHistoryUI);
    window.addEventListener("online", () => void flushTransientRetryQueue());
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({
    version: "2026.09.21-phase6b-document-sync-drive-followup-dob-status",
    configureDriveEndpoint,
    driveStatus: () => Object.freeze({
      configured: Boolean(configuredDriveEndpoint()),
      transientPending: transientRetryQueue.length
    }),
    flushDrive: flushTransientRetryQueue,
    privacy: Object.freeze({
      patientNameStorage: "google-drive-only",
      localPersistentPatientStorage: false,
      temporaryHistoryEnabled: false
    })
  });

  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
