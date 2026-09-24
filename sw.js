"use strict";

const CACHE_NAME = "insulog-shell-beceb072f8462345";
const DEPLOYMENT_REVISION = "release-beceb072f8462345";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=beceb072f8462345";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=beceb072f8462345",
  "./document-flow.css?v=beceb072f8462345",
  "./pdf-enhancements.css?v=beceb072f8462345",
  "./pdf-design-2026.css?v=beceb072f8462345",
  "./aps-safety-2026.css?v=beceb072f8462345",
  "./farmacia-popular.css?v=beceb072f8462345",
  "./app-runtime.js?v=beceb072f8462345",
  "./clinical-engine.js?v=beceb072f8462345",
  "./clinical-copy.js?v=beceb072f8462345",
  "./note-presenter.js?v=beceb072f8462345",
  "./app.js?v=beceb072f8462345",
  "./safety-guard.js?v=beceb072f8462345",
  "./patient-document.js?v=beceb072f8462345",
  "./pdf-enhancements.js?v=beceb072f8462345",
  "./aps-safety-2026.js?v=beceb072f8462345",
  "./farmacia-popular.js?v=beceb072f8462345",
  "./document-flow.js?v=beceb072f8462345",
  "./app-shell.js?v=beceb072f8462345",
  "./phase6b-professional-decision.js?v=beceb072f8462345",
  "./phase6b-document-sync.js?v=beceb072f8462345",
  "./manifest.webmanifest?v=beceb072f8462345",
  "./assets/icons/icon-32.png?v=beceb072f8462345",
  "./assets/icons/icon-180.png?v=beceb072f8462345",
  "./assets/icons/icon-192.png?v=beceb072f8462345",
  "./assets/icons/icon-512.png?v=beceb072f8462345"
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
