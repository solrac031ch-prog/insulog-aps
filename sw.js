"use strict";

const CACHE_NAME = "insulog-shell-100fdc95b613deae";
const DEPLOYMENT_REVISION = "release-100fdc95b613deae";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=100fdc95b613deae";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=100fdc95b613deae",
  "./document-flow.css?v=100fdc95b613deae",
  "./pdf-enhancements.css?v=100fdc95b613deae",
  "./pdf-design-2026.css?v=100fdc95b613deae",
  "./aps-safety-2026.css?v=100fdc95b613deae",
  "./farmacia-popular.css?v=100fdc95b613deae",
  "./app-runtime.js?v=100fdc95b613deae",
  "./clinical-engine.js?v=100fdc95b613deae",
  "./clinical-copy.js?v=100fdc95b613deae",
  "./note-presenter.js?v=100fdc95b613deae",
  "./app.js?v=100fdc95b613deae",
  "./safety-guard.js?v=100fdc95b613deae",
  "./patient-document.js?v=100fdc95b613deae",
  "./pdf-enhancements.js?v=100fdc95b613deae",
  "./aps-safety-2026.js?v=100fdc95b613deae",
  "./farmacia-popular.js?v=100fdc95b613deae",
  "./document-flow.js?v=100fdc95b613deae",
  "./app-shell.js?v=100fdc95b613deae",
  "./phase6b-professional-decision.js?v=100fdc95b613deae",
  "./phase6b-document-sync.js?v=100fdc95b613deae",
  "./manifest.webmanifest?v=100fdc95b613deae",
  "./assets/icons/icon-32.png?v=100fdc95b613deae",
  "./assets/icons/icon-180.png?v=100fdc95b613deae",
  "./assets/icons/icon-192.png?v=100fdc95b613deae",
  "./assets/icons/icon-512.png?v=100fdc95b613deae"
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
