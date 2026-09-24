const { test, expect } = require("@playwright/test");

test("las pantallas de trabajo mantienen una interfaz limpia sin copy redundante", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("footer")).toHaveCount(0);

  for (const id of ["#p1", "#p2", "#p41"]) {
    const label = page.locator(`${id} .page-label`);
    await expect(label).toHaveClass(/sr-only/);
  }

  await expect(page.locator("#p2 > .lead")).toHaveCount(0);
  await expect(page.locator("#p2 .action-caption")).toHaveCount(0);
  await expect(page.locator("#p3 > .lead")).toHaveCount(0);
  await expect(page.locator("#p35 > .lead")).toHaveCount(0);
  await expect(page.locator("#p5 > .lead")).toHaveCount(0);
  await expect(page.locator("#p6 .date-row")).toHaveClass(/sr-only/);

  await expect(page.locator("#best-professional-review .helper-text")).toHaveCount(0);
});

test("la guía clínica importante permanece visible después de la limpieza", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator("#p1")).toContainText("Si presenta alguna de estas condiciones");
  await expect(page.locator("#p2 .alert-warning")).toContainText("glibenclamida");
  await expect(page.locator("#p4 > .lead")).toContainText("al menos 3 HGT en ayunas");
  await expect(page.locator("#p41 .alert-danger")).toContainText("≥0,5 UI/kg/día");
  await expect(page.locator("#p0 .evidence-card")).toContainText("Fuentes clínicas y versión");
});
