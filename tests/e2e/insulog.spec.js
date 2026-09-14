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

async function fillValues(locator, values) {
  for (let index = 0; index < values.length; index += 1) {
    await locator.nth(index).fill(String(values[index]));
  }
}

async function fillFasting(page, values) {
  await fillValues(page.locator("#tabla-seguimiento .ay"), values);
}

async function fillPreLunch(page, values) {
  await fillValues(page.locator("#tabla-seguimiento .pre"), values);
}

async function runtimeState(page) {
  return page.evaluate(() => window.InsulogRuntime.state.snapshot());
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 2);
}

async function openInitialDose(page, hba1c = "11") {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill(hba1c);
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expectActivePage(page, "p25");
  await page.locator("#continuar-dosificacion-inicio").click();
  await expectActivePage(page, "p3");
}

async function fillInitialSensitivity(page, { weight = 70, age = 55, height = 175, egfr = 90 } = {}) {
  await page.locator("#peso-paciente").fill(String(weight));
  await page.locator("#edad-paciente").fill(String(age));
  await page.locator("#talla-paciente").fill(String(height));
  await page.locator("#egfr-paciente").fill(String(egfr));
}

test("arranca sin errores JavaScript y monta las APIs explícitas", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/");
  await expect(page.locator("#p0 .brand-title")).toHaveText("Insulog APS");
  await expect(page.locator("#p25")).toBeAttached();
  await expect(page.locator("[onclick], [onchange], [oninput]")).toHaveCount(0);
  await page.waitForTimeout(150);

  const architecture = await page.evaluate(() => ({
    runtime: Boolean(window.InsulogRuntime),
    app: Boolean(window.InsulogApp),
    documents: Boolean(window.InsulogDocuments),
    shell: Boolean(window.InsulogShell),
    clinicalVersion: window.InsulogApp?.version,
    activePageId: window.InsulogRuntime?.navigation.activePageId(),
    initialState: window.InsulogRuntime?.state.snapshot(),
    actions: [
      "navigate", "define-initial-scheme", "calculate-initial", "prepare-followup",
      "calculate-followup", "open-document", "show-document", "finish"
    ].every((name) => window.InsulogRuntime?.actions.has(name)),
    legacy: {
      nav: typeof nav,
      globalData: typeof globalData,
      calculateFollowup: typeof calcularSeguimientoPro,
      generateDocument: typeof generarDocumento,
      finish: typeof finalizar
    }
  }));

  expect(architecture.runtime).toBe(true);
  expect(architecture.app).toBe(true);
  expect(architecture.documents).toBe(true);
  expect(architecture.shell).toBe(true);
  expect(architecture.actions).toBe(true);
  expect(architecture.clinicalVersion).toBe("2026.09.14-clinical-r2");
  expect(architecture.activePageId).toBe("p0");
  expect(architecture.initialState).toEqual({ am: 0, pm: 0, criteria: "", acciones: "" });
  expect(architecture.legacy).toEqual({
    nav: "undefined",
    globalData: "undefined",
    calculateFollowup: "undefined",
    generateDocument: "undefined",
    finish: "undefined"
  });
  expect(pageErrors).toEqual([]);
});

test("navegación y estado funcionan solo a través del runtime", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.InsulogRuntime.navigation.go(2));
  await expectActivePage(page, "p2");
  await page.evaluate(() => window.InsulogRuntime.navigation.go(1));
  await expectActivePage(page, "p1");
});

test("la exclusión clínica mantiene al paciente fuera del algoritmo APS", async ({ page }) => {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "SÍ", exact: true }).click();
  await expectActivePage(page, "p1");
  await expect(page.locator("#alerta")).toBeVisible();
  await expect(page.locator("#alerta")).toContainText("Derivar a nivel secundario");
});

test("sospecha de cetosis bloquea NPH y deriva inmediatamente a urgencia", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill("12");
  await page.getByRole("button", { name: /Sospecha de cetosis/i }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expectActivePage(page, "p2");
  await expect(page.locator("#sugerencia-esquema-inicio")).toContainText("DERIVACIÓN INMEDIATA");
  const data = await runtimeState(page);
  expect(data.decisionInicio.urgent).toBe(true);
  expect(data.decisionInicio.canProceed).toBe(false);
});

test("HbA1c 9,2 aislada no abre dosificación automática", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill("9.2");
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expectActivePage(page, "p2");
  await expect(page.locator("#sugerencia-esquema-inicio")).toContainText("Sin indicación automática");
});

test("inicio basal MINSAL usa sensibilidad por edad, IMC y VFGe", async ({ page }) => {
  await openInitialDose(page, "11");
  await fillInitialSensitivity(page, { weight: 70, age: 55, height: 175, egfr: 90 });
  await page.locator("#p3").getByRole("button", { name: "CALCULAR DOSIS Y GENERAR NOTA", exact: true }).click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect(data.sensibilidadInsulina).toBe("Sensibilidad usual");
  expect(data.factorInicio).toBe(0.2);
  expect({ am: data.am, pm: data.pm }).toEqual({ am: 0, pm: 14 });
  await expect(page.locator("#nota-clinica")).toContainText("NPH basal monodosis nocturna");
});

