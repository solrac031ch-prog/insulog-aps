from pathlib import Path
import re

path = Path("phase6b-professional-decision.js")
text = path.read_text(encoding="utf-8")
original = text

text, n = re.subn(
    r"\n  function renderDataQuality\(\) \{.*?\n  \}\n\n  function setReviewStatus",
    "\n\n  function setReviewStatus",
    text,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"Expected one renderDataQuality block, removed {n}")

text, n = re.subn(
    r"\n  function injectDataQualityUI\(\) \{.*?\n  \}\n\n  function injectProfessionalDecisionUI",
    "\n\n  function injectProfessionalDecisionUI",
    text,
    count=1,
    flags=re.S,
)
if n != 1:
    raise SystemExit(f"Expected one injectDataQualityUI block, removed {n}")

for line in [
    "      .best-quality-card { max-width: 760px; }\n",
    "      .best-quality-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 10px; margin-top: 10px; }\n",
    "      .best-quality-chip { display: block; padding: 10px 12px; border-radius: 999px; text-align: center; font-size: .88rem; font-weight: 800; }\n",
    "      .best-quality-chip.is-ok, .best-quality-summary.is-ok { color: #0b6b3a; background: #edf9f2; }\n",
    "      .best-quality-chip.is-pending, .best-quality-summary.is-pending { color: #8a5a00; background: #fff7e5; }\n",
    "      .best-quality-summary { margin: 10px 0 0; padding: 10px 12px; border-radius: 10px; text-align: center; font-size: .86rem; font-weight: 750; }\n",
]:
    if line not in text:
        raise SystemExit(f"Missing expected CSS line: {line.strip()}")
    text = text.replace(line, "", 1)

old_media = "        .best-review-actions.phase6b-actions, .best-quality-grid { grid-template-columns: 1fr; }"
new_media = "        .best-review-actions.phase6b-actions { grid-template-columns: 1fr; }"
if old_media not in text:
    raise SystemExit("Missing expected mobile quality-grid rule")
text = text.replace(old_media, new_media, 1)

if "    injectDataQualityUI();\n" not in text:
    raise SystemExit("Missing injectDataQualityUI call")
text = text.replace("    injectDataQualityUI();\n", "", 1)

listener_block = '''    document.addEventListener("input", (event) => {
      if (event.target.matches("#tabla-seguimiento .ay, #tabla-seguimiento .pre")) renderDataQuality();
    });
    document.addEventListener("change", (event) => {
      if (event.target.id === "tipo-esquema") renderDataQuality();
    });
    renderDataQuality();
'''
if listener_block not in text:
    raise SystemExit("Missing expected data-quality listener block")
text = text.replace(listener_block, "", 1)

forbidden = [
    "renderDataQuality",
    "injectDataQualityUI",
    "best-data-quality",
    "best-quality-fasting",
    "best-quality-pre",
    "best-quality-summary",
]
leftovers = [token for token in forbidden if token in text]
if leftovers:
    raise SystemExit(f"Visual data-quality leftovers: {leftovers}")

required = [
    "function qualitySnapshot()",
    "fastingSufficient:",
    "preLunchSufficient:",
    "qualitySnapshot, canGeneratePatientDocument",
]
missing = [token for token in required if token not in text]
if missing:
    raise SystemExit(f"Clinical/data-audit safeguards were unexpectedly removed: {missing}")

if text == original:
    raise SystemExit("No changes made")

path.write_text(text, encoding="utf-8")
print("Removed redundant data-quality UI; clinical gating preserved.")
