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
styles = text("styles.css")
runtime_js = text("app-runtime.js")
clinical_engine = text("clinical-engine.js")
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

# HTML shell: declarative actions only, no inline JavaScript.
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

forbid(html, ["onclick=", "onchange=", "oninput="], "Inline JavaScript handlers")
require(
    html,
    [
        'data-action="navigate"', 'data-action="exclude"', 'data-action="show-initial-criteria"',
        'data-action="toggle-selection"', 'data-action="define-initial-scheme"',
        'data-action="calculate-initial"', 'data-action="prepare-followup"',
        'data-action="calculate-followup"', 'data-action="toggle-high-dose-action"',
        'data-action="generate-high-dose-note"', 'data-action="copy-note"',
        'data-action="open-document"', 'data-action="show-document"',
        'data-action="back-document"', 'data-action="print-document"', 'data-action="finish"',
    ],
    "Declarative UI actions",
)

# Phase 7 visual contract: one responsive app stylesheet, touch-sized controls, no mobile page chrome.
require(
    styles,
    [
        "--page-inline:", "--radius-lg:", "min-height: 50px", "min-height: 48px",
        ".selection-btn::after", ".tracking-table tbody tr:focus-within",
        "@media (max-width: 760px)", "min-height: 100vh", "border-radius: 0",
        "@media (prefers-reduced-motion: reduce)",
    ],
    "Phase 7 mobile UI foundation",
)
forbid(styles, ["overflow-x: scroll !important", "zoom:"], "Mobile UI distortion workarounds")

direct_assets = [
    "./app-runtime.js?v=20260910-2",
    "./clinical-engine.js?v=20260910-3",
    "./app.js?v=20260910-4",
    "./patient-document.js?v=20260910-2",
    "./pdf-enhancements.js?v=20260910-5",
    "./aps-safety-2026.js?v=20260910-3",
    "./farmacia-popular.js?v=20260827-4",
    "./document-flow.js?v=20260910-2",
    "./app-shell.js?v=20260910-2",
    "./document-flow.css?v=20260910-1",
    "./aps-safety-2026.css?v=20260827-2",
    "./farmacia-popular.css?v=20260827-2",
]
require(html, direct_assets + ["./styles.css?v=20260910-1"], "Direct application assets")
require(html, ['id="pdf-preview-frame"', './pdf-preview.html?v=20260910-1', 'pdf-render-staging'], "Isolated PDF host")
forbid(html, ['href="./pdf-enhancements.css', 'href="./pdf-design-2026.css'], "Parent application PDF styles")
require(pdf_preview_html, ['./styles.css?v=20260910-1', './pdf-enhancements.css?v=20260827-4', './pdf-design-2026.css?v=20260827-1', './document-flow.css?v=20260910-1', 'id="pdf"'], "Isolated PDF document assets")

script_order = [html.index(asset) for asset in direct_assets[:9]]
if script_order != sorted(script_order):
    raise SystemExit("JavaScript load order must remain runtime -> clinical engine -> app -> patient document -> PDF -> APS safety -> pharmacy -> document flow -> shell")

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

# Runtime: private ephemeral state + explicit action registry.
require(
    runtime_js,
    [
        "let runtimeState", "const actionHandlers = new Map()", "function activePageId", "function go(pagina)",
        "function snapshotState", "function patchState", "function replaceState", "function resetState",
        "function registerAction", "function decorateAction", "function invokeAction", "function hasAction",
        "window.InsulogRuntime", "actions: Object.freeze", "state: Object.freeze",
    ],
    "Application runtime boundary",
)
forbid(
    runtime_js,
    [
        "let globalData", "const $ =", "const qsa =", "function nav(",
        "calcularInicioMejorado", "calcularSeguimientoPro", "calculateFollowup", "MEDICAMENTOS_APS", "generarDocumento",
    ],
    "Runtime leakage",
)

