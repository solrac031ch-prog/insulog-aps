import { test, expect } from "@playwright/test";

async function expectActivePage(page, id) {
  await expect(page.locator(`#${id}`)).toHaveClass(/active/);
}

async function openLevel3Followup(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("2");
  await page.locator("#am-actual").fill("20");
  await page.locator("#pm-actual").fill("25");

  const fasting = page.locator("#tabla-seguimiento .ay");
  const pre = page.locator("#tabla-seguimiento .pre");
  await fasting.nth(0).fill("58");
  await fasting.nth(1).fill("92");
  await fasting.nth(2).fill("105");
  await pre.nth(0).fill("120");
  await pre.nth(1).fill("118");
  await pre.nth(2).fill("125");

  await page.locator("#ajustar-seguimiento-btn").click();
  await expect(page.locator("#alerta-hipoglicemia-ada")).toBeVisible();
  await page.locator("#hipo-con-ayuda").click();
  await expect(page.locator("#nivel3-evaluacion")).toBeVisible();
}

test("nivel 3 sin causa reversible clara propone reducir 20% la dosis NPH probablemente responsable", async ({ page }) => {
  await openLevel3Followup(page);

  await page.locator("#nivel3-causa").selectOption("no_clara");
  await page.locator("#nivel3-continuar").click();
  await expectActivePage(page, "p5");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.level3AutoDoseAvailable).toBe(true);
  expect(state.level3ImplicatedDose).toBe("PM");
  expect(state.level3ReductionPercent).toBe(20);
  expect(state.am).toBe(20);
  expect(state.pm).toBe(20);
  expect(state.amActual).toBe(20);
  expect(state.pmActual).toBe(25);

  await expect(page.locator("#nota-clinica")).toContainText("PROPUESTA INSULOG: reducir 20%");
  await expect(page.locator("#nota-clinica")).toContainText("Nueva propuesta: AM 20 UI | PM 20 UI");
  await expect(page.locator("#best-review-accept")).toHaveText("ACEPTAR PROPUESTA INSULOG");

  await page.locator("#best-review-accept").click();
  const accepted = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(accepted.professionalDecision).toBe("aceptada");
  expect(accepted.professionalAm).toBe(20);
  expect(accepted.professionalPm).toBe(20);
  expect(accepted.professionalLevel3ProposalAccepted).toBe(true);
  await expect(page.locator("#best-final-decision-summary")).toContainText("propuesta de reducción de Insulog aceptada");
  await expect(page.locator("#best-final-decision-summary")).toContainText("PM 20 UI");
});

test("nivel 3 con causa incierta no calcula porcentaje y deja el ajuste a decisión médica", async ({ page }) => {
  await openLevel3Followup(page);

  await page.locator("#nivel3-causa").selectOption("incierta");
  await page.locator("#nivel3-continuar").click();
  await expectActivePage(page, "p5");

  const state = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(state.level3AutoDoseAvailable).toBe(false);
  expect(state.level3ReductionPercent).toBeNull();

  await expect(page.locator("#nota-clinica")).toContainText("no emitir ajuste numérico automático");
  await expect(page.locator("#nota-clinica")).toContainText("La causa no está suficientemente aclarada");
  await expect(page.locator("#best-review-accept")).toHaveText("ACEPTAR CONDUCTA INSULOG");

  await page.locator("#best-review-modify").click();
  await page.locator("#best-final-am").fill("18");
  await page.locator("#best-final-pm").fill("18");
  await page.locator("#best-modify-reason").fill("Ajuste individual tras reevaluación clínica del episodio nivel 3");
  await page.getByRole("button", { name: "GUARDAR DECISIÓN", exact: true }).click();

  const modified = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect(modified.professionalDecision).toBe("modificada");
  expect(modified.professionalAm).toBe(18);
  expect(modified.professionalPm).toBe(18);
});
