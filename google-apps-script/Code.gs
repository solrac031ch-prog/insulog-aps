"use strict";

const INSULOG_DRIVE_CONFIG = Object.freeze({
  spreadsheetId: "1nNCD6qGt2QisTVLWqfatwnLHshG5YfTpmiWrVBA8xfY",
  patientsSheet: "Pacientes",
  controlsSheet: "Controles",
  eventsSheet: "Eventos",
  allowedOrigins: ["https://solrac031ch-prog.github.io"],
  bridgeVersion: "2026.09.15-drive-v1"
});

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "Insulog APS Drive Bridge",
    version: INSULOG_DRIVE_CONFIG.bridgeVersion
  });
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const payload = parsePayload_(e);
    validatePayload_(payload);

    const spreadsheet = SpreadsheetApp.openById(INSULOG_DRIVE_CONFIG.spreadsheetId);
    const patients = requiredSheet_(spreadsheet, INSULOG_DRIVE_CONFIG.patientsSheet);
    const controls = requiredSheet_(spreadsheet, INSULOG_DRIVE_CONFIG.controlsSheet);
    const events = requiredSheet_(spreadsheet, INSULOG_DRIVE_CONFIG.eventsSheet);

    if (controlAlreadyExists_(controls, payload.recordId)) {
      return jsonResponse_({ ok: true, duplicate: true, recordId: payload.recordId });
    }

    const timestamp = safeDate_(payload.timestamp) || new Date();
    const patient = upsertPatient_(patients, payload, timestamp);
    appendControl_(controls, patient.patientId, payload, timestamp);
    appendAutomaticHypoglycemiaEvent_(events, patient.patientId, payload, timestamp);

    return jsonResponse_({
      ok: true,
      duplicate: false,
      recordId: payload.recordId,
      patientId: patient.patientId
    });
  } catch (error) {
    console.error(error && error.stack ? error.stack : error);
    return jsonResponse_({ ok: false, error: String(error && error.message ? error.message : error) });
  } finally {
    lock.releaseLock();
  }
}

function parsePayload_(e) {
  const raw = e && e.postData && typeof e.postData.contents === "string"
    ? e.postData.contents
    : "";
  if (!raw) throw new Error("Solicitud sin contenido.");
  return JSON.parse(raw);
}

function validatePayload_(payload) {
  if (!payload || typeof payload !== "object") throw new Error("Payload inválido.");
  if (String(payload.bridgeVersion || "") !== INSULOG_DRIVE_CONFIG.bridgeVersion) {
    throw new Error("Versión del puente no compatible.");
  }

  const origin = String(payload.sourceOrigin || "").trim();
  if (INSULOG_DRIVE_CONFIG.allowedOrigins.indexOf(origin) === -1) {
    throw new Error("Origen no autorizado.");
  }

  const recordId = String(payload.recordId || "").trim();
  if (recordId.length < 8 || recordId.length > 120) throw new Error("recordId inválido.");

  const patientName = cleanName_(payload.patientName);
  if (patientName.length < 3 || patientName.length > 160) throw new Error("Nombre de paciente inválido.");

  const decision = String(payload.professionalDecision || "");
  if (["Aceptada", "Modificada"].indexOf(decision) === -1) {
    throw new Error("Decisión profesional inválida.");
  }

  if (!isFiniteNumber_(payload.finalTotal) || Number(payload.finalTotal) <= 0 || Number(payload.finalTotal) > 300) {
    throw new Error("Dosis final inválida.");
  }
}

function requiredSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error("No existe la hoja requerida: " + name);
  return sheet;
}

function controlAlreadyExists_(sheet, recordId) {
  if (sheet.getLastRow() < 2) return false;
  const finder = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(recordId))
    .matchEntireCell(true)
    .matchCase(true);
  return Boolean(finder.findNext());
}

