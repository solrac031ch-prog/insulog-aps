const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function openDefinition(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await expectActivePage(page, "p2");
}

async function openFollowupTable(page) {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p35");
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

test("arranca sin errores JavaScript y monta las APIs explícitas", async ({ page }) => {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/");
  await expect(page.locator("#p0 .brand-title")).toHaveText("Insulog APS");
  await expect(page.locator("#p25")).toBeAttached();
  await expect(page.locator("#meta-hba1c-seguimiento")).toBeAttached();
  await expect(page.locator("#nivel3-referido")).toHaveCount(0);
  await expect(page.locator("#edad-inicio")).toBeAttached();
  await expect(page.locator("#imc-inicio")).toBeAttached();
  await expect(page.locator("#vfg-inicio")).toBeAttached();
  await page.waitForTimeout(100);
  const architecture = await page.evaluate(() => ({
    runtime: Boolean(window.InsulogRuntime),
    engine: Boolean(window.InsulogClinicalEngine),
    app: Boolean(window.InsulogApp),
    shell: Boolean(window.InsulogShell),
    version: window.InsulogApp?.version
  }));
  expect(architecture).toEqual({ runtime: true, engine: true, app: true, shell: true, version: "2026.09.21-clinical-r3" });
  expect(pageErrors).toEqual([]);
});

test("la exclusión clínica mantiene al paciente fuera del algoritmo APS", async ({ page }) => {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "SÍ", exact: true }).click();
  await expectActivePage(page, "p1");
  await expect(page.locator("#alerta")).toBeVisible();
});

test("HbA1c >10 inicia NPH basal en monodosis y no doble dosis automática", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill("11");
  await page.locator("#edad-inicio").fill("60");
  await page.locator("#imc-inicio").fill("25");
  await page.locator("#vfg-inicio").fill("90");
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expectActivePage(page, "p25");
  await page.locator("#continuar-dosificacion-inicio").click();
  await expectActivePage(page, "p3");
  await expect(page.locator("#factor-dosis")).toHaveValue("0.2");
  await expect(page.locator("#factor-dosis")).toBeEnabled();
  await page.locator("#peso-paciente").fill("70");
  await page.locator("#p3").getByRole("button", { name: "CALCULAR DOSIS Y GENERAR NOTA", exact: true }).click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect({ am: data.am, pm: data.pm }).toEqual({ am: 0, pm: 14 });
  await expect(page.locator("#nota-clinica")).toContainText("NPH monodosis nocturna");
});

test("riesgo de hipoglicemia sugiere 0,1 UI/kg pero permite ajuste profesional a 0,2", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#hba1c-inicio").fill("11");
  await page.locator('.riesgo-hipo-btn[data-value="Adulto mayor frágil"]').click();
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expectActivePage(page, "p25");
  await page.locator("#continuar-dosificacion-inicio").click();
  await expect(page.locator("#factor-dosis")).toHaveValue("0.1");
  await expect(page.locator("#factor-dosis")).toBeEnabled();
  await page.locator("#factor-dosis").selectOption("0.2");
  await expect(page.locator("#factor-dosis")).toHaveValue("0.2");
  await page.locator("#peso-paciente").fill("70");
  await page.locator("#p3").getByRole("button", { name: "CALCULAR DOSIS Y GENERAR NOTA", exact: true }).click();
  const data = await runtimeState(page);
  expect({ am: data.am, pm: data.pm }).toEqual({ am: 0, pm: 14 });
});

test("sospecha de cetosis bloquea el flujo ambulatorio y deriva a urgencia", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator('.catabolico-btn[data-value*="cetosis"]').click();
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("POSIBLE CRISIS HIPERGLICÉMICA / CETOSIS");
  await expect(page.locator("#nota-clinica")).toContainText("Unidad de Emergencia Hospitalaria");
});

