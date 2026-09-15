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
  await page.locator("#nombre-paciente").fill("Paciente prueba");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("Paciente prueba");
  await expect(frame.locator("#pdf")).toContainText("21 UI");
  await expect(frame.locator("#pdf")).not.toContainText("22 UI");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.pm).toBe(22);
  expect(state.professionalPm).toBe(21);
  expect(JSON.stringify(state)).not.toContain("Paciente prueba");
});

test("6B no muestra historial temporal ni expone API para guardar pacientes", async ({ page }) => {
  await openFollowupResult(page);
  await expect(page.locator("#best-history-save-card")).toHaveCount(0);
  await expect(page.locator("#best-history-home-entry")).toHaveCount(0);
  await expect(page.locator("#p8")).toHaveCount(0);

  const privacy = await page.evaluate(() => window.InsulogPhase6BDocumentSync?.privacy);
  expect(privacy).toEqual({ patientNameStorage: "none", temporaryHistoryEnabled: false });
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