function upsertPatient_(sheet, payload, timestamp) {
  const patientName = cleanName_(payload.patientName);
  const normalized = normalizeName_(patientName);
  const lastRow = sheet.getLastRow();
  let patientRow = 0;
  let patientId = "";

  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 10).getValues();
    for (let index = 0; index < rows.length; index += 1) {
      if (normalizeName_(rows[index][1]) === normalized) {
        patientRow = index + 2;
        patientId = String(rows[index][0] || "").trim();
        break;
      }
    }
  }

  const hba1c = nullableNumber_(payload.hba1c);
  const baselineNph = nullableNumber_(payload.currentTotal);

  if (!patientRow) {
    patientId = Utilities.getUuid();
    sheet.appendRow([
      patientId,
      patientName,
      "",
      "",
      timestamp,
      timestamp,
      "Activo",
      hba1c === null ? "" : hba1c,
      baselineNph === null ? "" : baselineNph,
      ""
    ]);
    return { patientId: patientId, row: sheet.getLastRow(), created: true };
  }

  if (!patientId) {
    patientId = Utilities.getUuid();
    sheet.getRange(patientRow, 1).setValue(patientId);
  }

  sheet.getRange(patientRow, 2).setValue(patientName);
  sheet.getRange(patientRow, 6).setValue(timestamp);
  sheet.getRange(patientRow, 7).setValue("Activo");

  if (hba1c !== null && sheet.getRange(patientRow, 8).isBlank()) {
    sheet.getRange(patientRow, 8).setValue(hba1c);
  }
  if (baselineNph !== null && sheet.getRange(patientRow, 9).isBlank()) {
    sheet.getRange(patientRow, 9).setValue(baselineNph);
  }

  return { patientId: patientId, row: patientRow, created: false };
}

function appendControl_(sheet, patientId, payload, timestamp) {
  const currentAm = numberOrBlank_(payload.currentAm);
  const currentPm = numberOrBlank_(payload.currentPm);
  const currentTotal = numberOrBlank_(payload.currentTotal);
  const recommendedTotal = numberOrBlank_(payload.recommendedTotal);
  const finalTotal = numberOrBlank_(payload.finalTotal);
  const hba1c = numberOrBlank_(payload.hba1c);
  const egfr = numberOrBlank_(payload.egfr);
  const weight = numberOrBlank_(payload.weightKg);
  const fastingAverage = numberOrBlank_(payload.fastingAverage);
  const preLunchAverage = numberOrBlank_(payload.preLunchAverage);
  const version = [
    String(payload.clinicalEngineVersion || "").trim(),
    String(payload.documentModuleVersion || "").trim(),
    String(payload.appRuntimeVersion || "").trim()
  ].filter(Boolean).join(" | ");

  sheet.appendRow([
    String(payload.recordId),
    patientId,
    cleanName_(payload.patientName),
    timestamp,
    normalizeControlKind_(payload.controlKind),
    weight,
    hba1c,
    "",
    egfr,
    currentAm,
    currentPm,
    currentTotal,
    fastingAverage,
    preLunchAverage,
    payload.hypoglycemia70 ? "Sí" : "No",
    payload.hypoglycemia54 ? "Sí" : "No",
    String(payload.recommendationText || "").trim(),
    recommendedTotal,
    finalTotal,
    normalizeDecision_(payload.professionalDecision),
    String(payload.professionalReason || "").trim(),
    "",
    version || INSULOG_DRIVE_CONFIG.bridgeVersion,
    timestamp
  ]);
}

function appendAutomaticHypoglycemiaEvent_(sheet, patientId, payload, timestamp) {
  if (!payload.hypoglycemia70) return;

  const lowest = nullableNumber_(payload.lowestGlucose);
  const severity = payload.hypoglycemia54 ? "Moderado" : "Leve";
  const thresholdText = payload.hypoglycemia54 ? "<54 mg/dL" : "<70 mg/dL";
  const detail = lowest === null
    ? "Hipoglicemia detectada en glicemias registradas en Insulog (" + thresholdText + ")."
    : "Hipoglicemia detectada en glicemias registradas en Insulog. Menor valor: " + lowest + " mg/dL.";

  sheet.appendRow([
    Utilities.getUuid(),
    patientId,
    cleanName_(payload.patientName),
    timestamp,
    "Hipoglicemia",
    severity,
    detail,
    "Sí",
    "Revisión de dosis y conducta clínica según Insulog y decisión profesional.",
    "",
    "No",
    "Generado automáticamente desde el control " + String(payload.recordId)
  ]);
}

function normalizeControlKind_(value) {
  const text = String(value || "");
  if (text === "Inicio") return "Inicio";
  if (text === "Seguimiento") return "Seguimiento";
  return "Ajuste";
}

function normalizeDecision_(value) {
  return String(value || "") === "Modificada" ? "Modificada" : "Aceptada";
}

function cleanName_(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeName_(value) {
  return cleanName_(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL");
}

function safeDate_(value) {
  const date = new Date(String(value || ""));
  return isNaN(date.getTime()) ? null : date;
}

function isFiniteNumber_(value) {
  return value !== null && value !== "" && isFinite(Number(value));
}

function nullableNumber_(value) {
  return isFiniteNumber_(value) ? Number(value) : null;
}

function numberOrBlank_(value) {
  const number = nullableNumber_(value);
  return number === null ? "" : number;
}

function jsonResponse_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
