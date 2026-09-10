from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def write(path, content):
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{label}: expected exactly one match, found {count}")
    return text.replace(old, new, 1)


sw = read("sw.js")
sw = replace_once(
    sw,
    'const DEPLOYMENT_REVISION = "pdf-isolation-20260910-r1";\n\nconst APP_SHELL = [\n  "./index.html",\n  "./pdf-preview.html?v=20260910-1",',
    'const DEPLOYMENT_REVISION = "pdf-isolation-20260910-r1";\nconst PDF_PREVIEW_PATH = "./pdf-preview.html?v=20260910-1";\n\nconst APP_SHELL = [\n  "./index.html",\n  PDF_PREVIEW_PATH,',
    "declare isolated preview navigation asset",
)
old_nav = '''  if (request.mode === "navigate") {
    // HTML network-first: evita entregar primero un index viejo y mezclar revisiones.
    const refreshIndex = caches.open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetchFresh(new Request("./index.html", { cache: "reload" }));
        await cache.put("./index.html", response.clone());
        return response;
      });

    event.waitUntil(refreshIndex.catch(() => undefined));
    event.respondWith(
      refreshIndex.catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match("./index.html")) || fetch(request);
      })
    );
    return;
  }
'''
new_nav = '''  if (request.mode === "navigate") {
    // La app y el documento imprimible son dos documentos HTML distintos.
    // Ambos usan network-first, pero nunca se sustituyen entre sí.
    const navigationAsset = url.pathname.endsWith("/pdf-preview.html")
      ? PDF_PREVIEW_PATH
      : "./index.html";

    const refreshNavigation = caches.open(CACHE_NAME)
      .then(async (cache) => {
        const response = await fetchFresh(new Request(navigationAsset, { cache: "reload" }));
        await cache.put(navigationAsset, response.clone());
        return response;
      });

    event.waitUntil(refreshNavigation.catch(() => undefined));
    event.respondWith(
      refreshNavigation.catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        return (await cache.match(navigationAsset)) || fetch(request);
      })
    );
    return;
  }
'''
sw = replace_once(sw, old_nav, new_nav, "separate preview navigation in service worker")
write("sw.js", sw)

inv = read("scripts/check_invariants.py")
needle = "        'event.waitUntil(refreshAsset.catch(() => undefined))', \"fetchFresh\",\n"
replacement = "        'event.waitUntil(refreshAsset.catch(() => undefined))', \"fetchFresh\",\n        'const PDF_PREVIEW_PATH = \"./pdf-preview.html?v=20260910-1\"',\n        'url.pathname.endsWith(\"/pdf-preview.html\")', 'cache.match(navigationAsset)',\n"
inv = replace_once(inv, needle, replacement, "protect isolated preview navigation")
write("scripts/check_invariants.py", inv)

print("Service worker now keeps app and PDF preview navigations separate")
