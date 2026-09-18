#!/usr/bin/env python3
"""Create or clean the exact temporary real-assembly ZLinq compile probe."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path


RELATIVE_ROOT = Path("Assets") / "AgentSetupZLinqProbe"
ASMDEF = b'''{
  "name": "Agent.Setup.ZLinqProbe",
  "references": [
    "ZLinq.Unity"
  ],
  "includePlatforms": [
    "Editor"
  ],
  "autoReferenced": false
}
'''
SOURCE = b'''using ZLinq;

namespace Agent.Setup
{
    internal static class ZLinqCompileProbe
    {
        internal static int Sum()
        {
            var values = new[] { 1, 2, 3 }.AsValueEnumerable();
            var sum = 0;
            foreach (var value in values)
                sum += value;
            return sum;
        }
    }
}
'''
OWNED = {
    "Agent.Setup.ZLinqProbe.asmdef": ASMDEF,
    "ZLinqCompileProbe.cs": SOURCE,
}
ALLOWED_GENERATED = {
    "Agent.Setup.ZLinqProbe.asmdef.meta",
    "ZLinqCompileProbe.cs.meta",
}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_checkpoint(path: Path) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"Probe checkpoint is unavailable or invalid: {exc}") from exc
    if not isinstance(value, dict) or value.get("owner") != "setup-unity-zlinq":
        raise SystemExit("Probe checkpoint ownership is invalid")
    return value


def write_checkpoint(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".partial")
    partial.write_text(json.dumps(value, indent=2) + "\n", encoding="utf-8")
    os.replace(partial, path)


def validate_project(root: Path) -> None:
    if not (root / "Assets").is_dir() or not (root / "Packages" / "manifest.json").is_file():
        raise SystemExit(f"Not a Unity project root: {root}")


def create(root: Path, checkpoint_path: Path) -> dict:
    target = root / RELATIVE_ROOT
    checkpoint = None
    if checkpoint_path.is_file():
        checkpoint = load_checkpoint(checkpoint_path)
    if target.exists():
        unexpected = sorted(path.name for path in target.iterdir() if path.name not in set(OWNED) | ALLOWED_GENERATED)
        if unexpected:
            raise SystemExit(f"Probe directory contains unowned files: {unexpected}")
        for name, expected in OWNED.items():
            path = target / name
            if path.exists() and path.read_bytes() != expected:
                raise SystemExit(f"Existing probe file has unknown content: {path}")
    target.mkdir(parents=True, exist_ok=True)
    changed = False
    for name, content in OWNED.items():
        path = target / name
        if not path.exists():
            path.write_bytes(content)
            changed = True
    value = {
        "schema_version": 1,
        "owner": "setup-unity-zlinq",
        "status": "created-awaiting-unity-compile",
        "project_root": str(root),
        "probe_root": RELATIVE_ROOT.as_posix(),
        "files": {name: digest(content) for name, content in OWNED.items()},
        "reused": checkpoint is not None and not changed,
    }
    write_checkpoint(checkpoint_path, value)
    return value


def cleanup(root: Path, checkpoint_path: Path) -> dict:
    checkpoint = load_checkpoint(checkpoint_path)
    if Path(checkpoint.get("project_root", "")).resolve() != root:
        raise SystemExit("Probe checkpoint project root does not match")
    target = root / RELATIVE_ROOT
    removed: list[str] = []
    if target.exists():
        unexpected = sorted(path.name for path in target.iterdir() if path.name not in set(OWNED) | ALLOWED_GENERATED)
        if unexpected:
            raise SystemExit(f"Probe directory contains unowned files: {unexpected}")
        for name, expected in OWNED.items():
            path = target / name
            if path.exists() and path.read_bytes() != expected:
                raise SystemExit(f"Probe file changed after creation: {path}")
        for path in sorted(target.iterdir()):
            path.unlink()
            removed.append(path.relative_to(root).as_posix())
        target.rmdir()
        removed.append(RELATIVE_ROOT.as_posix())

    root_meta = target.with_suffix(".meta")
    if root_meta.is_file():
        root_meta.unlink()
        removed.append(root_meta.relative_to(root).as_posix())

    csproj = root / "Agent.Setup.ZLinqProbe.csproj"
    if csproj.is_file():
        text = csproj.read_text(encoding="utf-8-sig", errors="replace")
        if "Agent.Setup.ZLinqProbe" not in text:
            raise SystemExit("Generated probe csproj does not identify the owned assembly")
        csproj.unlink()
        removed.append(csproj.name)

    checkpoint["status"] = "cleaned-awaiting-unity-reload-verification"
    checkpoint["removed"] = removed
    write_checkpoint(checkpoint_path, checkpoint)
    return checkpoint


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("operation", choices=("create", "cleanup"))
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path)
    args = parser.parse_args()
    root = args.project_root.resolve()
    validate_project(root)
    checkpoint = (args.checkpoint or root / ".agent-temp" / "setup-checkpoints" / "zlinq-compile-probe.json").resolve()
    result = create(root, checkpoint) if args.operation == "create" else cleanup(root, checkpoint)
    print(json.dumps({"status": result["status"], "checkpoint": str(checkpoint), "probe_root": str(root / RELATIVE_ROOT)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
