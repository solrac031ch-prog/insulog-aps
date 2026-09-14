// Final Phase 6B browser contract: data sufficiency, professional override and document sync.
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
  await expect(page.locator("#nota-clinica")).toContainText("PM: 22 UI");
}

test("6B muestra suficiencia de HGT en tiempo real", async ({ page }) => {
  await gotoFollowup(page);
  await page.locator("#tipo-esquema").selectOption("pm");
  await expect(page.locator("#best-quality-fasting")).toContainText("Ayunas 0/3");
  await expect(page.locator("#best-quality-pre")).toContainText("no requerido");

  const fasting = page.locator("#tabla-seguimiento .ay");
  await fasting.nth(0).fill("140");
  await fasting.nth(1).fill("150");
  await expect(page.locator("#best-quality-summary")).toContainText("Datos parciales");
  await fasting.nth(2).fill("160");
  await expect(page.locator("#best-quality-fasting")).toContainText("3/3 ✓");
  await expect(page.locator("#best-quality-summary")).toContainText("Datos suficientes");

  await page.locator("#tipo-esquema").selectOption("2");
  await expect(page.locator("#best-quality-pre")).toContainText("Pre-almuerzo 0/3");
  await expect(page.locator("#best-quality-summary")).toContainText("Datos parciales");
});

test("6B separa recomendación Clinical r2 y pauta final modificada", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-review-modify").click();
  await expect(page.locator("#best-modify-panel")).toBeVisible();
  await page.locator("#best-final-am").fill("0");
  await page.locator("#best-final-pm").fill("21");
  await page.locator("#best-modify-reason").fill("Contexto clínico y patrón alimentario del paciente");
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();

  await expect(page.locator("#best-review-status")).toContainText("Plan modificado");
  await expect(page.locator("#best-final-decision-summary")).toContainText("PM 21 UI");
  await expect(page.locator("#nota-clinica")).toContainText("Recomendación Insulog Clinical r2: PM 22 UI");
  await expect(page.locator("#nota-clinica")).toContainText("Modificada (PM 21 UI)");
  await expect(page.locator("#nota-clinica")).toContainText("Contexto clínico y patrón alimentario");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect({ enginePm: state.pm, finalPm: state.professionalPm, decision: state.professionalDecision }).toEqual({ enginePm: 22, finalPm: 21, decision: "modificada" });
});

test("6B sincroniza la pauta profesional con documento/PDF sin alterar el cálculo", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-review-modify").click();
  await page.locator("#best-final-am").fill("0");
  await page.locator("#best-final-pm").fill("21");
  await page.locator("#best-modify-reason").fill("Ajuste clínico deliberado por contexto del paciente");
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");
  await page.locator("#nombre-paciente").fill("Paciente prueba");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("21 UI");
  await expect(frame.locator("#pdf")).not.toContainText("22 UI");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.pm).toBe(22);
  expect(state.professionalPm).toBe(21);
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

test("6B guarda en historial la decisión profesional modificada", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-review-modify").click();
  await page.locator("#best-final-am").fill("0");
  await page.locator("#best-final-pm").fill("21");
  await page.locator("#best-modify-reason").fill("Preferencia clínica documentada para titulación conservadora");
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();

  await page.locator("#best-history-alias").fill("PX-6B");
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await page.locator("#best-history-save-card").getByRole("button", { name: "VER HISTORIAL", exact: true }).click();
  await expectActivePage(page, "p8");
  await expect(page.locator("#best-history-list")).toContainText("PX-6B");
  await expect(page.locator("#best-history-list")).toContainText("Modificada por profesional");
  await expect(page.locator("#best-history-list")).toContainText("Decisión final: PM 21 UI");
});
