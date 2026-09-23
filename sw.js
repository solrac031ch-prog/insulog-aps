"use strict";

const CACHE_NAME = "insulog-shell-bd5baa11f673fa9b";
const DEPLOYMENT_REVISION = "release-bd5baa11f673fa9b";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=bd5baa11f673fa9b";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=bd5baa11f673fa9b",
  "./document-flow.css?v=bd5baa11f673fa9b",
  "./pdf-enhancements.css?v=bd5baa11f673fa9b",
  "./pdf-design-2026.css?v=bd5baa11f673fa9b",
  "./aps-safety-2026.css?v=bd5baa11f673fa9b",
  "./farmacia-popular.css?v=bd5baa11f673fa9b",
  "./app-runtime.js?v=bd5baa11f673fa9b",
  "./clinical-engine.js?v=bd5baa11f673fa9b",
  "./clinical-copy.js?v=bd5baa11f673fa9b",
  "./note-presenter.js?v=bd5baa11f673fa9b",
  "./app.js?v=bd5baa11f673fa9b",
  "./safety-guard.js?v=bd5baa11f673fa9b",
  "./patient-document.js?v=bd5baa11f673fa9b",
  "./pdf-enhancements.js?v=bd5baa11f673fa9b",
  "./aps-safety-2026.js?v=bd5baa11f673fa9b",
  "./farmacia-popular.js?v=bd5baa11f673fa9b",
  "./document-flow.js?v=bd5baa11f673fa9b",
  "./app-shell.js?v=bd5baa11f673fa9b",
  "./phase6b-professional-decision.js?v=bd5baa11f673fa9b",
  "./phase6b-document-sync.js?v=bd5baa11f673fa9b",
  "./manifest.webmanifest?v=bd5baa11f673fa9b",
  "./assets/icons/icon-32.png?v=bd5baa11f673fa9b",
  "./assets/icons/icon-180.png?v=bd5baa11f673fa9b",
  "./assets/icons/icon-192.png?v=bd5baa11f673fa9b",
  "./assets/icons/icon-512.png?v=bd5baa11f673fa9b"
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
