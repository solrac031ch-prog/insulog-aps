const { test, expect } = require("@playwright/test");
const { PDFDocument } = require("pdf-lib");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function openDefinition(page) {
  await page.goto("/");
  await expectActivePage(page, "p0");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await expectActivePage(page, "p1");
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await expectActivePage(page, "p2");
}

async function openFollowupMedications(page) {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p35");
  await expect(page.locator('#p35 input[data-aps-med="seguimiento"][data-med-key="metformina850"]')).toBeAttached();
}

async function openFollowupTable(page) {
  await openFollowupMedications(page);
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");
  await expect(page.locator("#tabla-seguimiento tr")).toHaveCount(15);
}

async function fillFasting(page, values) {
  const inputs = page.locator("#tabla-seguimiento .ay");
  for (let index = 0; index < values.length; index += 1) {
    await inputs.nth(index).fill(String(values[index]));
  }
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

test("arranca sin errores JavaScript y monta la capa de seguridad", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#p0 .brand-title")).toHaveText("Insulog APS");
  await expect(page.locator("#p25")).toBeAttached();
  await expect(page.locator('script[src*="farmacia-popular.js"]')).toHaveCount(1);
  await page.waitForTimeout(150);

  expect(pageErrors).toEqual([]);
});

test("la exclusión clínica mantiene al paciente fuera del algoritmo APS", async ({ page }) => {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "SÍ", exact: true }).click();

  await expectActivePage(page, "p1");
  await expect(page.locator("#alerta")).toBeVisible();
  await expect(page.locator("#alerta")).toContainText("Derivar a nivel secundario");
});

test("inicio con hiperglicemia marcada conserva el cálculo NPH 0,2 UI/kg y reparto AM/PM", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill("11");
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();

  await expectActivePage(page, "p25");
  await page.locator("#continuar-dosificacion-inicio").click();
  await expectActivePage(page, "p3");
  await expect(page.locator("#factor-dosis")).toHaveValue("0.2");

  await page.locator("#peso-paciente").fill("70");
  await page.locator("#p3").getByRole("button", { name: "CALCULAR DOSIS Y GENERAR NOTA", exact: true }).click();
  await expectActivePage(page, "p5");

  const dose = await page.evaluate(() => ({ am: globalData.am, pm: globalData.pm }));
  expect(dose).toEqual({ am: 10, pm: 4 });
});

test("alto riesgo de hipoglicemia conserva inicio conservador 0,1 UI/kg", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill("11");
  await page.locator('.riesgo-hipo-btn[data-value="Adulto mayor frágil"]').click();
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();

  await expectActivePage(page, "p25");
  await page.locator("#continuar-dosificacion-inicio").click();
  await expect(page.locator("#factor-dosis")).toHaveValue("0.1");

  await page.locator("#peso-paciente").fill("70");
  await page.locator("#p3").getByRole("button", { name: "CALCULAR DOSIS Y GENERAR NOTA", exact: true }).click();
  await expectActivePage(page, "p5");

  const dose = await page.evaluate(() => ({ am: globalData.am, pm: globalData.pm }));
  expect(dose).toEqual({ am: 0, pm: 8 });
});

test("seguimiento genera exactamente 15 filas de HGT", async ({ page }) => {
  await openFollowupTable(page);
  await expect(page.locator("#tabla-seguimiento tr")).toHaveCount(15);
  await expect(page.locator("#tabla-seguimiento .ay")).toHaveCount(15);
  await expect(page.locator("#tabla-seguimiento .pre")).toHaveCount(15);
});

test("las metforminas simples siguen siendo excluyentes, pero vildagliptina/metformina puede coexistir", async ({ page }) => {
  await openFollowupMedications(page);

  const met850 = page.locator('#p35 input[data-med-key="metformina850"]');
  const metXR = page.locator('#p35 input[data-med-key="metforminaXR1000"]');
  const vildaMet = page.locator('#p35 input[data-med-key="vildaMet"]');

  await met850.check({ force: true });
  await metXR.check({ force: true });
  await expect(met850).not.toBeChecked();
  await expect(metXR).toBeChecked();

  await met850.check({ force: true });
  await expect(metXR).not.toBeChecked();
  await vildaMet.check({ force: true });
  await expect(met850).toBeChecked();
  await expect(vildaMet).toBeChecked();
});

