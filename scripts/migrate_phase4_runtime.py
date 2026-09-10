from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


# app.js: remove runtime/navigation definitions and application bootstrap.
app = read("app.js")
runtime_start = app.index("let globalData = {")
clinical_start = app.index("function exclusion()", runtime_start)
app = app[:runtime_start] + app[clinical_start:]

# Extract patient document construction verbatim so no clinical/document wording is rewritten.
doc_start = app.index("function generarPDF(")
doc_end = app.index("function finalizar()", doc_start)
document_block = app[doc_start:doc_end]
patient_document = (
    '"use strict";\n\n'
    "/* Base document builder extracted from app.js. Presentation remains isolated by document-flow.js. */\n\n"
    + document_block
)
write("patient-document.js", patient_document)
app = app[:doc_start] + app[doc_end:]

shell_start = app.index("function setupButtonFeedback()")
shell_listener = 'document.addEventListener("DOMContentLoaded", init);'
shell_end = app.index(shell_listener, shell_start) + len(shell_listener)
app = (app[:shell_start] + app[shell_end:]).rstrip() + "\n"
write("app.js", app)

# index.html: explicit dependency order: runtime -> clinical/app -> document -> overlays -> shell.
html = read("index.html")
html = html.replace('  <!-- Legacy CI marker only: ./pdf-enhancements.js?v=20260827-3 -->\n', '')
html = replace_once(
    html,
    '  <script src="./app.js?v=20260826"></script>\n',
    '  <script src="./app-runtime.js?v=20260910-1"></script>\n'
    '  <script src="./app.js?v=20260910-1"></script>\n'
    '  <script src="./patient-document.js?v=20260910-1"></script>\n',
    "application runtime/document scripts",
)
html = replace_once(
    html,
    '  <script src="./document-flow.js?v=20260910-1"></script>\n',
    '  <script src="./document-flow.js?v=20260910-1"></script>\n'
    '  <script src="./app-shell.js?v=20260910-1"></script>\n',
    "application shell script",
)
write("index.html", html)

# Service worker: ship all new runtime boundaries atomically.
sw = read("sw.js")
sw = replace_once(sw, 'insulog-shell-20260910-atomic17', 'insulog-shell-20260910-atomic18', "cache revision")
sw = replace_once(sw, 'pdf-isolation-20260910-r1', 'runtime-navigation-20260910-r1', "deployment revision")
sw = replace_once(
    sw,
    '  "./app.js?v=20260826",\n',
    '  "./app-runtime.js?v=20260910-1",\n'
    '  "./app.js?v=20260910-1",\n'
    '  "./patient-document.js?v=20260910-1",\n',
    "runtime app-shell assets",
)
sw = replace_once(
    sw,
    '  "./document-flow.js?v=20260910-1",\n',
    '  "./document-flow.js?v=20260910-1",\n'
    '  "./app-shell.js?v=20260910-1",\n',
    "bootstrap app-shell asset",
)
write("sw.js", sw)

# Static workflow: syntax-check the new boundaries.
static = read(".github/workflows/static-check.yml")
static = replace_once(
    static,
    '          node --check app.js\n',
    '          node --check app-runtime.js\n'
    '          node --check app.js\n'
    '          node --check patient-document.js\n'
    '          node --check app-shell.js\n',
    "static JS checks",
)
write(".github/workflows/static-check.yml", static)

# Document workflow follows the new atomic shell revision.
doc_workflow = read(".github/workflows/document-flow-check.yml")
doc_workflow = doc_workflow.replace('insulog-shell-20260910-atomic17', 'insulog-shell-20260910-atomic18')
write(".github/workflows/document-flow-check.yml", doc_workflow)

