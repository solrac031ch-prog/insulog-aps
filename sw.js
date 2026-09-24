"use strict";

const CACHE_NAME = "insulog-shell-bc6728d6c8e297af";
const DEPLOYMENT_REVISION = "release-bc6728d6c8e297af";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=bc6728d6c8e297af";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=bc6728d6c8e297af",
  "./document-flow.css?v=bc6728d6c8e297af",
  "./pdf-enhancements.css?v=bc6728d6c8e297af",
  "./pdf-design-2026.css?v=bc6728d6c8e297af",
  "./aps-safety-2026.css?v=bc6728d6c8e297af",
  "./farmacia-popular.css?v=bc6728d6c8e297af",
  "./app-runtime.js?v=bc6728d6c8e297af",
  "./clinical-engine.js?v=bc6728d6c8e297af",
  "./clinical-copy.js?v=bc6728d6c8e297af",
  "./note-presenter.js?v=bc6728d6c8e297af",
  "./app.js?v=bc6728d6c8e297af",
  "./safety-guard.js?v=bc6728d6c8e297af",
  "./patient-document.js?v=bc6728d6c8e297af",
  "./pdf-enhancements.js?v=bc6728d6c8e297af",
  "./aps-safety-2026.js?v=bc6728d6c8e297af",
  "./farmacia-popular.js?v=bc6728d6c8e297af",
  "./document-flow.js?v=bc6728d6c8e297af",
  "./app-shell.js?v=bc6728d6c8e297af",
  "./phase6b-professional-decision.js?v=bc6728d6c8e297af",
  "./phase6b-document-sync.js?v=bc6728d6c8e297af",
  "./manifest.webmanifest?v=bc6728d6c8e297af",
  "./assets/icons/icon-32.png?v=bc6728d6c8e297af",
  "./assets/icons/icon-180.png?v=bc6728d6c8e297af",
  "./assets/icons/icon-192.png?v=bc6728d6c8e297af",
  "./assets/icons/icon-512.png?v=bc6728d6c8e297af"
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
