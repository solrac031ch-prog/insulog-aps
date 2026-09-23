"use strict";

const CACHE_NAME = "insulog-shell-ad833eda2c5a8afc";
const DEPLOYMENT_REVISION = "release-ad833eda2c5a8afc";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=ad833eda2c5a8afc";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=ad833eda2c5a8afc",
  "./document-flow.css?v=ad833eda2c5a8afc",
  "./pdf-enhancements.css?v=ad833eda2c5a8afc",
  "./pdf-design-2026.css?v=ad833eda2c5a8afc",
  "./aps-safety-2026.css?v=ad833eda2c5a8afc",
  "./farmacia-popular.css?v=ad833eda2c5a8afc",
  "./app-runtime.js?v=ad833eda2c5a8afc",
  "./clinical-engine.js?v=ad833eda2c5a8afc",
  "./clinical-copy.js?v=ad833eda2c5a8afc",
  "./note-presenter.js?v=ad833eda2c5a8afc",
  "./app.js?v=ad833eda2c5a8afc",
  "./safety-guard.js?v=ad833eda2c5a8afc",
  "./patient-document.js?v=ad833eda2c5a8afc",
  "./pdf-enhancements.js?v=ad833eda2c5a8afc",
  "./aps-safety-2026.js?v=ad833eda2c5a8afc",
  "./farmacia-popular.js?v=ad833eda2c5a8afc",
  "./document-flow.js?v=ad833eda2c5a8afc",
  "./app-shell.js?v=ad833eda2c5a8afc",
  "./phase6b-professional-decision.js?v=ad833eda2c5a8afc",
  "./phase6b-document-sync.js?v=ad833eda2c5a8afc",
  "./manifest.webmanifest?v=ad833eda2c5a8afc",
  "./assets/icons/icon-32.png?v=ad833eda2c5a8afc",
  "./assets/icons/icon-180.png?v=ad833eda2c5a8afc",
  "./assets/icons/icon-192.png?v=ad833eda2c5a8afc",
  "./assets/icons/icon-512.png?v=ad833eda2c5a8afc"
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
