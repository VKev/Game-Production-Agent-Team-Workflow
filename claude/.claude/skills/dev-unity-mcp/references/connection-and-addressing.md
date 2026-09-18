# Connection and addressing

## Transport and selection

Codex launches the official relay over stdio:

```toml
[mcp_servers.unity_mcp]
command = "C:\\Users\\USER\\.unity\\relay\\relay_win.exe"
args = ["--mcp"]
enabled = true
```

The relay discovers Editor bridges and communicates through the platform bridge transport (named pipe on Windows; Unix socket on supported Unix platforms).

For the pinned `2.17.0-pre.1` source:

- Discovery directory: `%USERPROFILE%\.unity\mcp\connections` by default; `UNITY_MCP_STATUS_DIR` overrides it.
- Discovery filename: `bridge-<project-hash-8>-<editor-pid>.json`.
- Discovery fields: `connection_type`, `connection_path`, UTC `created_date`, canonical `project_path`, internal bridge `protocol_version` (`2.0` in this snapshot), and `editor_pid`.
- Windows connection: `\\.\pipe\unity-mcp-<project-hash-8>-<editor-pid>`.
- macOS/Linux connection: `/tmp/unity-mcp-<project-hash-8>-<editor-pid>`, opened as a Unix domain socket by the platform listener.
- The project hash is the first eight lowercase hex characters of SHA1 over `Application.dataPath`. Do not reproduce it for targeting when `--project-path`/`--instance-id` or the discovery JSON can select safely.
- The bridge writes its discovery file after the listener starts and deletes it on orderly shutdown. Validate its PID/project path and actual process liveness; a stale JSON file alone is not a live bridge.
- Connection liveness is a transport message (`command_in_progress`) every 1.5 seconds. In this exact source it is not a periodic heartbeat-file update and the relay consumes it before the external MCP client. `bridge-status-*`/`bridge-port-*` constants and cleanup paths are legacy/internal compatibility surfaces, not the current discovery contract.

Do not edit discovery files. Inspect them only for diagnostics and let the package own creation/cleanup.

Default portable config contains no project selector. When targeting is necessary, use exactly one of:

- `--project-path <absolute-project-root>` or `UNITY_PROJECT_PATH`
- `--instance-id <editor-pid>` or `UNITY_INSTANCE_ID`

Command-line values override environment variables. If multiple Editors remain plausible, ask the user to close extras or choose the target. Never guess by recency.

Approve Codex in `Edit > Project Settings > AI > Unity MCP Server > Pending Connections`. If the first-use third-party disclaimer is shown, the user must review and accept it first; do not automate or bypass that decision. Multiple live `codex-mcp-client` PIDs are supported, while multiple plausible Unity Editor targets remain ambiguous. A structurally valid TOML entry is only restart-ready until Codex restarts, the client is approved, every registered tool is enabled, and `initialize`/`tools/list` succeed.

## Resource and file paths

Accepted project-resource forms depend on the tool schema and include:

- `unity://path/Assets/...`
- `file://...`
- project-relative `Assets/...`

Decode URL escapes once, normalize separators/dot segments, resolve the canonical path, and reject any result outside the project. Never use traversal such as `../` to escape the project.

Special aliases recognized by the pinned 2.17 surface:

- `unity://spec/script-edits`
- `spec/script-edits`
- `script-edits`
- UI output resource `unity://widget/asset_preview`

## Unity targets

- GameObject: exact name, instance ID, or hierarchy path. Prefer instance ID/path when names repeat.
- Scene: scene name, `Assets/...unity` path, or build index. Use asset path for deterministic editing.
- Asset: `Assets/...` path, GUID, or the tool's type/filter query.
- Component: GameObject target plus component type and index when duplicates exist.
- Script: resource URI or asset path; obtain and pass SHA256 when the schema requires optimistic concurrency.
- Menu item: exact Unity menu path.
- Package: package id plus exact version/source when mutating.

Never carry an instance ID across an Editor restart/domain context without re-resolving it.
