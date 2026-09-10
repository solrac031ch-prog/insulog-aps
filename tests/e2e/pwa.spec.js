const { test, expect } = require("@playwright/test");

test.use({ serviceWorkers: "allow" });

test("la PWA sirve el mismo catálogo que el código fuente sin reescribir JavaScript", async ({ page }) => {
  await page.goto("/");

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload();
  }

  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    { message: "La página debe quedar controlada por el service worker" }
  ).toBe(true);

  const servedSource = await page.evaluate(async () => {
    const response = await fetch("./aps-safety-2026.js?v=20260910-1", { cache: "reload" });
    return response.text();
  });

  expect(servedSource).toContain('label: "Empagliflozina"');
  expect(servedSource).toContain('doses: ["12,5/850 mg/día", "12,5/1.000 mg/día"]');
  expect(servedSource).not.toContain('label: "Empagliflozina 10 mg"');

  await page.evaluate(() => nav(35));

  const empa = page.locator('#p35 input[data-med-key="empagliflozina"]');
  const empaCard = empa.locator("xpath=ancestor::label[1]");
  await expect(empaCard.locator(".aps-med-name")).toHaveText("Empagliflozina");

  const empaMet = page.locator('#p35 input[data-med-key="empaMet12_5_1000"]');
  const empaMetCard = empaMet.locator("xpath=ancestor::label[1]");
  const options = await empaMetCard.locator(".aps-med-dose option").allTextContents();
  expect(options).toEqual(["12,5/850 mg/día", "12,5/1.000 mg/día"]);

  const shellCaches = await page.evaluate(async () =>
    (await caches.keys()).filter((name) => name.startsWith("insulog-shell-"))
  );
  expect(shellCaches).toEqual(["insulog-shell-20260910-atomic16"]);
});
