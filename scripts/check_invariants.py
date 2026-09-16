from pathlib import Path
import re

from app_shell_release import compute_release

ROOT = Path(__file__).resolve().parents[1]
RELEASE = compute_release()


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

# Phase 7 visual contract.
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

# Phase 7B clinical UX.
require(
    html,
    [
        "Apoyo clínico · DM2 en APS", "Seguridad · antes de usar el algoritmo",
        "Elegir flujo · inicio o seguimiento", "Inicio · dosis NPH",
        "Seguimiento · registro de HGT", "Resultado · nota clínica",
        "Documento · datos del paciente", "Documento · vista previa",
        'class="clinical-check-card text-left"', 'class="card card-blue text-left compact-card guidance-details"',
        'class="table-guide text-left"', 'class="sr-only">Registro de glicemias para ajuste de insulina NPH',
        'class="btn btn-narrow secondary-nav"',
    ],
    "Phase 7B screen hierarchy",
)
require(
    styles,
    [
        ".hero-note", ".evidence-card", ".clinical-check-card", ".condition-list",
        ".guidance-details", ".followup-setup-card", ".table-guide", ".th-unit",
        ".secondary-nav", "#p25 .page-label::after", "overflow-x: visible", "table-layout: fixed",
    ],
    "Phase 7B screen polish styles",
)


def asset(path: str) -> str:
    return f"./{path}?v={RELEASE}"


direct_assets = [
    asset("app-runtime.js"),
    asset("clinical-engine.js"),
    asset("app.js"),
    asset("patient-document.js"),
    asset("pdf-enhancements.js"),
    asset("aps-safety-2026.js"),
    asset("farmacia-popular.js"),
    asset("document-flow.js"),
    asset("app-shell.js"),
    asset("document-flow.css"),
    asset("aps-safety-2026.css"),
    asset("farmacia-popular.css"),
]
require(html, direct_assets + [asset("styles.css")], "Direct application assets")
require(html, ['id="pdf-preview-frame"', asset("pdf-preview.html"), 'pdf-render-staging'], "Isolated PDF host")
forbid(html, ['href="./pdf-enhancements.css', 'href="./pdf-design-2026.css'], "Parent application PDF styles")
require(
    pdf_preview_html,
    [asset("document-flow.css"), asset("pdf-enhancements.css"), asset("pdf-design-2026.css"), 'id="pdf"'],
    "Isolated PDF document assets",
)
forbid(pdf_preview_html, ['href="./styles.css'], "Isolated PDF global application stylesheet")
if pdf_preview_html.index(asset("pdf-design-2026.css")) < pdf_preview_html.index(asset("document-flow.css")):
    raise SystemExit("PDF design must load after document-flow.css and remain the final visual authority")

script_order = [html.index(item) for item in direct_assets[:9]]
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

# Pure clinical engine: protect the current APS-NPH-2026 r2 contract.
require(
    clinical_engine,
    [
        "InsulogClinicalEngine", "TARGET_PROFILES", "function roundUnits", "Math.round(value)",
        "function suggestInitialScheme", "hba1cValue > 10", "containsAcuteEmergency", "Unidad de Emergencia Hospitalaria",
        "function assessInsulinSensitivity", "bmiValue < 20", "egfrValue < 60", "ageValue > 70", "bmiValue >= 30",
        "function calculateInitialDose", 'scheme !== "doble_dosis" && safeFactor > 0.2',
        "function detectDiscordantHighs", "function analyzeGlucose", "hypoglycemiaLevel2", "minimum < 54", "minimum < 70",
        "function classifyHypoglycemia", "requiredAssistance", "urgent: true",
        "function calculateAdjustment", "analysis.min", "analysis.hipo ? -20 : -10", "percent = 10", "percent = 20",
        "function assessDoseSafety", "dosePerKg >= 0.5", "dosePerKg >= 0.4",
        "requiresHighDoseReview", "blocksAutomaticEscalation", "automaticEscalationBlocked",
        "function calculateFollowup", "preLunchValues", "preElevenValues", "se bloqueó el aumento automático",
    ],
    "Pure clinical engine r2 invariants",
)
forbid(
    clinical_engine,
    [
        "document", "querySelector", "runtimeState", "localStorage", "sessionStorage", "indexedDB", "InsulogRuntime",
        "hba1c > 9", "hba1c >= 11", "dosePerKg >= 0.7", "dosePerKg >= 1", "hipoSevera",
        "analysis.promedio < 80", "analysis.promedio <= 130", "analysis.promedio <= 180",
    ],
    "Pure clinical engine browser coupling or retired clinical rules",
)

