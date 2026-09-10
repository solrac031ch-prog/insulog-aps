from pathlib import Path
import re

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


# index.html: the application no longer loads PDF presentation CSS in the parent document.
html = read("index.html")
html = html.replace('  <!-- Legacy CI marker only: ./pdf-enhancements.css?v=20260827-3 -->\n', '')
html = replace_once(html, '  <link rel="stylesheet" href="./pdf-enhancements.css?v=20260827-4">\n', '', "remove parent PDF enhancements CSS")
html = replace_once(html, '  <link rel="stylesheet" href="./pdf-design-2026.css?v=20260827-1">\n', '', "remove parent PDF design CSS")
html = replace_once(html, './document-flow.css?v=20260831-1', './document-flow.css?v=20260910-1', "document flow CSS version")
html = replace_once(html, './document-flow.js?v=20260827-2', './document-flow.js?v=20260910-1', "document flow JS version")
html = replace_once(
    html,
    '        <button type="button" class="btn btn-main" onclick="window.print()">IMPRIMIR</button>',
    '        <button id="imprimir-documento-btn" type="button" class="btn btn-main" onclick="imprimirDocumentoAislado()" disabled>IMPRIMIR</button>',
    "isolated print button",
)
html = replace_once(
    html,
    '      <div id="pdf" class="imprimible-container" aria-live="polite"></div>',
    '      <div class="pdf-preview-frame-shell no-print">\n        <iframe id="pdf-preview-frame" class="pdf-preview-frame" src="./pdf-preview.html?v=20260910-1" title="Vista previa del documento del paciente" aria-busy="true"></iframe>\n      </div>',
    "replace visible PDF with iframe",
)
html = replace_once(
    html,
    '  </footer>\n\n  <script src="./app.js?v=20260826"></script>',
    '  </footer>\n\n  <div id="pdf" class="imprimible-container pdf-render-staging" aria-hidden="true"></div>\n\n  <script src="./app.js?v=20260826"></script>',
    "add hidden PDF staging area",
)
write("index.html", html)

# sw.js: cache the isolated preview page and new document-flow revision.
sw = read("sw.js")
sw = replace_once(sw, 'insulog-shell-20260910-atomic16', 'insulog-shell-20260910-atomic17', "PWA cache version")
sw = replace_once(sw, 'source-of-truth-20260910-r1', 'pdf-isolation-20260910-r1', "deployment revision")
sw = replace_once(sw, '  "./index.html",\n', '  "./index.html",\n  "./pdf-preview.html?v=20260910-1",\n', "cache preview page")
sw = replace_once(sw, './document-flow.css?v=20260831-1', './document-flow.css?v=20260910-1', "cached document flow CSS")
sw = replace_once(sw, './document-flow.js?v=20260827-2', './document-flow.js?v=20260910-1', "cached document flow JS")
write("sw.js", sw)

# E2E: validate the iframe boundary and print the isolated page itself.
spec = read("tests/e2e/insulog.spec.js")
start = spec.index('test("P6 solo prepara el documento y P7 contiene la vista previa"')
end = spec.index('test("el nombre del paciente no persiste tras recargar la aplicación"', start)
replacement = r'''test("P6 solo prepara el documento y P7 contiene la vista previa aislada", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => nav(6));
  await expectActivePage(page, "p6");
  await expect(page.locator("#p6 #pdf")).toHaveCount(0);
  await expect(page.locator("#p7 #pdf")).toHaveCount(0);
  await expect(page.locator("#pdf-preview-frame")).toHaveCount(1);
  await expect(page.locator("body > #pdf.pdf-render-staging")).toBeHidden();

  let alertMessage = "";
  page.once("dialog", async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });
  await page.locator("#p6").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  expect(alertMessage).toContain("nombre del paciente");
  await expectActivePage(page, "p6");

  await page.locator("#nombre-paciente").fill("Paciente E2E");
  await page.locator("#p6").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p7");

  const preview = page.frameLocator("#pdf-preview-frame");
  await expect(preview.locator("#pdf")).toContainText("Paciente E2E");
  await expect(page.locator("#imprimir-documento-btn")).toBeEnabled();
});

test("los estilos del PDF viven solo dentro del documento aislado", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator('head > link[href*="pdf-enhancements.css"]')).toHaveCount(0);
  await expect(page.locator('head > link[href*="pdf-design-2026.css"]')).toHaveCount(0);

  const preview = page.frameLocator("#pdf-preview-frame");
  await expect(preview.locator('head > link[href*="pdf-enhancements.css"]')).toHaveCount(1);
  await expect(preview.locator('head > link[href*="pdf-design-2026.css"]')).toHaveCount(1);
});

test("el documento aislado imprime en una sola hoja Letter", async ({ page, context }) => {
  await page.goto("/");
  await page.evaluate(() => {
    globalData.am = 10;
    globalData.pm = 4;
    globalData.criteria = "HbA1c 11%, glicemia en ayunas 280 mg/dL";
    globalData.tratamientoConcomitante = "Metformina 850 mg: 1.700 mg/día; Dapagliflozina: 10 mg/día; Vildagliptina 50 mg: 50 mg cada 12 h";
    nav(6);
  });

  await page.locator("#nombre-paciente").fill("Paciente prueba impresión");
  await page.locator("#p6").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p7");

  const preview = page.frameLocator("#pdf-preview-frame");
  await expect(preview.locator("#pdf")).toContainText("Paciente prueba impresión");

  const rendered = await page.locator("#pdf-preview-frame").evaluate((iframe) => {
    const root = iframe.contentDocument?.getElementById("pdf");
    return { className: root?.className || "", html: root?.innerHTML || "" };
  });
  expect(rendered.html).toContain("Paciente prueba impresión");

  const printPage = await context.newPage();
  await printPage.goto("/pdf-preview.html?v=20260910-1");
  await printPage.evaluate(({ className, html }) => {
    const root = document.getElementById("pdf");
    root.className = className;
    root.innerHTML = html;
  }, rendered);
  await printPage.emulateMedia({ media: "print" });

  const pdf = await printPage.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });
  const document = await PDFDocument.load(pdf);
  expect(document.getPageCount()).toBe(1);
  await printPage.close();
});

'''
spec = spec[:start] + replacement + spec[end:]
write("tests/e2e/insulog.spec.js", spec)

