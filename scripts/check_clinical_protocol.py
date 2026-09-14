from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "clinical-protocol.json"
ENGINE_PATH = "clinical-engine.js"
VERSION_RE = re.compile(r"^APS-NPH-\d{4}\.\d{2}\.\d{2}-r\d+$")


def load_manifest(text: str | None = None) -> dict:
    if text is None:
        text = MANIFEST_PATH.read_text(encoding="utf-8")
    data = json.loads(text)
    required = {"protocolId", "version", "status", "scope", "engine", "regressionMatrix", "changePolicy"}
    missing = sorted(required.difference(data))
    if missing:
        raise SystemExit(f"Clinical protocol manifest missing fields: {missing}")
    if data["protocolId"] != "insulog-aps-nph":
        raise SystemExit(f"Unexpected protocolId: {data['protocolId']}")
    if data["engine"] != ENGINE_PATH:
        raise SystemExit(f"Clinical protocol engine must be {ENGINE_PATH}")
    if not VERSION_RE.fullmatch(data["version"]):
        raise SystemExit(f"Invalid clinical protocol version: {data['version']}")
    if not isinstance(data["regressionMatrix"], list) or not data["regressionMatrix"]:
        raise SystemExit("regressionMatrix must be a non-empty list")
    return data


def validate_matrix(manifest: dict) -> None:
    for relative_path in manifest["regressionMatrix"]:
        path = ROOT / relative_path
        if not path.is_file():
            raise SystemExit(f"Clinical regression file missing: {relative_path}")


def git(*args: str, check: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=check,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def validate_pr_version_bump(manifest: dict) -> None:
    base_ref = os.environ.get("GITHUB_BASE_REF", "").strip()
    if not base_ref:
        return

    subprocess.run(
        ["git", "fetch", "origin", base_ref, "--depth=1"],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    base_sha = git("rev-parse", "FETCH_HEAD")
    changed = set(filter(None, git("diff", "--name-only", base_sha, "HEAD").splitlines()))

    if ENGINE_PATH not in changed:
        return

    if "clinical-protocol.json" not in changed:
        raise SystemExit(
            "clinical-engine.js changed without clinical-protocol.json. "
            "A clinical engine change must explicitly update the protocol manifest/version."
        )

    previous = subprocess.run(
        ["git", "show", f"{base_sha}:clinical-protocol.json"],
        cwd=ROOT,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if previous.returncode != 0:
        return

    previous_manifest = load_manifest(previous.stdout)
    if previous_manifest["version"] == manifest["version"]:
        raise SystemExit(
            "clinical-engine.js changed but clinical protocol version did not. "
            f"Current version remains {manifest['version']}."
        )


def main() -> None:
    manifest = load_manifest()
    validate_matrix(manifest)
    validate_pr_version_bump(manifest)
    print(
        "Clinical protocol governance OK: "
        f"{manifest['protocolId']} {manifest['version']} with {len(manifest['regressionMatrix'])} regression files"
    )


if __name__ == "__main__":
    main()
