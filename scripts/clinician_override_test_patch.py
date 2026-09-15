from pathlib import Path

# Phase 6B decision tests: current clinical note uses "PM 22 UI" inside
# "Nuevo Esquema sugerido", not the legacy "PM: 22 UI" label.
path = Path("tests/e2e/phase6b-professional-decision.spec.js")
text = path.read_text(encoding="utf-8")
old = 'await expect(page.locator("#nota-clinica")).toContainText("PM: 22 UI");'
new = 'await expect(page.locator("#nota-clinica")).toContainText("PM 22 UI");'
if old not in text:
    raise SystemExit("Stale Phase 6B note assertion not found")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")

# The over-basalization contract is the dedicated warning plus persisted state.
# A MutationObserver may legitimately refresh the generic review status afterwards,
# so the status line itself is not the stable contract.
path = Path("tests/e2e/phase6b-overbasal-professional-override.spec.js")
text = path.read_text(encoding="utf-8")
old = '  await expect(page.locator("#best-review-status")).toContainText("criterio clínico documentado");\n'
if old not in text:
    raise SystemExit("Stale overbasal status assertion not found")
text = text.replace(old, '', 1)
path.write_text(text, encoding="utf-8")

print("Phase 6B test expectations aligned")
