"use strict";

const CACHE_NAME = "insulog-shell-df33a277605b050c";
const DEPLOYMENT_REVISION = "release-df33a277605b050c";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=df33a277605b050c";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=df33a277605b050c",
  "./document-flow.css?v=df33a277605b050c",
  "./pdf-enhancements.css?v=df33a277605b050c",
  "./pdf-design-2026.css?v=df33a277605b050c",
  "./aps-safety-2026.css?v=df33a277605b050c",
  "./farmacia-popular.css?v=df33a277605b050c",
  "./app-runtime.js?v=df33a277605b050c",
  "./clinical-engine.js?v=df33a277605b050c",
  "./clinical-copy.js?v=df33a277605b050c",
  "./note-presenter.js?v=df33a277605b050c",
  "./app.js?v=df33a277605b050c",
  "./safety-guard.js?v=df33a277605b050c",
  "./patient-document.js?v=df33a277605b050c",
  "./pdf-enhancements.js?v=df33a277605b050c",
  "./aps-safety-2026.js?v=df33a277605b050c",
  "./farmacia-popular.js?v=df33a277605b050c",
  "./document-flow.js?v=df33a277605b050c",
  "./app-shell.js?v=df33a277605b050c",
  "./phase6b-professional-decision.js?v=df33a277605b050c",
  "./phase6b-document-sync.js?v=df33a277605b050c",
  "./manifest.webmanifest?v=df33a277605b050c",
  "./assets/icons/icon-32.png?v=df33a277605b050c",
  "./assets/icons/icon-180.png?v=df33a277605b050c",
  "./assets/icons/icon-192.png?v=df33a277605b050c",
  "./assets/icons/icon-512.png?v=df33a277605b050c"
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
