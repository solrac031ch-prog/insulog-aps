"use strict";

const META_CACHE = "insulog-shell-meta-v1";
const CONTENT_CACHE_PREFIX = "insulog-shell-content-";
const ACTIVE_POINTER_KEY = new URL("./__insulog_active_shell__", self.registration.scope).href;
const PDF_PREVIEW_PATH = "./pdf-preview.html?v=20260910-1";

/*
 * Los sufijos ?v= se mantienen temporalmente como aliases de compatibilidad.
 * La identidad del shell ya no depende de ellos: se calcula con SHA-256 sobre
 * el contenido real de todos los recursos antes de cambiar la versión activa.
 */
const APP_SHELL = [
  "./index.html",
  PDF_PREVIEW_PATH,
  "./styles.css?v=20260910-2",
  "./pdf-enhancements.css?v=20260827-4",
  "./pdf-design-2026.css?v=20260827-1",
  "./document-flow.css?v=20260910-1",
  "./aps-safety-2026.css?v=20260827-2",
  "./farmacia-popular.css?v=20260827-2",
  "./app-runtime.js?v=20260910-2",
  "./clinical-engine.js?v=20260910-3",
  "./app.js?v=20260910-4",
  "./patient-document.js?v=20260910-2",
  "./pdf-enhancements.js?v=20260910-5",
  "./aps-safety-2026.js?v=20260910-3",
  "./farmacia-popular.js?v=20260827-4",
  "./document-flow.js?v=20260910-2",
  "./app-shell.js?v=20260910-2",
  "./manifest.webmanifest?v=20260826",
  "./assets/icons/icon-32.png?v=20260826",
  "./assets/icons/icon-180.png?v=20260826",
  "./assets/icons/icon-192.png?v=20260826",
  "./assets/icons/icon-512.png?v=20260826"
];

const SHELL_ASSET_BY_PATH = new Map(
  APP_SHELL.map((asset) => [new URL(asset, self.location.href).pathname, asset])
);

let stagingPromise = null;

function bytesToHex(buffer) {
  return Array.from(new Uint8Array(buffer), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchShellAsset(asset) {
  const request = new Request(asset, {
    cache: "reload",
    credentials: "same-origin"
  });
  const response = await fetch(request);

  if (!response.ok) {
    throw new Error(`No se pudo actualizar ${asset}: HTTP ${response.status}`);
  }

  return {
    asset,
    path: new URL(asset, self.location.href).pathname,
    response,
    bytes: new Uint8Array(await response.clone().arrayBuffer())
  };
}

async function fingerprintShell(items) {
  const encoder = new TextEncoder();
  const chunks = [];
  let totalLength = 0;

  for (const item of items) {
    const header = encoder.encode(`${item.path}\n${item.bytes.byteLength}\n`);
    chunks.push(header, item.bytes);
    totalLength += header.byteLength + item.bytes.byteLength;
  }

  const payload = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    payload.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const digest = await crypto.subtle.digest("SHA-256", payload);
  return bytesToHex(digest);
}

async function getActiveCacheName() {
  const meta = await caches.open(META_CACHE);
  const pointer = await meta.match(ACTIVE_POINTER_KEY);
  return pointer ? (await pointer.text()).trim() : "";
}

async function setActiveCacheName(cacheName) {
  const meta = await caches.open(META_CACHE);
  await meta.put(
    ACTIVE_POINTER_KEY,
    new Response(cacheName, {
      headers: { "content-type": "text/plain; charset=utf-8" }
    })
  );
}

async function cleanupOldContentCaches(activeCacheName) {
  const keys = await caches.keys();
  await Promise.all(
    keys
      .filter((key) => key.startsWith(CONTENT_CACHE_PREFIX) && key !== activeCacheName)
      .map((key) => caches.delete(key))
  );
}

async function buildFreshShell() {
  const items = await Promise.all(APP_SHELL.map(fetchShellAsset));
  const fingerprint = await fingerprintShell(items);
  const cacheName = `${CONTENT_CACHE_PREFIX}${fingerprint}`;
  const activeCacheName = await getActiveCacheName();

  if (activeCacheName === cacheName) {
    return cacheName;
  }

  const cache = await caches.open(cacheName);
  for (const item of items) {
    await cache.put(item.asset, item.response.clone());
  }

  // El puntero se cambia únicamente después de que TODO el shell está listo.
  await setActiveCacheName(cacheName);
  return cacheName;
}

function stageFreshShell() {
  if (stagingPromise) return stagingPromise;

  stagingPromise = buildFreshShell()
    .finally(() => {
      stagingPromise = null;
    });

  return stagingPromise;
}

async function matchActiveAsset(asset) {
  const activeCacheName = await getActiveCacheName();
  if (!activeCacheName) return null;

  const cache = await caches.open(activeCacheName);
  return cache.match(asset);
}

async function matchAfterStaging(asset) {
  const cacheName = await stageFreshShell();
  const cache = await caches.open(cacheName);
  return cache.match(asset);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    stageFreshShell().then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    getActiveCacheName().then((activeCacheName) => cleanupOldContentCaches(activeCacheName))
  );
  // No clients.claim(): una pestaña clínica ya abierta conserva el worker con
  // el que comenzó hasta su próxima navegación, evitando mezclar runtimes.
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

    // Se sirve el shell activo completo y se prepara el siguiente en segundo
    // plano. Si no hay shell activo, se construye uno antes de responder.
    event.waitUntil(stageFreshShell().catch(() => undefined));
    event.respondWith((async () => {
      const active = await matchActiveAsset(navigationAsset);
      if (active) return active;

      try {
        const staged = await matchAfterStaging(navigationAsset);
        if (staged) return staged;
      } catch (_) {
        // El fallback de red permite abrir la app cuando aún no existe caché.
      }

      return fetch(request);
    })());
    return;
  }

  const shellAsset = SHELL_ASSET_BY_PATH.get(url.pathname);
  if (!shellAsset) return;

  event.respondWith((async () => {
    const active = await matchActiveAsset(shellAsset);
    if (active) return active;

    try {
      const staged = await matchAfterStaging(shellAsset);
      if (staged) return staged;
    } catch (_) {
      // Si el shell no pudo construirse, no ocultamos el recurso de red.
    }

    return fetch(request);
  })());
});
