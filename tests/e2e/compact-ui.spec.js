const { test, expect } = require("@playwright/test");

test("la interfaz clínica mantiene solo ayudas esenciales", async ({ page }) => {
  await page.goto("/");

  const identity = page.locator("#professional-identity-bar");
  await expect(identity).toBeVisible();
  await expect(identity).toContainText("Sesión profesional");
  await expect(identity).toContainText("Activo");
  await expect(identity).not.toContainText("Profesional activo");
  await expect(identity).not.toContainText("Registro operativo activo");
  await expect(identity).not.toContainText("Base clínica habilitada");

  await expect(page.locator("#p2 .action-caption")).toHaveCount(0);
  await expect(page.locator("#p5 .lead")).toHaveCount(0);
  await expect(page.locator("#p5 .decision-card .card-title")).toHaveCount(0);
  await expect(page.locator("#p6 h2")).toHaveText("Datos del paciente");

  const review = page.locator("#best-professional-review");
  await expect(review).toHaveCount(1);
  await expect(review.locator(":scope > .helper-text")).toHaveCount(0);
});

test("la recomendación de inicio prioriza esquema y factor y deja el criterio colapsable", async ({ page }) => {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "Fracaso terapia oral", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expect(page.locator("#p25")).toHaveClass(/active/);
  await page.locator("#p25").getByRole("button", { name: "CONTINUAR A DOSIFICACIÓN NPH", exact: true }).click();

  await expect(page.locator("#p3")).toHaveClass(/active/);
  await expect(page.locator("#p3 > .lead")).toHaveCount(0);

  const summary = page.locator("#resumen-esquema-inicio");
  await expect(summary).toBeVisible();
  await expect(summary.locator(".init-suggestion-main")).toContainText("Esquema:");
  await expect(summary.locator(".init-suggestion-main")).toContainText("Factor:");
  await expect(summary.locator("summary")).toHaveText("Ver criterio clínico");
  await expect(summary).not.toContainText("Esquema sugerido:");
  await expect(summary).not.toContainText("Factor sugerido:");
});
