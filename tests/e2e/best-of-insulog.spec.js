const { test, expect } = require("@playwright/test");

// Final Phase 6A browser contract: explainability, human review and ephemeral session history.
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
  await expect(page.locator("#nota-clinica")).toContainText("aumentar 10%");
}

test("Best of Insulog explica la recomendación sin recalcular ni modificar Clinical r2", async ({ page }) => {
  await openFollowupResult(page);

  const before = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect({ am: before.am, pm: before.pm, minAy: before.minAy }).toEqual({ am: 0, pm: 22, minAy: 160 });

  await expect(page.locator("#best-decision-trace")).toBeAttached();
  await page.locator("#best-decision-trace summary").click();
  await expect(page.locator("#best-decision-body")).toContainText("Ayunas: 3 registro(s)");
  await expect(page.locator("#best-decision-body")).toContainText("Menor ayunas: 160 mg/dL");
  await expect(page.locator("#best-decision-body")).toContainText("PM 22 UI");

  await page.locator("#best-review-accept").click();
  await expect(page.locator("#best-review-status")).toContainText("aceptada por el profesional");

  const after = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect({ am: after.am, pm: after.pm, minAy: after.minAy }).toEqual({ am: 0, pm: 22, minAy: 160 });
});

test("historial temporal guarda revisión durante la sesión y desaparece al recargar", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-review-accept").click();
  await page.locator("#best-history-alias").fill("PX-001");
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await expect(page.locator("#best-history-status")).toContainText("PX-001");

  await page.locator("#best-history-save-card").getByRole("button", { name: "VER HISTORIAL", exact: true }).click();
  await expectActivePage(page, "p8");
  await expect(page.locator("#best-history-list")).toContainText("PX-001");
  await expect(page.locator("#best-history-list")).toContainText("170 mg/dL");
  await expect(page.locator("#best-history-list")).toContainText("22 UI");
  await expect(page.locator("#best-history-list")).toContainText("Aceptada");

  await page.reload();
  await expectActivePage(page, "p0");
  await page.locator("#p0 details").getByText("Fuentes clínicas y versión", { exact: true }).click();
  await page.locator("#best-history-home-entry").click();
  await expectActivePage(page, "p8");
  await expect(page.locator("#best-history-list")).toContainText("No hay registros guardados");
  await expect(page.locator("#best-history-list")).not.toContainText("PX-001");
});

test("historial exige alias y revisión profesional antes de guardar", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await expect(page.locator("#best-history-status")).toContainText("alias o código local");

  await page.locator("#best-history-alias").fill("PX-002");
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await expect(page.locator("#best-history-status")).toContainText("revisión profesional");

  await page.locator("#best-history-save-card").getByRole("button", { name: "VER HISTORIAL", exact: true }).click();
  await expectActivePage(page, "p8");
  await expect(page.locator("#best-history-list")).toContainText("No hay registros guardados");
});
