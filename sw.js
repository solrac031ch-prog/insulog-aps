"use strict";

const CACHE_NAME = "insulog-static-20260826-fast-start1";
const STATIC_ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=20260826",
  "./pdf-enhancements.css?v=20260826-2",
  "./aps-safety-2026.css?v=20260826-1",
  "./app.js?v=20260826",
  "./pdf-enhancements.js?v=20260826-2",
  "./aps-safety-2026.js?v=20260826-1",
  "./manifest.webmanifest?v=20260826",
  "./assets/icons/icon-32.png?v=20260826",
  "./assets/icons/icon-180.png?v=20260826",
  "./assets/icons/icon-192.png?v=20260826",
  "./assets/icons/icon-512.png?v=20260826"
];

const STATIC_PATHS = new Set(
  STATIC_ASSETS.map((asset) => new URL(asset, self.location.href).pathname)
);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // App shell: abrir inmediatamente desde caché y actualizar en segundo plano.
  if (request.mode === "navigate") {
    const networkUpdate = fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("./index.html", copy));
        }
        return response;
      })
      .catch(() => null);

    event.waitUntil(networkUpdate.then(() => undefined));
    event.respondWith(
      caches.match("./index.html").then((cached) => {
        if (cached) return cached;
        return networkUpdate.then((response) => response || caches.match("./index.html"));
      })
    );
    return;
  }

  // Solo se cachean archivos estáticos conocidos. Insulog no persiste datos clínicos del paciente.
  if (!STATIC_PATHS.has(url.pathname)) return;

  // Recursos versionados: responder desde caché sin bloquear la apertura y refrescar detrás.
  const networkUpdate = fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
      }
      return response;
    })
    .catch(() => null);

  event.waitUntil(networkUpdate.then(() => undefined));
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return networkUpdate.then((response) => response || caches.match(request));
    })
  );
});
