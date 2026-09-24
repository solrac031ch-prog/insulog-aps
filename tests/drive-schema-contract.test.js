"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const bridge = fs.readFileSync("google-apps-script/Code.gs", "utf8");
const sync = fs.readFileSync("phase6b-document-sync.js", "utf8");

[
  '"2026.09.24-schema-v10"',
  '"Recomendación NPH AM (UI)"',
  '"Recomendación NPH PM (UI)"',
  '"Decisión final NPH AM (UI)"',
  '"Decisión final NPH PM (UI)"',
  '"Meta HbA1c (%)"',
  '"HGT ayunas utilizados"',
  '"HGT pre-almuerzo utilizados"',
  '"Inicio esquema sugerido Insulog"',
  '"Inicio factor sugerido (UI/kg)"',
  '"Inicio dosis sugerida AM (UI)"',
  '"Inicio dosis sugerida PM (UI)"',
  '"Inicio esquema aplicado"',
  '"Inicio factor aplicado (UI/kg)"',
  '"Inicio esquema modificado por médico"',
  '"Inicio factor modificado por médico"',
  "recommendedAm",
  "recommendedPm",
  "finalAm",
  "finalPm",
  "serializeGlucoseValues_(payload.fastingValues)",
  "serializeGlucoseValues_(payload.preLunchValues)",
  "documentSyncVersion",
  "appendAutomaticHyperglycemicEmergencyEvent_",
  "hyperglycemicEmergency",
  "initiationFasting",
  "initiationCasual",
  '"CasosRaw"',
  "appendRawCase_",
  "pseudonymizedPayload_",
  "payload_sha256",
  "chain_hash",
  '"HGT mínimo ayunas utilizado"',
  '"Dosis actual (UI/kg/día)"',
  '"Bloqueo escalamiento automático"',
  '"ID estudio paciente"',
  '"ID estudio profesional"'
].forEach((token) => assert.ok(bridge.includes(token), `Falta contrato Drive: ${token}`));

[
  "fastingValues,",
  "preLunchValues,",
  'document.getElementById("meta-hba1c-seguimiento")?.value',
  "targetA1c,",
  "recommendedAm,",
  "recommendedPm,",
  "finalAm,",
  "finalPm,",
  "initiationSuggestedScheme,",
  "initiationSuggestedFactor,",
  "initiationSuggestedAm,",
  "initiationSuggestedPm,",
  "initiationAppliedScheme,",
  "initiationAppliedFactor,",
  "initiationSchemeModified,",
  "initiationFactorModified,",
  "documentSyncVersion:",
  "hyperglycemicEmergency,",
  "emergencyReason:",
  "initiationFasting,",
  "initiationCasual,",
  "initiationAge,",
  "initiationBmi,",
  "initiationCriteria,",
  "initiationCatabolic,",
  "initiationHypoRisk,",
  "fastingMinimumUsed:",
  "preLunchMinimumUsed:",
  "currentDosePerKg:",
  "automaticEscalationBlocked:",
  "doseSafetyWarning:"
].forEach((token) => assert.ok(sync.includes(token), `Falta payload de validación: ${token}`));

console.log("Drive validation schema contract checks passed");
