"use strict";

const CACHE_NAME = "insulog-shell-c7036c4cab814dae";
const DEPLOYMENT_REVISION = "release-c7036c4cab814dae";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=c7036c4cab814dae";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=c7036c4cab814dae",
  "./document-flow.css?v=c7036c4cab814dae",
  "./pdf-enhancements.css?v=c7036c4cab814dae",
  "./pdf-design-2026.css?v=c7036c4cab814dae",
  "./aps-safety-2026.css?v=c7036c4cab814dae",
  "./farmacia-popular.css?v=c7036c4cab814dae",
  "./app-runtime.js?v=c7036c4cab814dae",
  "./clinical-engine.js?v=c7036c4cab814dae",
  "./clinical-copy.js?v=c7036c4cab814dae",
  "./note-presenter.js?v=c7036c4cab814dae",
  "./app.js?v=c7036c4cab814dae",
  "./safety-guard.js?v=c7036c4cab814dae",
  "./patient-document.js?v=c7036c4cab814dae",
  "./pdf-enhancements.js?v=c7036c4cab814dae",
  "./aps-safety-2026.js?v=c7036c4cab814dae",
  "./farmacia-popular.js?v=c7036c4cab814dae",
  "./document-flow.js?v=c7036c4cab814dae",
  "./app-shell.js?v=c7036c4cab814dae",
  "./phase6b-professional-decision.js?v=c7036c4cab814dae",
  "./phase6b-document-sync.js?v=c7036c4cab814dae",
  "./manifest.webmanifest?v=c7036c4cab814dae",
  "./assets/icons/icon-32.png?v=c7036c4cab814dae",
  "./assets/icons/icon-180.png?v=c7036c4cab814dae",
  "./assets/icons/icon-192.png?v=c7036c4cab814dae",
  "./assets/icons/icon-512.png?v=c7036c4cab814dae"
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
