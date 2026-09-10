"use strict";

const CACHE_NAME = "insulog-shell-20260910-atomic18";
const DEPLOYMENT_REVISION = "runtime-navigation-20260910-r1";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=20260910-1";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=20260826",
  "./pdf-enhancements.css?v=20260827-4",
  "./pdf-design-2026.css?v=20260827-1",
  "./document-flow.css?v=20260910-1",
  "./aps-safety-2026.css?v=20260827-2",
  "./farmacia-popular.css?v=20260827-2",
  "./app-runtime.js?v=20260910-1",
  "./app.js?v=20260910-1",
  "./patient-document.js?v=20260910-1",
  "./pdf-enhancements.js?v=20260827-4",
  "./aps-safety-2026.js?v=20260910-1",
  "./farmacia-popular.js?v=20260827-4",
  "./document-flow.js?v=20260910-1",
  "./app-shell.js?v=20260910-1",
  "./manifest.webmanifest?v=20260826",
  "./assets/icons/icon-32.png?v=20260826",
  "./assets/icons/icon-180.png?v=20260826",
  "./assets/icons/icon-192.png?v=20260826",
  "./assets/icons/icon-512.png?v=20260826"
];

const STATIC_PATHS = new Set(
  APP_SHELL.map((asset) => new URL(asset, self.location.href).pathname)
);

async function fetchFresh(request) {
  const response = await fetch(new Request(request, { cache: "reload" }));
  if (!response.ok) {
    throw new Error(`No se pudo actualizar ${request.url || request}: HTTP ${response.status}`);
  }
  return response;
}

async function precacheFreshShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (asset) => {
    const request = new Request(asset, { cache: "reload" });
    const response = await fetchFresh(request);
    await cache.put(asset, response.clone());
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheFreshShell().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    // La app y el documento imprimible son dos documentos HTML distintos.
    // Ambos usan network-first, pero nunca se sustituyen entre sí.
    const navigationAsset = url.pathname.endsWith("/pdf-preview.html")
      ? PDF_PREVIEW_PATH
      : "./index.html";

    const refreshNavigation = caches.open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetchFresh(new Request(navigationAsset, { cache: "reload" }));
        await cache.put(navigationAsset, response.clone());
        return response;
      });

    event.waitUntil(refreshNavigation.catch(() => undefined));
    event.respondWith(
      refreshNavigation.catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(navigationAsset)) || fetch(request);
      })
    );
    return;
  }

  if (!STATIC_PATHS.has(url.pathname)) return;

  const refreshAsset = caches.open(CACHE_NAME)
    .then(async (cache) => {
      const response = await fetchFresh(request);
      await cache.put(request, response.clone());
      return response;
    });

  event.waitUntil(refreshAsset.catch(() => undefined));
  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(request))
      .then((cached) => cached || refreshAsset)
      .catch(() => fetch(request))
  );
});