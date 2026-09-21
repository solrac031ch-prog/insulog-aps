// Clinical r2 + Phase 6B final mobile validation.
const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function openFollowupTable(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p35");
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");
}

test("shell móvil conserva metadatos instalables y no desborda", async ({ page }, testInfo) => {
  await page.goto("/");

  await expect(page.locator('meta[name="viewport"]')).toHaveAttribute("content", /viewport-fit=cover/);
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveCount(1);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute("content", "yes");
  await expect(page.locator("#p0 .brand-title")).toHaveText("Insulog APS");

  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    coarsePointer: matchMedia("(pointer: coarse)").matches
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
  expect(dimensions.coarsePointer).toBe(true);

  await page.screenshot({ path: testInfo.outputPath("mobile-p0.png"), fullPage: false, animations: "disabled" });
});

test("flujo de seguimiento y tabla HGT siguen utilizables con touch", async ({ page }, testInfo) => {
  await openFollowupTable(page);

  const layout = await page.locator("#p4 .table-wrap").evaluate((wrap) => {
    const table = wrap.querySelector(".tracking-table");
    const glucose = wrap.querySelector(".glicemia");
    const button = document.querySelector("#ajustar-seguimiento-btn");
    return {
      wrapClientWidth: wrap.clientWidth,
      wrapScrollWidth: wrap.scrollWidth,
      tableWidth: table?.getBoundingClientRect().width || 0,
      glucoseWidth: glucose?.getBoundingClientRect().width || 0,
      glucoseHeight: glucose?.getBoundingClientRect().height || 0,
      buttonHeight: button?.getBoundingClientRect().height || 0,
      documentClientWidth: document.documentElement.clientWidth,
      documentScrollWidth: document.documentElement.scrollWidth
    };
  });

  expect(layout.wrapScrollWidth).toBeLessThanOrEqual(layout.wrapClientWidth + 1);
  expect(layout.tableWidth).toBeLessThanOrEqual(layout.wrapClientWidth + 1);
  expect(layout.glucoseWidth).toBeGreaterThanOrEqual(44);
  expect(layout.glucoseHeight).toBeGreaterThanOrEqual(44);
  expect(layout.buttonHeight).toBeGreaterThanOrEqual(48);
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 2);

  const fasting = page.locator("#tabla-seguimiento .ay");
  await fasting.nth(0).fill("160");
  await fasting.nth(1).fill("160");
  await fasting.nth(2).fill("160");
  await expect(fasting.nth(0)).toHaveValue("160");

  await page.screenshot({ path: testInfo.outputPath("mobile-p4.png"), fullPage: false, animations: "disabled" });
});

test("vista previa del documento se renderiza dentro del iframe móvil", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.InsulogRuntime.state.patch({
      am: 12,
      pm: 8,
      acciones: "- Control médico en 15 días.",
      professionalDecision: "aceptada",
      professionalAm: 12,
      professionalPm: 8,
      professionalReason: "",
      professionalDosePerKg: null
    });
    window.InsulogRuntime.navigation.go(6);
  });
  await expectActivePage(page, "p6");
  await page.locator("#nombre-paciente").fill("Paciente compatibilidad móvil");
  await page.locator("#fecha-nacimiento-paciente").fill("1960-05-12");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("Paciente compatibilidad móvil");
  await expect(frame.locator("#pdf")).toContainText("12 UI");
  await expect(frame.locator("#pdf")).toContainText("8 UI");

  const frameMetrics = await frame.locator("#pdf").evaluate((root) => ({
    clientWidth: root.clientWidth,
    scrollWidth: root.scrollWidth
  }));
  expect(frameMetrics.scrollWidth).toBeLessThanOrEqual(frameMetrics.clientWidth + 1);
});

test("Android Chromium instala el shell y vuelve a abrir la app offline", async ({ page, context }, testInfo) => {
  test.skip(testInfo.project.name !== "android-chromium", "El contrato offline con service worker se valida en Chromium Android");

  await page.goto("/");
  await page.evaluate(async () => navigator.serviceWorker.ready);

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#p0 .brand-title")).toHaveText("Insulog APS");
  await expect(page.locator("#p0")).toHaveClass(/active/);
  await context.setOffline(false);
});