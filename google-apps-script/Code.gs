"use strict";

const INSULOG_DRIVE_CONFIG = Object.freeze({
  spreadsheetId: "1WTDqnaHgwX_7OdgxW0C7WIC6Up3dcxOcmKhObHw9La4",
  patientsSheet: "Pacientes",
  controlsSheet: "Controles",
  eventsSheet: "Eventos",
  allowedOrigins: ["https://solrac031ch-prog.github.io"],
  bridgeVersion: "2026.09.21-drive-v2",
  schemaVersion: "2026.09.21-schema-v4"
});

function doGet() {
  return jsonResponse_({
    ok: true,
    service: "Insulog APS Drive Bridge",
    version: INSULOG_DRIVE_CONFIG.bridgeVersion,
    schemaVersion: INSULOG_DRIVE_CONFIG.schemaVersion,
    spreadsheetId: INSULOG_DRIVE_CONFIG.spreadsheetId
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
    ensureSchema_(patients, controls);

    if (controlAlreadyExists_(controls, payload.recordId)) {
      return jsonResponse_({ ok: true, duplicate: true, recordId: payload.recordId });
    }

    const timestamp = safeDate_(payload.timestamp) || new Date();
    const patient = upsertPatient_(patients, payload, timestamp);
    appendControl_(controls, patient, payload, timestamp);
    appendAutomaticHypoglycemiaEvent_(events, patient.patientId, payload, timestamp);

    return jsonResponse_({
      ok: true,
      duplicate: false,
      recordId: payload.recordId,
      patientId: patient.patientId,
      firstRegistration: patient.created,
      cohortEntryType: patient.cohortEntryType
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

  const patientBirthDate = normalizeBirthDate_(payload.patientBirthDate);
  if (!patientBirthDate) throw new Error("Fecha de nacimiento inválida.");

  const documentType = String(payload.documentType || "").trim();
  if (["inicio", "seguimiento"].indexOf(documentType) === -1) {
    throw new Error("Tipo de documento inválido.");
  }

  const decision = String(payload.professionalDecision || "");
  if (["Aceptada", "Modificada"].indexOf(decision) === -1) {
    throw new Error("Decisión profesional inválida.");
  }

  if (!isFiniteNumber_(payload.finalTotal) || Number(payload.finalTotal) <= 0 || Number(payload.finalTotal) > 300) {
    throw new Error("Dosis final inválida.");
  }

  if (payload.concomitantMedications !== undefined && !Array.isArray(payload.concomitantMedications)) {
    throw new Error("Lista de medicamentos concomitantes inválida.");
  }
  if (Array.isArray(payload.concomitantMedications) && payload.concomitantMedications.length > 20) {
    throw new Error("Demasiados medicamentos concomitantes.");
  }
}

function requiredSheet_(spreadsheet, name) {
  const sheet = spreadsheet.getSheetByName(name);
  if (!sheet) throw new Error("No existe la hoja requerida: " + name);
  return sheet;
}

function ensureSchema_(patients, controls) {
  const properties = PropertiesService.getScriptProperties();
  if (properties.getProperty("INSULOG_SCHEMA_VERSION") === INSULOG_DRIVE_CONFIG.schemaVersion) return;

  const patientHeaders = [
    "Tipo de ingreso a cohorte",
    "Usaba insulina antes del primer registro",
    "NPH AM basal (UI)",
    "NPH PM basal (UI)",
    "NPH final tras primer registro (UI/día)"
  ];
  patients.getRange(1, 11, 1, patientHeaders.length).setValues([patientHeaders]);

  const yesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Sí", "No"], true)
    .setAllowInvalid(false)
    .build();
  patients.getRange(2, 12, Math.max(1, patients.getMaxRows() - 1), 1).setDataValidation(yesNoRule);

  const controlRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Inicio", "Ingreso con insulina previa", "Ajuste", "Seguimiento"], true)
    .setAllowInvalid(false)
    .build();
  controls.getRange(2, 5, Math.max(1, controls.getMaxRows() - 1), 1).setDataValidation(controlRule);

  const medicationHeaders = [
    "Tratamiento concomitante (detalle)",
    "Claves medicamentos",
    "Metformina",
    "iSGLT2",
    "DPP-4 / vildagliptina"
  ];
  const requiredControlColumns = 24 + medicationHeaders.length;
  if (controls.getMaxColumns() < requiredControlColumns) {
    controls.insertColumnsAfter(controls.getMaxColumns(), requiredControlColumns - controls.getMaxColumns());
  }
  controls.getRange(1, 25, 1, medicationHeaders.length).setValues([medicationHeaders]);

  const medicationYesNoRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["Sí", "No"], true)
    .setAllowInvalid(false)
    .build();
  controls.getRange(2, 27, Math.max(1, controls.getMaxRows() - 1), 3).setDataValidation(medicationYesNoRule);

  properties.setProperty("INSULOG_SCHEMA_VERSION", INSULOG_DRIVE_CONFIG.schemaVersion);
}

function controlAlreadyExists_(sheet, recordId) {
  if (sheet.getLastRow() < 2) return false;
  const finder = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1)
    .createTextFinder(String(recordId))
    .matchEntireCell(true)
    .matchCase(true);
  return Boolean(finder.findNext());
}

function cohortEntryType_(payload) {
  return String(payload.documentType || "") === "inicio"
    ? "Inicio de insulina registrado en Insulog"
    : "Ya usaba insulina al primer registro en Insulog";
}

function upsertPatient_(sheet, payload, timestamp) {
  const patientName = cleanName_(payload.patientName);
  const normalized = normalizeName_(patientName);
  const patientBirthDate = normalizeBirthDate_(payload.patientBirthDate);
  const lastRow = sheet.getLastRow();
  let patientRow = 0;
  let patientId = "";
  let legacyBlankBirthDateRow = 0;
  let legacyBlankBirthDateCount = 0;

  if (lastRow >= 2) {
    const rows = sheet.getRange(2, 1, lastRow - 1, 15).getValues();
    for (let index = 0; index < rows.length; index += 1) {
      if (normalizeName_(rows[index][1]) !== normalized) continue;

      const storedBirthDate = normalizeBirthDate_(rows[index][2]);
      if (storedBirthDate === patientBirthDate) {
        patientRow = index + 2;
        patientId = String(rows[index][0] || "").trim();
        break;
      }

      if (!storedBirthDate) {
        legacyBlankBirthDateRow = index + 2;
        legacyBlankBirthDateCount += 1;
      }
    }

    if (!patientRow && legacyBlankBirthDateCount === 1) {
      patientRow = legacyBlankBirthDateRow;
      patientId = String(sheet.getRange(patientRow, 1).getValue() || "").trim();
      sheet.getRange(patientRow, 3).setValue(birthDateCellValue_(patientBirthDate));
      sheet.getRange(patientRow, 3).setNumberFormat("dd/mm/yyyy");
    }

    if (!patientRow && legacyBlankBirthDateCount > 1) {
      throw new Error("Coincidencia ambigua: existen varios pacientes con el mismo nombre y sin fecha de nacimiento.");
    }
  }

  const hba1c = nullableNumber_(payload.hba1c);
  const baselineAm = String(payload.documentType || "") === "inicio" ? 0 : nullableNumber_(payload.currentAm);
  const baselinePm = String(payload.documentType || "") === "inicio" ? 0 : nullableNumber_(payload.currentPm);
  const baselineNph = String(payload.documentType || "") === "inicio" ? 0 : nullableNumber_(payload.currentTotal);
  const firstFinalNph = nullableNumber_(payload.finalTotal);
  const cohortEntryType = cohortEntryType_(payload);
  const insulinBeforeEntry = String(payload.documentType || "") === "inicio" ? "No" : "Sí";

  if (!patientRow) {
    patientId = Utilities.getUuid();
    sheet.appendRow([
      patientId,
      patientName,
      birthDateCellValue_(patientBirthDate),
      "",
      timestamp,
      timestamp,
      "Activo",
      hba1c === null ? "" : hba1c,
      baselineNph === null ? "" : baselineNph,
      "",
      cohortEntryType,
      insulinBeforeEntry,
      baselineAm === null ? "" : baselineAm,
      baselinePm === null ? "" : baselinePm,
      firstFinalNph === null ? "" : firstFinalNph
    ]);
    return {
      patientId: patientId,
      row: sheet.getLastRow(),
      created: true,
      cohortEntryType: cohortEntryType
    };
  }

  if (!patientId) {
    patientId = Utilities.getUuid();
    sheet.getRange(patientRow, 1).setValue(patientId);
  }

  sheet.getRange(patientRow, 2).setValue(patientName);
  if (sheet.getRange(patientRow, 3).isBlank()) {
    sheet.getRange(patientRow, 3).setValue(birthDateCellValue_(patientBirthDate));
    sheet.getRange(patientRow, 3).setNumberFormat("dd/mm/yyyy");
  }
  sheet.getRange(patientRow, 6).setValue(timestamp);
  sheet.getRange(patientRow, 7).setValue("Activo");

  if (hba1c !== null && sheet.getRange(patientRow, 8).isBlank()) {
    sheet.getRange(patientRow, 8).setValue(hba1c);
  }
  if (baselineNph !== null && sheet.getRange(patientRow, 9).isBlank()) {
    sheet.getRange(patientRow, 9).setValue(baselineNph);
  }

  const storedCohortEntryType = String(sheet.getRange(patientRow, 11).getValue() || "").trim();
  return {
    patientId: patientId,
    row: patientRow,
    created: false,
    cohortEntryType: storedCohortEntryType || cohortEntryType
  };
}

function firstControlKind_(patient, payload) {
  if (!patient.created) return normalizeControlKind_(payload.controlKind);
  return String(payload.documentType || "") === "inicio"
    ? "Inicio"
    : "Ingreso con insulina previa";
}

function appendControl_(sheet, patient, payload, timestamp) {
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
  const medications = normalizeMedications_(payload.concomitantMedications);
  const medicationFlags = medicationClassFlags_(medications);
  const treatmentText = cleanMedicationText_(payload.concomitantTreatment, medications);
  const medicationKeys = medications.map(function(item) { return item.key; }).filter(Boolean).join("; ");
  const version = [
    String(payload.clinicalEngineVersion || "").trim(),
    String(payload.documentModuleVersion || "").trim(),
    String(payload.appRuntimeVersion || "").trim()
  ].filter(Boolean).join(" | ");

  sheet.appendRow([
    String(payload.recordId),
    patient.patientId,
    cleanName_(payload.patientName),
    timestamp,
    firstControlKind_(patient, payload),
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
    timestamp,
    treatmentText,
    medicationKeys,
    medicationFlags.metformin ? "Sí" : "No",
    medicationFlags.sglt2 ? "Sí" : "No",
    medicationFlags.dpp4 ? "Sí" : "No"
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

function normalizeMedications_(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).map(function(item) {
    const source = item && typeof item === "object" ? item : {};
    return {
      key: String(source.key || "").trim().slice(0, 80),
      label: String(source.label || "").trim().slice(0, 160),
      dose: String(source.dose || "").trim().slice(0, 120),
      text: String(source.text || "").trim().slice(0, 240)
    };
  }).filter(function(item) {
    return item.key || item.text || item.label;
  });
}

function cleanMedicationText_(value, medications) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text) return text.slice(0, 1200);
  if (!medications.length) return "No registrado";
  return medications.map(function(item) {
    return item.text || [item.label, item.dose].filter(Boolean).join(": ");
  }).filter(Boolean).join("; ").slice(0, 1200);
}

function medicationClassFlags_(medications) {
  const keys = medications.map(function(item) { return item.key; });
  const metforminKeys = ["metformina850", "metforminaXR1000", "metformina500", "metformina750", "empaMet12_5_1000", "vildaMet"];
  const sglt2Keys = ["dapagliflozina10", "empagliflozina", "empaMet12_5_1000"];
  const dpp4Keys = ["vildagliptina50", "vildaMet"];
  return {
    metformin: keys.some(function(key) { return metforminKeys.indexOf(key) !== -1; }),
    sglt2: keys.some(function(key) { return sglt2Keys.indexOf(key) !== -1; }),
    dpp4: keys.some(function(key) { return dpp4Keys.indexOf(key) !== -1; })
  };
}

function normalizeControlKind_(value) {
  const text = String(value || "");
  if (text === "Inicio") return "Inicio";
  if (text === "Ingreso con insulina previa") return "Ingreso con insulina previa";
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

function normalizeBirthDate_(value) {
  if (value instanceof Date && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone() || "America/Santiago", "yyyy-MM-dd");
  }

  const text = String(value || "").trim();
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (match) {
      const day = String(match[1]).padStart(2, "0");
      const month = String(match[2]).padStart(2, "0");
      return validBirthDateParts_(match[3], month, day) ? match[3] + "-" + month + "-" + day : "";
    }
    return "";
  }

  return validBirthDateParts_(match[1], match[2], match[3])
    ? match[1] + "-" + match[2] + "-" + match[3]
    : "";
}

function validBirthDateParts_(yearText, monthText, dayText) {
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return false;

  const date = new Date(year, month - 1, day, 12, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return false;

  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  return date <= todayKey;
}

function birthDateCellValue_(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return "";
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12, 0, 0);
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
