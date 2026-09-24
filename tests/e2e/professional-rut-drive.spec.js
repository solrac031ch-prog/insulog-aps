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


test("Inicio muestra el profesional activo enmascarado y permite cambiarlo", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("insulog.professional.rut.daily.v1", JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      rut: "12.345.678-5"
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const identity = page.locator("#professional-identity-bar");
  await expect(identity).toBeVisible();
  await expect(identity).toContainText("Profesional");
  await expect(identity).not.toContainText("Sesión profesional");
  await expect(identity).not.toContainText("Activo");
  await expect(identity).not.toContainText("Registro operativo activo");
  await expect(identity).not.toContainText("Base clínica habilitada");
  await expect(identity).not.toContainText("12.345.678-5");
  await expect(identity).toContainText("678-5");
  await expect(identity.locator(".professional-card__status.ok")).toHaveAttribute("aria-label", "Registro operativo activo");
  await expect(identity.locator(".professional-card__dot")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cambiar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Cerrar", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Cambiar", exact: true }).click();
  await expect(page.locator("#professional-rut-gate")).toBeVisible();
  await page.locator("#professional-rut-input").fill("1.234.567-4");
  await page.locator("#professional-rut-submit").click();
  await expect(identity).toContainText("567-4");
  await expect(identity).not.toContainText("1.234.567-4");
});


test("no reutiliza identidad profesional cuando existe un caso clínico parcialmente completado", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("insulog.professional.rut.daily.v1", JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      rut: "12.345.678-5"
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  await page.evaluate(() => {
    const input = document.getElementById("peso-paciente");
    input.value = "82";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });

  let message = "";
  page.once("dialog", async (dialog) => {
    message = dialog.message();
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Cambiar", exact: true }).click();

  expect(message).toContain("Finalice el caso clínico actual");
  await expect(page.locator("#professional-rut-gate")).toHaveCount(0);
  await expect(page.locator("#professional-identity-bar")).toContainText("678-5");
});

test("HGT mayor a 600 no se recorta silenciosamente antes de la validación clínica", async ({ page }) => {
  await page.goto("/");
  const value = await page.evaluate(() => {
    const input = document.createElement("input");
    input.className = "glicemia";
    input.value = "601";
    window.InsulogApp.inputs.handle({ target: input });
    return input.value;
  });
  expect(value).toBe("601");
});


test("la sesión profesional expone estado operativo claro y responsive", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("insulog.professional.rut.daily.v1", JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      rut: "12.345.678-5"
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const identity = page.locator("#professional-identity-bar");
  await expect(identity).toBeVisible();
  await expect(identity.locator(".professional-card__rut")).toContainText("678-5");
  await expect(identity.locator(".professional-card__status.ok")).toHaveAttribute("aria-label", "Registro operativo activo");
  await expect(identity.locator(".professional-card__dot")).toBeVisible();
  await expect(identity).not.toContainText("Activo");
  await expect(identity).not.toContainText("Base clínica habilitada");

  await page.setViewportSize({ width: 390, height: 844 });
  const box = await identity.boundingBox();
  expect(box).not.toBeNull();
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(390);
});


test("la sesión profesional conserva estilo crítico aunque el RUT ya esté guardado", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    localStorage.setItem("insulog.professional.rut.daily.v1", JSON.stringify({
      date: new Date().toISOString().slice(0, 10),
      rut: "12.345.678-5"
    }));
  });
  await page.reload({ waitUntil: "domcontentloaded" });

  const fallbackStyles = page.locator("#insulog-professional-rut-styles");
  await expect(fallbackStyles).toHaveCount(1);
  const fallbackCss = await fallbackStyles.evaluate((node) => node.textContent || "");
  expect(fallbackCss).toContain(".professional-card");

  const computed = await page.locator("#professional-identity-bar .professional-card").evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      display: style.display,
      borderRadius: style.borderRadius
    };
  });
  expect(computed.display).toBe("flex");
  expect(parseFloat(computed.borderRadius)).toBeGreaterThanOrEqual(10);
});
