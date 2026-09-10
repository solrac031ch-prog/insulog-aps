from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "scripts/check_invariants.py"
text = path.read_text(encoding="utf-8")

old = """        'new Request(asset, { cache: \"reload\" })', 'cache.match(\"./index.html\")',
        'addEventListener(\"fetch\"', 'caches.delete',
        'event.waitUntil(refreshIndex.catch(() => undefined))',
        'event.waitUntil(refreshAsset.catch(() => undefined))', \"fetchFresh\",
"""
new = """        'new Request(asset, { cache: \"reload\" })',
        'addEventListener(\"fetch\"', 'caches.delete',
        'event.waitUntil(refreshNavigation.catch(() => undefined))',
        'event.waitUntil(refreshAsset.catch(() => undefined))', \"fetchFresh\",
"""
if text.count(old) != 1:
    raise SystemExit(f"Expected one legacy PWA invariant block, found {text.count(old)}")
text = text.replace(old, new, 1)
path.write_text(text, encoding="utf-8")
print("Static PWA invariants aligned with isolated navigation")
