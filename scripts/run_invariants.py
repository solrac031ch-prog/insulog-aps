#!/usr/bin/env python3
"""Run the legacy invariant suite while Phase 8 owns the PWA contract separately.

The large invariant suite remains authoritative for clinical/UI/document boundaries.
Only its obsolete Phase-7B PWA block is omitted; `check_atomic_shell.py` replaces it
with the stricter content-addressed shell contract.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
legacy_path = ROOT / "scripts" / "check_invariants.py"
source = legacy_path.read_text(encoding="utf-8")

start_marker = "# PWA responsibility:"
end_marker = 'if "followup-flow-2026.js"'

start = source.find(start_marker)
end = source.find(end_marker, start)
if start < 0 or end < 0 or end <= start:
    raise SystemExit("Could not isolate the legacy PWA invariant block")

migrated = (
    source[:start]
    + "# Phase 8 PWA invariants are validated by scripts/check_atomic_shell.py.\n"
    + source[end:]
)

namespace = {
    "__file__": str(legacy_path),
    "__name__": "__main__",
}
exec(compile(migrated, str(legacy_path), "exec"), namespace)
