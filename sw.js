"use strict";

const CACHE_NAME = "insulog-shell-d66600d4dc89809f";
const DEPLOYMENT_REVISION = "release-d66600d4dc89809f";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=d66600d4dc89809f";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=d66600d4dc89809f",
  "./document-flow.css?v=d66600d4dc89809f",
  "./pdf-enhancements.css?v=d66600d4dc89809f",
  "./pdf-design-2026.css?v=d66600d4dc89809f",
  "./aps-safety-2026.css?v=d66600d4dc89809f",
  "./farmacia-popular.css?v=d66600d4dc89809f",
  "./app-runtime.js?v=d66600d4dc89809f",
  "./clinical-engine.js?v=d66600d4dc89809f",
  "./clinical-copy.js?v=d66600d4dc89809f",
  "./note-presenter.js?v=d66600d4dc89809f",
  "./app.js?v=d66600d4dc89809f",
  "./safety-guard.js?v=d66600d4dc89809f",
  "./patient-document.js?v=d66600d4dc89809f",
  "./pdf-enhancements.js?v=d66600d4dc89809f",
  "./aps-safety-2026.js?v=d66600d4dc89809f",
  "./farmacia-popular.js?v=d66600d4dc89809f",
  "./document-flow.js?v=d66600d4dc89809f",
  "./app-shell.js?v=d66600d4dc89809f",
  "./phase6b-professional-decision.js?v=d66600d4dc89809f",
  "./phase6b-document-sync.js?v=d66600d4dc89809f",
  "./manifest.webmanifest?v=d66600d4dc89809f",
  "./assets/icons/icon-32.png?v=d66600d4dc89809f",
  "./assets/icons/icon-180.png?v=d66600d4dc89809f",
  "./assets/icons/icon-192.png?v=d66600d4dc89809f",
  "./assets/icons/icon-512.png?v=d66600d4dc89809f"
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
