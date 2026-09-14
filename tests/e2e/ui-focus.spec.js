const { test, expect } = require("@playwright/test");

test("la portada arranca sin enfocar el título, pero la navegación conserva foco accesible", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const title = page.locator("#p0 .brand-title");
  await expect(title).toBeVisible();
  await expect(title).not.toHaveAttribute("tabindex", "-1");

  const initialFocus = await page.evaluate(() => document.activeElement?.className || document.activeElement?.tagName || "");
  expect(initialFocus).not.toContain("brand-title");

  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  const safetyHeading = page.locator("#p1 h2");
  await expect(safetyHeading).toHaveAttribute("tabindex", "-1");
  await expect(safetyHeading).toBeFocused();
});
