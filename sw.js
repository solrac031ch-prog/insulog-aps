"use strict";

const CACHE_NAME = "insulog-shell-c7e4f6a29d8b1305";
const DEPLOYMENT_REVISION = "release-c7e4f6a29d8b1305";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=c7e4f6a29d8b1305";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=c7e4f6a29d8b1305",
  "./document-flow.css?v=c7e4f6a29d8b1305",
  "./pdf-enhancements.css?v=c7e4f6a29d8b1305",
  "./pdf-design-2026.css?v=c7e4f6a29d8b1305",
  "./aps-safety-2026.css?v=c7e4f6a29d8b1305",
  "./farmacia-popular.css?v=c7e4f6a29d8b1305",
  "./app-runtime.js?v=c7e4f6a29d8b1305",
  "./clinical-engine.js?v=c7e4f6a29d8b1305",
  "./clinical-copy.js?v=c7e4f6a29d8b1305",
  "./note-presenter.js?v=c7e4f6a29d8b1305",
  "./app.js?v=c7e4f6a29d8b1305",
  "./safety-guard.js?v=c7e4f6a29d8b1305",
  "./patient-document.js?v=c7e4f6a29d8b1305",
  "./pdf-enhancements.js?v=c7e4f6a29d8b1305",
  "./aps-safety-2026.js?v=c7e4f6a29d8b1305",
  "./farmacia-popular.js?v=c7e4f6a29d8b1305",
  "./document-flow.js?v=c7e4f6a29d8b1305",
  "./app-shell.js?v=c7e4f6a29d8b1305",
  "./phase6b-professional-decision.js?v=c7e4f6a29d8b1305",
  "./phase6b-document-sync.js?v=c7e4f6a29d8b1305",
  "./manifest.webmanifest?v=c7e4f6a29d8b1305",
  "./assets/icons/icon-32.png?v=c7e4f6a29d8b1305",
  "./assets/icons/icon-180.png?v=c7e4f6a29d8b1305",
  "./assets/icons/icon-192.png?v=c7e4f6a29d8b1305",
  "./assets/icons/icon-512.png?v=c7e4f6a29d8b1305"
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
