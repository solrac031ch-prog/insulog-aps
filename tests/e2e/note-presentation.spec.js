const { test, expect } = require("@playwright/test");

async function renderNote(page, text) {
  await page.evaluate((value) => window.InsulogApp.notes.render(value), text);
  return page.locator("#nota-clinica .nota-linea").first();
}

test("la nota clínica colorea HbA1c según el valor real y no el 1 de HbA1c", async ({ page }) => {
  await page.goto("/");

  const green = await renderNote(page, "HbA1c estimada a 90 días si mantiene este patrón: 6.9%");
  await expect(green).toHaveClass(/nota-verde/);

  const yellow = await renderNote(page, "HbA1c estimada a 90 días si mantiene este patrón: 8.5%");
  await expect(yellow).toHaveClass(/nota-amarilla/);
  await expect(yellow).not.toHaveClass(/nota-verde/);

  const red = await renderNote(page, "HbA1c estimada a 90 días si mantiene este patrón: 9.0%");
  await expect(red).toHaveClass(/nota-roja/);
  await expect(red).not.toHaveClass(/nota-verde/);
});
