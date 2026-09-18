# Live registry export and equality proof

Use this only after Unity has resolved `com.unity.ai.assistant`, compilation is idle, and the Codex connection is approved under `Edit -> Project Settings -> AI -> Unity MCP Server`. Read the setup skill's `references/project-settings-ai.md` first.

## Export the Editor registry

The pinned `2.17.0-pre.1` public API exposes:

- `McpToolRegistry.GetAllToolsForSettings()` for every registered tool plus `IsEnabled`, `IsDefault`, and `Groups`.
- `McpToolRegistry.GetAvailableTools(true)` for the schema-bearing surface after programmatic filters while ignoring user enable state.
- `McpToolRegistry.GetAvailableTools()` for the surface currently advertised after filters and enable state.

Read the exact prewritten command at `../../setup-unity-mcp/assets/unity-commands/export-live-registry.cs` and submit that source unchanged to `Unity.RunCommand`. It uses the verified lowercase `Info` members and array APIs, has no Newtonsoft dependency, and writes the complete registry directly to `.agent-temp/setup-checkpoints/unity-mcp/unity-registry.json`; only counts, path, and SHA-256 are logged. Parse that file as JSON before using it. Do not paste the large schema payload through Editor logs because transport truncation is not valid registry evidence.

This command creates only setup-owned checkpoint evidence. It does not create an Unity asset, change settings, or write credentials. `Unity.RunCommand` is enabled by default in the verified package. If a user override disabled it, ask the user to enable that exact checkbox and then resume. Never substitute an exploratory command, use Computer Use, or use UI automation.

## Enable state

In the pinned package, `MCPSettings.EnableAllTools()` exists on an internal settings implementation, but the `2.17.0-pre.1` settings UI exposes only per-tool checkboxes plus **Reset to Defaults**. Do not compile against or reflect into the internal type, and do not rewrite its `EditorPrefs` JSON. List the exact disabled names, ask the user to enable those checkboxes, leave the settings page so dirty state is persisted, then export again and require:

```text
registered[*].IsEnabled == true
set(filteredIgnoringEnableState.name) == set(advertisedEnabled.name)
```

A programmatic `McpToolFilter` can intentionally remove tools after registration. Treat that difference as an explicit project filter to investigate, not as a successful enable-all result.

## Capture the client surface

After restarting Codex, capture the actual `tools/list` surface that Codex sees for server id `unity_mcp`. Preserve each exposed name, description, annotations, input schema, and output schema. Record `initialize` capabilities separately; only claim standard MCP resources, resource templates, or prompts when they are advertised live.

Run this export once for bootstrap and again after all package imports, custom-tool registrations, compilation, and domain reloads. Only the second result is final. Normalize schemas with sorted object keys, then hash their canonical JSON. Run `build_unity_mcp_catalog.py` with:

1. the verified package source root;
2. the live Editor registry export;
3. the Codex client tool-list capture.

The gate passes only when the exact exposed name set, canonical input/output schema hashes, groups, enable state, and documented URI patterns agree. On mismatch, write `skill-surface-drift`, regenerate only `references/generated/`, refresh the registry and client list, and compare again.

Never hand-edit generated evidence to force equality.
