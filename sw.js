"use strict";

const CACHE_NAME = "insulog-shell-eb8c04d2d8967eb5";
const DEPLOYMENT_REVISION = "release-eb8c04d2d8967eb5";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=eb8c04d2d8967eb5";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=eb8c04d2d8967eb5",
  "./document-flow.css?v=eb8c04d2d8967eb5",
  "./pdf-enhancements.css?v=eb8c04d2d8967eb5",
  "./pdf-design-2026.css?v=eb8c04d2d8967eb5",
  "./aps-safety-2026.css?v=eb8c04d2d8967eb5",
  "./farmacia-popular.css?v=eb8c04d2d8967eb5",
  "./app-runtime.js?v=eb8c04d2d8967eb5",
  "./clinical-engine.js?v=eb8c04d2d8967eb5",
  "./clinical-copy.js?v=eb8c04d2d8967eb5",
  "./note-presenter.js?v=eb8c04d2d8967eb5",
  "./app.js?v=eb8c04d2d8967eb5",
  "./safety-guard.js?v=eb8c04d2d8967eb5",
  "./patient-document.js?v=eb8c04d2d8967eb5",
  "./pdf-enhancements.js?v=eb8c04d2d8967eb5",
  "./aps-safety-2026.js?v=eb8c04d2d8967eb5",
  "./farmacia-popular.js?v=eb8c04d2d8967eb5",
  "./document-flow.js?v=eb8c04d2d8967eb5",
  "./app-shell.js?v=eb8c04d2d8967eb5",
  "./phase6b-professional-decision.js?v=eb8c04d2d8967eb5",
  "./phase6b-document-sync.js?v=eb8c04d2d8967eb5",
  "./manifest.webmanifest?v=eb8c04d2d8967eb5",
  "./assets/icons/icon-32.png?v=eb8c04d2d8967eb5",
  "./assets/icons/icon-180.png?v=eb8c04d2d8967eb5",
  "./assets/icons/icon-192.png?v=eb8c04d2d8967eb5",
  "./assets/icons/icon-512.png?v=eb8c04d2d8967eb5"
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
  // El worker nuevo solo queda listo si pudo descargar el shell completo.
  // No adelantamos la activación: una atención ya abierta sigue con su versión anterior.
  event.waitUntil(precacheFreshShell());
});

self.addEventListener("activate", (event) => {
  // La activación ocurre cuando la versión anterior ya no controla clientes.
  // Recién entonces retiramos caches viejos y no reclamamos pestañas ya abiertas.
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => key.startsWith("insulog-shell-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key))
    ))
  );
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
