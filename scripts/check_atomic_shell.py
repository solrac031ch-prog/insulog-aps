from pathlib import Path
from urllib.parse import urlsplit
import re

from app_shell_release import compute_release

ROOT = Path(__file__).resolve().parents[1]
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
CODE = re.sub(r"//.*", "", SW)
EXPECTED_RELEASE = compute_release()

REQUIRED = [
    f'const CACHE_NAME = "insulog-shell-{EXPECTED_RELEASE}"',
    f'const DEPLOYMENT_REVISION = "release-{EXPECTED_RELEASE}"',
    'const SHELL_ASSET_BY_PATH = new Map(',
    'new Request(asset, { cache: "reload" })',
    'event.waitUntil(precacheFreshShell())',
    'key.startsWith("insulog-shell-") && key !== CACHE_NAME',
    'cache.match(navigationAsset)',
    'cache.match(shellAsset)',
]

missing = [token for token in REQUIRED if token not in SW]
if missing:
    raise SystemExit(f"Atomic shell contract missing: {missing}")

FORBIDDEN = [
    "skipWaiting()",
    "clients.claim()",
    "refreshNavigation",
    "refreshAsset",
    "event.waitUntil(refresh",
]
found = [token for token in FORBIDDEN if token in CODE]
if found:
    raise SystemExit(f"Unsafe per-request shell update returned: {found}")

match = re.search(r"const APP_SHELL = \[(.*?)\];", SW, re.S)
if not match:
    raise SystemExit("APP_SHELL declaration not found")

assets = re.findall(r'"([^"\n]+)"', match.group(1))
if "PDF_PREVIEW_PATH" in match.group(1):
    pdf_match = re.search(r'const PDF_PREVIEW_PATH = "([^"]+)"', SW)
    if not pdf_match:
        raise SystemExit("PDF_PREVIEW_PATH is referenced but not declared")
    assets.insert(1, pdf_match.group(1))

if not assets:
    raise SystemExit("APP_SHELL is empty")

if len(assets) != len(set(assets)):
    duplicates = sorted({asset for asset in assets if assets.count(asset) > 1})
    raise SystemExit(f"Duplicate app-shell entries: {duplicates}")

versioned_assets = [asset for asset in assets if "?v=" in asset]
wrong_versions = [asset for asset in versioned_assets if not asset.endswith(f"?v={EXPECTED_RELEASE}")]
if wrong_versions:
    raise SystemExit(f"App-shell assets with noncanonical release token: {wrong_versions}")

paths = [urlsplit(asset).path for asset in assets]
normalized_paths = [path if path.startswith("./") else f"./{path.lstrip('/')}" for path in paths]
if len(normalized_paths) != len(set(normalized_paths)):
    duplicates = sorted({path for path in normalized_paths if normalized_paths.count(path) > 1})
    raise SystemExit(f"Multiple cached versions for the same path: {duplicates}")

required_paths = {
    "./index.html",
    "./pdf-preview.html",
    "./styles.css",
    "./document-flow.css",
    "./pdf-enhancements.css",
    "./pdf-design-2026.css",
    "./app-runtime.js",
    "./clinical-engine.js",
    "./clinical-copy.js",
    "./note-presenter.js",
    "./app.js",
    "./patient-document.js",
    "./pdf-enhancements.js",
    "./aps-safety-2026.js",
    "./farmacia-popular.js",
    "./document-flow.js",
    "./app-shell.js",
    "./manifest.webmanifest",
}
missing_paths = sorted(required_paths - set(normalized_paths))
if missing_paths:
    raise SystemExit(f"Critical paths missing from immutable shell: {missing_paths}")

if any("farmacia-cerro-navia.json" in asset for asset in assets):
    raise SystemExit("Farmacia Popular live JSON must remain network-only")

if CODE.count("cache.put(") != 1:
    raise SystemExit("Shell cache must be populated only during atomic install")

print(f"Atomic immutable shell passed for release {EXPECTED_RELEASE} with {len(assets)} unique assets")