# Invariants: parent app and printable document must have an explicit CSS/DOM boundary.
inv = read("scripts/check_invariants.py")
inv = replace_once(inv, 'doc_css = text("document-flow.css")\n', 'doc_css = text("document-flow.css")\npdf_preview_html = text("pdf-preview.html")\n', "load preview HTML in invariants")
inv = inv.replace('    "./pdf-enhancements.css?v=20260827-4",\n    "./pdf-design-2026.css?v=20260827-1",\n    "./document-flow.css?v=20260831-1",', '    "./document-flow.css?v=20260910-1",')
inv = inv.replace('    "./document-flow.js?v=20260827-2",', '    "./document-flow.js?v=20260910-1",')
inv = replace_once(
    inv,
    'require(html, direct_assets, "Direct application assets")\n',
    'require(html, direct_assets, "Direct application assets")\nrequire(html, [\'id="pdf-preview-frame"\', \'./pdf-preview.html?v=20260910-1\', \'imprimirDocumentoAislado()\', \'pdf-render-staging\'], "Isolated PDF host")\nforbid(html, [\'href="./pdf-enhancements.css\', \'href="./pdf-design-2026.css\'], "Parent application PDF styles")\nrequire(pdf_preview_html, [\'./styles.css?v=20260826\', \'./pdf-enhancements.css?v=20260827-4\', \'./pdf-design-2026.css?v=20260827-1\', \'./document-flow.css?v=20260910-1\', \'id="pdf"\'], "Isolated PDF document assets")\n',
    "PDF boundary invariants",
)
inv = inv.replace('    html.index("./document-flow.js?v=20260827-2"),', '    html.index("./document-flow.js?v=20260910-1"),')
old_p7 = '''if 'id="pdf"' in html[p6_start:p7_start]:
    raise SystemExit("P6 must contain only document preparation controls")
if 'id="pdf"' not in html[p7_start:main_end]:
    raise SystemExit("P7 must own the PDF preview")
'''
new_p7 = '''if 'id="pdf"' in html[p6_start:p7_start]:
    raise SystemExit("P6 must contain only document preparation controls")
if 'id="pdf"' in html[p7_start:main_end]:
    raise SystemExit("P7 must not render the printable PDF in the parent document")
if 'id="pdf-preview-frame"' not in html[p7_start:main_end]:
    raise SystemExit("P7 must own the isolated PDF iframe")
if html.index('id="pdf"') < main_end:
    raise SystemExit("The parent #pdf staging node must live outside the application main")
'''
inv = replace_once(inv, old_p7, new_p7, "P7 iframe invariant")
inv = inv.replace('require(doc_js, ["mostrarDocumento", "volverPreparacionDocumento", "nav(7)"], "P6/P7 document flow")', 'require(doc_js, ["mostrarDocumento", "volverPreparacionDocumento", "nav(7)", "pdf-preview-frame", "copiarVistaPreviaAlFrame", "imprimirDocumentoAislado", "contentDocument", "queueMicrotask"], "P6/P7 isolated document flow")')
inv = inv.replace('require(doc_css, ["@media print", "#p7"], "Document-flow print isolation")', 'require(doc_css, ["@media print", "#p7", ".pdf-preview-frame", ".pdf-render-staging", "body.pdf-isolated-document"], "Document-flow print isolation")')
inv = inv.replace('insulog-shell-20260910-atomic16', 'insulog-shell-20260910-atomic17')
inv = inv.replace('source-of-truth-20260910-r1', 'pdf-isolation-20260910-r1')
inv = inv.replace('"./pdf-enhancements.js?v=20260827-4", "./aps-safety-2026.js?v=20260910-1",\n        "./farmacia-popular.js?v=20260827-4", "./document-flow.js?v=20260827-2",', '"./pdf-preview.html?v=20260910-1", "./pdf-enhancements.js?v=20260827-4", "./aps-safety-2026.js?v=20260910-1",\n        "./farmacia-popular.js?v=20260827-4", "./document-flow.js?v=20260910-1",')
write("scripts/check_invariants.py", inv)

print("PDF isolation migration applied successfully")
