"use strict";

const CACHE_NAME = "insulog-shell-drive-followup-20260915a";
const DEPLOYMENT_REVISION = "release-drive-followup-20260915a";
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=drive-followup-20260915a";

const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=drive-followup-20260915a",
  "./document-flow.css?v=drive-followup-20260915a",
  "./pdf-enhancements.css?v=drive-followup-20260915a",
  "./pdf-design-2026.css?v=drive-followup-20260915a",
  "./aps-safety-2026.css?v=drive-followup-20260915a",
  "./farmacia-popular.css?v=drive-followup-20260915a",
  "./app-runtime.js?v=drive-followup-20260915a",
  "./clinical-engine.js?v=drive-followup-20260915a",
  "./clinical-copy.js?v=drive-followup-20260915a",
  "./note-presenter.js?v=drive-followup-20260915a",
  "./app.js?v=drive-followup-20260915a",
  "./safety-guard.js?v=drive-followup-20260915a",
  "./patient-document.js?v=drive-followup-20260915a",
  "./pdf-enhancements.js?v=drive-followup-20260915a",
  "./aps-safety-2026.js?v=drive-followup-20260915a",
  "./farmacia-popular.js?v=drive-followup-20260915a",
  "./document-flow.js?v=drive-followup-20260915a",
  "./app-shell.js?v=drive-followup-20260915a",
  "./phase6b-professional-decision.js?v=drive-followup-20260915a",
  "./phase6b-document-sync.js?v=drive-followup-20260915a",
  "./manifest.webmanifest?v=drive-followup-20260915a",
  "./assets/icons/icon-32.png?v=drive-followup-20260915a",
  "./assets/icons/icon-180.png?v=drive-followup-20260915a",
  "./assets/icons/icon-192.png?v=drive-followup-20260915a",
  "./assets/icons/icon-512.png?v=drive-followup-20260915a"
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
