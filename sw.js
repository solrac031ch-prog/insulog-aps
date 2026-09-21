"use strict";

const CACHE_NAME = "insulog-shell-1f01210d7ea3792e";
const DEPLOYMENT_REVISION = "release-1f01210d7ea3792e";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=1f01210d7ea3792e";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=1f01210d7ea3792e",
  "./document-flow.css?v=1f01210d7ea3792e",
  "./pdf-enhancements.css?v=1f01210d7ea3792e",
  "./pdf-design-2026.css?v=1f01210d7ea3792e",
  "./aps-safety-2026.css?v=1f01210d7ea3792e",
  "./farmacia-popular.css?v=1f01210d7ea3792e",
  "./app-runtime.js?v=1f01210d7ea3792e",
  "./clinical-engine.js?v=1f01210d7ea3792e",
  "./clinical-copy.js?v=1f01210d7ea3792e",
  "./note-presenter.js?v=1f01210d7ea3792e",
  "./app.js?v=1f01210d7ea3792e",
  "./safety-guard.js?v=1f01210d7ea3792e",
  "./patient-document.js?v=1f01210d7ea3792e",
  "./pdf-enhancements.js?v=1f01210d7ea3792e",
  "./aps-safety-2026.js?v=1f01210d7ea3792e",
  "./farmacia-popular.js?v=1f01210d7ea3792e",
  "./document-flow.js?v=1f01210d7ea3792e",
  "./app-shell.js?v=1f01210d7ea3792e",
  "./phase6b-professional-decision.js?v=1f01210d7ea3792e",
  "./phase6b-document-sync.js?v=1f01210d7ea3792e",
  "./manifest.webmanifest?v=1f01210d7ea3792e",
  "./assets/icons/icon-32.png?v=1f01210d7ea3792e",
  "./assets/icons/icon-180.png?v=1f01210d7ea3792e",
  "./assets/icons/icon-192.png?v=1f01210d7ea3792e",
  "./assets/icons/icon-512.png?v=1f01210d7ea3792e"
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
