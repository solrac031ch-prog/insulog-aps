"use strict";

// Service worker mínimo para Insulog APS.
// No intercepta navegación ni recursos: el navegador utiliza su caché HTTP normal.
// Al activarse elimina las cachés antiguas de la PWA para evitar versiones mezcladas.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
