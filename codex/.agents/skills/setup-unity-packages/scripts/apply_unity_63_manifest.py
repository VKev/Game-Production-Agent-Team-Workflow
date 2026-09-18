#!/usr/bin/env python3
"""Atomically apply the complete Unity 6000.3.21f1 package graph."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path


UNITY_VERSION = "6000.3.21f1"
REQUIRED = {
    "com.unity.ai.assistant",
    "com.unity.probuilder",
    "com.unity.visualeffectgraph",
    "com.unity.cloud.gltfast",
    "com.unity.cinemachine",
    "jp.hadashikick.vcontainer",
    "com.unity.burst",
    "com.unity.collections",
}
SEMVER = re.compile(r"^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$")
VCONTAINER = re.compile(r"^https://github\.com/hadashiA/VContainer\.git\?path=VContainer/Assets/VContainer#[0-9]+\.[0-9]+\.[0-9]+$")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_object(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(value, dict):
        raise ValueError(f"Expected a JSON object: {path}")
    return value


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--packages-json", type=Path, required=True)
    parser.add_argument("--evidence-json", type=Path)
    parser.add_argument("--checkpoint", type=Path)
    args = parser.parse_args()

    root = args.project_root.resolve()
    manifest_path = root / "Packages" / "manifest.json"
    version_path = root / "ProjectSettings" / "ProjectVersion.txt"
    lock_path = root / "Temp" / "UnityLockfile"
    if not manifest_path.is_file() or not version_path.is_file():
        raise SystemExit(f"Not a Unity project: {root}")
    match = re.search(r"(?m)^m_EditorVersion:\s*(\S+)\s*$", version_path.read_text(encoding="utf-8-sig"))
    if not match or match.group(1) != UNITY_VERSION:
        raise SystemExit(f"Setup requires Unity {UNITY_VERSION}; project declares {match.group(1) if match else 'unknown'}")
    if lock_path.exists():
        raise SystemExit("Unity Editor must be closed before the manifest transaction")

    resolved = load_object(args.packages_json)
    packages = resolved.get("packages", resolved)
    if not isinstance(packages, dict):
        raise SystemExit("packages-json must contain a package map")
    missing = sorted(REQUIRED - set(packages))
    if missing:
        raise SystemExit(f"Incomplete required package graph: {', '.join(missing)}")
    for package_id, value in packages.items():
        if not isinstance(package_id, str) or not isinstance(value, str) or not value:
            raise SystemExit("Every package id/value must be a non-empty string")
        if package_id == "jp.hadashikick.vcontainer":
            if not VCONTAINER.fullmatch(value):
                raise SystemExit("VContainer must be the verified official exact-tag Git URL")
        elif package_id.startswith("com.unity.") and not SEMVER.fullmatch(value):
            raise SystemExit(f"Unity package must use an exact version: {package_id}={value}")

    evidence = load_object(args.evidence_json) if args.evidence_json else None
    if evidence is None:
        raise SystemExit("evidence-json is required for the Phase-A checkpoint")
    if evidence.get("unity_version") != UNITY_VERSION:
        raise SystemExit("evidence-json does not verify the exact Unity version")
    if not isinstance(evidence.get("unity_editor_path"), str) or not evidence["unity_editor_path"]:
        raise SystemExit("evidence-json does not record the verified Unity Editor path")
    package_evidence = evidence.get("package_evidence")
    if not isinstance(package_evidence, dict):
        raise SystemExit("evidence-json package_evidence must be an object keyed by package id")
    for package_id, manifest_value in packages.items():
        item = package_evidence.get(package_id)
        if not isinstance(item, dict):
            raise SystemExit(f"Missing package evidence: {package_id}")
        if item.get("manifest_value") != manifest_value or item.get("verification") != "verified":
            raise SystemExit(f"Package evidence is not verified for exact manifest value: {package_id}")
        if not isinstance(item.get("source"), str) or not item["source"]:
            raise SystemExit(f"Package evidence has no source: {package_id}")
        if not isinstance(item.get("integrity"), dict) or not item["integrity"]:
            raise SystemExit(f"Package evidence has no integrity proof: {package_id}")
    archives = evidence.get("archives")
    if not isinstance(archives, list):
        raise SystemExit("evidence-json does not contain archive status")
    for item in archives:
        if not isinstance(item, dict) or item.get("status") != "verified" or not item.get("sha256"):
            raise SystemExit("Every registered archive must have verified status and SHA256")

    before = manifest_path.read_bytes()
    manifest = json.loads(before.decode("utf-8-sig"))
    dependencies = manifest.get("dependencies")
    if not isinstance(dependencies, dict):
        raise SystemExit("manifest.json has no dependencies object")
    dependencies.pop("com.coplaydev.unity-mcp", None)
    for package_id, value in packages.items():
        dependencies[package_id] = value

    newline = "\r\n" if b"\r\n" in before else "\n"
    indent_match = re.search(rb"\n(?P<indent>[ \t]+)\"dependencies\"", before)
    indent = len(indent_match.group("indent")) if indent_match else 2
    rendered = (json.dumps(manifest, indent=indent, ensure_ascii=False) + "\n").replace("\n", newline).encode("utf-8")
    checkpoint = args.checkpoint.resolve() if args.checkpoint else root / ".agent-temp" / "setup-checkpoints" / "unity-63-package-graph.json"
    checkpoint.parent.mkdir(parents=True, exist_ok=True)
    if rendered != before:
        backup = checkpoint.parent / "manifest.pre-unity-63.json"
        backup.write_bytes(before)
        partial = manifest_path.with_suffix(".json.partial")
        partial.write_bytes(rendered)
        try:
            parsed = json.loads(partial.read_text(encoding="utf-8"))
            if not REQUIRED.issubset(parsed["dependencies"]):
                raise ValueError("Post-write package graph is incomplete")
            os.replace(partial, manifest_path)
        except Exception:
            partial.unlink(missing_ok=True)
            shutil.copyfile(backup, manifest_path)
            raise

    after = manifest_path.read_bytes()
    report = {
        "status": "prepared-editor-closed-package-graph",
        "unity_version": UNITY_VERSION,
        "manifest_sha256_before": digest(before),
        "manifest_sha256_after": digest(after),
        "changed": before != after,
        "packages": {key: packages[key] for key in sorted(packages)},
        "dependencies_after": {key: dependencies[key] for key in sorted(dependencies)},
        "evidence": evidence,
        "phase_b_remaining": [
            "open Unity once and wait for resolve/import/compile",
            "import verified unitypackage archives in order",
            "run DOTween and other Editor-dependent configuration",
            "verify official relay and upsert Codex unity_mcp",
            "approve Codex, enable all tools, generate live catalog, and run final checks",
        ],
    }
    checkpoint.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": report["status"], "changed": report["changed"], "checkpoint": str(checkpoint)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
