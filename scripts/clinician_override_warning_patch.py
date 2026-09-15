from pathlib import Path

path = Path("phase6b-professional-decision.js")
text = path.read_text(encoding="utf-8")

anchor = '''    if (!decision) setReviewStatus("Revisión profesional aún no registrada.", true);
    if (decision === "aceptada") setReviewStatus("✓ Recomendación revisada y aceptada por el profesional.", true);'''
insert = '''    const professionalDosePerKg = safeNumber(data.professionalDosePerKg);
    const hasProfessionalOverbasalization = decision === "modificada"
      && professionalDosePerKg !== null
      && professionalDosePerKg > 0.5;
    if (summary && hasProfessionalOverbasalization) {
      let warning = byId("best-professional-overbasal-warning");
      if (!warning) {
        warning = document.createElement("div");
        warning.id = "best-professional-overbasal-warning";
        warning.setAttribute("role", "note");
        warning.style.marginTop = "10px";
        warning.style.fontWeight = "700";
        warning.style.color = "var(--warning, #8a5a00)";
        summary.appendChild(warning);
      }
      const formatted = professionalDosePerKg.toFixed(2).replace(".", ",");
      warning.textContent = `⚠ Supera 0,5 UI/kg/día (${formatted} UI/kg/día). Excepción registrada por decisión del profesional con justificación clínica.`;
    } else {
      byId("best-professional-overbasal-warning")?.remove();
    }

    if (!decision) setReviewStatus("Revisión profesional aún no registrada.", true);
    if (decision === "aceptada") setReviewStatus("✓ Recomendación revisada y aceptada por el profesional.", true);'''

if anchor not in text:
    raise SystemExit("Professional decision warning anchor not found")
text = text.replace(anchor, insert, 1)
path.write_text(text, encoding="utf-8")
print("Persistent professional dose warning added")
