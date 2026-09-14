"use strict";

const CACHE_NAME = "insulog-shell-d27afca0e54ebefe";
const DEPLOYMENT_REVISION = "release-d27afca0e54ebefe";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=d27afca0e54ebefe";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=d27afca0e54ebefe",
  "./document-flow.css?v=d27afca0e54ebefe",
  "./pdf-enhancements.css?v=d27afca0e54ebefe",
  "./pdf-design-2026.css?v=d27afca0e54ebefe",
  "./aps-safety-2026.css?v=d27afca0e54ebefe",
  "./farmacia-popular.css?v=d27afca0e54ebefe",
  "./app-runtime.js?v=d27afca0e54ebefe",
  "./clinical-engine.js?v=d27afca0e54ebefe",
  "./clinical-copy.js?v=d27afca0e54ebefe",
  "./note-presenter.js?v=d27afca0e54ebefe",
  "./app.js?v=d27afca0e54ebefe",
  "./patient-document.js?v=d27afca0e54ebefe",
  "./pdf-enhancements.js?v=d27afca0e54ebefe",
  "./aps-safety-2026.js?v=d27afca0e54ebefe",
  "./farmacia-popular.js?v=d27afca0e54ebefe",
  "./document-flow.js?v=d27afca0e54ebefe",
  "./app-shell.js?v=d27afca0e54ebefe",
  "./phase6b-professional-decision.js?v=d27afca0e54ebefe",
  "./phase6b-document-sync.js?v=d27afca0e54ebefe",
  "./manifest.webmanifest?v=d27afca0e54ebefe",
  "./assets/icons/icon-32.png?v=d27afca0e54ebefe",
  "./assets/icons/icon-180.png?v=d27afca0e54ebefe",
  "./assets/icons/icon-192.png?v=d27afca0e54ebefe",
  "./assets/icons/icon-512.png?v=d27afca0e54ebefe"
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
