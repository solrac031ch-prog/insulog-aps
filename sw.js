"use strict";

const CACHE_NAME = "insulog-shell-cad4fcc20a012c18";
const DEPLOYMENT_REVISION = "release-cad4fcc20a012c18";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=cad4fcc20a012c18";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=cad4fcc20a012c18",
  "./document-flow.css?v=cad4fcc20a012c18",
  "./pdf-enhancements.css?v=cad4fcc20a012c18",
  "./pdf-design-2026.css?v=cad4fcc20a012c18",
  "./aps-safety-2026.css?v=cad4fcc20a012c18",
  "./farmacia-popular.css?v=cad4fcc20a012c18",
  "./app-runtime.js?v=cad4fcc20a012c18",
  "./clinical-engine.js?v=cad4fcc20a012c18",
  "./clinical-copy.js?v=cad4fcc20a012c18",
  "./note-presenter.js?v=cad4fcc20a012c18",
  "./app.js?v=cad4fcc20a012c18",
  "./safety-guard.js?v=cad4fcc20a012c18",
  "./patient-document.js?v=cad4fcc20a012c18",
  "./pdf-enhancements.js?v=cad4fcc20a012c18",
  "./aps-safety-2026.js?v=cad4fcc20a012c18",
  "./farmacia-popular.js?v=cad4fcc20a012c18",
  "./document-flow.js?v=cad4fcc20a012c18",
  "./app-shell.js?v=cad4fcc20a012c18",
  "./phase6b-professional-decision.js?v=cad4fcc20a012c18",
  "./phase6b-document-sync.js?v=cad4fcc20a012c18",
  "./manifest.webmanifest?v=cad4fcc20a012c18",
  "./assets/icons/icon-32.png?v=cad4fcc20a012c18",
  "./assets/icons/icon-180.png?v=cad4fcc20a012c18",
  "./assets/icons/icon-192.png?v=cad4fcc20a012c18",
  "./assets/icons/icon-512.png?v=cad4fcc20a012c18"
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