# Pure clinical engine remains independent from browser state.
require(
    clinical_engine,
    [
        "InsulogClinicalEngine", "function roundEven", "Math.ceil(value / 2) * 2",
        "function suggestInitialScheme", "hba1c > 9", "hba1c >= 11", "fasting > 250", "fasting >= 250",
        "function calculateInitialDose", "total * 0.66",
        "function detectDiscordantHighs", "function analyzeGlucose", "value < 54", "value < 70",
        "function classifyHypoglycemia", "requiredAssistance", "minimum < 54",
        "function calculateAdjustment", "analysis.promedio < 80", "analysis.promedio <= 130", "analysis.promedio <= 180",
        "function calculateSecondDose", "Math.min(10, Math.max(4, weightKg * 0.1))",
        "function assessDoseSafety", "dosePerKg >= 1", "dosePerKg >= 0.7",
        "requiresHighDoseReview", "blocksAutomaticEscalation",
        "function calculateFollowup", "preElevenValues.length >= 3",
    ],
    "Pure clinical engine invariants",
)
forbid(
    clinical_engine,
    ["document", "querySelector", "runtimeState", "localStorage", "sessionStorage", "indexedDB", "InsulogRuntime"],
    "Pure clinical engine browser coupling",
)

# App adapter: local implementation registered as named actions, no legacy globals.
require(
    app,
    [
        "const runtime = window.InsulogRuntime", "const clinicalEngine = window.InsulogClinicalEngine",
        "const state = runtime.state", "const actions = runtime.actions",
        "clinicalEngine.suggestInitialScheme", "clinicalEngine.calculateInitialDose", "clinicalEngine.calculateFollowup",
        "ayunasRaw.length < 3", "resultado.requiresHighDoseReview",
        'actions.register("define-initial-scheme"', 'actions.register("calculate-initial"',
        'actions.register("prepare-followup"', 'actions.register("calculate-followup"',
        'actions.register("generate-high-dose-note"', 'actions.register("finish"',
        "window.InsulogApp",
    ],
    "Clinical UI adapter invariants",
)
forbid(
    app,
    [
        "globalData", "function nav(", "function redondearPar", "function analizarGlicemias",
        "function calcularAjuste", "function dosisSegundaDosis", "window.calcular", "window.generar",
        "resultado.dosisKg >= 0.7", "resultado.dosisKg >= 1",
    ],
    "Legacy app globals or duplicated clinical thresholds",
)

