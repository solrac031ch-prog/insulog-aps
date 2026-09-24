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


test("acepta RUT profesional con cuerpo de 7 dígitos y DV numérico", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("#professional-rut-input").fill("1.234.567-4");
  await page.locator("#professional-rut-submit").click();

  await expect(page.locator("#professional-rut-gate")).toHaveCount(0);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("insulog.professional.rut.daily.v1") || "null"));
  expect(stored.rut).toBe("1.234.567-4");
});

test("acepta RUT profesional de 7 u 8 dígitos con DV K y entrada sin formato", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("#professional-rut-input").fill("1000005k");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-rut-gate")).toHaveCount(0);

  let stored = await page.evaluate(() => JSON.parse(localStorage.getItem("insulog.professional.rut.daily.v1") || "null"));
  expect(stored.rut).toBe("1.000.005-K");

  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator("#professional-rut-input").fill("10000013K");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-rut-gate")).toHaveCount(0);

  stored = await page.evaluate(() => JSON.parse(localStorage.getItem("insulog.professional.rut.daily.v1") || "null"));
  expect(stored.rut).toBe("10.000.013-K");
});

test("explica si falla el largo o el dígito verificador", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("#professional-rut-input").fill("123456-7");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-rut-error")).toContainText("7 u 8 dígitos");

  await page.locator("#professional-rut-input").fill("1234567-5");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-rut-error")).toContainText("DV correcto es 4");
});


test("muestra profesional activo enmascarado y permite cambiar o cerrar sesión en equipo compartido", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.locator("#professional-rut-input").fill("12.345.678-5");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-active-panel")).toContainText("Profesional activo");
  await expect(page.locator("#professional-active-panel")).toContainText("••••••••-5");
  await expect(page.locator("#professional-active-panel")).not.toContainText("12.345.678");

  await page.locator("#professional-change-btn").click();
  await expect(page.locator("#professional-rut-gate")).toBeVisible();
  await page.locator("#professional-rut-input").fill("1.234.567-4");
  await page.locator("#professional-rut-submit").click();
  await expect(page.locator("#professional-active-panel")).toContainText("••••••••-4");

  await page.locator("#professional-logout-btn").click();
  await expect(page.locator("#professional-rut-gate")).toBeVisible();
  const stored = await page.evaluate(() => localStorage.getItem("insulog.professional.rut.daily.v1"));
  expect(stored).toBeNull();
});
