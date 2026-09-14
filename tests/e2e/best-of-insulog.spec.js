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
  await expect(page.locator("#nota-clinica")).toContainText("aumentar 10%");
}

test("Best of Insulog explica la recomendación sin recalcular ni modificar Clinical r2", async ({ page }) => {
  await openFollowupResult(page);

  const before = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect({ am: before.am, pm: before.pm, minAy: before.minAy }).toEqual({ am: 0, pm: 22, minAy: 160 });

  await expect(page.locator("#best-decision-trace")).toBeAttached();
  await page.locator("#best-decision-trace").click();
  await expect(page.locator("#best-decision-body")).toContainText("Ayunas: 3 registro(s)");
  await expect(page.locator("#best-decision-body")).toContainText("Menor ayunas: 160 mg/dL");
  await expect(page.locator("#best-decision-body")).toContainText("PM 22 UI");

  await page.locator("#best-review-accept").click();
  await expect(page.locator("#best-review-status")).toContainText("aceptada por el profesional");

  const after = await page.evaluate(() => window.InsulogRuntime.state.snapshot());
  expect({ am: after.am, pm: after.pm, minAy: after.minAy }).toEqual({ am: 0, pm: 22, minAy: 160 });
});

test("historial longitudinal local guarda revisión y persiste después de recargar", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-review-accept").click();
  await page.locator("#best-history-alias").fill("PX-001");
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await expect(page.locator("#best-history-status")).toContainText("PX-001");

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("insulog.history.v1") || "[]"));
  expect(stored).toHaveLength(1);
  expect(stored[0].alias).toBe("PX-001");
  expect(stored[0].review).toBe("aceptada");
  expect(stored[0].recommendedDose.pm).toBe(22);
  expect(stored[0].meanFasting).toBe(170);

  await page.locator("#best-history-save-card").getByRole("button", { name: "VER HISTORIAL", exact: true }).click();
  await expectActivePage(page, "p8");
  await expect(page.locator("#best-history-list")).toContainText("PX-001");
  await expect(page.locator("#best-history-list")).toContainText("170 mg/dL");
  await expect(page.locator("#best-history-list")).toContainText("22 UI");

  await page.reload();
  await expectActivePage(page, "p0");
  await page.locator("#p0 details").getByText("Fuentes clínicas y versión", { exact: true }).click();
  await page.locator("#best-history-home-entry").click();
  await expectActivePage(page, "p8");
  await expect(page.locator("#best-history-list")).toContainText("PX-001");
});

test("historial exige alias y revisión profesional antes de guardar", async ({ page }) => {
  await openFollowupResult(page);
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await expect(page.locator("#best-history-status")).toContainText("alias o código local");

  await page.locator("#best-history-alias").fill("PX-002");
  await page.locator("#best-history-save-card").getByRole("button", { name: "GUARDAR CASO", exact: true }).click();
  await expect(page.locator("#best-history-status")).toContainText("revisión profesional");
  const stored = await page.evaluate(() => localStorage.getItem("insulog.history.v1"));
  expect(stored).toBeNull();
});
