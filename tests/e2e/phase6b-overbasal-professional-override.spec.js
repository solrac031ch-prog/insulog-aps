const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function openFollowupResult(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  const fasting = page.locator("#tabla-seguimiento .ay");
  await fasting.nth(0).fill("160");
  await fasting.nth(1).fill("170");
  await fasting.nth(2).fill("180");
  await page.locator("#ajustar-seguimiento-btn").click();
  await expectActivePage(page, "p5");
}

test("permite pauta profesional >0,5 UI/kg/día con justificación y mantiene advertencia", async ({ page }) => {
  await openFollowupResult(page);

  await page.locator("#best-review-modify").click();
  await page.locator("#best-final-am").fill("20");
  await page.locator("#best-final-pm").fill("22");
  await page.locator("#best-modify-reason").fill("Necesita aumento de insulina según criterio clínico del profesional");
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.professionalDecision).toBe("modificada");
  expect(state.professionalAm).toBe(20);
  expect(state.professionalPm).toBe(22);
  expect(state.professionalDosePerKg).toBeCloseTo(0.6, 5);

  await expect(page.locator("#best-professional-overbasal-warning")).toContainText("0,60 UI/kg/día");
  await expect(page.locator("#best-final-decision-summary")).toContainText("AM 20 UI");
  await expect(page.locator("#best-final-decision-summary")).toContainText("PM 22 UI");

  await page.locator("#p5").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p6");

  await page.locator("#nombre-paciente").fill("Paciente prueba");
  await page.locator("#p6").getByRole("button", { name: "SEGUIMIENTO Y AJUSTE", exact: true }).click();
  await expectActivePage(page, "p7");

  const frame = page.frameLocator("#pdf-preview-frame");
  await expect(frame.locator("#pdf")).toContainText("20 UI");
  await expect(frame.locator("#pdf")).toContainText("22 UI");
});
