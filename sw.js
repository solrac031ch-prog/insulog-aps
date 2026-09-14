"use strict";

const CACHE_NAME = "insulog-shell-8a7f14b9326722df";
const DEPLOYMENT_REVISION = "release-8a7f14b9326722df";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=8a7f14b9326722df";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=8a7f14b9326722df",
  "./document-flow.css?v=8a7f14b9326722df",
  "./pdf-enhancements.css?v=8a7f14b9326722df",
  "./pdf-design-2026.css?v=8a7f14b9326722df",
  "./aps-safety-2026.css?v=8a7f14b9326722df",
  "./farmacia-popular.css?v=8a7f14b9326722df",
  "./app-runtime.js?v=8a7f14b9326722df",
  "./clinical-engine.js?v=8a7f14b9326722df",
  "./clinical-copy.js?v=8a7f14b9326722df",
  "./note-presenter.js?v=8a7f14b9326722df",
  "./app.js?v=8a7f14b9326722df",
  "./safety-guard.js?v=8a7f14b9326722df",
  "./patient-document.js?v=8a7f14b9326722df",
  "./pdf-enhancements.js?v=8a7f14b9326722df",
  "./aps-safety-2026.js?v=8a7f14b9326722df",
  "./farmacia-popular.js?v=8a7f14b9326722df",
  "./document-flow.js?v=8a7f14b9326722df",
  "./app-shell.js?v=8a7f14b9326722df",
  "./phase6b-professional-decision.js?v=8a7f14b9326722df",
  "./phase6b-document-sync.js?v=8a7f14b9326722df",
  "./manifest.webmanifest?v=8a7f14b9326722df",
  "./assets/icons/icon-32.png?v=8a7f14b9326722df",
  "./assets/icons/icon-180.png?v=8a7f14b9326722df",
  "./assets/icons/icon-192.png?v=8a7f14b9326722df",
  "./assets/icons/icon-512.png?v=8a7f14b9326722df"
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