# APS safety: compose through the action registry, never monkey-patch window functions.
require(
    aps_js,
    [
        "const runtime = window.InsulogRuntime", "const app = window.InsulogApp",
        "clinicalEngine.classifyHypoglycemia", "const state = runtime.state", "const actions = runtime.actions",
        'actions.decorate("define-initial-scheme"', 'actions.decorate("calculate-initial"',
        'actions.decorate("prepare-followup"', 'actions.decorate("calculate-followup"',
        'actions.decorate("generate-high-dose-note"', "actions.invoke(\"calculate-followup\")",
        "sobreinsulinización", "HIPOGLICEMIA NIVEL 3", "Promedio capilar global del registro",
        "evaluarHipoglicemiaADA", "firmaRegistroGlicemias", "mostrarRevisionHipoglicemia",
        "resolverRevisionHipoglicemia", "insertarPaginaTratamientoInicio", 'page.id = "p25"',
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
        "globalData", "window.definirEsquemaInicio", "window.calcularInicioMejorado", "window.prepSeg",
        "window.calcularSeguimientoPro", "window.generarNotaDosisAlta", "window.generarDocumento",
        "function detectarDiscordantes", "analizarGlicemiasSinExcluir", "window.analizarGlicemias",
        "const valoresHipo = valores.filter", 'addEventListener("input"',
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

# Patient document API and enhancer pipeline.
require(
    patient_document_js,
    [
        "const runtime = window.InsulogRuntime", "const enhancers = []", "function useEnhancer",
        "function generarDocumento", "state.snapshot()", "enhancers.forEach", "window.InsulogDocuments",
        "ADA 2026", "function bloqueControlFirma",
    ],
    "Patient document builder boundary",
)
forbid(
    patient_document_js,
    ["globalData", "function abrirDocumento", "window.generarDocumento", "window.abrirDocumento", "function nav("],
    "Patient document legacy globals",
)

require(
    pdf_js,
    [
        "const documents = window.InsulogDocuments", 'documents.useEnhancer("patient-pdf-enhancements"',
        "PAUTAS_PACIENTE", "actualizarDosisInsulinaPaciente", "actualizarTratamientoPaciente",
        "Dosis AM:", "antes del desayuno", "Dosis PM:", "antes de dormir",
        "Medicamentos para la diabetes", "comprimido", "pdf-carta-una-pagina",
        "marcarEstructuraCarta", "pdf-firma-control", "pdf-doc-footer",
    ],
    "Patient PDF enhancer",
)
forbid(pdf_js, ["globalData", "window.generarDocumento", "generarDocumentoBase"], "PDF global wrapper")
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

# Document flow: explicit actions + document API, no window replacement.
require(
    doc_js,
    [
        "const runtime = window.InsulogRuntime", "const documents = window.InsulogDocuments",
        'actions.register("open-document"', 'actions.register("show-document"',
        'actions.register("back-document"', 'actions.register("print-document"',
        'actions.decorate("finish"', "documents.generate(tipo)", "go(7)",
        "copiarVistaPreviaAlFrame", "contentDocument", "queueMicrotask", "frame.contentWindow?.print()",
    ],
    "P6/P7 isolated document flow",
)
forbid(
    doc_js,
    ["globalData", "window.abrirDocumento", "window.mostrarDocumento", "window.volverPreparacionDocumento", "window.imprimirDocumentoAislado", "window.finalizar", "window.generarDocumento", "function nav("],
    "Document-flow legacy globals",
)
require(doc_css, ["@media print", "#p7", ".pdf-preview-frame", ".pdf-render-staging", "body.pdf-isolated-document"], "Document-flow print isolation")
require(pdf_design, ["@page"], "PDF design page contract")

# Shell: one delegated click listener dispatches declarative actions.
require(
    shell_js,
    [
        "const runtime = window.InsulogRuntime", "const app = window.InsulogApp", "const actions = runtime.actions",
        "function setupActionDelegation", 'closest("[data-action]")', "actions.invoke(action, { element, event })",
        "document.addEventListener(\"input\", app.inputs.handle)", "function registerServiceWorker",
        "runtime.navigation.go(0)", "window.InsulogShell", "DOMContentLoaded",
    ],
    "Application shell boundary",
)
forbid(shell_js, ["globalData", "typeof handleInput", "calcularAjuste", "calculateFollowup", "MEDICAMENTOS_APS", "generarDocumento"], "Shell leakage")

# Only namespaced window exports are allowed in application layers.
application_js = "\n".join([runtime_js, app, patient_document_js, pdf_js, aps_js, pharmacy_js, doc_js, shell_js])
window_assignments = set(re.findall(r"window\.([A-Za-z_$][\w$]*)\s*=", application_js))
allowed_window_exports = {"InsulogRuntime", "InsulogApp", "InsulogDocuments", "InsulogShell"}
unexpected_exports = sorted(window_assignments - allowed_window_exports)
if unexpected_exports:
    raise SystemExit(f"Unexpected window exports: {unexpected_exports}")

# Farmacia Popular remains presentation/data only.
require(
    pharmacy_js,
    [
        "./data/farmacia-cerro-navia.json", 'cache: "no-store"',
        "metformina500", "metformina750", "empagliflozina", "empaMet12_5_1000", "vildaMet",
    ],
    "Farmacia Popular integration",
)
require(pharmacy_css, [".farmacia-popular"], "Farmacia Popular styling")

# PWA responsibility: cache/offline only, with a fresh shell for Phase 7 styles.
forbid(sw, ["normalizarAsset", "respuestaTexto"], "Service-worker runtime transformations")
require(
    sw,
    [
        'const CACHE_NAME = "insulog-shell-20260910-atomic23"',
        'const DEPLOYMENT_REVISION = "phase7-mobile-ui-20260910-r1"',
        'new Request(asset, { cache: "reload" })', 'addEventListener("fetch"', 'caches.delete',
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
        "./index.html", "./styles.css?v=20260910-1", "./app-runtime.js?v=20260910-2",
        "./clinical-engine.js?v=20260910-3", "./app.js?v=20260910-4", "./patient-document.js?v=20260910-2",
        "./pdf-preview.html?v=20260910-1", "./pdf-enhancements.js?v=20260910-5", "./aps-safety-2026.js?v=20260910-3",
        "./farmacia-popular.js?v=20260827-4", "./document-flow.js?v=20260910-2", "./app-shell.js?v=20260910-2",
    ],
    "Critical cached app-shell assets",
)

if "followup-flow-2026.js" in html or "followup-flow-2026.js" in sw:
    raise SystemExit("Broken dynamic follow-up flow must not return")

# Privacy: identifiable patient clinical state remains ephemeral in browser memory.
runtime_sources = "\n".join([runtime_js, clinical_engine, app, patient_document_js, pdf_js, doc_js, aps_js, pharmacy_js, shell_js])
forbid(runtime_sources, ["localStorage", "sessionStorage", "indexedDB"], "Patient data persistence")

print("Insulog Phase 7 mobile UI, action registry, clinical engine, pharmacy, PDF, privacy and PWA invariants passed")