const { test, expect } = require("@playwright/test");

test.use({ serviceWorkers: "allow" });

test("el app shell se instala completo y sirve una sola versión offline", async ({ page, context }) => {
  await page.goto("/");

  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });

  if (!(await page.evaluate(() => Boolean(navigator.serviceWorker.controller)))) {
    await page.reload({ waitUntil: "domcontentloaded" });
  }

  await expect.poll(
    () => page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    { message: "La segunda navegación debe quedar controlada por el service worker" }
  ).toBe(true);

  const shellState = await page.evaluate(async () => {
    const shellKeys = (await caches.keys()).filter((key) => key.startsWith("insulog-shell-"));
    const entries = [];
    for (const key of shellKeys) {
      const cache = await caches.open(key);
      entries.push({
        key,
        urls: (await cache.keys()).map((request) => request.url)
      });
    }
    return entries;
  });

  expect(shellState).toHaveLength(1);
  expect(shellState[0].key).toBe("insulog-shell-20260914-atomic26");
  expect(shellState[0].urls.length).toBeGreaterThanOrEqual(20);

  const cachedPaths = shellState[0].urls.map((url) => new URL(url).pathname);
  expect(new Set(cachedPaths).size).toBe(cachedPaths.length);
  expect(cachedPaths.some((path) => path.endsWith("/index.html"))).toBe(true);
  expect(cachedPaths.some((path) => path.endsWith("/pdf-preview.html"))).toBe(true);
  expect(cachedPaths.some((path) => path.endsWith("/document-flow.css"))).toBe(true);

  await context.setOffline(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#p0")).toHaveClass(/active/);
  await expect(page.locator(".brand-title")).toHaveText("Insulog APS");

  await page.goto("/pdf-preview.html?v=20260914-1", { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/pdf-isolated-document/);
  await expect(page.locator("#pdf")).toHaveCount(1);

  await context.setOffline(false);
});
