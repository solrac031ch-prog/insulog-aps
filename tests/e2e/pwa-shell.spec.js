const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");

const swSource = fs.readFileSync(path.join(__dirname, "..", "..", "sw.js"), "utf8");
const releaseMatch = swSource.match(/const CACHE_NAME = "insulog-shell-([0-9a-f]{16})"/);
if (!releaseMatch) throw new Error("No se encontró fingerprint canónico en sw.js");
const RELEASE = releaseMatch[1];

test.use({ serviceWorkers: "allow" });

test("la actualización PWA avisa sin reclamar una atención abierta", async () => {
  expect(swSource).toContain('self.clients.matchAll({ type: "window", includeUncontrolled: true })');
  expect(swSource).toContain('type: "INSULOG_UPDATE_READY"');
  expect(swSource).not.toContain("clients.claim()");
});


test("el app shell se instala completo y sirve una sola versión offline", async ({ page, context }) => {
  await page.goto("/");

  await expect.poll(async () => {
    try {
      return await page.evaluate(async () => {
        await navigator.serviceWorker.ready;
        return true;
      });
    } catch {
      return false;
    }
  }).toBe(true);

  let controlled = false;
  try {
    controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  } catch {
    await page.waitForLoadState("domcontentloaded");
  }

  if (!controlled) await page.reload({ waitUntil: "domcontentloaded" });

  await expect.poll(
    async () => {
      try {
        return await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
      } catch {
        return false;
      }
    },
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
  expect(shellState[0].key).toBe(`insulog-shell-${RELEASE}`);
  expect(shellState[0].urls.length).toBeGreaterThanOrEqual(20);

  const cachedPaths = shellState[0].urls.map((url) => new URL(url).pathname);
  expect(new Set(cachedPaths).size).toBe(cachedPaths.length);
  expect(cachedPaths.some((pathName) => pathName.endsWith("/index.html"))).toBe(true);
  expect(cachedPaths.some((pathName) => pathName.endsWith("/pdf-preview.html"))).toBe(true);
  expect(cachedPaths.some((pathName) => pathName.endsWith("/document-flow.css"))).toBe(true);

  const cachedVersions = shellState[0].urls
    .map((url) => new URL(url).searchParams.get("v"))
    .filter(Boolean);
  expect(new Set(cachedVersions)).toEqual(new Set([RELEASE]));

  await context.setOffline(true);

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#p0")).toHaveClass(/active/);
  await expect(page.locator(".brand-title")).toHaveText("Insulog APS");

  await page.goto(`/pdf-preview.html?v=${RELEASE}`, { waitUntil: "domcontentloaded" });
  await expect(page.locator("body")).toHaveClass(/pdf-isolated-document/);
  await expect(page.locator("#pdf")).toHaveCount(1);

  await context.setOffline(false);
});