test("persona de 70 años o más inicia conservador 0,1 UI/kg", async ({ page }) => {
  await openInitialDose(page, "11");
  await fillInitialSensitivity(page, { weight: 70, age: 75, height: 175, egfr: 90 });
  await page.locator("#p3").getByRole("button", { name: "CALCULAR DOSIS Y GENERAR NOTA", exact: true }).click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect(data.factorInicio).toBe(0.1);
  expect({ am: data.am, pm: data.pm }).toEqual({ am: 0, pm: 7 });
});

test("el factor 0,3 UI/kg no está disponible en inicio basal monodosis", async ({ page }) => {
  await openInitialDose(page, "11");
  await expect(page.locator('#factor-dosis option[value="0.3"]')).toHaveCount(0);
  await expect(page.locator("#factor-dosis")).toBeDisabled();
});

test("seguimiento genera exactamente 15 filas de HGT y usa pre-almuerzo", async ({ page }) => {
  await openFollowupTable(page);
  await expect(page.locator("#tabla-seguimiento tr")).toHaveCount(15);
  await expect(page.locator("#tabla-seguimiento .ay")).toHaveCount(15);
  await expect(page.locator("#tabla-seguimiento .pre")).toHaveCount(15);
  await expect(page.locator("#p4 thead")).toContainText("Pre-almuerzo");
  await expect(page.locator("#meta-hba1c-seguimiento")).toHaveValue("7");
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
});

test("seguimiento titula por menor de 3 y aumenta 10% entre 131-180", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [160, 170, 180]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect({ am: data.am, pm: data.pm, minAy: data.minAy }).toEqual({ am: 0, pm: 22, minAy: 160 });
  await expect(page.locator("#nota-clinica")).toContainText("menor ayuno 160 mg/dL");
});

test("un valor alto discordante no cambia la titulación si el menor de 3 está en meta", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [100, 100, 100, 300]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect({ pm: data.pm, promAy: data.promAy, minAy: data.minAy }).toEqual({ pm: 20, promAy: 150, minAy: 100 });
  await expect(page.locator("#nota-clinica")).toContainText("Valores discordantes: Ayunas 300 mg/dL");
  await expect(page.locator("#nota-clinica")).toContainText("Promedios descriptivos");
});

test("meta HbA1c individualizada modifica el rango de titulación", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await page.locator("#meta-hba1c-seguimiento").selectOption("8.5");
  await fillFasting(page, [160, 170, 180]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect(data.pm).toBe(20);
  await expect(page.locator("#nota-clinica")).toContainText("Meta individual de HbA1c: <8,5%");
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
  await expect(page.locator("#hipo-ada-titulo")).toContainText("nivel 1");
});

test("HGT menor de 54 mg/dL se presenta como hipoglicemia nivel 2", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [53, 105, 110]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p4");
  await expect(page.locator("#hipo-ada-titulo")).toContainText("nivel 2");
});

test("hipoglicemia con asistencia deriva inmediatamente a urgencia y no ajusta NPH", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [60, 105, 110]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await page.locator("#hipo-con-ayuda").click();
  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("HIPOGLICEMIA NIVEL 3 REFERIDA");
  await expect(page.locator("#nota-clinica")).toContainText("DERIVACIÓN INMEDIATA A UNIDAD DE EMERGENCIA HOSPITALARIA");
  await expect(page.locator("#nota-clinica")).toContainText("No se realiza ajuste automático de NPH");
});

test("nivel 3 puede declararse aun sin HGT menor de 70 registrado", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [100, 110, 120]);
  await page.locator("#hipo-nivel3-referida").check();
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("DERIVACIÓN INMEDIATA");
});

test("el techo basal 0,5 UI/kg bloquea escalada automática", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("34");
  await fillFasting(page, [181, 190, 200]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p41");
  const data = await runtimeState(page);
  expect(data.pm).toBe(35);
  expect(data.dosisKg).toBeLessThanOrEqual(0.5);
  await expect(page.locator("#p41")).toContainText("0,5 UI/kg/día");
});

test("P6 solo prepara el documento y P7 contiene la vista previa aislada", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.InsulogRuntime.navigation.go(6));
  await expectActivePage(page, "p6");
  await expect(page.locator("#p6 #pdf")).toHaveCount(0);
  await expect(page.locator("#p7 #pdf")).toHaveCount(0);
  await expect(page.locator("#pdf-preview-frame")).toHaveCount(1);
  await expect(page.locator("body > #pdf.pdf-render-staging")).toBeHidden();

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#p6").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
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
    window.InsulogRuntime.state.patch({
      am: 0,
      pm: 14,
      criteria: "HbA1c 11%",
      tratamientoConcomitante: "Metformina 850 mg: 1.700 mg/día"
    });
    window.InsulogRuntime.navigation.go(6);
  });
  await page.locator("#nombre-paciente").fill("Paciente prueba impresión");
  await page.locator("#p6").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p7");
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
  const pdf = await printPage.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } });
  const document = await PDFDocument.load(pdf);
  expect(document.getPageCount()).toBe(1);
  await printPage.close();
});

test("el nombre del paciente no persiste tras recargar la aplicación", async ({ page }) => {
  const marker = "PACIENTE-NO-PERSISTIR-E2E";
  await page.goto("/");
  await page.evaluate(() => window.InsulogRuntime.navigation.go(6));
  await page.locator("#nombre-paciente").fill(marker);
  const storage = await page.evaluate(async () => ({
    local: JSON.stringify({ ...localStorage }),
    session: JSON.stringify({ ...sessionStorage }),
    databases: typeof indexedDB.databases === "function" ? (await indexedDB.databases()).map((database) => database.name || "") : []
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
