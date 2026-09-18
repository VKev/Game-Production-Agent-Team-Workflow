#!/usr/bin/env python3
"""Prepare registered Unity archives for a target project without touching Assets.

The output is always written below <project>/.agent-temp/unity-package-staging.
Only exact registered archive hashes are accepted.  The transformation keeps Unity
GUID directories intact while remapping pathnames, applying hash-gated compatibility
patches, and optionally removing a known render-pipeline demo subtree.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
import copy
import gzip
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import re
import sys
import tarfile
from typing import Any


SCRIPT_DIR = Path(__file__).resolve().parent
PATCH_MANIFEST = SCRIPT_DIR / "unity_compatibility_patches.json"
GUID_RE = re.compile(rb"(?<![0-9a-f])([0-9a-f]{32})(?![0-9a-f])", re.IGNORECASE)
UNITY_VERSION_RE = re.compile(r"^m_EditorVersion:\s*(\d+)\.(\d+)\.(\d+)[A-Za-z0-9.]*\s*$", re.MULTILINE)
TEXT_EXTENSIONS = {
    ".asmdef", ".asmref", ".cginc", ".compute", ".cs", ".hlsl", ".json",
    ".md", ".shader", ".txt", ".uss", ".uxml", ".xml", ".yaml", ".yml",
}


REGISTERED: dict[str, dict[str, Any]] = {
    "8b2b6f42da157c9410b4fa13dddb17ff6d82f14fba706005df767fe62e387a5d": {
        "archive": "ZodinInspector.unitypackage",
        "old_root": "Assets/Plugins/Sirenix",
        "new_root": "Assets/Plugins/Sirenix",
    },
    "2244448acb4b8cbb2ef97794d1c22d7e4225e1a506fec79c357dafcda6d4882f": {
        "archive": "DOTweenPro.unitypackage",
        "old_root": "Assets/Plugins/Demigiant",
        "new_root": "Assets/Plugins/Demigiant",
    },
    "b422040ecba5efd0b6b54f2667d7ba2bbba30e7511e2f10b6bfd8fceb7dd4438": {
        "archive": "Feel.unitypackage",
        "old_root": "Assets/Feel",
        "new_root": "Assets/Plugins/Feel",
        "strip": {"not_hdrp": ["Assets/Feel/FeelDemosHDRP"]},
    },
    "d764ea0ff2a7c379731ef0ff8cde62f7aadabedd321e86f0b97eebd11fd8a8c0": {
        "archive": "FinalIK.unitypackage",
        "old_root": "Assets/Plugins/RootMotion",
        "new_root": "Assets/Plugins/RootMotion",
    },
    "b92b608c4b1d5703e5626aaa252d12f507d537a08c324d2937db552d706e282a": {
        "archive": "LegsAnimator.unitypackage",
        "old_root": "Assets/FImpossible Creations",
        "new_root": "Assets/Plugins/FImpossible Creations",
    },
    "ad6340bb9e3fdcca9f266b05bfc6debfc6ada6c1283a05a3584fcc310fc1715c": {
        "archive": "Optimizers.unitypackage",
        "old_root": "Assets/FImpossible Creations",
        "new_root": "Assets/Plugins/FImpossible Creations",
    },
    "70ba664ee8d7b6f0cb16111d1ecc8800f66ba87ab821eff369a889c3de98104f": {
        "archive": "RetargetPro.unitypackage",
        "old_root": "Assets/KINEMATION",
        "new_root": "Assets/Plugins/KINEMATION",
    },
    "af95839622b5d2fb477982138699d32e35e190577c3d00eeb4e55b3aed614e88": {
        "archive": "SpinalAnimator.unitypackage",
        "old_root": "Assets/FImpossible Creations",
        "new_root": "Assets/Plugins/FImpossible Creations",
    },
    "a14ef1c7121dc7d79a01c474dfa55f237f7ac44d5fae7a4145339731154c3a92": {
        "archive": "TailAnimator.unitypackage",
        "old_root": "Assets/FImpossible Creations",
        "new_root": "Assets/Plugins/FImpossible Creations",
    },
    "ae68a99ba0e06328291a0e1be12ef504249f7dbb23328553f4b9873a2a5dbd84": {
        "archive": "TechnieColliderCreator.unitypackage",
        "old_root": "Assets/Technie",
        "new_root": "Assets/Plugins/Technie",
    },
}


class PreparationError(RuntimeError):
    pass


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def within(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def validate_tar_name(name: str) -> None:
    if name == ".icon.png":
        return
    path = PurePosixPath(name)
    if path.is_absolute() or ".." in path.parts or "\\" in name:
        raise PreparationError(f"unsafe archive member: {name!r}")
    if len(path.parts) not in (1, 2) or not re.fullmatch(r"[0-9a-f]{32}", path.parts[0]):
        raise PreparationError(f"unexpected Unity package member: {name!r}")


def read_unity_version(project: Path) -> tuple[int, int, int, str]:
    path = project / "ProjectSettings" / "ProjectVersion.txt"
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise PreparationError(f"cannot read {path}: {exc}") from exc
    match = UNITY_VERSION_RE.search(text)
    if not match:
        raise PreparationError(f"cannot parse Unity version from {path}")
    major, minor, patch = (int(value) for value in match.groups())
    return major, minor, patch, match.group(0).split(":", 1)[1].strip()


def detect_render_pipeline(project: Path) -> str:
    manifest_path = project / "Packages" / "manifest.json"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PreparationError(f"cannot parse {manifest_path}: {exc}") from exc
    dependencies = manifest.get("dependencies")
    if not isinstance(dependencies, dict):
        raise PreparationError(f"{manifest_path} has no dependencies object")
    has_urp = "com.unity.render-pipelines.universal" in dependencies
    has_hdrp = "com.unity.render-pipelines.high-definition" in dependencies
    if has_urp and has_hdrp:
        raise PreparationError("both URP and HDRP are declared; active render pipeline is ambiguous")
    if has_hdrp:
        return "hdrp"
    if has_urp:
        return "urp"
    return "builtin"


def first_pathname(raw: bytes) -> str:
    try:
        path = raw.decode("utf-8").splitlines()[0]
    except (UnicodeDecodeError, IndexError) as exc:
        raise PreparationError("invalid pathname record") from exc
    pure = PurePosixPath(path)
    if not path.startswith("Assets/") or pure.is_absolute() or ".." in pure.parts or "\\" in path:
        raise PreparationError(f"unsafe Unity pathname: {path!r}")
    return path.rstrip("/")


def remap_path(path: str, old_root: str, new_root: str) -> str:
    if path == old_root:
        return new_root
    if path.startswith(old_root + "/"):
        return new_root + path[len(old_root):]
    return path


def rewrite_pathname(raw: bytes, old_path: str, new_path: str) -> bytes:
    old = old_path.encode("utf-8")
    if not raw.startswith(old):
        raise PreparationError(f"pathname record does not start with {old_path!r}")
    return new_path.encode("utf-8") + raw[len(old):]


def is_under(path: str, root: str) -> bool:
    return path == root or path.startswith(root + "/")


def normalize_text(data: bytes) -> str:
    try:
        return data.replace(b"\r\n", b"\n").decode("utf-8-sig")
    except UnicodeDecodeError as exc:
        raise PreparationError("registered compatibility source is not UTF-8") from exc


def apply_compatibility_patch(path: str, data: bytes, files: dict[str, dict[str, Any]]) -> tuple[bytes, bool]:
    entry = files.get(path)
    if entry is None:
        return data, False
    text = normalize_text(data)
    source_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()
    if source_hash != entry["source_sha256"]:
        raise PreparationError(f"compatibility source hash mismatch: {path}")
    lines = text.splitlines(keepends=True)
    for hunk in reversed(entry["hunks"]):
        start = hunk["start"]
        delete = hunk["delete"]
        if not isinstance(start, int) or not isinstance(delete, int) or start < 0 or delete < 0:
            raise PreparationError(f"invalid compatibility hunk: {path}")
        lines[start:start + delete] = hunk["insert"]
    result = "".join(lines)
    result_hash = hashlib.sha256(result.encode("utf-8")).hexdigest()
    if result_hash != entry["result_sha256"]:
        raise PreparationError(f"compatibility result hash mismatch: {path}")
    return result.encode("utf-8"), True


def replace_root_literals(data: bytes, path: str, old_root: str, new_root: str) -> tuple[bytes, bool]:
    if old_root == new_root or PurePosixPath(path).suffix.lower() not in TEXT_EXTENSIONS:
        return data, False
    changed = data
    pairs = (
        (old_root.encode("utf-8"), new_root.encode("utf-8")),
        (old_root.replace("/", "\\").encode("utf-8"), new_root.replace("/", "\\").encode("utf-8")),
    )
    for old, new in pairs:
        changed = changed.replace(old, new)
    return changed, changed != data


def validate_compatibility_profile(profile: dict[str, Any]) -> dict[str, Any]:
    files = profile.get("files")
    if not isinstance(files, list) or not files:
        raise PreparationError("matching compatibility profile has no files")
    if profile.get("expected_file_count") != len(files):
        raise PreparationError("compatibility profile file count does not match its exact gate")
    paths: set[str] = set()
    hunk_count = 0
    for entry in files:
        if not isinstance(entry, dict) or not isinstance(entry.get("path"), str):
            raise PreparationError("invalid compatibility file entry")
        path = entry["path"]
        if path in paths:
            raise PreparationError(f"duplicate compatibility path: {path}")
        paths.add(path)
        for hash_field in ("source_file_sha256", "source_sha256", "result_file_sha256", "result_sha256"):
            if not re.fullmatch(r"[0-9a-f]{64}", str(entry.get(hash_field, ""))):
                raise PreparationError(f"invalid {hash_field} for compatibility path: {path}")
        if entry.get("live_result_file_sha256") is not None and not re.fullmatch(
            r"[0-9a-f]{64}", str(entry["live_result_file_sha256"])
        ):
            raise PreparationError(f"invalid live_result_file_sha256 for compatibility path: {path}")
        hunks = entry.get("hunks")
        if not isinstance(hunks, list) or not hunks:
            raise PreparationError(f"compatibility path has no hunks: {path}")
        hunk_count += len(hunks)
        for hunk in hunks:
            if (
                not isinstance(hunk, dict)
                or not isinstance(hunk.get("start"), int)
                or not isinstance(hunk.get("delete"), int)
                or not isinstance(hunk.get("insert"), list)
                or hunk["start"] < 0
                or hunk["delete"] < 0
                or not all(isinstance(line, str) for line in hunk["insert"])
            ):
                raise PreparationError(f"invalid compatibility hunk: {path}")
    if profile.get("expected_hunk_count") != hunk_count:
        raise PreparationError("compatibility profile hunk count does not match its exact gate")
    return profile


def load_compatibility_profile(archive_hash: str, unity_version: str) -> dict[str, Any] | None:
    try:
        manifest = json.loads(PATCH_MANIFEST.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise PreparationError(f"cannot read compatibility manifest: {exc}") from exc
    if manifest.get("schema_version") != 1 or not isinstance(manifest.get("profiles"), list):
        raise PreparationError("unsupported compatibility manifest schema")
    if manifest.get("unity_version") != unity_version:
        raise PreparationError(
            f"compatibility manifest targets {manifest.get('unity_version')!r}, not {unity_version!r}"
        )
    matches = [
        profile for profile in manifest["profiles"]
        if profile.get("archive_sha256") == archive_hash
        and profile.get("unity_version") == unity_version
    ]
    if len(matches) > 1:
        raise PreparationError("multiple compatibility profiles match the same archive")
    if not matches:
        return None
    return validate_compatibility_profile(matches[0])


def inspect_archive(archive: Path, strip_roots: list[str]) -> tuple[dict[str, str], set[str], list[str]]:
    paths: dict[str, str] = {}
    references: dict[str, set[str]] = {}
    current_guid: str | None = None
    current_asset: bytes | None = None
    with tarfile.open(archive, "r:gz") as package:
        for member in package:
            validate_tar_name(member.name)
            parts = member.name.split("/")
            guid = parts[0]
            if guid != current_guid:
                current_guid = guid
                current_asset = None
            if not member.isfile() or len(parts) != 2:
                continue
            if parts[1] == "asset":
                current_asset = package.extractfile(member).read()
            elif parts[1] == "pathname":
                raw = package.extractfile(member).read()
                path = first_pathname(raw)
                if guid in paths and paths[guid] != path:
                    raise PreparationError(f"duplicate pathname for GUID {guid}")
                paths[guid] = path
                if current_asset is not None and PurePosixPath(path).suffix.lower() in TEXT_EXTENSIONS.union({".unity", ".prefab", ".asset", ".mat", ".controller", ".anim"}):
                    references[path] = {match.group(1).decode("ascii").lower() for match in GUID_RE.finditer(current_asset)}
    excluded = {guid for guid, path in paths.items() if any(is_under(path, root) for root in strip_roots)}
    blocked_by: list[str] = []
    if excluded:
        inbound = {
            path: sorted(refs.intersection(excluded))
            for path, refs in references.items()
            if not any(is_under(path, root) for root in strip_roots) and refs.intersection(excluded)
        }
        if inbound:
            blocked_by = sorted(inbound)
            excluded = set()
    return paths, excluded, blocked_by


def prepare(args: argparse.Namespace) -> dict[str, Any]:
    project = args.project_root.resolve()
    archive = args.archive.resolve()
    if not (project / "Assets").is_dir() or not (project / "Packages" / "manifest.json").is_file():
        raise PreparationError(f"not a Unity project root: {project}")
    if not archive.is_file() or archive.suffix.lower() != ".unitypackage":
        raise PreparationError(f"not a Unity package archive: {archive}")

    unity_major, unity_minor, unity_patch, unity_version = read_unity_version(project)
    if unity_version != "6000.3.21f1":
        raise PreparationError(
            f"this portable setup requires Unity 6000.3.21f1; project declares {unity_version}"
        )
    render_pipeline = detect_render_pipeline(project)
    archive_hash = sha256_file(archive)
    registered = REGISTERED.get(archive_hash)
    if registered is None:
        raise PreparationError("archive hash is not registered; newer or modified builds require compatibility review")
    if archive.name != registered["archive"]:
        raise PreparationError(f"registered archive filename must be {registered['archive']}")

    output_root = (project / ".agent-temp" / "unity-package-staging").resolve()
    allowed_root = (project / ".agent-temp").resolve()
    if not within(output_root, allowed_root):
        raise PreparationError("staging output escaped the project .agent-temp root")
    output_root.mkdir(parents=True, exist_ok=True)
    output = output_root / f"{archive.stem}-prepared.unitypackage"
    partial = output.with_suffix(output.suffix + ".partial")
    sidecar = output.with_suffix(output.suffix + ".manifest.json")
    transformer_hash = sha256_file(Path(__file__).resolve())
    patch_manifest_hash = sha256_file(PATCH_MANIFEST)
    input_fingerprint = hashlib.sha256(json.dumps({
        "source_sha256": archive_hash,
        "unity_version": unity_version,
        "render_pipeline": render_pipeline,
        "strip_incompatible_demos": bool(args.strip_incompatible_demos),
        "transformer_sha256": transformer_hash,
        "patch_manifest_sha256": patch_manifest_hash,
    }, sort_keys=True, separators=(",", ":")).encode("utf-8")).hexdigest()

    if partial.exists():
        raise PreparationError(f"staging partial exists; another or interrupted preparation must be reviewed: {partial}")
    if output.exists() != sidecar.exists():
        raise PreparationError("staging output/sidecar ownership is incomplete; refusing to overwrite it")
    if output.exists():
        try:
            existing = json.loads(sidecar.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise PreparationError(f"cannot verify existing staging sidecar: {exc}") from exc
        owned = (
            existing.get("schema_version") == 1
            and existing.get("source_archive") == archive.name
            and existing.get("output_archive") == output.name
            and existing.get("source_sha256") in REGISTERED
        )
        if not owned:
            raise PreparationError("existing staging output is not owned by this registered preparation workflow")
        if (
            existing.get("input_fingerprint") == input_fingerprint
            and existing.get("output_sha256") == sha256_file(output)
        ):
            return {**existing, "reused": True}

    strip_roots: list[str] = []
    if args.strip_incompatible_demos and render_pipeline != "hdrp":
        strip_roots.extend(registered.get("strip", {}).get("not_hdrp", []))
    paths, excluded_guids, strip_blocked_by = inspect_archive(archive, strip_roots)
    effective_strip_roots = strip_roots if excluded_guids else []

    compatibility = load_compatibility_profile(archive_hash, unity_version)
    compat_files = {entry["path"]: entry for entry in compatibility.get("files", [])} if compatibility else {}
    compatibility_hunks = sum(len(entry["hunks"]) for entry in compat_files.values())
    remapped = patched = rewritten = written = 0
    old_root = registered["old_root"]
    new_root = registered["new_root"]
    try:
        with partial.open("wb") as raw_output:
            with gzip.GzipFile(fileobj=raw_output, mode="wb", filename="", mtime=0) as compressed:
                with tarfile.open(fileobj=compressed, mode="w|", format=tarfile.GNU_FORMAT) as target:
                    with tarfile.open(archive, "r:gz") as source:
                        for member in source:
                            validate_tar_name(member.name)
                            guid = member.name.split("/", 1)[0]
                            if guid in excluded_guids:
                                continue
                            if not member.isfile():
                                target.addfile(copy.copy(member))
                                continue
                            data = source.extractfile(member).read()
                            path = paths.get(guid)
                            leaf = member.name.split("/", 1)[1] if "/" in member.name else ""
                            if leaf == "pathname" and path is not None:
                                mapped = remap_path(path, old_root, new_root)
                                if mapped != path:
                                    data = rewrite_pathname(data, path, mapped)
                                    remapped += 1
                            elif leaf == "asset" and path is not None:
                                data, did_patch = apply_compatibility_patch(path, data, compat_files)
                                patched += int(did_patch)
                                data, did_rewrite = replace_root_literals(data, path, old_root, new_root)
                                rewritten += int(did_rewrite)
                            clone = copy.copy(member)
                            clone.size = len(data)
                            target.addfile(clone, io.BytesIO(data))
                            written += 1
        if compatibility is not None and patched != len(compat_files):
            missing = sorted(set(compat_files).difference(paths.values()))
            raise PreparationError(
                f"compatibility profile did not patch every registered file: "
                f"expected {len(compat_files)}, patched {patched}, missing {missing}"
            )
        os.replace(partial, output)
        report = {
            "schema_version": 1,
            "source_archive": archive.name,
            "source_sha256": archive_hash,
            "output_archive": output.name,
            "output_sha256": sha256_file(output),
            "input_fingerprint": input_fingerprint,
            "transformer_sha256": transformer_hash,
            "patch_manifest_sha256": patch_manifest_hash,
            "unity_version": unity_version,
            "render_pipeline": render_pipeline,
            "strip_incompatible_demos_requested": bool(args.strip_incompatible_demos),
            "old_root": old_root,
            "canonical_root": new_root,
            "pathname_records_remapped": remapped,
            "text_assets_with_root_rewrites": rewritten,
            "compatibility_profile": compatibility.get("id") if compatibility else None,
            "compatibility_files_patched": patched,
            "compatibility_hunks_applied": compatibility_hunks if compatibility else 0,
            "excluded_roots": effective_strip_roots,
            "excluded_guid_count": len(excluded_guids),
            "demo_strip_blocked_by_references": strip_blocked_by[:20],
            "archive_file_members_written": written,
            "reused": False,
        }
        sidecar_partial = sidecar.with_suffix(sidecar.suffix + ".partial")
        sidecar_partial.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        os.replace(sidecar_partial, sidecar)
        return report
    except Exception:
        partial.unlink(missing_ok=True)
        raise


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-root", required=True, type=Path, help="Exact Unity project root")
    parser.add_argument(
        "--archive",
        required=True,
        action="append",
        type=Path,
        help="Registered source .unitypackage; repeat for a bounded parallel batch",
    )
    parser.add_argument(
        "--strip-incompatible-demos",
        action="store_true",
        help="Strip only registered demo subtrees for render pipelines not used by the project",
    )
    parser.add_argument(
        "--jobs",
        type=int,
        default=2,
        choices=range(1, 5),
        metavar="1..4",
        help="Maximum independent archive preparations to run concurrently (default: 2)",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    archives = [archive.resolve() for archive in args.archive]
    if len(set(archives)) != len(archives):
        print(json.dumps({"status": "blocked", "reason": "duplicate --archive input"}), file=sys.stderr)
        return 2
    output_names = [f"{archive.stem}-prepared.unitypackage".casefold() for archive in archives]
    if len(set(output_names)) != len(output_names):
        print(json.dumps({"status": "blocked", "reason": "archive batch has colliding output names"}), file=sys.stderr)
        return 2

    def run_one(archive: Path) -> dict[str, Any]:
        item_args = argparse.Namespace(
            project_root=args.project_root,
            archive=archive,
            strip_incompatible_demos=args.strip_incompatible_demos,
        )
        return prepare(item_args)

    if len(archives) == 1:
        try:
            report = run_one(archives[0])
        except (PreparationError, OSError, tarfile.TarError) as exc:
            print(json.dumps({"status": "blocked", "reason": str(exc)}, ensure_ascii=False), file=sys.stderr)
            return 2
        print(json.dumps({"status": "prepared", **report}, ensure_ascii=False))
        return 0

    results: list[dict[str, Any] | None] = [None] * len(archives)
    failures: list[dict[str, str]] = []
    with ThreadPoolExecutor(max_workers=min(args.jobs, len(archives)), thread_name_prefix="unitypackage") as pool:
        futures = {pool.submit(run_one, archive): (index, archive) for index, archive in enumerate(archives)}
        for future in as_completed(futures):
            index, archive = futures[future]
            try:
                results[index] = future.result()
            except (PreparationError, OSError, tarfile.TarError) as exc:
                failures.append({"archive": archive.name, "reason": str(exc)})

    payload = {
        "status": "batch-blocked" if failures else "batch-prepared",
        "jobs": min(args.jobs, len(archives)),
        "results": [result for result in results if result is not None],
        "failures": failures,
    }
    print(json.dumps(payload, ensure_ascii=False))
    return 2 if failures else 0
if __name__ == "__main__":
    raise SystemExit(main())