test("no permite duplicar iSGLT2", async ({ page }) => {
  await openFollowupMedications(page);

  const dapa = page.locator('#p35 input[data-med-key="dapagliflozina10"]');
  const empaMet = page.locator('#p35 input[data-med-key="empaMet12_5_1000"]');

  await dapa.check({ force: true });
  await empaMet.check({ force: true });

  await expect(dapa).not.toBeChecked();
  await expect(empaMet).toBeChecked();
});

test("Farmacia Popular carga precio y disponibilidad desde el JSON local", async ({ page }) => {
  await openFollowupMedications(page);

  const empa = page.locator('#p35 input[data-med-key="empagliflozina"]');
  const card = empa.locator("xpath=ancestor::label[1]");
  await empa.check({ force: true });

  const pharmacy = card.locator(".farmacia-popular-status");
  await expect(pharmacy).toBeVisible();
  await expect(pharmacy).toContainText("Farmacia Popular Cerro Navia");
  await expect(pharmacy.locator(".farmacia-popular-price")).toContainText(/\$\s?[\d.]+/);
  await expect(pharmacy).toContainText("precio referencial de venta");
});

test("seguimiento PM con ayunas 160 mg/dL aumenta exactamente 2 UI", async ({ page }) => {
  await openFollowupTable(page);

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [160, 160, 160]);
  await page.locator("#ajustar-seguimiento-btn").click();

  await expectActivePage(page, "p5");
  const dose = await page.evaluate(() => ({ am: globalData.am, pm: globalData.pm }));
  expect(dose).toEqual({ am: 0, pm: 22 });
});

test("la alerta de hipoglicemia aparece solo después de presionar Ajustar dosis", async ({ page }) => {
  await openFollowupTable(page);

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [60, 105, 110]);

  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeHidden();
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p4");
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await expect(page.locator("#hipo-sin-ayuda")).toBeVisible();
  await expect(page.locator("#hipo-con-ayuda")).toBeVisible();
});

test("P6 solo prepara el documento y P7 contiene la vista previa", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => nav(6));
  await expectActivePage(page, "p6");
  await expect(page.locator("#p6 #pdf")).toHaveCount(0);
  await expect(page.locator("#p7 #pdf")).toHaveCount(1);

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
  await expect(page.locator("#pdf")).toContainText("Paciente E2E");
});

test("el documento de paciente imprime en una sola hoja Letter", async ({ page }) => {
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
  await expect(page.locator("#pdf")).toContainText("Paciente prueba impresión");

  await page.emulateMedia({ media: "print" });
  const pdf = await page.pdf({
    format: "Letter",
    printBackground: true,
    preferCSSPageSize: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" }
  });
  const document = await PDFDocument.load(pdf);
  expect(document.getPageCount()).toBe(1);
});

test("el nombre del paciente no persiste tras recargar la aplicación", async ({ page }) => {
  const marker = "PACIENTE-NO-PERSISTIR-E2E";
  await page.goto("/");
  await page.evaluate(() => nav(6));
  await page.locator("#nombre-paciente").fill(marker);

  const storage = await page.evaluate(async () => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    databases: typeof indexedDB.databases === "function"
      ? (await indexedDB.databases()).map((database) => database.name || "")
      : []
  }));
  expect(storage.local).not.toContain(marker);
  expect(storage.session).not.toContain(marker);

  await page.reload();
  await expect(page.locator("#nombre-paciente")).toHaveValue("");
});

test("las pantallas principales no generan overflow horizontal en ancho móvil", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expectNoHorizontalOverflow(page);

  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await expectNoHorizontalOverflow(page);

  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await expectNoHorizontalOverflow(page);
});
