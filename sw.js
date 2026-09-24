"use strict";

const CACHE_NAME = "insulog-shell-eaf4c3e55cdd497a";
const DEPLOYMENT_REVISION = "release-eaf4c3e55cdd497a";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=eaf4c3e55cdd497a";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=eaf4c3e55cdd497a",
  "./document-flow.css?v=eaf4c3e55cdd497a",
  "./pdf-enhancements.css?v=eaf4c3e55cdd497a",
  "./pdf-design-2026.css?v=eaf4c3e55cdd497a",
  "./aps-safety-2026.css?v=eaf4c3e55cdd497a",
  "./farmacia-popular.css?v=eaf4c3e55cdd497a",
  "./app-runtime.js?v=eaf4c3e55cdd497a",
  "./clinical-engine.js?v=eaf4c3e55cdd497a",
  "./clinical-copy.js?v=eaf4c3e55cdd497a",
  "./note-presenter.js?v=eaf4c3e55cdd497a",
  "./app.js?v=eaf4c3e55cdd497a",
  "./safety-guard.js?v=eaf4c3e55cdd497a",
  "./patient-document.js?v=eaf4c3e55cdd497a",
  "./pdf-enhancements.js?v=eaf4c3e55cdd497a",
  "./aps-safety-2026.js?v=eaf4c3e55cdd497a",
  "./farmacia-popular.js?v=eaf4c3e55cdd497a",
  "./document-flow.js?v=eaf4c3e55cdd497a",
  "./app-shell.js?v=eaf4c3e55cdd497a",
  "./phase6b-professional-decision.js?v=eaf4c3e55cdd497a",
  "./phase6b-document-sync.js?v=eaf4c3e55cdd497a",
  "./manifest.webmanifest?v=eaf4c3e55cdd497a",
  "./assets/icons/icon-32.png?v=eaf4c3e55cdd497a",
  "./assets/icons/icon-180.png?v=eaf4c3e55cdd497a",
  "./assets/icons/icon-192.png?v=eaf4c3e55cdd497a",
  "./assets/icons/icon-512.png?v=eaf4c3e55cdd497a"
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
