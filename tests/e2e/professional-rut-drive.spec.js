const { test, expect } = require("@playwright/test");

test("Drive queda configurado automáticamente y el RUT profesional se solicita una vez al día", async ({ page }) => {
  await page.goto("/");

  let status = await page.evaluate(() => window.InsulogPhase6BDocumentSync.driveStatus());
  expect(status.configured).toBe(true);
  expect(status.automaticProductionEndpoint).toBe(true);
  expect(status.professionalRutRegisteredToday).toBe(true);

  await page.evaluate(() => localStorage.removeItem("insulog.professional.rut.daily.v1"));

  let promptCount = 0;
  page.on("dialog", async (dialog) => {
    if (dialog.type() === "prompt") {
      promptCount += 1;
      await dialog.accept("12.345.678-5");
      return;
    }
    await dialog.accept();
  });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect.poll(() => page.evaluate(
    () => window.InsulogPhase6BDocumentSync.driveStatus().professionalRutRegisteredToday
  )).toBe(true);
  expect(promptCount).toBe(1);

  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(150);
  expect(promptCount).toBe(1);

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
