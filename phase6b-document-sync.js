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
  const PRODUCTION_DRIVE_ENDPOINT = "https://script.google.com/macros/s/AKfycbx203QzIWqGmeTh_p1XjjmADWBuu_L3RJmUoV9A1fk12_OEtnhkSLq62bgup0ERe3IlBw/exec";
  const DRIVE_BRIDGE_VERSION = "2026.09.24-drive-v4";
  const PROFESSIONAL_RUT_STORAGE_KEY = "insulog.professional.rut.daily.v1";
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

  function isHyperglycemicEmergency() {
    return /CRISIS HIPERGLIC[EÉ]MICA|CETOSIS/i.test(rawClinicalNote());
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
    if (validDriveEndpoint(stored)) return stored;
    return validDriveEndpoint(PRODUCTION_DRIVE_ENDPOINT) ? PRODUCTION_DRIVE_ENDPOINT : "";
  }

  function localDateKey(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function professionalRutResult(value) {
    const compact = String(value || "")
      .trim()
      .toUpperCase()
      .replace(/[^0-9K]/g, "");

    if (!/^\d{7,8}[0-9K]$/.test(compact)) {
      return Object.freeze({
        valid: false,
        formatted: "",
        reason: "length",
        message: "RUT no válido. Ingrese 7 u 8 dígitos de RUT más su dígito verificador."
      });
    }

    const body = compact.slice(0, -1);
    const verifier = compact.slice(-1);
    let sum = 0;
    let multiplier = 2;
    for (let index = body.length - 1; index >= 0; index -= 1) {
      sum += Number(body[index]) * multiplier;
      multiplier = multiplier === 7 ? 2 : multiplier + 1;
    }

    const remainder = 11 - (sum % 11);
    const expected = remainder === 11 ? "0" : (remainder === 10 ? "K" : String(remainder));
    if (verifier !== expected) {
      return Object.freeze({
        valid: false,
        formatted: "",
        reason: "verifier",
        message: `RUT no válido. Dígito verificador incorrecto. Para ${body}, el DV correcto es ${expected}.`
      });
    }

    const reversed = body.split("").reverse();
    const grouped = [];
    for (let index = 0; index < reversed.length; index += 3) {
      grouped.push(reversed.slice(index, index + 3).reverse().join(""));
    }

    return Object.freeze({
      valid: true,
      formatted: `${grouped.reverse().join(".")}-${verifier}`,
      reason: "",
      message: ""
    });
  }

  function normalizeProfessionalRut(value) {
    return professionalRutResult(value).formatted;
  }

  function storedDailyProfessionalRut() {
    try {
      const stored = JSON.parse(localStorage.getItem(PROFESSIONAL_RUT_STORAGE_KEY) || "null");
      if (!stored || stored.date !== localDateKey()) {
        localStorage.removeItem(PROFESSIONAL_RUT_STORAGE_KEY);
        return "";
      }
      return normalizeProfessionalRut(stored.rut);
    } catch {
      localStorage.removeItem(PROFESSIONAL_RUT_STORAGE_KEY);
      return "";
    }
  }

  function ensureProfessionalRutStyles() {
    if (document.getElementById("insulog-professional-rut-styles")) return;
    const style = document.createElement("style");
    style.id = "insulog-professional-rut-styles";
    style.textContent = `
      #professional-rut-gate {
        position: fixed;
        inset: 0;
        z-index: 100000;
        display: grid;
        place-items: center;
        padding: 20px;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(4px);
      }
      #professional-rut-gate[hidden] { display: none !important; }
      #professional-rut-gate .professional-rut-card {
        width: min(100%, 430px);
        background: #fff;
        border-radius: 18px;
        padding: 24px;
        box-shadow: 0 24px 70px rgba(15, 23, 42, 0.28);
      }
      #professional-rut-gate h2 { margin: 0 0 8px; font-size: 1.35rem; }
      #professional-rut-gate p { margin: 0 0 16px; line-height: 1.45; }
      #professional-rut-gate label { display: block; font-weight: 700; margin-bottom: 6px; }
      #professional-rut-input {
        width: 100%;
        min-height: 48px;
        box-sizing: border-box;
        border: 1px solid #94a3b8;
        border-radius: 10px;
        padding: 10px 12px;
        font: inherit;
      }
      #professional-rut-error {
        min-height: 1.3em;
        margin: 8px 0 12px;
        color: #b91c1c;
        font-weight: 600;
      }
      #professional-rut-submit {
        width: 100%;
        min-height: 48px;
        border: 0;
        border-radius: 10px;
        font: inherit;
        font-weight: 800;
        cursor: pointer;
        background: #0f766e;
        color: #fff;
      }
      #professional-identity-status {
        max-width: 520px;
        margin: 12px auto 20px;
        padding: 10px 12px;
        border: 1px solid #cbd5e1;
        border-radius: 12px;
        background: #f8fafc;
        color: #334155;
        font-size: 0.88rem;
      }
      #professional-identity-status .professional-identity-row {
        display: flex;
        gap: 10px;
        align-items: center;
        justify-content: space-between;
      }
      #professional-identity-status button {
        width: auto;
        min-height: 38px;
        padding: 8px 12px;
        border: 1px solid #94a3b8;
        border-radius: 9px;
        background: #fff;
        color: #0f172a;
        cursor: pointer;
        font: inherit;
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);
  }

  function closeProfessionalRutGate() {
    document.getElementById("professional-rut-gate")?.remove();
  }

  function maskedProfessionalRut(rut) {
    const normalized = normalizeProfessionalRut(rut);
    if (!normalized) return "";
    const verifier = normalized.slice(-1);
    return `••.•••.•••-${verifier}`;
  }

  function renderProfessionalIdentityStatus() {
    const home = document.getElementById("p0");
    if (!home) return;
    let node = document.getElementById("professional-identity-status");
    if (!node) {
      node = document.createElement("div");
      node.id = "professional-identity-status";
      node.className = "no-print";
      const anchor = home.querySelector(".brand-subtitle") || home.querySelector("h1");
      anchor?.insertAdjacentElement("afterend", node);
    }
    const rut = storedDailyProfessionalRut();
    node.innerHTML = rut
      ? `<div class="professional-identity-row"><span><strong>Profesional activo:</strong> ${maskedProfessionalRut(rut)}</span><button type="button" data-action="change-professional">CAMBIAR PROFESIONAL</button></div>`
      : `<div class="professional-identity-row"><span><strong>Profesional:</strong> identificación pendiente</span><button type="button" data-action="change-professional">IDENTIFICAR</button></div>`;
  }

  function showProfessionalRutGate() {
    const current = storedDailyProfessionalRut();
    if (current) {
      closeProfessionalRutGate();
      return current;
    }

    ensureProfessionalRutStyles();
    if (document.getElementById("professional-rut-gate")) return "";

    const gate = document.createElement("div");
    gate.id = "professional-rut-gate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");
    gate.setAttribute("aria-labelledby", "professional-rut-title");
    gate.innerHTML = `
      <form class="professional-rut-card" id="professional-rut-form" novalidate>
        <h2 id="professional-rut-title">Identificación profesional</h2>
        <p>Ingrese su RUT profesional para registrar los controles de hoy. Se solicitará una sola vez al día en este computador.</p>
        <label for="professional-rut-input">RUT profesional</label>
        <input id="professional-rut-input" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="12" placeholder="12.345.678-5 o 1.234.567-K" aria-describedby="professional-rut-error">
        <div id="professional-rut-error" role="alert" aria-live="polite"></div>
        <button id="professional-rut-submit" type="submit">CONTINUAR A INSULOG</button>
      </form>
    `;

    const form = gate.querySelector("#professional-rut-form");
    const input = gate.querySelector("#professional-rut-input");
    const error = gate.querySelector("#professional-rut-error");
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const validation = professionalRutResult(input.value);
      if (!validation.valid) {
        error.textContent = validation.message;
        input.focus();
        input.select();
        return;
      }
      const rut = validation.formatted;
      input.value = rut;
      localStorage.setItem(PROFESSIONAL_RUT_STORAGE_KEY, JSON.stringify({ date: localDateKey(), rut }));
      closeProfessionalRutGate();
      renderProfessionalIdentityStatus();
    });

    document.body.appendChild(gate);
    requestAnimationFrame(() => input.focus());
    return "";
  }

  function requestDailyProfessionalRut() {
    return storedDailyProfessionalRut() || showProfessionalRutGate();
  }

  function registerProfessionalIdentityActions() {
    actions.register("change-professional", () => {
      const active = storedDailyProfessionalRut();
      const message = active
        ? "¿Cambiar el profesional activo en este equipo? Los próximos controles quedarán asociados al nuevo RUT."
        : "¿Ingresar identificación profesional?";
      if (!window.confirm(message)) return undefined;
      localStorage.removeItem(PROFESSIONAL_RUT_STORAGE_KEY);
      lastDriveFingerprint = "";
      lastDriveRecordId = "";
      renderProfessionalIdentityStatus();
      return showProfessionalRutGate();
    }, { replace: true });
  }

  function renderDriveStatus() {
    const node = document.getElementById("drive-sync-status");
    if (!node) return;
    const configured = Boolean(configuredDriveEndpoint());
    node.className = configured
      ? "alert alert-success compact-warning no-print"
      : "alert alert-warning compact-warning no-print";
    node.textContent = configured
      ? "✓ Drive configurado en este dispositivo."
      : "⚠ Drive no configurado en este dispositivo. El documento puede generarse, pero el control no se guardará en la base longitudinal.";
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

  function patientBirthDate() {
    const value = String(document.getElementById("fecha-nacimiento-paciente")?.value || "").trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : "";
  }

  function concomitantMedicationSnapshot(tipo, data) {
    const scope = tipo === "inicio" ? "inicio" : "seguimiento";
    const medications = Array.from(document.querySelectorAll(`input[data-aps-med="${scope}"]:checked`))
      .map((input) => {
        const label = String(input.dataset.baseLabel || input.dataset.label || "").trim();
        const dose = String(input.closest("label")?.querySelector(".aps-med-dose")?.value || "").trim();
        const key = String(input.dataset.medKey || "").trim();
        const text = String(input.dataset.label || label || "").trim();
        return { key, label, dose, text };
      })
      .filter((item) => item.key || item.text);

    const text = String(data.tratamientoConcomitante || "").trim()
      || (medications.length ? medications.map((item) => item.text).join("; ") : "No registrado");

    return { text, medications };
  }

  function numericInputValues(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map((input) => Number.parseInt(input.value, 10))
      .filter(Number.isFinite);
  }

  function selectedValues(selector) {
    return Array.from(document.querySelectorAll(selector))
      .map((control) => String(control.dataset.value || "").trim())
      .filter(Boolean);
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
    if (isUrgencyRoute() && data.professionalDecision === "aceptada" && data.level3AutomaticRecommendation !== true) return "Seguimiento";
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
    const birthDate = patientBirthDate();
    if (!patientName || !birthDate) return null;

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
    const initiationFasting = tipo === "inicio" ? safeNumber(document.getElementById("glicemia-ayunas-inicio")?.value) : null;
    const initiationCasual = tipo === "inicio" ? safeNumber(document.getElementById("glicemia-casual-inicio")?.value) : null;
    const initiationAge = tipo === "inicio" ? safeNumber(document.getElementById("edad-inicio")?.value) : null;
    const initiationBmi = tipo === "inicio" ? safeNumber(document.getElementById("imc-inicio")?.value) : null;
    const initiationCriteriaSelected = tipo === "inicio"
      ? selectedValues(".inicio-btn.seleccionada, .aceptacion-btn.seleccionada")
      : [];
    const catabolicSymptomsSelected = tipo === "inicio" ? selectedValues(".catabolico-btn.seleccionada") : [];
    const hypoglycemiaRiskSelected = tipo === "inicio" ? selectedValues(".riesgo-hipo-btn.seleccionada") : [];
    const egfr = tipo === "inicio" ? safeNumber(document.getElementById("vfg-inicio")?.value) : null;
    const targetA1c = tipo === "seguimiento"
      ? safeNumber(document.getElementById("meta-hba1c-seguimiento")?.value) ?? safeNumber(data.targetA1c)
      : null;
    const currentAm = tipo === "inicio" ? 0 : numberOrZero(data.amActual);
    const currentPm = tipo === "inicio" ? 0 : numberOrZero(data.pmActual);
    const initiationSuggestedScheme = tipo === "inicio" ? String(data.esquemaInicioSugerido || "").trim() : "";
    const initiationSuggestedFactor = tipo === "inicio" ? safeNumber(data.factorInicioSugerido) : null;
    const initiationAppliedScheme = tipo === "inicio" ? String(data.esquemaInicio || "").trim() : "";
    const initiationAppliedFactor = tipo === "inicio" ? safeNumber(data.factorInicioAplicado) : null;
    const initiationSchemeModified = tipo === "inicio" && Boolean(data.esquemaInicioModificadoPorProfesional);
    const initiationFactorModified = tipo === "inicio" && Boolean(data.factorInicioModificadoPorProfesional);
    let initiationSuggestedAm = null;
    let initiationSuggestedPm = null;
    if (tipo === "inicio" && weight && initiationSuggestedScheme && initiationSuggestedFactor !== null) {
      const suggestedDose = window.InsulogClinicalEngine?.calculateInitialDose?.({
        weightKg: weight,
        factor: initiationSuggestedFactor,
        scheme: initiationSuggestedScheme
      });
      if (suggestedDose?.valid) {
        initiationSuggestedAm = safeNumber(suggestedDose.am);
        initiationSuggestedPm = safeNumber(suggestedDose.pm);
      }
    }
    const note = rawClinicalNote();
    const urgencyRoute = isUrgencyRoute();
    const hyperglycemicEmergency = isHyperglycemicEmergency();
    const urgencyAccepted = urgencyRoute && data.professionalDecision === "aceptada";
    const level3Automatic = urgencyRoute && data.level3AutomaticRecommendation === true;
    const urgencyAcceptedWithoutDose = urgencyAccepted && !level3Automatic;
    const recommendedAm = urgencyAcceptedWithoutDose ? null : numberOrZero(data.am);
    const recommendedPm = urgencyAcceptedWithoutDose ? null : numberOrZero(data.pm);
    const finalAm = urgencyAcceptedWithoutDose ? null : numberOrZero(data.professionalAm);
    const finalPm = urgencyAcceptedWithoutDose ? null : numberOrZero(data.professionalPm);
    const decision = data.professionalDecision === "modificada" ? "Modificada" : "Aceptada";
    const medication = concomitantMedicationSnapshot(tipo, data);
    const professionalRut = storedDailyProfessionalRut();
    const currentTotal = totalDose(currentAm, currentPm);
    const finalTotalForTrace = urgencyAcceptedWithoutDose ? null : totalDose(finalAm, finalPm);
    const currentDosePerKg = weight && weight > 0 ? currentTotal / weight : null;
    const finalDosePerKg = weight && weight > 0 && finalTotalForTrace !== null ? finalTotalForTrace / weight : null;
    const doseSafetyLevel = String(data.doseSafetyLevel || "");
    const automaticEscalationBlocked = Boolean(data.automaticEscalationBlocked);
    const doseSafetyReason = String(data.doseSafetyWarning || (automaticEscalationBlocked
      ? "Aumento automático bloqueado por umbral de seguridad de dosis basal."
      : "")).trim();
    const fingerprint = [
      patientName, birthDate, tipo, note, decision,
      urgencyAcceptedWithoutDose ? "urgency-no-dose" : "",
      data.level3Timing || "", data.level3ReversibleCause || "",
      finalAm ?? "", finalPm ?? "", hba1c ?? "", targetA1c ?? "",
      initiationFasting ?? "", initiationCasual ?? "", initiationAge ?? "", initiationBmi ?? "",
      initiationCriteriaSelected.join(","), catabolicSymptomsSelected.join(","), hypoglycemiaRiskSelected.join(","),
      hyperglycemicEmergency ? "hyperglycemic-emergency" : "",
      currentDosePerKg ?? "", finalDosePerKg ?? "", doseSafetyLevel, automaticEscalationBlocked ? "escalation-blocked" : "",
      fastingValues.join(","), preLunchValues.join(","),
      initiationSuggestedScheme, initiationSuggestedFactor ?? "",
      initiationAppliedScheme, initiationAppliedFactor ?? "",
      initiationSchemeModified ? "scheme-modified" : "",
      initiationFactorModified ? "factor-modified" : "",
      medication.text, professionalRut
    ].join("|");

    return {
      bridgeVersion: DRIVE_BRIDGE_VERSION,
      recordId: stableRecordId(fingerprint),
      sourceOrigin: window.location.origin,
      timestamp: new Date().toISOString(),
      professionalRut,
      patientName,
      patientBirthDate: birthDate,
      documentType: tipo,
      controlKind: controlKind(tipo, data),
      weightKg: weight,
      hba1c,
      initiationFasting,
      initiationCasual,
      initiationAge,
      initiationBmi,
      initiationCriteriaSelected,
      catabolicSymptomsSelected,
      hypoglycemiaRiskSelected,
      egfr,
      targetA1c,
      initiationSuggestedScheme,
      initiationSuggestedFactor,
      initiationSuggestedAm,
      initiationSuggestedPm,
      initiationAppliedScheme,
      initiationAppliedFactor,
      initiationSchemeModified,
      initiationFactorModified,
      currentAm,
      currentPm,
      currentTotal,
      currentDosePerKg,
      fastingAverage: safeNumber(data.promAy),
      preLunchAverage: safeNumber(data.promPre),
      fastingValues,
      preLunchValues,
      hypoglycemia70: lowestGlucose !== null && lowestGlucose < 70,
      hypoglycemia54: lowestGlucose !== null && lowestGlucose < 54,
      hypoglycemiaLevel3: /HIPOGLICEMIA NIVEL 3/i.test(note),
      lowestGlucose,
      recommendedAm,
      recommendedPm,
      recommendedTotal: urgencyAcceptedWithoutDose ? null : totalDose(recommendedAm, recommendedPm),
      recommendationText: urgencyAcceptedWithoutDose
        ? "Ruta de urgencia: sin titulación automática de NPH"
        : (level3Automatic
          ? `Hipoglicemia nivel 3: reducir ${Number(data.level3ReductionPercent || 20)}% NPH ${String(data.level3ImplicatedDose || "").toUpperCase()}`
          : doseLabel(recommendedAm, recommendedPm)),
      finalAm,
      finalPm,
      finalTotal: finalTotalForTrace,
      finalDosePerKg,
      doseSafetyLevel,
      automaticEscalationBlocked,
      doseSafetyReason,
      professionalDecision: decision,
      professionalReason: String(data.professionalReason || "").trim(),
      professionalDosePerKg: urgencyAcceptedWithoutDose ? null : safeNumber(data.professionalDosePerKg),
      concomitantTreatment: medication.text,
      concomitantMedications: medication.medications,
      urgencyRoute,
      hyperglycemicEmergency,
      emergencyReason: hyperglycemicEmergency ? note : "",
      level3Timing: String(data.level3Timing || ""),
      level3ReversibleCause: String(data.level3ReversibleCause || ""),
      level3SevereNeurologic: Boolean(data.level3SevereNeurologic),
      level3AutomaticRecommendation: Boolean(data.level3AutomaticRecommendation),
      level3ImplicatedDose: String(data.level3ImplicatedDose || ""),
      level3ReductionPercent: safeNumber(data.level3ReductionPercent),
      clinicalEngineVersion: window.InsulogClinicalEngine?.version || "",
      documentModuleVersion: window.InsulogDocuments?.version || "",
      appRuntimeVersion: runtime.version || "",
      documentSyncVersion: window.InsulogPhase6BDocumentSync?.version || ""
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

  function clinicalFlowType() {
    return /^INICIO\b/i.test(String(rawClinicalNote()).trim()) ? "inicio" : "seguimiento";
  }

  function registerDocumentSync() {
    actions.decorate("show-document", (next) => (context) => {
      const data = state.snapshot();
      if (data.professionalDecision !== "aceptada" && data.professionalDecision !== "modificada") {
        return next(context);
      }

      const professionalRut = requestDailyProfessionalRut();
      if (!professionalRut) {
        alert("Debe ingresar un RUT profesional válido para registrar este control.");
        return undefined;
      }

      const birthDateInput = document.getElementById("fecha-nacimiento-paciente");
      if (!patientBirthDate()) {
        alert("Ingrese la fecha de nacimiento del paciente para identificar correctamente el seguimiento longitudinal.");
        birthDateInput?.focus();
        return undefined;
      }

      const original = { am: data.am, pm: data.pm, dosisKg: data.dosisKg };
      const urgencyAccepted = isUrgencyRoute() && data.professionalDecision === "aceptada";
      const urgencyAcceptedWithoutDose = urgencyAccepted && data.level3AutomaticRecommendation !== true;
      const am = urgencyAcceptedWithoutDose ? 0 : numberOrZero(data.professionalAm);
      const pm = urgencyAcceptedWithoutDose ? 0 : numberOrZero(data.professionalPm);
      const tipo = clinicalFlowType();
      const driveRecord = buildDriveRecord(tipo, data);

      state.patch({ am, pm, dosisKg: urgencyAcceptedWithoutDose ? null : (data.professionalDosePerKg ?? data.dosisKg) });
      const result = next(context);
      requestAnimationFrame(() => state.patch(original));

      if (result && driveRecord) void sendDriveRecord(driveRecord);
      return result;
    });
  }

  function init() {
    configureDriveEndpointFromQuery();
    renderDriveStatus();
    registerProfessionalIdentityActions();
    requestDailyProfessionalRut();
    renderProfessionalIdentityStatus();
    injectFollowupHbA1cField();
    registerProfessionalOverbasalizationOverride();
    registerDocumentSync();
    disableTemporaryHistoryActions();
    removeTemporaryHistoryUI();
    requestAnimationFrame(removeTemporaryHistoryUI);
    window.addEventListener("online", () => void flushTransientRetryQueue());
  }

  window.InsulogPhase6BDocumentSync = Object.freeze({
    version: "2026.09.24-phase6b-document-sync-research-v4",
    configureDriveEndpoint,
    driveStatus: () => Object.freeze({
      configured: Boolean(configuredDriveEndpoint()),
      automaticProductionEndpoint: configuredDriveEndpoint() === PRODUCTION_DRIVE_ENDPOINT,
      professionalRutRegisteredToday: Boolean(storedDailyProfessionalRut()),
      transientPending: transientRetryQueue.length
    }),
    flushDrive: flushTransientRetryQueue,
    privacy: Object.freeze({
      patientNameStorage: "google-drive-only",
      localPersistentPatientStorage: false,
      temporaryHistoryEnabled: false
    })
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
