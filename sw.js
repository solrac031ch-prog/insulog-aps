"use strict";

const CACHE_NAME = "insulog-shell-20260827-atomic8";

const APP_SHELL = [
  "./index.html",
  "./styles.css?v=20260826",
  "./pdf-enhancements.css?v=20260827-3",
  "./aps-safety-2026.css?v=20260827-2",
  "./app.js?v=20260826",
  "./pdf-enhancements.js?v=20260827-3",
  "./aps-safety-2026.js?v=20260827-2",
  "./manifest.webmanifest?v=20260826",
  "./assets/icons/icon-32.png?v=20260826",
  "./assets/icons/icon-180.png?v=20260826",
  "./assets/icons/icon-192.png?v=20260826",
  "./assets/icons/icon-512.png?v=20260826"
];

const STATIC_PATHS = new Set(
  APP_SHELL.map((asset) => new URL(asset, self.location.href).pathname)
);

async function fetchFresh(request) {
  const response = await fetch(new Request(request, { cache: "reload" }));
  if (!response.ok) {
    throw new Error(`No se pudo actualizar ${request.url || request}: HTTP ${response.status}`);
  }
  return response;
}

async function precacheFreshShell() {
  const cache = await caches.open(CACHE_NAME);

  await Promise.all(APP_SHELL.map(async (asset) => {
    const request = new Request(asset, { cache: "reload" });
    const response = await fetchFresh(request);
    await cache.put(asset, response.clone());
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
    const refreshIndex = caches.open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetchFresh(new Request("./index.html", { cache: "reload" }));
        await cache.put("./index.html", response.clone());
        return response;
      });

    event.waitUntil(refreshIndex.catch(() => undefined));
    event.respondWith(
      caches.open(CACHE_NAME)
        .then((cache) => cache.match("./index.html"))
        .then((cached) => cached || refreshIndex)
        .catch(() => fetch(request))
    );
    return;
  }

  if (!STATIC_PATHS.has(url.pathname)) return;

  const refreshAsset = caches.open(CACHE_NAME)
    .then(async (cache) => {
      const response = await fetchFresh(request);
      await cache.put(request, response.clone());
      return response;
    });

  event.waitUntil(refreshAsset.catch(() => undefined));
  event.respondWith(
    caches.open(CACHE_NAME)
      .then((cache) => cache.match(request))
      .then((cached) => cached || refreshAsset)
      .catch(() => fetch(request))
  );
});
