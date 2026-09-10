const { test, expect } = require("@playwright/test");

async function expectActivePage(page, id) {
  const section = page.locator(`#${id}`);
  await expect(section).toHaveClass(/(^|\s)active(\s|$)/);
  await expect(section).toHaveAttribute("aria-hidden", "false");
}

async function openFollowupTable(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await expectActivePage(page, "p35");
  await expect(page.locator('#p35 input[data-aps-med="seguimiento"][data-med-key="metformina850"]')).toBeAttached();
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expectActivePage(page, "p4");
}

test("portada 7B prioriza la acción clínica y oculta códigos internos", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(page.locator("#p0 .page-label")).toHaveText("Apoyo clínico · DM2 en APS");
  await expect(page.locator("#p0")).not.toContainText("[P0]");
  await expect(page.locator("#p0 .hero-note")).toBeVisible();
  await expect(page.locator("#p0 .evidence-card")).not.toHaveAttribute("open", "");
  await expect(page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true })).toBeVisible();
});

test("tabla HGT cabe en 390 px sin scroll horizontal interno", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openFollowupTable(page);

  const layout = await page.locator("#p4 .table-wrap").evaluate((wrap) => {
    const table = wrap.querySelector(".tracking-table");
    const firstGlucose = wrap.querySelector(".glicemia");
    const documentElement = document.documentElement;
    return {
      wrapClientWidth: wrap.clientWidth,
      wrapScrollWidth: wrap.scrollWidth,
      tableWidth: table?.getBoundingClientRect().width || 0,
      firstGlucoseWidth: firstGlucose?.getBoundingClientRect().width || 0,
      documentClientWidth: documentElement.clientWidth,
      documentScrollWidth: documentElement.scrollWidth
    };
  });

  expect(layout.wrapScrollWidth).toBeLessThanOrEqual(layout.wrapClientWidth + 1);
  expect(layout.tableWidth).toBeLessThanOrEqual(layout.wrapClientWidth + 1);
  expect(layout.firstGlucoseWidth).toBeGreaterThan(44);
  expect(layout.documentScrollWidth).toBeLessThanOrEqual(layout.documentClientWidth + 2);
});
