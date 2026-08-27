"use strict";

const CACHE_NAME = "insulog-shell-20260827-atomic12";
const DEPLOYMENT_REVISION = "farmacia-popular-20260827-r3";

const APP_SHELL = [
  "./index.html",
  "./styles.css?v=20260826",
  "./pdf-enhancements.css?v=20260827-3",
  "./pdf-enhancements.css?v=20260827-4",
  "./aps-safety-2026.css?v=20260827-2",
  "./farmacia-popular.css?v=20260827-1",
  "./app.js?v=20260826",
  "./pdf-enhancements.js?v=20260827-3",
  "./pdf-enhancements.js?v=20260827-4",
  "./aps-safety-2026.js?v=20260827-2",
  "./farmacia-popular.js?v=20260827-1",
  "./manifest.webmanifest?v=20260826",
  "./assets/icons/icon-32.png?v=20260826",
  "./assets/icons/icon-180.png?v=20260826",
  "./assets/icons/icon-192.png?v=20260826",
  "./assets/icons/icon-512.png?v=20260826"
];

const STATIC_PATHS = new Set(
  APP_SHELL.map((asset) => new URL(asset, self.location.href).pathname)
);

async function normalizarAssetClinico(request, response) {
  const url = new URL(request.url || request, self.location.href);
  if (!url.pathname.endsWith("/aps-safety-2026.js")) return response;

  const texto = await response.text();
  const normalizado = texto.replace(
    'label: "Empagliflozina 10 mg"',
    'label: "Empagliflozina"'
  );

  const farmaciaLoader = `\n;(() => {\n  if (!document.querySelector('link[data-farmacia-popular]')) {\n    const link = document.createElement('link');\n    link.rel = 'stylesheet';\n    link.href = './farmacia-popular.css?v=20260827-1';\n    link.dataset.farmaciaPopular = 'true';\n    document.head.appendChild(link);\n  }\n  if (!document.querySelector('script[data-farmacia-popular]')) {\n    const script = document.createElement('script');\n    script.src = './farmacia-popular.js?v=20260827-1';\n    script.dataset.farmaciaPopular = 'true';\n    document.body.appendChild(script);\n  }\n})();\n`;

  return new Response(normalizado + farmaciaLoader, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

async function fetchFresh(request) {
  const response = await fetch(new Request(request, { cache: "reload" }));
  if (!response.ok) {
    throw new Error(`No se pudo actualizar ${request.url || request}: HTTP ${response.status}`);
  }
  return normalizarAssetClinico(request, response);
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
