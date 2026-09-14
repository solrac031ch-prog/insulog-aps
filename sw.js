"use strict";

const CACHE_NAME = "insulog-shell-af0dfa0fa8720a36";
const DEPLOYMENT_REVISION = "release-af0dfa0fa8720a36";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=af0dfa0fa8720a36";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=af0dfa0fa8720a36",
  "./document-flow.css?v=af0dfa0fa8720a36",
  "./pdf-enhancements.css?v=af0dfa0fa8720a36",
  "./pdf-design-2026.css?v=af0dfa0fa8720a36",
  "./aps-safety-2026.css?v=af0dfa0fa8720a36",
  "./farmacia-popular.css?v=af0dfa0fa8720a36",
  "./app-runtime.js?v=af0dfa0fa8720a36",
  "./clinical-engine.js?v=af0dfa0fa8720a36",
  "./clinical-copy.js?v=af0dfa0fa8720a36",
  "./note-presenter.js?v=af0dfa0fa8720a36",
  "./app.js?v=af0dfa0fa8720a36",
  "./patient-document.js?v=af0dfa0fa8720a36",
  "./pdf-enhancements.js?v=af0dfa0fa8720a36",
  "./aps-safety-2026.js?v=af0dfa0fa8720a36",
  "./farmacia-popular.js?v=af0dfa0fa8720a36",
  "./document-flow.js?v=af0dfa0fa8720a36",
  "./app-shell.js?v=af0dfa0fa8720a36",
  "./manifest.webmanifest?v=af0dfa0fa8720a36",
  "./assets/icons/icon-32.png?v=af0dfa0fa8720a36",
  "./assets/icons/icon-180.png?v=af0dfa0fa8720a36",
  "./assets/icons/icon-192.png?v=af0dfa0fa8720a36",
  "./assets/icons/icon-512.png?v=af0dfa0fa8720a36"
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