# Invariants: enforce architectural responsibilities and compatibility order.
inv = read("scripts/check_invariants.py")
inv = replace_once(
    inv,
    'app = text("app.js")\n',
    'runtime_js = text("app-runtime.js")\napp = text("app.js")\npatient_document_js = text("patient-document.js")\nshell_js = text("app-shell.js")\n',
    "load runtime boundaries",
)
inv = inv.replace('    "./app.js?v=20260826",', '    "./app-runtime.js?v=20260910-1",\n    "./app.js?v=20260910-1",\n    "./patient-document.js?v=20260910-1",')
inv = inv.replace('    "./document-flow.js?v=20260910-1",', '    "./document-flow.js?v=20260910-1",\n    "./app-shell.js?v=20260910-1",', 1)
old_order = '''script_order = [
    html.index("./app.js?v=20260826"),
    html.index("./pdf-enhancements.js?v=20260827-4"),
    html.index("./aps-safety-2026.js?v=20260910-1"),
    html.index("./farmacia-popular.js?v=20260827-4"),
    html.index("./document-flow.js?v=20260910-1"),
]
if script_order != sorted(script_order):
    raise SystemExit("JavaScript load order must remain app -> PDF -> APS safety -> pharmacy -> document flow")
'''
new_order = '''script_order = [
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
'''
inv = replace_once(inv, old_order, new_order, "script dependency order")

architecture_checks = '''# Runtime/navigation boundary: infrastructure only, with legacy compatibility during migration.
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

'''
anchor = '# Core clinical invariants. These protect accidental refactors; intentional clinical changes\n'
if architecture_checks not in inv:
    inv = replace_once(inv, anchor, architecture_checks + anchor, "architecture invariant section")

inv = inv.replace('insulog-shell-20260910-atomic17', 'insulog-shell-20260910-atomic18')
inv = inv.replace('pdf-isolation-20260910-r1', 'runtime-navigation-20260910-r1')
inv = inv.replace('"./index.html", "./styles.css?v=20260826", "./app.js?v=20260826",', '"./index.html", "./styles.css?v=20260826", "./app-runtime.js?v=20260910-1",\n        "./app.js?v=20260910-1", "./patient-document.js?v=20260910-1",')
inv = inv.replace('"./farmacia-popular.js?v=20260827-4", "./document-flow.js?v=20260910-1",', '"./farmacia-popular.js?v=20260827-4", "./document-flow.js?v=20260910-1", "./app-shell.js?v=20260910-1",')
inv = inv.replace('runtime = "\\n".join([app, pdf_js, doc_js, aps_js, pharmacy_js])', 'runtime = "\\n".join([runtime_js, app, patient_document_js, pdf_js, doc_js, aps_js, pharmacy_js, shell_js])')
write("scripts/check_invariants.py", inv)

# E2E: prove the namespace works and the old nav/globalData contract still behaves identically.
spec = read("tests/e2e/insulog.spec.js")
old_boot = '''  await page.waitForTimeout(150);

  expect(pageErrors).toEqual([]);
});
'''
new_boot = '''  await page.waitForTimeout(150);

  const architecture = await page.evaluate(() => ({
    runtime: Boolean(window.InsulogRuntime),
    shell: Boolean(window.InsulogShell),
    activePageId: window.InsulogRuntime?.navigation.activePageId(),
    initialState: window.InsulogRuntime?.state.snapshot()
  }));
  expect(architecture.runtime).toBe(true);
  expect(architecture.shell).toBe(true);
  expect(architecture.activePageId).toBe("p0");
  expect(architecture.initialState).toEqual({ am: 0, pm: 0, criteria: "", acciones: "" });
  expect(pageErrors).toEqual([]);
});

test("la nueva navegación mantiene compatibilidad con nav y las páginas existentes", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(() => window.InsulogRuntime.navigation.go(2));
  await expectActivePage(page, "p2");

  await page.evaluate(() => nav(1));
  await expectActivePage(page, "p1");

  const state = await page.evaluate(() => {
    globalData.am = 12;
    return window.InsulogRuntime.state.snapshot();
  });
  expect(state.am).toBe(12);
});
'''
spec = replace_once(spec, old_boot, new_boot, "E2E runtime architecture checks")
write("tests/e2e/insulog.spec.js", spec)

print("Phase 4 runtime/navigation migration applied")
