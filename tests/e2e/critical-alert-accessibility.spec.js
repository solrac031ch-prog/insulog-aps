const { test, expect } = require("@playwright/test");

async function openFollowupTable(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expect(page.locator("#p4")).toHaveClass(/active/);
}

async function fillValues(locator, values) {
  for (let index = 0; index < values.length; index += 1) {
    await locator.nth(index).fill(String(values[index]));
  }
}

test("la alerta de hipoglicemia se anuncia y queda dentro del viewport tras ajustar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFollowupTable(page);

  await page.locator("#peso-seguimiento").fill("70");
  await page.locator("#tipo-esquema").selectOption("pm");
  await page.locator("#pm-actual").fill("20");
  await fillValues(page.locator("#tabla-seguimiento .ay"), [60, 105, 110]);

  const alerta = page.locator("#alerta-hipoglicemia-ada");
  await expect(alerta).toHaveAttribute("aria-hidden", "true");

  await page.locator("#ajustar-seguimiento-btn").click();

  await expect(alerta).toBeVisible();
  await expect(alerta).toHaveAttribute("role", "alert");
  await expect(alerta).toHaveAttribute("aria-live", "polite");
  await expect(alerta).toHaveAttribute("aria-hidden", "false");
  await expect(page.locator("#hipo-ada-titulo")).toContainText("nivel 1");
  await expect(page.locator("#hipo-sin-ayuda")).toBeVisible();
  await expect(page.locator("#hipo-con-ayuda")).toBeVisible();

  await expect.poll(async () => alerta.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);
});

test("la revisión de dosis alta lleva el foco al encabezado clínico de P41", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFollowupTable(page);

  await page.locator("#peso-seguimiento").fill("50");
  await page.locator("#tipo-esquema").selectOption("2");
  await page.locator("#am-actual").fill("20");
  await page.locator("#pm-actual").fill("20");
  await fillValues(page.locator("#tabla-seguimiento .ay"), [160, 160, 160]);
  await fillValues(page.locator("#tabla-seguimiento .pre"), [160, 160, 160]);

  await page.locator("#ajustar-seguimiento-btn").click();

  await expect(page.locator("#p41")).toHaveClass(/active/);
  const heading = page.locator("#p41 h2");
  await expect(heading).toContainText(/dosis alta|sobreinsulinización/i);
  await expect(heading).toHaveAttribute("tabindex", "-1");
  await expect.poll(async () => page.evaluate(() => document.activeElement?.closest("#p41 h2") !== null)).toBe(true);

  await expect.poll(async () => heading.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return rect.top >= 0 && rect.top < window.innerHeight && rect.bottom > 0;
  })).toBe(true);
});
