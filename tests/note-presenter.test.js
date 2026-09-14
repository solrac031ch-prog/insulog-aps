"use strict";

const assert = require("node:assert/strict");
const presenter = require("../note-presenter.js");

assert.equal(presenter.escapeHTML(`<script>"x" & 'y'</script>`), "&lt;script&gt;&quot;x&quot; &amp; &#039;y&#039;&lt;/script&gt;");
assert.equal(presenter.classifyLine("ALERTA DOSIS ALTA (>0.7 UI/kg):"), "nota-roja");
assert.equal(presenter.classifyLine("Hipoglicemia nivel 1"), "nota-roja");
assert.equal(presenter.classifyLine("HbA1c estimada a 90 días: 7.0%"), "nota-verde");
assert.equal(presenter.classifyLine("HbA1c estimada a 90 días: 8.5%"), "nota-amarilla");
assert.equal(presenter.classifyLine("HbA1c estimada a 90 días: 9.0%"), "nota-roja");
assert.equal(presenter.classifyLine("Nuevo Esquema sugerido: AM 10 UI | PM 4 UI"), "nota-azul");
assert.equal(presenter.classifyLine("Esquema actual: AM 8 UI | PM 4 UI"), "nota-gris");
assert.equal(presenter.classifyLine("Texto neutro"), "");

const text = `Promedios usados: Ayunas 150 | Pre-once N/A
HbA1c estimada a 90 días si mantiene este patrón: 6.9%
Nuevo Esquema sugerido: AM 0 UI | PM 22 UI

ALERTA DOSIS ALTA (>0.7 UI/kg):`;

assert.equal(
  presenter.toHTML(text),
  `<span class="nota-linea nota-gris">Promedios usados: Ayunas 150 | Pre-once N/A</span>` +
    `<span class="nota-linea nota-verde">HbA1c estimada a 90 días si mantiene este patrón: 6.9%</span>` +
    `<span class="nota-linea nota-azul">Nuevo Esquema sugerido: AM 0 UI | PM 22 UI</span>` +
    `<span class="nota-linea">&nbsp;</span>` +
    `<span class="nota-linea nota-roja">ALERTA DOSIS ALTA (&gt;0.7 UI/kg):</span>`
);

assert.equal(Object.isFrozen(presenter), true, "El presenter debe exponer una API inmutable");

console.log("Note presenter exact regression checks passed");
