"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");

const bridge = fs.readFileSync("google-apps-script/Code.gs", "utf8");
const sync = fs.readFileSync("phase6b-document-sync.js", "utf8");

[
  '"2026.09.23-schema-v8"',
  '"Recomendación NPH AM (UI)"',
  '"Recomendación NPH PM (UI)"',
  '"Decisión final NPH AM (UI)"',
  '"Decisión final NPH PM (UI)"',
  '"Meta HbA1c (%)"',
  '"HGT ayunas utilizados"',
  '"HGT pre-almuerzo utilizados"',
  "recommendedAm",
  "recommendedPm",
  "finalAm",
  "finalPm",
  "serializeGlucoseValues_(payload.fastingValues)",
  "serializeGlucoseValues_(payload.preLunchValues)"
].forEach((token) => assert.ok(bridge.includes(token), `Falta contrato Drive: ${token}`));

[
  "fastingValues,",
  "preLunchValues,",
  'targetA1c: tipo === "seguimiento" ? safeNumber(data.targetA1c) : null',
  "recommendedAm,",
  "recommendedPm,",
  "finalAm,",
  "finalPm,"
].forEach((token) => assert.ok(sync.includes(token), `Falta payload de validación: ${token}`));

console.log("Drive validation schema contract checks passed");
