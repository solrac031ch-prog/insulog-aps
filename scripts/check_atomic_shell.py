#!/usr/bin/env python3
"""Static contract for the content-addressed Insulog app shell."""

from pathlib import Path
import re
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
sw = (ROOT / "sw.js").read_text(encoding="utf-8")
html = (ROOT / "index.html").read_text(encoding="utf-8")
pdf = (ROOT / "pdf-preview.html").read_text(encoding="utf-8")


def fail(message: str) -> None:
    raise SystemExit(f"Atomic shell invariant failed: {message}")


def require(text: str, snippets: list[str], label: str) -> None:
    missing = [snippet for snippet in snippets if snippet not in text]
    if missing:
        fail(f"{label}: missing {missing}")


require(
    sw,
    [
        'const META_CACHE = "insulog-shell-meta-v1"',
        'const CONTENT_CACHE_PREFIX = "insulog-shell-content-"',
        "const ACTIVE_POINTER_KEY =",
        "const SHELL_ASSET_BY_PATH = new Map(",
        'crypto.subtle.digest("SHA-256", payload)',
        "async function fingerprintShell(items)",
        "async function getActiveCacheName()",
        "async function setActiveCacheName(cacheName)",
        "async function buildFreshShell()",
        "function stageFreshShell()",
        "await cache.put(item.asset, item.response.clone())",
        "await setActiveCacheName(cacheName)",
        'request.mode === "navigate"',
        "event.waitUntil(stageFreshShell().catch(() => undefined))",
        "const shellAsset = SHELL_ASSET_BY_PATH.get(url.pathname)",
    ],
    "content-addressed service worker",
)

for forbidden in [
    "const CACHE_NAME =",
    "DEPLOYMENT_REVISION",
    "refreshAsset",
    "precacheFreshShell",
    "self.clients.claim()",
]:
    if forbidden in sw:
        fail(f"legacy cache behavior returned: {forbidden}")

put_index = sw.index("await cache.put(item.asset, item.response.clone())")
pointer_index = sw.index("await setActiveCacheName(cacheName)")
if pointer_index <= put_index:
    fail("active pointer must switch only after shell resources are cached")

if "data/farmacia-cerro-navia.json" in sw:
    fail("Farmacia Popular data must remain outside the immutable app shell")

block = re.search(r"const APP_SHELL = \[(.*?)\];", sw, re.S)
if not block:
    fail("APP_SHELL declaration not found")

shell_assets = set(re.findall(r'"(\./[^"\n]+)"', block.group(1)))
pdf_constant = re.search(r'const PDF_PREVIEW_PATH = "([^"]+)"', sw)
if not pdf_constant:
    fail("PDF_PREVIEW_PATH not found")
shell_assets.add(pdf_constant.group(1))
shell_paths = {urlsplit(asset).path for asset in shell_assets}

required_shell_paths = {
    "./index.html",
    "./pdf-preview.html",
    "./styles.css",
    "./pdf-enhancements.css",
    "./pdf-design-2026.css",
    "./document-flow.css",
    "./aps-safety-2026.css",
    "./farmacia-popular.css",
    "./app-runtime.js",
    "./clinical-engine.js",
    "./app.js",
    "./patient-document.js",
    "./pdf-enhancements.js",
    "./aps-safety-2026.js",
    "./farmacia-popular.js",
    "./document-flow.js",
    "./app-shell.js",
    "./manifest.webmanifest",
    "./assets/icons/icon-32.png",
    "./assets/icons/icon-180.png",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
}

missing_paths = sorted(required_shell_paths - shell_paths)
if missing_paths:
    fail(f"APP_SHELL is missing required resources: {missing_paths}")

asset_pattern = re.compile(
    r'(?:src|href)="(\./[^"#]+\.(?:js|css|html|webmanifest|png)(?:\?[^"#]*)?)"'
)
referenced = set(asset_pattern.findall(html)) | set(asset_pattern.findall(pdf))
referenced_paths = {urlsplit(asset).path for asset in referenced}
not_atomic = sorted(referenced_paths - shell_paths)
if not_atomic:
    fail(f"HTML references resources outside the atomic shell: {not_atomic}")

print(
    f"Atomic content-addressed shell contract passed: {len(shell_paths)} cached paths, "
    f"{len(referenced_paths)} HTML-referenced paths protected"
)
