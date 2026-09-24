"use strict";

const CACHE_NAME = "insulog-shell-dd2130d680018420";
const DEPLOYMENT_REVISION = "release-dd2130d680018420";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=dd2130d680018420";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=dd2130d680018420",
  "./document-flow.css?v=dd2130d680018420",
  "./pdf-enhancements.css?v=dd2130d680018420",
  "./pdf-design-2026.css?v=dd2130d680018420",
  "./aps-safety-2026.css?v=dd2130d680018420",
  "./farmacia-popular.css?v=dd2130d680018420",
  "./app-runtime.js?v=dd2130d680018420",
  "./clinical-engine.js?v=dd2130d680018420",
  "./clinical-copy.js?v=dd2130d680018420",
  "./note-presenter.js?v=dd2130d680018420",
  "./app.js?v=dd2130d680018420",
  "./safety-guard.js?v=dd2130d680018420",
  "./patient-document.js?v=dd2130d680018420",
  "./pdf-enhancements.js?v=dd2130d680018420",
  "./aps-safety-2026.js?v=dd2130d680018420",
  "./farmacia-popular.js?v=dd2130d680018420",
  "./document-flow.js?v=dd2130d680018420",
  "./app-shell.js?v=dd2130d680018420",
  "./phase6b-professional-decision.js?v=dd2130d680018420",
  "./phase6b-document-sync.js?v=dd2130d680018420",
  "./manifest.webmanifest?v=dd2130d680018420",
  "./assets/icons/icon-32.png?v=dd2130d680018420",
  "./assets/icons/icon-180.png?v=dd2130d680018420",
  "./assets/icons/icon-192.png?v=dd2130d680018420",
  "./assets/icons/icon-512.png?v=dd2130d680018420"
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
