#!/usr/bin/env python3
"""Generate and compare the managed Unity MCP surface for one pinned package."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
from pathlib import Path
from typing import Any
from urllib.parse import unquote, urlparse


NATIVE_RE = re.compile(r'\[McpTool\(\s*"([^"]+)"(?P<body>.*?)\)\]', re.S)
NATIVE_CONST_RE = re.compile(r'\[McpTool\(\s*(?P<const>[A-Za-z_][A-Za-z0-9_]*)\s*,(?P<body>.*?)\)\]', re.S)
CONST_STRING_RE = re.compile(r'\bconst\s+string\s+(?P<name>[A-Za-z_][A-Za-z0-9_]*)\s*=\s*"(?P<value>[^"]+)"\s*;')
ADAPTED_RE = re.compile(
    r'\[AgentTool\((?P<tool>.*?)\)\]\s*'
    r'\[AgentToolSettings\((?P<settings>.*?)\)\]', re.S
)
QUOTED_RE = re.compile(r'"((?:[^"\\]|\\.)*)"')
MCP_AVAILABILITY_RE = re.compile(r'mcp\s*:\s*McpAvailability\.(Available|Default)')
GROUPS_RE = re.compile(r'Groups\s*=\s*new(?:\s+string)?\[\]\s*\{(?P<items>.*?)\}', re.S)


def load_json(path: Path | None) -> Any:
    if path is None:
        return None
    with path.open("r", encoding="utf-8-sig") as handle:
        return json.load(handle)


def stable_hash(text: str) -> str:
    value = 17
    for character in text:
        value = ((value * 31) + ord(character)) & 0xFFFFFFFF
    return f"{value:08x}"


def expose_name(source_name: str) -> str:
    sanitized = source_name.replace(".", "_")
    if len(sanitized) <= 42:
        return sanitized
    return f"{sanitized[:33]}_{stable_hash(sanitized)}"


def source_path(path: Path, package_root: Path) -> str:
    return path.relative_to(package_root).as_posix()


def discover_official_tools(package_root: Path) -> list[dict[str, Any]]:
    tools: dict[str, dict[str, Any]] = {}
    native_root = package_root / "Modules" / "Unity.AI.MCP.Editor" / "Tools"
    for path in sorted(native_root.rglob("*.cs")):
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        constants = {match.group("name"): match.group("value") for match in CONST_STRING_RE.finditer(text)}
        matches = [(match.group(1), match.group("body")) for match in NATIVE_RE.finditer(text)]
        matches.extend(
            (constants[match.group("const")], match.group("body"))
            for match in NATIVE_CONST_RE.finditer(text)
            if match.group("const") in constants
        )
        for name, body in matches:
            group_match = GROUPS_RE.search(body)
            groups = QUOTED_RE.findall(group_match.group("items")) if group_match else []
            tools[name] = {
                "source_name": name,
                "exposed_name": expose_name(name),
                "kind": "mcp-native",
                "source": source_path(path, package_root),
                "groups_from_source": groups,
                "enabled_by_default_from_source": "EnabledByDefault = true" in body,
                "schema_authority": "live-registry",
            }

    for path in sorted(package_root.rglob("*.cs")):
        if "Tests" in path.parts or "Samples~" in path.parts:
            continue
        text = path.read_text(encoding="utf-8-sig", errors="replace")
        for match in ADAPTED_RE.finditer(text):
            availability = MCP_AVAILABILITY_RE.search(match.group("settings"))
            if not availability:
                continue
            quoted = [bytes(value, "utf-8").decode("unicode_escape") for value in QUOTED_RE.findall(match.group("tool"))]
            names = [value for value in quoted if value.startswith("Unity.")]
            if not names:
                continue
            name = names[-1]
            tools[name] = {
                "source_name": name,
                "exposed_name": expose_name(name),
                "kind": "assistant-adapted",
                "source": source_path(path, package_root),
                "groups_from_source": [],
                "enabled_by_default_from_source": availability.group(1) == "Default",
                "schema_authority": "live-registry",
            }
    return sorted(tools.values(), key=lambda item: item["exposed_name"])


def extract_tools(payload: Any) -> list[dict[str, Any]]:
    if payload is None:
        return []
    if isinstance(payload, list):
        return payload
    if not isinstance(payload, dict):
        raise ValueError("Tool catalog must be a JSON object or array")
    for key in ("tools", "result", "registry", "registered"):
        value = payload.get(key)
        if isinstance(value, list):
            return value
        if isinstance(value, dict) and isinstance(value.get("tools"), list):
            return value["tools"]
    raise ValueError("Tool catalog does not contain a tools array")


def canonical_hash(value: Any) -> str | None:
    if value is None:
        return None
    encoded = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def normalize_project_resource(value: str, project_root: Path) -> str:
    if value in {"unity://spec/script-edits", "spec/script-edits", "script-edits", "unity://widget/asset_preview"}:
        return value
    decoded = unquote(value)
    if decoded.startswith("unity://path/"):
        candidate = project_root / decoded[len("unity://path/") :]
    elif decoded.startswith("file://"):
        parsed = urlparse(decoded)
        candidate = Path(unquote(parsed.path.lstrip("/")) if re.match(r"^/[A-Za-z]:", parsed.path) else unquote(parsed.path))
    elif decoded.startswith("Assets/") or decoded == "Assets":
        candidate = project_root / decoded
    else:
        raise ValueError(f"Unsupported Unity resource address: {value}")
    root = project_root.resolve()
    resolved = candidate.resolve()
    try:
        relative = resolved.relative_to(root)
    except ValueError as exc:
        raise ValueError(f"Resource escapes project root: {value}") from exc
    return relative.as_posix()


def normalize_live(tool: dict[str, Any]) -> dict[str, Any]:
    info = tool.get("Info") if isinstance(tool.get("Info"), dict) else tool
    name = info.get("name") or info.get("Name")
    if not isinstance(name, str) or not name:
        raise ValueError("Every live tool needs a non-empty name")
    groups = tool.get("groups", tool.get("Groups", []))
    enabled = tool.get("enabled", tool.get("IsEnabled"))
    default = tool.get("default", tool.get("IsDefault"))
    input_schema = info.get("inputSchema", info.get("InputSchema"))
    output_schema = info.get("outputSchema", info.get("OutputSchema"))
    return {
        "name": name,
        "title": info.get("title", info.get("Title")),
        "description": info.get("description", info.get("Description")),
        "groups": sorted(groups or []),
        "enabled": enabled,
        "default": default,
        "annotations": info.get("annotations", info.get("Annotations")),
        "input_schema": input_schema,
        "output_schema": output_schema,
        "input_schema_sha256": canonical_hash(input_schema),
        "output_schema_sha256": canonical_hash(output_schema),
        "uri_patterns": sorted(tool.get("uri_patterns", tool.get("UriPatterns", [])) or []),
    }


def compare(official: list[dict[str, Any]], registry: list[dict[str, Any]], client: list[dict[str, Any]]) -> dict[str, Any]:
    all_registry_map = {item["name"]: item for item in registry}
    registry_map = {name: item for name, item in all_registry_map.items() if item.get("enabled") is not False}
    client_map = {item["name"]: item for item in client}
    registry_names, client_names = set(registry_map), set(client_map)
    official_names = {item["exposed_name"] for item in official}
    mismatches: list[dict[str, Any]] = []
    for name in sorted(registry_names & client_names):
        for field in ("input_schema_sha256", "output_schema_sha256"):
            if registry_map[name].get(field) != client_map[name].get(field):
                mismatches.append({"name": name, "field": field, "registry": registry_map[name].get(field), "client": client_map[name].get(field)})
        registry_uris = registry_map[name].get("uri_patterns") or []
        client_uris = client_map[name].get("uri_patterns") or []
        if (registry_uris or client_uris) and registry_uris != client_uris:
            mismatches.append({"name": name, "field": "uri_patterns", "registry": registry_uris, "client": client_uris})
    source_metadata_mismatches: list[dict[str, Any]] = []
    for item in official:
        name = item["exposed_name"]
        live = all_registry_map.get(name)
        if live is None:
            continue
        source_groups = sorted(item.get("groups_from_source") or [])
        if source_groups and source_groups != (live.get("groups") or []):
            source_metadata_mismatches.append({"name": name, "field": "groups", "source": source_groups, "registry": live.get("groups") or []})
        live_default = live.get("default")
        if live_default is not None and bool(item.get("enabled_by_default_from_source")) != bool(live_default):
            source_metadata_mismatches.append({"name": name, "field": "default", "source": bool(item.get("enabled_by_default_from_source")), "registry": bool(live_default)})
    missing_official = sorted(official_names - set(all_registry_map))
    disabled = sorted(item["name"] for item in registry if item.get("enabled") is False)
    exact = registry_names == client_names and not mismatches and not source_metadata_mismatches and not missing_official and not disabled
    return {
        "status": "complete" if exact else "skill-surface-drift",
        "exact": exact,
        "missing_in_client": sorted(registry_names - client_names),
        "unexpected_in_client": sorted(client_names - registry_names),
        "missing_official_in_registry": missing_official,
        "disabled_in_registry": disabled,
        "schema_mismatches": mismatches,
        "source_metadata_mismatches": source_metadata_mismatches,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--package-root", type=Path, required=True)
    parser.add_argument("--package-metadata", type=Path)
    parser.add_argument("--live-registry", type=Path)
    parser.add_argument("--client-tools", type=Path)
    parser.add_argument("--capabilities", type=Path)
    parser.add_argument("--minimum-native", type=int, default=20)
    parser.add_argument("--minimum-adapted", type=int, default=10)
    parser.add_argument("--allow-source-drift", action="store_true")
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()

    root = args.package_root.resolve()
    package_json = load_json(root / "package.json")
    if package_json.get("name") != "com.unity.ai.assistant":
        raise SystemExit("package-root is not com.unity.ai.assistant")
    official = discover_official_tools(root)
    native_count = sum(item["kind"] == "mcp-native" for item in official)
    adapted_count = sum(item["kind"] == "assistant-adapted" for item in official)
    source_contract_ok = native_count >= args.minimum_native and adapted_count >= args.minimum_adapted
    if not source_contract_ok and not args.allow_source_drift:
        raise SystemExit(
            f"Source surface drift: native={native_count}/{args.minimum_native}, "
            f"adapted={adapted_count}/{args.minimum_adapted}"
        )

    live = [normalize_live(item) for item in extract_tools(load_json(args.live_registry))] if args.live_registry else []
    client = [normalize_live(item) for item in extract_tools(load_json(args.client_tools))] if args.client_tools else []
    verification = compare(official, live, client) if live and client else {"status": "pending-live-registry", "exact": False}
    result = {
        "format": 1,
        "package": {
            "id": package_json["name"],
            "version": package_json["version"],
            "unity": package_json.get("unity"),
            "unityRelease": package_json.get("unityRelease"),
            "verified_distribution": load_json(args.package_metadata),
        },
        "name_policy": {"replace": {".": "_"}, "max_length": 42, "hash_suffix": "_ + stable 8-hex"},
        "uri_contract": {
            "project": ["unity://path/Assets/...", "file://...", "Assets/..."],
            "special": ["unity://spec/script-edits", "spec/script-edits", "script-edits", "unity://widget/asset_preview"],
            "security": "URL decode, normalize, and reject traversal outside the project root",
        },
        "official_source_tools": official,
        "counts": {"mcp_native": native_count, "assistant_adapted": adapted_count, "official_total": len(official), "live_total": len(live), "client_total": len(client)},
        "live_registry": live,
        "client_tools": client,
        "capabilities": load_json(args.capabilities),
        "source_contract": {
            "status": "complete" if source_contract_ok else "skill-surface-drift",
            "minimum_native": args.minimum_native,
            "minimum_adapted": args.minimum_adapted,
        },
        "verification": verification,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps({"status": verification["status"], "output": str(args.output.resolve()), "counts": result["counts"]}))
    return 0 if verification["status"] != "skill-surface-drift" else 2


if __name__ == "__main__":
    raise SystemExit(main())
