"use strict";

const CACHE_NAME = "insulog-shell-8939ab06645f8976";
const DEPLOYMENT_REVISION = "release-8939ab06645f8976";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=8939ab06645f8976";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=8939ab06645f8976",
  "./document-flow.css?v=8939ab06645f8976",
  "./pdf-enhancements.css?v=8939ab06645f8976",
  "./pdf-design-2026.css?v=8939ab06645f8976",
  "./aps-safety-2026.css?v=8939ab06645f8976",
  "./farmacia-popular.css?v=8939ab06645f8976",
  "./app-runtime.js?v=8939ab06645f8976",
  "./clinical-engine.js?v=8939ab06645f8976",
  "./clinical-copy.js?v=8939ab06645f8976",
  "./note-presenter.js?v=8939ab06645f8976",
  "./app.js?v=8939ab06645f8976",
  "./safety-guard.js?v=8939ab06645f8976",
  "./patient-document.js?v=8939ab06645f8976",
  "./pdf-enhancements.js?v=8939ab06645f8976",
  "./aps-safety-2026.js?v=8939ab06645f8976",
  "./farmacia-popular.js?v=8939ab06645f8976",
  "./document-flow.js?v=8939ab06645f8976",
  "./app-shell.js?v=8939ab06645f8976",
  "./phase6b-professional-decision.js?v=8939ab06645f8976",
  "./phase6b-document-sync.js?v=8939ab06645f8976",
  "./manifest.webmanifest?v=8939ab06645f8976",
  "./assets/icons/icon-32.png?v=8939ab06645f8976",
  "./assets/icons/icon-180.png?v=8939ab06645f8976",
  "./assets/icons/icon-192.png?v=8939ab06645f8976",
  "./assets/icons/icon-512.png?v=8939ab06645f8976"
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
