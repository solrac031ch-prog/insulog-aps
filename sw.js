"use strict";

const CACHE_NAME = "insulog-shell-e8282ae94d3aa95d";
const DEPLOYMENT_REVISION = "release-e8282ae94d3aa95d";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=e8282ae94d3aa95d";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=e8282ae94d3aa95d",
  "./document-flow.css?v=e8282ae94d3aa95d",
  "./pdf-enhancements.css?v=e8282ae94d3aa95d",
  "./pdf-design-2026.css?v=e8282ae94d3aa95d",
  "./aps-safety-2026.css?v=e8282ae94d3aa95d",
  "./farmacia-popular.css?v=e8282ae94d3aa95d",
  "./app-runtime.js?v=e8282ae94d3aa95d",
  "./clinical-engine.js?v=e8282ae94d3aa95d",
  "./clinical-copy.js?v=e8282ae94d3aa95d",
  "./note-presenter.js?v=e8282ae94d3aa95d",
  "./app.js?v=e8282ae94d3aa95d",
  "./safety-guard.js?v=e8282ae94d3aa95d",
  "./patient-document.js?v=e8282ae94d3aa95d",
  "./pdf-enhancements.js?v=e8282ae94d3aa95d",
  "./aps-safety-2026.js?v=e8282ae94d3aa95d",
  "./farmacia-popular.js?v=e8282ae94d3aa95d",
  "./document-flow.js?v=e8282ae94d3aa95d",
  "./app-shell.js?v=e8282ae94d3aa95d",
  "./phase6b-professional-decision.js?v=e8282ae94d3aa95d",
  "./phase6b-document-sync.js?v=e8282ae94d3aa95d",
  "./manifest.webmanifest?v=e8282ae94d3aa95d",
  "./assets/icons/icon-32.png?v=e8282ae94d3aa95d",
  "./assets/icons/icon-180.png?v=e8282ae94d3aa95d",
  "./assets/icons/icon-192.png?v=e8282ae94d3aa95d",
  "./assets/icons/icon-512.png?v=e8282ae94d3aa95d"
];

const SHELL_ASSET_BY_PATH = new Map(
  APP_SHELL.map((asset) => [new URL(asset, self.registration.scope).pathname, asset])
);

async function fetchFresh(asset) {
  const request = new Request(asset, { cache: "reload" });
  const response = await fetch(request);
  if (!response.ok) {
    throw new Error(`No se pudo preparar ${asset}: HTTP ${response.status}`);
  }
  return response;
}

async function precacheFreshShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (asset) => {
    const response = await fetchFresh(asset);
    await cache.put(asset, response.clone());
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    await precacheFreshShell();
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((key) => key.startsWith("insulog-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    );

    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    windows.forEach((client) => client.postMessage({
      type: "INSULOG_UPDATE_READY",
      release: DEPLOYMENT_REVISION
    }));
  })());
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const navigationAsset = url.pathname.endsWith("/pdf-preview.html")
      ? PDF_PREVIEW_PATH
      : "./index.html";

    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match(navigationAsset))
        .then((cached) => cached || fetch(request))
    );
    return;
  }

  const shellAsset = SHELL_ASSET_BY_PATH.get(url.pathname);
  if (!shellAsset) return;

  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(shellAsset))
      .then((cached) => cached || fetch(request))
  );
});
