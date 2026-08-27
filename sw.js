"use strict";

const CACHE_NAME = "insulog-shell-20260827-atomic3";

const APP_SHELL = [
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
  APP_SHELL.map((asset) => new URL(asset, self.location.href).pathname)
);

async function precacheFreshShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (asset) => {
    const request = new Request(asset, { cache: "reload" });
    const response = await fetch(request);

    if (!response.ok) {
      throw new Error(`No se pudo precargar ${asset}: HTTP ${response.status}`);
    }

    await cache.put(asset, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    precacheFreshShell().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match("./index.html"))
        .then((cached) => cached || fetch(request))
    );
    return;
  }

  if (!STATIC_PATHS.has(url.pathname)) return;

  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(request))
      .then((cached) => cached || fetch(request))
  );
});
