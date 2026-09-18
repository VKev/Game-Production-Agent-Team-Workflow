#!/usr/bin/env python3
"""Validate the Codex-only safe video-analyzer table and version evidence."""

from __future__ import annotations

import argparse
import json
import re
import tomllib
from pathlib import Path


VERSION = re.compile(r"^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$")
ENABLED = ["get_metadata", "get_frames", "get_frame_at", "get_frame_burst"]
DISABLED = ["analyze_video", "analyze_videos", "get_transcript", "analyze_moment"]
EMPTY_ENV = {"TWELVELABS_API_KEY": "", "OPENAI_API_KEY": "", "WHISPER_HF_MODEL": ""}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, required=True)
    parser.add_argument("--expected-version", required=True)
    parser.add_argument("--reported-version", required=True)
    args = parser.parse_args()

    errors: list[str] = []
    if not VERSION.fullmatch(args.expected_version) or args.reported_version.strip().lstrip("v") != args.expected_version:
        errors.append("package-version-mismatch")
    try:
        config = tomllib.loads(args.config.read_text(encoding="utf-8-sig"))
    except (OSError, tomllib.TOMLDecodeError) as exc:
        print(json.dumps({"status": "incorrect", "errors": ["codex-config-invalid"], "detail": str(exc)}))
        return 0

    servers = config.get("mcp_servers", {})
    candidates = []
    if isinstance(servers, dict):
        for name, value in servers.items():
            if not isinstance(value, dict):
                continue
            launch = " ".join([str(value.get("command", "")), *map(str, value.get("args", []))])
            if "mcp-video-analyzer" in launch:
                candidates.append(name)
    table = servers.get("video-analyzer", {}) if isinstance(servers, dict) else {}
    exact = (
        candidates == ["video-analyzer"]
        and table.get("command") == "npx"
        and table.get("args") == ["-y", "mcp-video-analyzer@latest"]
        and table.get("enabled_tools") == ENABLED
        and table.get("disabled_tools") == DISABLED
        and table.get("startup_timeout_sec") == 60
        and table.get("tool_timeout_sec") == 300
        and table.get("env") == EMPTY_ENV
    )
    if not exact:
        errors.append("video-analyzer-table")
    print(json.dumps({
        "status": "correct" if not errors else "incorrect",
        "version_match": "package-version-mismatch" not in errors,
        "candidate_server_ids": candidates,
        "safe_table_exact": exact,
        "errors": errors,
    }))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
