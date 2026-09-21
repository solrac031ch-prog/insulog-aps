const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function gotoFollowup(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");
}

async function openFollowupResult(page) {
  await gotoFollowup(page);
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  const fasting = page.locator("#tabla-seguimiento .ay");
  await fasting.nth(0).fill("160");
  await fasting.nth(1).fill("170");
  await fasting.nth(2).fill("180");
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
  await expect(page.locator("#nota-clinica")).toContainText("PM 22 UI");
}

async function modifyTo21(page, reason = "Contexto clínico y patrón alimentario del paciente") {
  await page.locator("#best-review-modify").click();
  await expect(page.locator("#best-modify-panel")).toBeVisible();
  await page.locator("#best-final-am").fill("0");
  await page.locator("#best-final-pm").fill("21");
  await page.locator("#best-modify-reason").fill(reason);
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();
}

test("6B separa recomendación Clinical r2 y pauta final modificada", async ({ page }) => {
  await openFollowupResult(page);
  await modifyTo21(page);

  await expect(page.locator("#best-review-status")).toContainText("Plan modificado");
  await expect(page.locator("#best-final-decision-summary")).toContainText("PM 21 UI");
  await expect(page.locator("#nota-clinica")).toContainText("Recomendación Insulog Clinical r2: PM 22 UI");
  await expect(page.locator("#nota-clinica")).toContainText("Modificada (PM 21 UI)");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect({ enginePm: state.pm, finalPm: state.professionalPm, decision: state.professionalDecision }).toEqual({ enginePm: 22, finalPm: 21, decision: "modificada" });
});

test("6B pide nombre sólo al generar documento y no lo almacena en el estado", async ({ page }) => {
  await openFollowupResult(page);
  await modifyTo21(page, "Ajuste clínico deliberado por contexto del paciente");

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");
  await expect(page.locator("label[for='nombre-paciente']")).toHaveText("Nombre del paciente");
  await expect(page.locator("label[for='fecha-nacimiento-paciente']")).toHaveText("Fecha de nacimiento");
  await page.locator("#nombre-paciente").fill("Paciente prueba");
  await page.locator("#fecha-nacimiento-paciente").fill("1960-05-12");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("Paciente prueba");
  await expect(frame.locator("#pdf")).toContainText("12/05/1960");
  await expect(frame.locator("#pdf")).toContainText("21 UI");
  await expect(frame.locator("#pdf")).not.toContainText("22 UI");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.pm).toBe(22);
  expect(state.professionalPm).toBe(21);
  expect(JSON.stringify(state)).not.toContain("Paciente prueba");
  expect(JSON.stringify(state)).not.toContain("1960-05-12");
});

test("6B exige fecha de nacimiento antes de generar el documento", async ({ page }) => {
  await openFollowupResult(page);
  await modifyTo21(page, "Ajuste clínico deliberado por contexto del paciente");

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");
  await page.locator("#nombre-paciente").fill("Paciente sin fecha");

  let message = "";
  page.once("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();

  await expectActivePage(page, "p6");
  expect(message).toContain("fecha de nacimiento");
});

test("6B informa si Drive está configurado en este dispositivo", async ({ page }) => {
  await page.goto("/?driveEndpoint=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FTEST-ENDPOINT-123456%2Fexec");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  const fasting = page.locator("#tabla-seguimiento .ay");
  await fasting.nth(0).fill("160");
  await fasting.nth(1).fill("170");
  await fasting.nth(2).fill("180");
  await page.locator("#ajustar-seguimiento-btn").click();
  await page.locator("#best-review-accept").click();
  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();

  await expectActivePage(page, "p6");
  await expect(page.locator("#drive-sync-status")).toContainText("Drive configurado en este dispositivo");
  expect(page.url()).not.toContain("driveEndpoint");
});

test("6B no muestra historial local y declara almacenamiento identificatorio sólo en Drive", async ({ page }) => {
  await openFollowupResult(page);
  await expect(page.locator("#best-history-save-card")).toHaveCount(0);
  await expect(page.locator("#best-history-home-entry")).toHaveCount(0);
  await expect(page.locator("#p8")).toHaveCount(0);

  const privacy = await page.evaluate(() => window.InsulogPhase6BDocumentSync?.privacy);
  expect(privacy).toEqual({
    patientNameStorage: "google-drive-only",
    localPersistentPatientStorage: false,
    temporaryHistoryEnabled: false
  });
  expect(await page.evaluate(() => Boolean(window.InsulogPhase6BDocumentSync?.history))).toBe(false);
});

test("6B bloquea documento cuando la decisión es reevaluar", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-review-reassess").click();
  await expect(page.locator("#nota-clinica")).toContainText("Reevaluar antes de emitir una pauta definitiva");

  let message = "";
  page.once("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p5");
  expect(message).toContain("ACEPTAR o MODIFICAR PLAN");
});


test("6B envía tratamiento concomitante al registro longitudinal", async ({ page }) => {
  await page.goto("/?driveEndpoint=https%3A%2F%2Fscript.google.com%2Fmacros%2Fs%2FTEST-ENDPOINT-123456%2Fexec");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();

  const firstMedication = page.locator('input[data-aps-med="seguimiento"]').first();
  await firstMedication.check();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  const fasting = page.locator("#tabla-seguimiento .ay");
  await fasting.nth(0).fill("160");
  await fasting.nth(1).fill("170");
  await fasting.nth(2).fill("180");
  await page.locator("#ajustar-seguimiento-btn").click();
  await page.locator("#best-review-accept").click();
  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();

  await page.locator("#nombre-paciente").fill("Paciente medicamentos");
  await page.locator("#fecha-nacimiento-paciente").fill("1965-08-20");

  const requestPromise = page.waitForRequest((request) =>
    request.method() === "POST" &&
    request.url().includes("script.google.com/macros/s/TEST-ENDPOINT-123456/exec")
  );
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  const request = await requestPromise;
  const payload = JSON.parse(request.postData() || "{}");

  expect(payload.patientBirthDate).toBe("1965-08-20");
  expect(payload.coMedications).toContain("Metformina");
});