# App adapter: local implementation registered as named actions, no legacy globals.
require(
    app,
    [
        "const runtime = window.InsulogRuntime", "const clinicalEngine = window.InsulogClinicalEngine",
        "const state = runtime.state", "const actions = runtime.actions",
        "clinicalEngine.suggestInitialScheme", "clinicalEngine.calculateInitialDose", "clinicalEngine.calculateFollowup",
        "ayunasRaw.length < 3", "3 glicemias pre-almuerzo", "meta-hba1c-seguimiento",
        "resultado.blocksAutomaticEscalation", "minAy", "minPre",
        'actions.register("define-initial-scheme"', 'actions.register("calculate-initial"',
        'actions.register("prepare-followup"', 'actions.register("calculate-followup"',
        'actions.register("generate-high-dose-note"', 'actions.register("finish"',
        "window.InsulogApp",
    ],
    "Clinical UI adapter r2 invariants",
)
forbid(
    app,
    [
        "globalData", "function nav(", "function redondearPar", "function analizarGlicemias",
        "function calcularAjuste", "function dosisSegundaDosis", "window.calcular", "window.generar",
        "resultado.dosisKg >= 0.7", "resultado.dosisKg >= 1", "hba1cEstimada", "nivel3-referido",
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
        "Vía Clínica MINSAL DM2 2026", "Protocolo de Insulinización MINSAL 2022", "function bloqueControlFirma", "pdf-doc-title", "pdf-patient-row",
        "pdf-firma-control", "Registro de control - 15 días",
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
        'pdf-insulina-etiqueta\">AM', "antes del desayuno", 'pdf-insulina-etiqueta\">PM', "antes de dormir",
        "Medicamentos para la diabetes", "comprimido", "pdf-carta-una-pagina",
        "marcarEstructuraCarta", "pdf-firma-control", "pdf-doc-footer", "pdf-contenido-extenso",
    ],
    "Patient PDF enhancer",
)
forbid(pdf_js, ["globalData", "window.generarDocumento", "generarDocumentoBase"], "PDF global wrapper")

# Phase 8C PDF: structure and visual authority are deliberately separated.
require(
    pdf_css,
    [
        ".pdf-carta-una-pagina", ".pdf-insulina-pautas", ".pdf-clean-list",
        ".tabla-registro-hgt", ".col-fecha", ".col-hora-medicion", ".col-hgt",
    ],
    "Patient PDF structural styling",
)
forbid(pdf_css, ["@media print", "overflow: hidden"], "PDF structural layer must not compete with print design")
require(
    pdf_design,
    [
        "size: Letter portrait", "margin: 0.38in 0.42in", ".pdf-carta-una-pagina",
        ".pdf-doc-header", ".pdf-doc-title", ".pdf-patient-row", ".pdf-insulina-paciente",
        ".pdf-medicamentos-paciente", ".pdf-indicaciones", ".pdf-firma-control", ".pdf-doc-footer",
        ".tabla-registro-hgt thead", "display: table-header-group", "height: 18.5px",
        ".pdf-contenido-extenso", "break-inside: auto",
    ],
    "Readable Letter PDF styling",
)
forbid(
    pdf_design,
    ["overflow: hidden", "height: 16.4px", "height: 17.2px", "font-size: 9.4px", "zoom:", "width: 108.7%"],
    "PDF clipping or compression",
)

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
require(doc_css, ["@media print", ".pdf-preview-frame", ".pdf-render-staging", "body.pdf-isolated-document"], "Document-flow print isolation")
forbid(doc_css, [".pdf-insulina-paciente", ".tabla-registro-hgt", "height: 16.4px", "height: 17.2px"], "Document-flow visual leakage")

