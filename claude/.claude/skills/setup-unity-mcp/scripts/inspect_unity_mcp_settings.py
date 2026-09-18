#!/usr/bin/env python3
"""Inspect Project Settings > AI and Unity MCP controls from a verified package."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
import xml.etree.ElementTree as ET


PROVIDERS = {
    "assistant": "Editor/UI/Scripts/AssistantProjectSettingsProvider.cs",
    "assistant_mcp_extensions": "Editor/UI/Scripts/McpClientSettingsProvider.cs",
    "gateway": "Editor/UI/Scripts/GatewayProjectSettingsProvider.cs",
    "ui": "Editor/UI/AssistantUISettingsProvider.cs",
    "unity_mcp_server": "Modules/Unity.AI.MCP.Editor/Settings/UI/MCPSettingsProvider.cs",
}

MCP_SETTINGS = "Modules/Unity.AI.MCP.Editor/Settings/MCPSettings.cs"
MCP_CONSTANTS = "Modules/Unity.AI.MCP.Editor/Settings/MCPConstants.cs"
MCP_PANEL = "Modules/Unity.AI.MCP.Editor/Settings/UI/MCPSettingsPanel.uxml"
TOOL_ITEM = "Modules/Unity.AI.MCP.Editor/Settings/UI/ToolItemControl.uxml"
RUN_COMMAND = "Modules/Unity.AI.MCP.Editor/Tools/RunCommand.cs"
CHANGELOG = "CHANGELOG.md"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def require_file(root: Path, relative: str) -> Path:
    path = root / relative
    if not path.is_file():
        raise ValueError(f"Required package source is missing: {relative}")
    return path


def first_match(pattern: str, text: str, label: str) -> str:
    match = re.search(pattern, text, flags=re.MULTILINE)
    if not match:
        raise ValueError(f"Could not resolve {label} from package source")
    return match.group(1)


def parse_provider(root: Path, key: str, relative: str) -> dict[str, object]:
    path = require_file(root, relative)
    text = path.read_text(encoding="utf-8-sig")
    path_match = re.search(r'new\s+SettingsProvider\(\s*"([^"]+)"', text)
    if path_match:
        settings_path = path_match.group(1)
    elif variable_match := re.search(r"new\s+SettingsProvider\(\s*([A-Za-z_]\w*)", text):
        variable = variable_match.group(1)
        settings_path = first_match(
            rf'const\s+string\s+{re.escape(variable)}\s*=\s*"([^"]+)"',
            text,
            f"{key} settings path",
        )
    elif key == "unity_mcp_server" and "MCPConstants.projectSettingsPath" in text:
        constants = require_file(root, MCP_CONSTANTS).read_text(encoding="utf-8-sig")
        settings_path = first_match(
            r'projectSettingsPath\s*=\s*"([^"]+)"',
            constants,
            f"{key} settings path",
        )
    else:
        raise ValueError(f"Could not resolve {key} settings path from package source")
    label_match = re.search(r'label\s*=\s*"([^"]+)"', text)
    label = label_match.group(1) if label_match else settings_path.rsplit("/", 1)[-1]
    return {
        "key": key,
        "settings_path": settings_path,
        "label": label,
        "codex_policy": "configure" if key == "unity_mcp_server" else "preserve",
        "source": relative,
        "sha256": sha256(path),
    }


def parse_uxml(path: Path) -> list[dict[str, str]]:
    root = ET.parse(path).getroot()
    controls: list[dict[str, str]] = []
    for element in root.iter():
        name = element.attrib.get("name", "")
        text = element.attrib.get("text", "")
        if name or text:
            controls.append(
                {
                    "type": element.tag.rsplit("}", 1)[-1],
                    "name": name,
                    "text": text,
                }
            )
    return controls


def bool_initializer(text: str, field: str) -> bool:
    value = first_match(
        rf"public\s+bool\s+{re.escape(field)}\s*=\s*(true|false)\s*;",
        text,
        field,
    )
    return value == "true"


def inspect(package_root: Path) -> dict[str, object]:
    package_json = require_file(package_root, "package.json")
    manifest = json.loads(package_json.read_text(encoding="utf-8-sig"))
    if manifest.get("name") != "com.unity.ai.assistant":
        raise ValueError("Package identity is not com.unity.ai.assistant")

    pages = [parse_provider(package_root, key, relative) for key, relative in PROVIDERS.items()]

    settings_path = require_file(package_root, MCP_SETTINGS)
    settings_text = settings_path.read_text(encoding="utf-8-sig")
    panel_path = require_file(package_root, MCP_PANEL)
    panel_controls = parse_uxml(panel_path)
    tool_item_path = require_file(package_root, TOOL_ITEM)
    tool_controls = parse_uxml(tool_item_path)
    run_command_path = require_file(package_root, RUN_COMMAND)
    run_command_text = run_command_path.read_text(encoding="utf-8-sig")
    changelog_path = require_file(package_root, CHANGELOG)
    changelog_text = changelog_path.read_text(encoding="utf-8-sig")

    public_enable_all = any(
        control["type"] == "Button"
        and (
            control["text"].strip().lower() == "enable all"
            or "enableall" in control["name"].replace("-", "").lower()
        )
        for control in panel_controls
    )
    reset_to_defaults = any(
        control["type"] == "Button"
        and control["text"].strip().lower() == "reset to defaults"
        for control in panel_controls
    )
    per_tool_checkbox = any(
        control["type"] == "Toggle" and control["name"] == "toolItemCheckbox"
        for control in tool_controls
    )

    validation_initializer = first_match(
        r"public\s+string\s+validationLevel\s*=\s*([^;]+);",
        settings_text,
        "validationLevel initializer",
    ).strip()

    source_files = [
        MCP_SETTINGS,
        MCP_CONSTANTS,
        MCP_PANEL,
        TOOL_ITEM,
        RUN_COMMAND,
        CHANGELOG,
    ]
    return {
        "package": {
            "name": manifest["name"],
            "version": manifest.get("version"),
            "package_json_sha256": sha256(package_json),
        },
        "pages": pages,
        "unity_mcp_server": {
            "defaults": {
                "bridge_enabled": bool_initializer(settings_text, "bridgeEnabled"),
                "auto_approve_in_batch_mode": bool_initializer(
                    settings_text, "autoApproveInBatchMode"
                ),
                "validation_level_initializer": validation_initializer,
            },
            "controls": {
                "public_enable_all": public_enable_all,
                "reset_to_defaults": reset_to_defaults,
                "per_tool_checkbox": per_tool_checkbox,
            },
            "internal_enable_all_method": bool(
                re.search(r"\bvoid\s+EnableAllTools\s*\(", settings_text)
            ),
            "run_command_enabled_by_default": bool(
                re.search(
                    r'\[McpTool\(.*?EnabledByDefault\s*=\s*true.*?\)\]',
                    run_command_text,
                    flags=re.DOTALL,
                )
            ),
            "connection_caps_not_entitlement_gated": (
                "MCP and gateway connections are no longer capped or gated by entitlement limits"
                in changelog_text
            ),
        },
        "source_hashes": {
            relative: sha256(require_file(package_root, relative)) for relative in source_files
        },
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package-root", required=True, type=Path)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--expected-version")
    args = parser.parse_args()

    try:
        payload = inspect(args.package_root.resolve())
        if args.expected_version and payload["package"]["version"] != args.expected_version:
            raise ValueError(
                f"Expected package version {args.expected_version}, got "
                f"{payload['package']['version']}"
            )
        encoded = json.dumps(payload, indent=2, sort_keys=True) + "\n"
        if args.output:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(encoded, encoding="utf-8", newline="\n")
        sys.stdout.write(encoded)
        return 0
    except (OSError, ValueError, json.JSONDecodeError, ET.ParseError) as exc:
        sys.stderr.write(f"settings-surface-error: {exc}\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
