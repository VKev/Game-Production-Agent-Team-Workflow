#!/usr/bin/env python3
"""Reconcile the setup checkpoint after the authorized ZLinq.Unity live addition."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from pathlib import Path


UNITY_VERSION = "6000.3.21f1"
PACKAGE_ID = "com.cysharp.zlinq"
GIT_URL = re.compile(
    r"^https://github\.com/Cysharp/ZLinq\.git\?path=src/ZLinq\.Unity/Assets/ZLinq\.Unity#(?P<tag>[^#\s]+)$"
)
VERSION = re.compile(r"^\d+\.\d+\.\d+$")


def load_object(path: Path, label: str) -> dict:
    try:
        value = json.loads(path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise SystemExit(f"{label} is unavailable or invalid: {exc}") from exc
    if not isinstance(value, dict):
        raise SystemExit(f"{label} must be a JSON object")
    return value


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def same_path(left: str, right: Path) -> bool:
    try:
        return Path(left).resolve() == right.resolve()
    except (OSError, TypeError):
        return False


def phase_a_dependencies(graph: dict, graph_path: Path) -> dict[str, str]:
    recorded = graph.get("dependencies_after")
    if isinstance(recorded, dict) and all(isinstance(key, str) and isinstance(value, str) for key, value in recorded.items()):
        return dict(recorded)

    backup = graph_path.parent / "manifest.pre-unity-63.json"
    before = load_object(backup, "Phase-A manifest backup")
    dependencies = before.get("dependencies")
    packages = graph.get("packages")
    if not isinstance(dependencies, dict) or not isinstance(packages, dict):
        raise SystemExit("Package-graph checkpoint lacks dependencies_after and cannot be reconstructed safely")
    result = dict(dependencies)
    result.pop("com.coplaydev.unity-mcp", None)
    result.update(packages)
    if not all(isinstance(key, str) and isinstance(value, str) for key, value in result.items()):
        raise SystemExit("Reconstructed Phase-A dependency graph is invalid")
    return result


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--zlinq-version", required=True)
    parser.add_argument("--zlinq-git-url", required=True)
    parser.add_argument("--package-graph-checkpoint", type=Path)
    parser.add_argument("--setup-checkpoint", type=Path)
    args = parser.parse_args()

    root = args.project_root.resolve()
    if not VERSION.fullmatch(args.zlinq_version):
        raise SystemExit("ZLinq version must be a stable numeric version")
    url_match = GIT_URL.fullmatch(args.zlinq_git_url)
    if not url_match or url_match.group("tag").lstrip("v") != args.zlinq_version:
        raise SystemExit("ZLinq.Unity URL must be the matching official exact-tag Git URL")

    manifest_path = root / "Packages" / "manifest.json"
    lock_path = root / "Packages" / "packages-lock.json"
    graph_path = (args.package_graph_checkpoint or root / ".agent-temp" / "setup-checkpoints" / "unity-63-package-graph.json").resolve()
    setup_path = (args.setup_checkpoint or root / ".agent-temp" / "setup-checkpoints" / "setup-agents.json").resolve()
    manifest = load_object(manifest_path, "manifest.json")
    package_lock = load_object(lock_path, "packages-lock.json")
    graph = load_object(graph_path, "Phase-A package-graph checkpoint")
    setup = load_object(setup_path, "setup checkpoint")

    if graph.get("unity_version") != UNITY_VERSION:
        raise SystemExit("Package-graph checkpoint is not for Unity 6000.3.21f1")
    if setup.get("unityVersion", setup.get("unity_version")) != UNITY_VERSION:
        raise SystemExit("Setup checkpoint is not for Unity 6000.3.21f1")
    saved_root = setup.get("projectRoot", setup.get("project_root"))
    if not isinstance(saved_root, str) or not same_path(saved_root, root):
        raise SystemExit("Setup checkpoint project root does not match")

    current = manifest.get("dependencies")
    if not isinstance(current, dict):
        raise SystemExit("manifest.json has no dependencies object")
    expected = phase_a_dependencies(graph, graph_path)
    if PACKAGE_ID in expected:
        raise SystemExit("Phase-A checkpoint unexpectedly already contains ZLinq.Unity")
    expected[PACKAGE_ID] = args.zlinq_git_url
    if current != expected:
        missing = sorted(set(expected) - set(current))
        unexpected = sorted(set(current) - set(expected))
        changed = sorted(key for key in set(current) & set(expected) if current[key] != expected[key])
        raise SystemExit(
            "Manifest drift exceeds the authorized ZLinq.Unity addition: "
            f"missing={missing}, unexpected={unexpected}, changed={changed}"
        )

    locked = package_lock.get("dependencies")
    item = locked.get(PACKAGE_ID) if isinstance(locked, dict) else None
    if not isinstance(item, dict) or item.get("source") != "git" or item.get("version") != args.zlinq_git_url:
        raise SystemExit("packages-lock.json does not resolve the exact official ZLinq.Unity URL")

    manifest_hash = sha256(manifest_path)
    lock_hash = sha256(lock_path)
    setup["manifestAfterZLinqUnitySha256"] = manifest_hash
    setup["packageLockAfterZLinqUnitySha256"] = lock_hash
    setup["zlinqUnityReconciliation"] = {
        "status": "authorized-live-addition-verified",
        "packageId": PACKAGE_ID,
        "version": args.zlinq_version,
        "manifestValue": args.zlinq_git_url,
        "manifestSha256": manifest_hash,
        "packageLockSha256": lock_hash,
    }

    partial = setup_path.with_suffix(setup_path.suffix + ".partial")
    partial.write_text(json.dumps(setup, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    load_object(partial, "reconciled setup checkpoint")
    os.replace(partial, setup_path)
    print(json.dumps({"status": "reconciled", "checkpoint": str(setup_path), "manifest_sha256": manifest_hash, "package_lock_sha256": lock_hash}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
