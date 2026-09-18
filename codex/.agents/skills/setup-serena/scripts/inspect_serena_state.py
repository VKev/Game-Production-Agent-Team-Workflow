#!/usr/bin/env python3
"""Read-only structural inspection for Serena, Codex MCP, hooks, and project guidance."""

from __future__ import annotations

import argparse
import json
import re
import tomllib
from pathlib import Path


TOP_LEVEL = re.compile(r"^(?P<key>[A-Za-z_][A-Za-z0-9_]*):\s*(?P<value>.*?)\s*$")


def yaml_scalars(path: Path) -> tuple[dict[str, str], list[str]]:
    values: dict[str, str] = {}
    duplicates: list[str] = []
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        if not line or line[0].isspace() or line.lstrip().startswith("#"):
            continue
        match = TOP_LEVEL.match(line)
        if not match:
            continue
        key = match.group("key")
        if key in values:
            duplicates.append(key)
        values[key] = match.group("value").strip().strip('"\'')
    return values, sorted(set(duplicates))


def hook_count(payload: dict, event: str, matcher: str, command: str) -> int:
    hooks = payload.get("hooks")
    entries = hooks.get(event, []) if isinstance(hooks, dict) else []
    count = 0
    for entry in entries if isinstance(entries, list) else []:
        if not isinstance(entry, dict) or entry.get("matcher") != matcher:
            continue
        handlers = entry.get("hooks", [])
        for handler in handlers if isinstance(handlers, list) else []:
            if isinstance(handler, dict) and handler.get("type") == "command" and handler.get("command") == command:
                count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project-root", type=Path, required=True)
    parser.add_argument("--serena-config", type=Path, required=True)
    parser.add_argument("--codex-config", type=Path, required=True)
    parser.add_argument("--hooks", type=Path, required=True)
    args = parser.parse_args()

    root = args.project_root.resolve()
    errors: list[str] = []
    dashboard = interface = None
    duplicates: list[str] = []
    if args.serena_config.is_file():
        values, duplicates = yaml_scalars(args.serena_config)
        dashboard = values.get("web_dashboard")
        interface = values.get("web_dashboard_interface")
        if duplicates:
            errors.append("duplicate-serena-top-level-keys")
        if dashboard != "true" or interface != "tray_manager":
            errors.append("serena-dashboard-settings")
    else:
        errors.append("serena-config-missing")

    mcp_exact = False
    if args.codex_config.is_file():
        try:
            codex = tomllib.loads(args.codex_config.read_text(encoding="utf-8-sig"))
            server = codex.get("mcp_servers", {}).get("serena", {})
            mcp_exact = server.get("command") == "serena" and server.get("args") == [
                "start-mcp-server", "--project-from-cwd", "--context=codex"
            ]
            if not mcp_exact:
                errors.append("serena-mcp-entry")
        except (OSError, tomllib.TOMLDecodeError):
            errors.append("codex-config-invalid")
    else:
        errors.append("codex-config-missing")

    hook_counts = {"pre_tool_use": 0, "session_start": 0}
    if args.hooks.is_file():
        try:
            hooks = json.loads(args.hooks.read_text(encoding="utf-8-sig"))
            hook_counts["pre_tool_use"] = hook_count(hooks, "PreToolUse", "Bash", "serena-hooks remind --client=codex")
            hook_counts["session_start"] = hook_count(hooks, "SessionStart", "startup|resume", "serena-hooks activate --client=codex")
            if hook_counts["pre_tool_use"] != 1 or hook_counts["session_start"] != 1:
                errors.append("serena-core-hooks")
        except (OSError, json.JSONDecodeError):
            errors.append("hooks-json-invalid")
    else:
        errors.append("hooks-json-missing")

    agents = root / "AGENTS.md"
    guidance = False
    if agents.is_file():
        text = agents.read_text(encoding="utf-8-sig")
        guidance = text.count("<!-- setup-serena:start -->") == 1 and text.count("<!-- setup-serena:end -->") == 1
    if not guidance:
        errors.append("project-guidance")

    result = {
        "status": "correct" if not errors else "incorrect",
        "serena_config": {
            "exists": args.serena_config.is_file(),
            "web_dashboard": dashboard == "true",
            "web_dashboard_interface": interface,
            "duplicate_top_level_keys": duplicates,
        },
        "codex_mcp_exact": mcp_exact,
        "hook_counts": hook_counts,
        "project_guidance": guidance,
        "errors": errors,
        "unsupported_probe": "Never run `serena project list`; Serena 1.6 project commands are create, health-check, index, index-file, and is_ignored_path.",
    }
    print(json.dumps(result))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
