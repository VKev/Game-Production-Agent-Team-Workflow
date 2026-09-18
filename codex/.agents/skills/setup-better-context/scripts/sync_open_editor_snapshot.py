#!/usr/bin/env python3
"""Fail-closed Windows fallback for Better Context's open-Editor sync."""

from __future__ import annotations

import argparse
import ctypes
import hashlib
import importlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path


KNOWN_UNITY_EDITOR_MODULE_HASHES = {
    "7d6d3b69ffd896b5eee0e3ff2effd7c7a4f1c7887e25b557ab02ec6954bc01c6",
}
PROCESS_QUERY_LIMITED_INFORMATION = 0x1000


def _same_path(left: Path, right: Path) -> bool:
    return os.path.normcase(str(left.resolve())) == os.path.normcase(str(right.resolve()))


def _project_unity_version(root: Path) -> str:
    try:
        source = (root / "ProjectSettings" / "ProjectVersion.txt").read_text(
            encoding="utf-8-sig"
        )
    except (OSError, UnicodeDecodeError):
        return ""
    match = re.search(r"^m_EditorVersion:\s*(\S+)\s*$", source, re.MULTILINE)
    return match.group(1) if match else ""


def _load_unity_editor():
    try:
        return importlib.import_module("better_context.unity_editor")
    except ModuleNotFoundError:
        completed = subprocess.run(
            ["uv", "tool", "dir"], capture_output=True, text=True, check=False
        )
        if completed.returncode != 0:
            raise RuntimeError("Could not resolve the uv tool directory.")
        tool_root = Path(completed.stdout.strip()) / "better-context-unity"
        candidates = [tool_root / "Lib" / "site-packages"]
        candidates.extend(tool_root.glob("lib/python*/site-packages"))
        matches = [path for path in candidates if (path / "better_context").is_dir()]
        if len(matches) != 1:
            raise RuntimeError("Better Context uv tool environment is missing or ambiguous.")
        sys.path.insert(0, str(matches[0]))
        return importlib.import_module("better_context.unity_editor")


def _query_process_image(process_id: int) -> Path:
    if os.name != "nt":
        raise RuntimeError("This fallback is Windows-only; use `editor sync --mode open`.")
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = (ctypes.c_ulong, ctypes.c_int, ctypes.c_ulong)
    kernel32.OpenProcess.restype = ctypes.c_void_p
    kernel32.QueryFullProcessImageNameW.argtypes = (
        ctypes.c_void_p,
        ctypes.c_ulong,
        ctypes.c_wchar_p,
        ctypes.POINTER(ctypes.c_ulong),
    )
    kernel32.QueryFullProcessImageNameW.restype = ctypes.c_int
    kernel32.CloseHandle.argtypes = (ctypes.c_void_p,)
    handle = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, process_id)
    if not handle:
        raise OSError(ctypes.get_last_error(), f"Could not open process {process_id}")
    try:
        buffer = ctypes.create_unicode_buffer(32768)
        size = ctypes.c_ulong(len(buffer))
        if not kernel32.QueryFullProcessImageNameW(handle, 0, buffer, ctypes.byref(size)):
            raise OSError(ctypes.get_last_error(), f"Could not query process {process_id}")
        return Path(buffer.value)
    finally:
        kernel32.CloseHandle(handle)


def _verify_editor_identity(root: Path, query_process_image=_query_process_image) -> int:
    instance_path = root / "Library" / "EditorInstance.json"
    try:
        instance = json.loads(instance_path.read_text(encoding="utf-8-sig"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Could not read {instance_path}: {exc}") from exc
    project_version = _project_unity_version(root)
    process_id = int(instance.get("process_id", instance.get("processId", 0)))
    recorded_version = str(instance.get("version", ""))
    recorded_path = Path(str(instance.get("app_path", "")))
    if not project_version or recorded_version != project_version:
        raise RuntimeError("EditorInstance version does not match ProjectVersion.txt.")
    if process_id <= 0 or not recorded_path.is_file() or recorded_path.name.casefold() != "unity.exe":
        raise RuntimeError("EditorInstance does not identify a usable Unity.exe process.")
    if project_version.casefold() not in {part.casefold() for part in recorded_path.parts}:
        raise RuntimeError("Unity executable path does not contain the exact project version.")
    live_path = query_process_image(process_id)
    if not _same_path(live_path, recorded_path):
        raise RuntimeError("Live process executable does not match EditorInstance app_path.")
    return process_id


def sync_open_editor(root: Path, timeout_seconds: int) -> dict[str, object]:
    unity_editor = _load_unity_editor()

    module_path = Path(unity_editor.__file__).resolve()
    module_hash = hashlib.sha256(module_path.read_bytes()).hexdigest()
    if module_hash not in KNOWN_UNITY_EDITOR_MODULE_HASHES:
        raise RuntimeError(
            "Unknown Better Context unity_editor.py hash; retry the standard command and register "
            "this source before using the fallback."
        )
    process_id = _verify_editor_identity(root)
    original = unity_editor._process_running
    unity_editor._process_running = lambda candidate: int(candidate) == process_id
    try:
        result = unity_editor.sync_editor_snapshot(
            root,
            mode="open",
            timeout_seconds=timeout_seconds,
        )
    finally:
        unity_editor._process_running = original
    if not result.success:
        raise RuntimeError(result.message)
    return {
        "status": "fresh",
        "mode": result.mode,
        "snapshot_path": str(result.snapshot_path),
        "unity_editor_module_sha256": module_hash,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Sync Better Context from an exact already-open Unity Editor on Windows."
    )
    parser.add_argument("--project-root", required=True, type=Path)
    parser.add_argument("--timeout-seconds", type=int, default=300)
    args = parser.parse_args()
    if args.timeout_seconds < 1 or args.timeout_seconds > 600:
        parser.error("--timeout-seconds must be between 1 and 600")
    root = args.project_root.resolve()
    if not (root / "Assets").is_dir() or not (root / "ProjectSettings").is_dir():
        parser.error("--project-root is not a Unity project")
    try:
        print(json.dumps(sync_open_editor(root, args.timeout_seconds), indent=2))
    except (OSError, RuntimeError, ValueError) as exc:
        parser.exit(1, f"error: {exc}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
