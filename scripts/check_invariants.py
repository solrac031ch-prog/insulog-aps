from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]


def text(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def require(haystack: str, needles, label: str) -> None:
    missing = [needle for needle in needles if needle not in haystack]
    if missing:
        raise SystemExit(f"{label} missing: {missing}")


def forbid(haystack: str, needles, label: str) -> None:
    found = [needle for needle in needles if needle in haystack]
    if found:
        raise SystemExit(f"{label} forbidden: {found}")


html = text("index.html")
runtime_js = text("app-runtime.js")
app = text("app.js")
patient_document_js = text("patient-document.js")
shell_js = text("app-shell.js")
pdf_js = text("pdf-enhancements.js")
pdf_css = text("pdf-enhancements.css")
pdf_design = text("pdf-design-2026.css")
doc_js = text("document-flow.js")
doc_css = text("document-flow.css")
pdf_preview_html = text("pdf-preview.html")
aps_js = text("aps-safety-2026.js")
aps_css = text("aps-safety-2026.css")
pharmacy_js = text("farmacia-popular.js")
pharmacy_css = text("farmacia-popular.css")
sw = text("sw.js")

# HTML shell and navigation.
required_ids = [
    "p0", "p1", "p2", "p3", "p35", "p4", "p41", "p5", "p6", "p7",
    "tratamiento-concomitante-seguimiento", "alerta-hipoglicemia-ada",
    "hipo-ada-titulo", "hipo-ada-descripcion", "hipo-sin-ayuda", "hipo-con-ayuda",
    "ajustar-seguimiento-btn", "peso-paciente", "factor-dosis", "peso-seguimiento",
    "tabla-seguimiento", "nota-clinica", "nombre-paciente", "pdf",
]
missing_ids = [item for item in required_ids if f'id="{item}"' not in html]
if missing_ids:
    raise SystemExit(f"HTML required IDs missing: {missing_ids}")

if len(re.findall(r"<head(?:\s|>)", html, re.I)) != 1 or len(re.findall(r"</head>", html, re.I)) != 1:
    raise SystemExit("index.html must contain exactly one head")

direct_assets = [
    "./app-runtime.js?v=20260910-1",
    "./app.js?v=20260910-1",
    "./patient-document.js?v=20260910-1",
    "./pdf-enhancements.js?v=20260827-4",
    "./aps-safety-2026.js?v=20260910-1",
    "./farmacia-popular.js?v=20260827-4",
    "./document-flow.js?v=20260910-1",
    "./app-shell.js?v=20260910-1",
    "./document-flow.css?v=20260910-1",
    "./aps-safety-2026.css?v=20260827-2",
    "./farmacia-popular.css?v=20260827-2",
]
require(html, direct_assets, "Direct application assets")
require(html, ['id="pdf-preview-frame"', './pdf-preview.html?v=20260910-1', 'imprimirDocumentoAislado()', 'pdf-render-staging'], "Isolated PDF host")
forbid(html, ['href="./pdf-enhancements.css', 'href="./pdf-design-2026.css'], "Parent application PDF styles")
require(pdf_preview_html, ['./styles.css?v=20260826', './pdf-enhancements.css?v=20260827-4', './pdf-design-2026.css?v=20260827-1', './document-flow.css?v=20260910-1', 'id="pdf"'], "Isolated PDF document assets")

script_order = [
    html.index("./app-runtime.js?v=20260910-1"),
    html.index("./app.js?v=20260910-1"),
    html.index("./patient-document.js?v=20260910-1"),
    html.index("./pdf-enhancements.js?v=20260827-4"),
    html.index("./aps-safety-2026.js?v=20260910-1"),
    html.index("./farmacia-popular.js?v=20260827-4"),
    html.index("./document-flow.js?v=20260910-1"),
    html.index("./app-shell.js?v=20260910-1"),
]
if script_order != sorted(script_order):
    raise SystemExit("JavaScript load order must remain runtime -> app -> patient document -> PDF -> APS safety -> pharmacy -> document flow -> shell")

p6_start = html.index('<section id="p6"')
p7_start = html.index('<section id="p7"')
main_end = html.index("</main>", p7_start)
if 'id="pdf"' in html[p6_start:p7_start]:
    raise SystemExit("P6 must contain only document preparation controls")
if 'id="pdf"' in html[p7_start:main_end]:
    raise SystemExit("P7 must not render the printable PDF in the parent document")
if 'id="pdf-preview-frame"' not in html[p7_start:main_end]:
    raise SystemExit("P7 must own the isolated PDF iframe")
if html.index('id="pdf"') < main_end:
    raise SystemExit("The parent #pdf staging node must live outside the application main")

if 'class="aps-safety-box is-hidden"' not in html:
    raise SystemExit("Hypoglycemia review must be hidden directly in HTML")
if html.index('id="alerta-hipoglicemia-ada"') <= html.index('id="ajustar-seguimiento-btn"'):
    raise SystemExit("Hypoglycemia review must appear after the Adjust button")

# Runtime/navigation boundary: infrastructure only, with legacy compatibility during migration.
require(
    runtime_js,
    [
        "let globalData = {", "const $ =", "const qsa =", "function showElement",
        "function nav(pagina)", "function activePageId", "window.InsulogRuntime",
        "navigation: Object.freeze", "state: Object.freeze", "snapshotRuntimeState",
    ],
    "Application runtime boundary",
)
forbid(
    runtime_js,
    ["calcularInicioMejorado", "calcularSeguimientoPro", "calcularAjuste", "MEDICAMENTOS_APS", "generarDocumento"],
    "Runtime clinical leakage",
)
forbid(
    app,
    ["let globalData = {", "const $ =", "const qsa =", "function nav(pagina)",
     "function setupButtonFeedback", "function registerServiceWorker", "DOMContentLoaded"],
    "Legacy app runtime leakage",
)
require(
    patient_document_js,
    ["function generarPDF", "function abrirDocumento", "function generarDocumento", "function bloqueControlFirma"],
    "Patient document builder boundary",
)
forbid(
    patient_document_js,
    ["function calcularInicioMejorado", "function calcularSeguimientoPro", "function calcularAjuste", "MEDICAMENTOS_APS"],
    "Patient document clinical leakage",
)
require(
    shell_js,
    ["window.InsulogRuntime", "function setupButtonFeedback", "function setupAriaPressed",
     "function registerServiceWorker", "function init", "handleInput", "runtime.navigation.go(0)",
     "window.InsulogShell", "DOMContentLoaded"],
    "Application shell boundary",
)
forbid(shell_js, ["globalData", "calcularAjuste", "MEDICAMENTOS_APS", "generarDocumento"], "Shell clinical leakage")

# Core clinical invariants. These protect accidental refactors; intentional clinical changes
# must update both the implementation and this contract in the same reviewed PR.
require(
    app,
    [
        "function redondearPar", "Math.ceil(valor / 2) * 2",
        "function calcularInicioMejorado", "function analizarGlicemias",
        "function calcularAjuste", "ayunasRaw.length < 3", "preonceRaw.length >= 3",
        "function dosisSegundaDosis", "Math.min(10, Math.max(4, pesoKg * 0.1))",
        "function calcularSeguimientoPro", "dosisKg >= 1", "dosisKg >= 0.7",
    ],
    "Core clinical invariants",
)

# APS safety/formulary is the source of truth.
require(
    aps_js,
    [
        "sobreinsulinización", "HIPOGLICEMIA NIVEL 3", "Promedio capilar global del registro",
        "evaluarHipoglicemiaADA", "firmaRegistroGlicemias", "mostrarRevisionHipoglicemia",
        "resolverRevisionHipoglicemia", "revisionHipo", "hipo-sin-ayuda", "hipo-con-ayuda",
        "insertarPaginaTratamientoInicio", 'page.id = "p25"', "definirEsquemaInicioConTratamiento",
        "enriquecerTratamientoSeguimiento", "NOTA_EFICACIA", "activarSelectoresDosis",
        "sincronizarSelectorDosis", "Precauciones / evitar",
        'label: "Empagliflozina"',
        'doses: ["10 mg/día", "12,5 mg/día", "25 mg/día"]',
        'doses: ["12,5/850 mg/día", "12,5/1.000 mg/día"]',
        'doses: ["50/500 mg", "50/850 mg", "50/1.000 mg"]',
        'groups: ["metformina-simple"]', 'groups: ["sglt2"]',
        'value: "vildaMet"', 'groups: ["vildagliptina"]',
        "comparteGrupo", "desmarcarConflictos", "Disponible en APS", "Otras opciones / compra particular",
    ],
    "APS safety/formulary invariants",
)
forbid(
    aps_js,
    [
        'addEventListener("input"', '.glicemia")) actualizar',
        'groups: ["vildagliptina", "metformina-simple"]',
        "no es una tabla de titulación", "No incluida en ADA Table 9.3", "uso local",
        "adaptación local", "esquema local", "NOTA_DOSIS", "NOTA_ARSENAL",
        "Insulog evita duplicar metforminas simples, iSGLT2 y vildagliptina.",
    ],
    "APS safety/formulary",
)
require(
    aps_css,
    [
        ".aps-hypo-actions", ".aps-hypo-question", ".aps-safety-box",
        ".aps-med-copy", ".aps-med-efficacy", ".aps-med-dose-row", ".aps-med-dose",
        ".aps-med-safety", ".aps-efficacy-note", ".aps-med-section-title", "#p25",
    ],
    "APS clinical UI styling",
)

# Patient document contract.
require(
    pdf_js,
    [
        "PAUTAS_PACIENTE", "actualizarDosisInsulinaPaciente", "actualizarTratamientoPaciente",
        "Dosis AM:", "antes del desayuno", "Dosis PM:", "antes de dormir",
        "Medicamentos para la diabetes", "comprimido", "pdf-carta-una-pagina",
        "marcarEstructuraCarta", "pdf-firma-control", "pdf-doc-footer",
    ],
    "Patient PDF layer",
)
require(
    pdf_css,
    [
        "size: Letter portrait", "margin: 0.35cm", ".pdf-carta-una-pagina",
        ".pdf-insulina-paciente", ".pdf-medicamentos-paciente", ".pdf-indicaciones",
        ".pdf-firma-control", ".pdf-doc-footer", "page-break-inside: avoid !important",
        "break-inside: avoid-page !important",
    ],
    "Letter PDF styling",
)
forbid(pdf_css, ["overflow: hidden"], "PDF clipping")
require(doc_js, ["mostrarDocumento", "volverPreparacionDocumento", "nav(7)", "pdf-preview-frame", "copiarVistaPreviaAlFrame", "imprimirDocumentoAislado", "contentDocument", "queueMicrotask"], "P6/P7 isolated document flow")
require(doc_css, ["@media print", "#p7", ".pdf-preview-frame", ".pdf-render-staging", "body.pdf-isolated-document"], "Document-flow print isolation")
require(pdf_design, ["@page"], "PDF design page contract")

# Farmacia Popular remains a presentation/data concern, not a clinical-calculation input.
require(
    pharmacy_js,
    [
        "./data/farmacia-cerro-navia.json", 'cache: "no-store"',
        "metformina500", "metformina750", "empagliflozina", "empaMet12_5_1000", "vildaMet",
    ],
    "Farmacia Popular integration",
)
require(pharmacy_css, [".farmacia-popular"], "Farmacia Popular styling")

# PWA responsibility: cache/offline only. Never rewrite clinical JavaScript at runtime.
forbid(sw, ["normalizarAsset", "respuestaTexto"], "Service-worker runtime transformations")
require(
    sw,
    [
        'const CACHE_NAME = "insulog-shell-20260910-atomic18"',
        'const DEPLOYMENT_REVISION = "runtime-navigation-20260910-r1"',
        'new Request(asset, { cache: "reload" })',
        'addEventListener("fetch"', 'caches.delete',
        'event.waitUntil(refreshNavigation.catch(() => undefined))',
        'event.waitUntil(refreshAsset.catch(() => undefined))', "fetchFresh",
        'const PDF_PREVIEW_PATH = "./pdf-preview.html?v=20260910-1"',
        'url.pathname.endsWith("/pdf-preview.html")', 'cache.match(navigationAsset)',
    ],
    "PWA invariants",
)
require(
    sw,
    [
        "./index.html", "./styles.css?v=20260826", "./app-runtime.js?v=20260910-1",
        "./app.js?v=20260910-1", "./patient-document.js?v=20260910-1",
        "./pdf-preview.html?v=20260910-1", "./pdf-enhancements.js?v=20260827-4", "./aps-safety-2026.js?v=20260910-1",
        "./farmacia-popular.js?v=20260827-4", "./document-flow.js?v=20260910-1", "./app-shell.js?v=20260910-1",
    ],
    "Critical cached app-shell assets",
)

if "followup-flow-2026.js" in html or "followup-flow-2026.js" in sw:
    raise SystemExit("Broken dynamic follow-up flow must not return")

# Privacy: identifiable patient clinical state must remain ephemeral in browser memory.
runtime = "\n".join([runtime_js, app, patient_document_js, pdf_js, doc_js, aps_js, pharmacy_js, shell_js])
forbid(runtime, ["localStorage", "sessionStorage", "indexedDB"], "Patient data persistence")

print("Insulog application, clinical, pharmacy, PDF, privacy and PWA invariants passed")