# Shell: one delegated click listener dispatches declarative actions and injects r2 controls.
require(
    shell_js,
    [
        "const runtime = window.InsulogRuntime", "const app = window.InsulogApp", "const actions = runtime.actions",
        "function setupActionDelegation", 'closest("[data-action]")', "actions.invoke(action, { element, event })",
        "document.addEventListener(\"input\", app.inputs.handle)", "function registerServiceWorker",
        'updateViaCache: "none"', "registration.update()", "injectClinicalR2Controls",
        "meta-hba1c-seguimiento", "edad-inicio", "imc-inicio", "vfg-inicio",
        "runtime.navigation.go(0)", "window.InsulogShell", "DOMContentLoaded",
    ],
    "Application shell boundary",
)
forbid(shell_js, ["globalData", "typeof handleInput", "calcularAjuste", "MEDICAMENTOS_APS", "generarDocumento"], "Shell leakage")

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

# Phase 8D/8E PWA: shell is immutable and all versioning comes from one fingerprint.
forbid(
    sw,
    [
        "normalizarAsset", "respuestaTexto", "skipWaiting()", "clients.claim()",
        "refreshNavigation", "refreshAsset", "event.waitUntil(refresh",
    ],
    "Service-worker runtime mutations",
)
require(
    sw,
    [
        f'const CACHE_NAME = "insulog-shell-{RELEASE}"',
        f'const DEPLOYMENT_REVISION = "release-{RELEASE}"',
        'new Request(asset, { cache: "reload" })', "precacheFreshShell",
        'event.waitUntil(precacheFreshShell())', 'addEventListener("fetch"', 'caches.delete',
        f'const PDF_PREVIEW_PATH = "./pdf-preview.html?v={RELEASE}"',
        'url.pathname.endsWith("/pdf-preview.html")', 'cache.match(navigationAsset)',
        "SHELL_ASSET_BY_PATH", "cache.match(shellAsset)",
    ],
    "Immutable PWA invariants",
)
require(
    sw,
    [
        "./index.html", asset("styles.css"), asset("app-runtime.js"), asset("clinical-engine.js"),
        asset("app.js"), asset("patient-document.js"), asset("pdf-preview.html"), asset("document-flow.css"),
        asset("pdf-enhancements.css"), asset("pdf-design-2026.css"), asset("pdf-enhancements.js"),
        asset("aps-safety-2026.js"), asset("farmacia-popular.js"), asset("document-flow.js"), asset("app-shell.js"),
    ],
    "Critical cached app-shell assets",
)

version_tokens = set()
for source in (html, pdf_preview_html, sw):
    version_tokens.update(re.findall(r"\?v=([A-Za-z0-9._-]+)", source))
if version_tokens != {RELEASE}:
    raise SystemExit(f"Mixed app-shell release tokens: expected {RELEASE}, found {sorted(version_tokens)}")

if "followup-flow-2026.js" in html or "followup-flow-2026.js" in sw:
    raise SystemExit("Broken dynamic follow-up flow must not return")

# Privacy: identifiable patient clinical state remains ephemeral in browser memory.
runtime_sources = "\n".join([runtime_js, clinical_engine, app, patient_document_js, pdf_js, doc_js, aps_js, pharmacy_js, shell_js])
forbid(runtime_sources, ["localStorage", "sessionStorage", "indexedDB"], "Patient data persistence")

print(f"Insulog release {RELEASE}: immutable shell, readable PDF, clinical engine r2, pharmacy and privacy invariants passed")
