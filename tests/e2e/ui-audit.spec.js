const { test, expect } = require("@playwright/test");

async function snap(page, testInfo, key, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(250);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "auto" }));
  await page.waitForTimeout(50);
  const path = testInfo.outputPath(`${key}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled", caret: "hide" });
  await testInfo.attach(`${key}.png`, { path, contentType: "image/png" });
}

async function gotoP2(page) {
  await page.goto("/");
  await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
  await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
  await expect(page.locator("#p2")).toHaveClass(/active/);
}

async function gotoP25(page) {
  await gotoP2(page);
  await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
  await page.locator("#p2 #criterios").waitFor({ state: "visible" });
  await page.locator("#p2").getByRole("button", { name: "Fracaso terapia oral", exact: true }).click();
  await page.locator("#p2").getByRole("button", { name: "SIGUIENTE: DOSIFICACIÓN", exact: true }).click();
  await expect(page.locator("#p25")).toHaveClass(/active/);
}

async function gotoP3(page) {
  await gotoP25(page);
  await page.locator("#p25").getByRole("button", { name: /CONTINUAR/i }).click();
  await expect(page.locator("#p3")).toHaveClass(/active/);
}

async function gotoP35(page) {
  await gotoP2(page);
  await page.locator("#p2").getByRole("button", { name: "SEGUIMIENTO DE INSULINA", exact: true }).click();
  await expect(page.locator("#p35")).toHaveClass(/active/);
}

async function gotoP4(page) {
  await gotoP35(page);
  await page.locator("#p35").getByRole("button", { name: "CONTINUAR AL REGISTRO DE GLICEMIAS", exact: true }).click();
  await expect(page.locator("#p4")).toHaveClass(/active/);
}

for (const profile of [
  { name: "mobile", viewport: { width: 390, height: 844 } },
  { name: "desktop", viewport: { width: 1440, height: 1000 } }
]) {
  test.describe(`UI audit ${profile.name}`, () => {
    test("screens", async ({ page }, testInfo) => {
      await page.goto("/");
      await snap(page, testInfo, `${profile.name}-p0-full`, profile.viewport);

      await page.locator("#p0").getByRole("button", { name: "INICIAR ALGORITMO", exact: true }).click();
      await snap(page, testInfo, `${profile.name}-p1-full`, profile.viewport);

      await page.locator("#p1").getByRole("button", { name: "NO", exact: true }).click();
      await snap(page, testInfo, `${profile.name}-p2-full`, profile.viewport);

      await page.locator("#p2").getByRole("button", { name: "INICIO DE INSULINA", exact: true }).click();
      await snap(page, testInfo, `${profile.name}-p2-expanded-full`, profile.viewport);

      await page.reload();
      await gotoP25(page);
      await snap(page, testInfo, `${profile.name}-p25-full`, profile.viewport);

      await page.reload();
      await gotoP3(page);
      await snap(page, testInfo, `${profile.name}-p3-full`, profile.viewport);

      await page.reload();
      await gotoP35(page);
      await snap(page, testInfo, `${profile.name}-p35-full`, profile.viewport);

      await page.reload();
      await gotoP4(page);
      await snap(page, testInfo, `${profile.name}-p4-full`, profile.viewport);
    });
  });
}
