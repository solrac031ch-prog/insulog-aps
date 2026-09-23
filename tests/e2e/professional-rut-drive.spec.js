const { test, expect } = require("@playwright/test");

test("Drive queda configurado automáticamente y el RUT profesional se solicita una vez al día", async ({ page }) => {
  await page.goto("/");

  let status = await page.evaluate(() => window.InsulogPhase6BDocumentSync.driveStatus());
  expect(status.configured).toBe(true);
  expect(status.automaticProductionEndpoint).toBe(true);
  expect(status.professionalRutRegisteredToday).toBe(true);

  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#professional-rut-gate")).toBeVisible();
  await page.locator("#professional-rut-input").fill("12.345.678-5");
  await page.locator("#professional-rut-submit").click();

  await expect(page.locator("#professional-rut-gate")).toHaveCount(0);
  await expect.poll(() => page.evaluate(
    () => window.InsulogPhase6BDocumentSync.driveStatus().professionalRutRegisteredToday
  )).toBe(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#professional-rut-gate")).toHaveCount(0);

  status = await page.evaluate(() => window.InsulogPhase6BDocumentSync.driveStatus());
  expect(status.configured).toBe(true);
  expect(status.automaticProductionEndpoint).toBe(true);
});

test("un RUT profesional válido queda disponible para el registro clínico del día", async ({ page }) => {
  await page.goto("/");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("insulog.professional.rut.daily.v1") || "null"));
  expect(stored).not.toBeNull();
  expect(stored.rut).toBe("12.345.678-5");
});


test("RUT inválido mantiene bloqueado el acceso diario", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.locator("#professional-rut-gate")).toBeVisible();
  await page.locator("#professional-rut-input").fill("12.345.678-9");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-rut-error")).toContainText("RUT no válido");
  await expect(page.locator("#professional-rut-gate")).toBeVisible();
});
