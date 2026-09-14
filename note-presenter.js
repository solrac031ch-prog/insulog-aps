"use strict";

(function exposeNotePresenter(root, factory) {
  const presenter = factory();

  if (typeof module === "object" && module.exports) {
    module.exports = presenter;
  }

  if (root) {
    root.InsulogNotePresenter = presenter;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function escapeHTML(text = "") {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function classifyLine(line = "") {
    const lower = String(line).toLowerCase();

    if (lower.includes("alerta") || lower.includes("hipoglicemia") || lower.includes("<54") || lower.includes("<70") || lower.includes("suspensión")) {
      return "nota-roja";
    }

    if (lower.includes("hba1c estimada")) {
      const value = parseFloat(String(line).replace(",", ".").match(/[\d.]+/)?.[0]);
      if (!Number.isNaN(value)) {
        if (value <= 7) return "nota-verde";
        if (value < 9) return "nota-amarilla";
        return "nota-roja";
      }
    }

    if (lower.includes("nuevo esquema") || lower.includes("dosis sugerida")) return "nota-azul";
    if (lower.includes("esquema actual") || lower.includes("promedios usados") || lower.includes("promedio global")) return "nota-gris";
    return "";
  }

  function toHTML(text = "") {
    return String(text)
      .split("\n")
      .map((line) => {
        const className = classifyLine(line);
        const content = escapeHTML(line) || "&nbsp;";
        return `<span class="nota-linea${className ? ` ${className}` : ""}">${content}</span>`;
      })
      .join("");
  }

  return Object.freeze({ escapeHTML, classifyLine, toHTML });
});