test("preferencia del paciente no funciona como indicación independiente", async ({ page }) => {
  await openDefinition(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.getByRole("button", { name: "Paciente acepta insulinoterapia", exact: true }).click();
  let dialogText = "";
  page.once("dialog", async (dialog) => { dialogText = dialog.message(); await dialog.accept(); });
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  expect(dialogText).toContain("no se identifica una indicación protocolizada");
  await expectActivePage(page, "p2");
});

test("seguimiento titula con el menor de 3 glicemias y ajuste porcentual", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [160, 170, 180]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect({ pm: data.pm, minAy: data.minAy }).toEqual({ pm: 22, minAy: 160 });
  await expect(page.locator("#nota-clinica")).toContainText("menor de ≥3");
  await expect(page.locator("#nota-clinica")).toContainText("aumentar 10%");
});

test("valor alto discordante se conserva pero no altera la dosis si el menor está en meta", async ({ page }) => {
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
  await expect(page.locator("#nota-clinica")).toContainText("no se excluyen automáticamente");
});

test("meta individual <8% modifica correctamente el rango de titulación", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#meta-hba1c-seguimiento").selectOption("8");
  await page.locator("#peso-seguimiento").fill("100");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [151, 180, 200]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  const data = await runtimeState(page);
  expect(data.pm).toBe(22);
  expect(data.targetA1c).toBe(8);
});

test("hipoglicemia <54 se clasifica nivel 2 antes de ajustar", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [53, 105, 110]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p4");
  await expect(page.locator("#hipo-ada-titulo")).toContainText("Hipoglicemia detectada");
  await expect(page.locator("#hipo-ada-descripcion")).toContainText("<54 mg/dL");
  await expect(page.locator(".aps-hypo-question")).toContainText("nivel 3");
});

test("nivel 3 se pregunta solo después de detectar un HGT <70", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [60, 105, 110]);
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeHidden();
  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await expect(page.locator(".aps-hypo-question")).toContainText("nivel 3");
  await page.locator("#hipo-con-ayuda").click();
  await expect(page.locator("#hipo3-review-panel")).toBeVisible();
  await page.locator("#hipo3-momento").selectOption("fasting");
  await page.locator("#hipo3-causa").selectOption("none");
  await page.locator("#hipo3-neuro").selectOption("no");
  await page.locator("#hipo3-continuar").click();
  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("HIPOGLICEMIA NIVEL 3");
  await expect(page.locator("#nota-clinica")).toContainText("PROPUESTA INSULOG: reducir 20% la NPH PM");
});

test("confirmar asistencia en alerta de hipoglicemia también activa ruta nivel 3", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillFasting(page, [60, 105, 110]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await page.locator("#hipo-con-ayuda").click();
  await expect(page.locator("#hipo3-review-panel")).toBeVisible();
  await page.locator("#hipo3-momento").selectOption("fasting");
  await page.locator("#hipo3-causa").selectOption("reduced_intake");
  await page.locator("#hipo3-neuro").selectOption("no");
  await page.locator("#hipo3-continuar").click();
  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("HIPOGLICEMIA NIVEL 3");
  await expect(page.locator("#nota-clinica")).toContainText("AJUSTE MÉDICO REQUERIDO");
});

test("no escala automáticamente cuando la titulación proyectada supera 0,5 UI/kg/día", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("34");
  await fillFasting(page, [181, 190, 200]);
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p41");
  const data = await runtimeState(page);
  expect(data.pm).toBe(34);
  await expect(page.locator("#p41")).toContainText("0,5 UI/kg/día");
});

test("esquema BID requiere 3 glicemias pre-almuerzo para ajustar NPH AM", async ({ page }) => {
  await openFollowupTable(page);
  await page.locator("#peso-seguimiento").fill("100");
  await page.locator("#tipo-esquema").selectOption("2");
  await page.locator("#am-actual").fill("15");
  await page.locator("#pm-actual").fill("15");
  await fillFasting(page, [160, 160, 160]);
  await fillPreLunch(page, [181, 181]);
  let dialogText = "";
  page.once("dialog", async (dialog) => { dialogText = dialog.message(); await dialog.accept(); });
  await page.locator("#ajustar-seguimiento-btn").click();
  expect(dialogText).toContain("3 glicemias pre-almuerzo");
  await expectActivePage(page, "p4");
});
