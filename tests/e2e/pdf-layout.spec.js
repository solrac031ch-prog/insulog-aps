const { test, expect } = require("@playwright/test");
const { PDFDocument } = require("pdf-lib");

async function expectActivePage(page, id) {
  await expect(page.locator(`#${id}`)).toHaveClass(/active/);
}

test("PDF 8C mantiene jerarquía legible, aislamiento visual y tabla HGT usable", async ({ page, context }, testInfo) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.InsulogRuntime.state.patch({
      am: 18,
      pm: 10,
      professionalDecision: "aceptada",
      professionalAm: 18,
      professionalPm: 10,
      professionalReason: "",
      professionalDosePerKg: null,
      acciones: "- Control médico en 15 días con registro completo."
    });
    window.InsulogRuntime.navigation.go(6);
  });

  await page.locator("#nombre-paciente").fill("María Fernanda González Pérez");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  const pdf = frame.locator("#pdf");
  await expect(pdf).toContainText("María Fernanda González Pérez");
  await expect(pdf).toContainText("18 UI");
  await expect(pdf).toContainText("10 UI");
  await expect(pdf).toContainText("Pre-almuerzo");
  await expect(pdf).not.toContainText("Preonce");
  await expect(frame.locator(".tabla-registro-hgt tbody tr")).toHaveCount(15);

  const loadedStyles = await page.locator("#pdf-preview-frame").evaluate((iframe) =>
    Array.from(iframe.contentDocument?.querySelectorAll('link[rel="stylesheet"]') || [])
      .map((link) => link.getAttribute("href") || "")
  );
  expect(loadedStyles.some((href) => /(^|\/)styles\.css(?:\?|$)/.test(href))).toBe(false);
  expect(loadedStyles.some((href) => /pdf-design-2026\.css/.test(href))).toBe(true);

  const metrics = await pdf.evaluate((root) => {
    const style = getComputedStyle(root);
    const dose = root.querySelector(".pdf-insulina-line strong");
    const row = root.querySelector(".tabla-registro-hgt tbody tr");
    const title = root.querySelector(".pdf-doc-title");
    return {
      width: root.getBoundingClientRect().width,
      fontSize: parseFloat(style.fontSize),
      titleSize: title ? parseFloat(getComputedStyle(title).fontSize) : 0,
      doseSize: dose ? parseFloat(getComputedStyle(dose).fontSize) : 0,
      rowHeight: row ? row.getBoundingClientRect().height : 0,
      scrollWidth: root.scrollWidth,
      clientWidth: root.clientWidth
    };
  });

  expect(metrics.width).toBeGreaterThan(700);
  expect(metrics.fontSize).toBeGreaterThanOrEqual(13);
  expect(metrics.titleSize).toBeGreaterThanOrEqual(20);
  expect(metrics.doseSize).toBeGreaterThanOrEqual(24);
  expect(metrics.rowHeight).toBeGreaterThanOrEqual(18);
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

  const screenshotPath = testInfo.outputPath("pdf-followup-8c.png");
  await pdf.screenshot({ path: screenshotPath, animations: "disabled" });
  await testInfo.attach("pdf-followup-8c.png", { path: screenshotPath, contentType: "image/png" });

  const rendered = await page.locator("#pdf-preview-frame").evaluate((iframe) => {
    const root = iframe.contentDocument?.getElementById("pdf");
    return { className: root?.className || "", html: root?.innerHTML || "" };
  });

  const printPage = await context.newPage();
  await printPage.goto("/pdf-preview.html");
  await printPage.evaluate(({ className, html }) => {
    const root = document.getElementById("pdf");
    root.className = className;
    root.innerHTML = html;
  }, rendered);
  await printPage.emulateMedia({ media: "print" });

  const bytes = await printPage.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });
  const document = await PDFDocument.load(bytes);
  expect(document.getPageCount()).toBe(1);
  await printPage.close();
});
