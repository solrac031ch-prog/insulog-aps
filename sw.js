"use strict";

const CACHE_NAME = "insulog-shell-c90fdf75f6f642ff";
const DEPLOYMENT_REVISION = "release-c90fdf75f6f642ff";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=c90fdf75f6f642ff";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=c90fdf75f6f642ff",
  "./document-flow.css?v=c90fdf75f6f642ff",
  "./pdf-enhancements.css?v=c90fdf75f6f642ff",
  "./pdf-design-2026.css?v=c90fdf75f6f642ff",
  "./aps-safety-2026.css?v=c90fdf75f6f642ff",
  "./farmacia-popular.css?v=c90fdf75f6f642ff",
  "./app-runtime.js?v=c90fdf75f6f642ff",
  "./clinical-engine.js?v=c90fdf75f6f642ff",
  "./clinical-copy.js?v=c90fdf75f6f642ff",
  "./note-presenter.js?v=c90fdf75f6f642ff",
  "./app.js?v=c90fdf75f6f642ff",
  "./safety-guard.js?v=c90fdf75f6f642ff",
  "./patient-document.js?v=c90fdf75f6f642ff",
  "./pdf-enhancements.js?v=c90fdf75f6f642ff",
  "./aps-safety-2026.js?v=c90fdf75f6f642ff",
  "./farmacia-popular.js?v=c90fdf75f6f642ff",
  "./document-flow.js?v=c90fdf75f6f642ff",
  "./app-shell.js?v=c90fdf75f6f642ff",
  "./phase6b-professional-decision.js?v=c90fdf75f6f642ff",
  "./phase6b-document-sync.js?v=c90fdf75f6f642ff",
  "./manifest.webmanifest?v=c90fdf75f6f642ff",
  "./assets/icons/icon-32.png?v=c90fdf75f6f642ff",
  "./assets/icons/icon-180.png?v=c90fdf75f6f642ff",
  "./assets/icons/icon-192.png?v=c90fdf75f6f642ff",
  "./assets/icons/icon-512.png?v=c90fdf75f6f642ff"
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
