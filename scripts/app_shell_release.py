from __future__ import annotations

from pathlib import Path
import argparse
import hashlib
import re

ROOT = Path(__file__).resolve().parents[1]

# Files that define one offline-capable Insulog release. Dynamic pharmacy data is
# intentionally excluded because it is fetched with no-store at runtime.
SHELL_FILES = [
    "index.html",
    "pdf-preview.html",
    "styles.css",
    "document-flow.css",
    "pdf-enhancements.css",
    "pdf-design-2026.css",
    "aps-safety-2026.css",
    "farmacia-popular.css",
    "app-runtime.js",
    "clinical-engine.js",
    "clinical-copy.js",
    "note-presenter.js",
    "app.js",
    "safety-guard.js",
    "patient-document.js",
    "pdf-enhancements.js",
    "aps-safety-2026.js",
    "farmacia-popular.js",
    "document-flow.js",
    "app-shell.js",
    "phase6b-professional-decision.js",
    "phase6b-document-sync.js",
    "manifest.webmanifest",
    "assets/icons/icon-32.png",
    "assets/icons/icon-180.png",
    "assets/icons/icon-192.png",
    "assets/icons/icon-512.png",
    "sw.js",
]

VERSION_RE = re.compile(rb"\?v=[A-Za-z0-9._-]+")
CACHE_RE = re.compile(rb'const CACHE_NAME = "insulog-shell-[^"]+"')
REVISION_RE = re.compile(rb'const DEPLOYMENT_REVISION = "[^"]+"')
HEX_TOKEN_RE = re.compile(r"^[0-9a-f]{16}$")


def normalized_bytes(path: str) -> bytes:
    data = (ROOT / path).read_bytes()
    if path in {"index.html", "pdf-preview.html", "sw.js"}:
        data = VERSION_RE.sub(b"?v=__RELEASE__", data)
    if path == "sw.js":
        data = CACHE_RE.sub(b'const CACHE_NAME = "insulog-shell-__RELEASE__"', data)
        data = REVISION_RE.sub(b'const DEPLOYMENT_REVISION = "release-__RELEASE__"', data)
    return data


def compute_release() -> str:
    digest = hashlib.sha256()
    for path in sorted(SHELL_FILES):
        data = normalized_bytes(path)
        digest.update(path.encode("utf-8"))
        digest.update(b"\0")
        digest.update(str(len(data)).encode("ascii"))
        digest.update(b"\0")
        digest.update(data)
        digest.update(b"\0")
    return digest.hexdigest()[:16]


def rewrite_text_file(path: str, release: str) -> None:
    file_path = ROOT / path
    data = file_path.read_bytes()
    data = VERSION_RE.sub(f"?v={release}".encode("ascii"), data)
    if path == "sw.js":
        data = CACHE_RE.sub(f'const CACHE_NAME = "insulog-shell-{release}"'.encode("ascii"), data)
        data = REVISION_RE.sub(f'const DEPLOYMENT_REVISION = "release-{release}"'.encode("ascii"), data)
    file_path.write_bytes(data)


def current_release_tokens() -> set[str]:
    tokens: set[str] = set()
    for path in ("index.html", "pdf-preview.html", "sw.js"):
        text = (ROOT / path).read_text(encoding="utf-8")
        tokens.update(re.findall(r"\?v=([A-Za-z0-9._-]+)", text))
    return tokens


def validate(expected: str) -> None:
    tokens = current_release_tokens()
    if tokens != {expected}:
        raise SystemExit(
            "App-shell URL versions are not canonical. "
            f"Expected only {expected}; found {sorted(tokens)}. "
            "Run: python scripts/app_shell_release.py --write"
        )

    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    cache_match = re.search(r'const CACHE_NAME = "insulog-shell-([^"]+)"', sw)
    revision_match = re.search(r'const DEPLOYMENT_REVISION = "release-([^"]+)"', sw)
    cache_token = cache_match.group(1) if cache_match else ""
    revision_token = revision_match.group(1) if revision_match else ""

    if cache_token != expected or revision_token != expected:
        raise SystemExit(
            f"Service-worker release mismatch: expected {expected}, "
            f"cache={cache_token or '<missing>'}, revision={revision_token or '<missing>'}"
        )
    if not HEX_TOKEN_RE.fullmatch(expected):
        raise SystemExit(f"Invalid release token format: {expected}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate/check the Insulog app-shell release fingerprint")
    parser.add_argument("--write", action="store_true", help="Rewrite shell URL/cache tokens to the computed fingerprint")
    parser.add_argument("--print", dest="print_only", action="store_true", help="Print the computed fingerprint")
    args = parser.parse_args()

    release = compute_release()
    if args.print_only:
        print(release)
        return

    if args.write:
        for path in ("index.html", "pdf-preview.html", "sw.js"):
            rewrite_text_file(path, release)
        # Recompute after writing to prove normalization makes the operation idempotent.
        after = compute_release()
        if after != release:
            raise SystemExit(f"Release fingerprint was not idempotent: before={release}, after={after}")

    validate(release)
    print(f"Insulog app-shell release fingerprint OK: {release}")


if __name__ == "__main__":
    main()
