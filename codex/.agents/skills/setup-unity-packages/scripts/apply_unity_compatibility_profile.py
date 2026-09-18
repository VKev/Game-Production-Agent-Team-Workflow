#!/usr/bin/env python3
"""Apply one registered compatibility profile to an already-imported package."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import sys

from prepare_unitypackage import (
    PATCH_MANIFEST,
    PreparationError,
    apply_compatibility_patch,
    sha256_file,
    validate_compatibility_profile,
)


EXACT_UNITY = "6000.3.21f1"


def atomic_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    partial = path.with_suffix(path.suffix + ".partial")
    partial.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    os.replace(partial, path)


def load_profile(profile_id: str) -> dict:
    manifest = json.loads(PATCH_MANIFEST.read_text(encoding="utf-8"))
    if manifest.get("schema_version") != 1 or manifest.get("unity_version") != EXACT_UNITY:
        raise PreparationError("compatibility manifest does not target the exact supported Editor")
    matches = [profile for profile in manifest.get("profiles", []) if profile.get("id") == profile_id]
    if len(matches) != 1:
        raise PreparationError(f"expected exactly one registered profile {profile_id!r}")
    return validate_compatibility_profile(matches[0])


def installed_path(project: Path, profile: dict, archive_path: str) -> Path:
    archive_root = profile["archive_root"]
    installed_root = profile["installed_root"]
    if archive_path != archive_root and not archive_path.startswith(archive_root + "/"):
        raise PreparationError(f"profile path is outside its archive root: {archive_path}")
    relative = archive_path[len(archive_root):].lstrip("/")
    pure = PurePosixPath(installed_root) / PurePosixPath(relative)
    if pure.is_absolute() or ".." in pure.parts:
        raise PreparationError(f"unsafe installed profile path: {pure}")
    return project.joinpath(*pure.parts)


def apply_profile(project: Path, archive: Path, profile_id: str, check_only: bool) -> dict:
    project = project.resolve()
    archive = archive.resolve()
    if not (project / "Assets").is_dir() or not (project / "Packages" / "manifest.json").is_file():
        raise PreparationError(f"not a Unity project root: {project}")
    version_text = (project / "ProjectSettings" / "ProjectVersion.txt").read_text(encoding="utf-8")
    if f"m_EditorVersion: {EXACT_UNITY}" not in version_text.splitlines():
        raise PreparationError(f"project does not declare exact Unity {EXACT_UNITY}")
    profile = load_profile(profile_id)
    if profile.get("unity_version") != EXACT_UNITY:
        raise PreparationError("profile does not target the exact supported Editor")
    if archive.name != profile.get("archive") or sha256_file(archive) != profile.get("archive_sha256"):
        raise PreparationError("profile archive name or SHA-256 mismatch")
    primary = project.joinpath(*PurePosixPath(profile["primary_path"]).parts)
    if not primary.is_file() or sha256_file(primary) != profile.get("primary_sha256"):
        raise PreparationError("installed package primary marker mismatch")

    files = profile.get("files")
    if not isinstance(files, list) or len(files) != len({entry.get("path") for entry in files}):
        raise PreparationError("compatibility profile file list is empty or duplicated")
    observed = []
    planned: list[tuple[Path, bytes, bytes, dict]] = []
    for entry in files:
        path = installed_path(project, profile, entry["path"])
        if not path.is_file():
            raise PreparationError(f"installed compatibility source is missing: {path}")
        source = path.read_bytes()
        digest = hashlib.sha256(source).hexdigest()
        if digest in {entry.get("result_file_sha256"), entry.get("live_result_file_sha256")}:
            state = "result"
        elif digest == entry.get("source_file_sha256"):
            effective_entry = entry
            patched, changed = apply_compatibility_patch(entry["path"], source, {entry["path"]: effective_entry})
            if not changed or hashlib.sha256(patched).hexdigest() != effective_entry.get("result_file_sha256"):
                raise PreparationError(f"registered result verification failed: {path}")
            planned.append((path, source, patched, effective_entry))
            state = "source"
        else:
            raise PreparationError(f"installed compatibility source/result hash mismatch: {path}")
        observed.append({"path": path.relative_to(project).as_posix(), "sha256": digest, "state": state})

    checkpoint = project / ".agent-temp" / "setup-checkpoints" / f"compatibility-{profile_id}.json"
    report = {
        "schema_version": 1,
        "profile": profile_id,
        "unity_version": EXACT_UNITY,
        "archive": archive.name,
        "archive_sha256": profile["archive_sha256"],
        "state_before": "correct" if not planned else "repairable",
        "files": observed,
        "planned_patch_count": len(planned),
        "status": "check-only" if check_only else "pending-apply",
    }
    atomic_json(checkpoint, report)
    if check_only or not planned:
        report["status"] = "correct" if not planned else "repairable"
        atomic_json(checkpoint, report)
        return report

    replaced: list[tuple[Path, bytes]] = []
    try:
        for path, original, patched, _ in planned:
            partial = path.with_suffix(path.suffix + ".compatibility.partial")
            if partial.exists():
                raise PreparationError(f"compatibility partial already exists: {partial}")
            partial.write_bytes(patched)
            if hashlib.sha256(partial.read_bytes()).hexdigest() not in {
                item[3]["result_file_sha256"] for item in planned if item[0] == path
            }:
                raise PreparationError(f"compatibility partial verification failed: {path}")
            os.replace(partial, path)
            replaced.append((path, original))
    except Exception:
        for path, original in reversed(replaced):
            rollback = path.with_suffix(path.suffix + ".rollback.partial")
            rollback.write_bytes(original)
            os.replace(rollback, path)
        raise

    results = []
    for path, _, _, entry in planned:
        digest = sha256_file(path)
        if digest != entry["result_file_sha256"]:
            raise PreparationError(f"post-apply result hash mismatch: {path}")
        results.append({"path": path.relative_to(project).as_posix(), "sha256": digest})
    report.update({"status": "repaired", "patched_count": len(planned), "results": results})
    atomic_json(checkpoint, report)
    return report


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", required=True, type=Path)
    parser.add_argument("--archive", required=True, type=Path)
    parser.add_argument("--profile", required=True)
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()
    try:
        report = apply_profile(args.project_root, args.archive, args.profile, args.check_only)
    except (OSError, ValueError, json.JSONDecodeError, PreparationError) as exc:
        print(json.dumps({"status": "blocked", "reason": str(exc)}), file=sys.stderr)
        return 2
    print(json.dumps(report, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
