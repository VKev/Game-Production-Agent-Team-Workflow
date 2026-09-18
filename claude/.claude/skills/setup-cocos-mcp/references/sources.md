# Official sources

- Repository: https://github.com/FunplayAI/funplay-cocos-mcp
- Releases (zip + `SHA256SUMS.txt`): https://github.com/FunplayAI/funplay-cocos-mcp/releases
- Cocos Store listing: https://store.cocos.com/app/detail/8913
- npm stdio bridge (optional): https://www.npmjs.com/package/funplay-cocos-mcp

Checked on 2026-09-18. Latest release at that date: **v0.6.3** (2026-09-12), assets
`Funplay.CocosMcp.v0.6.3.zip`, `SHA256SUMS.txt`, `release-manifest.json`,
`RELEASE_NOTES.md`. Requires Cocos Creator **3.8+** and Node **>= 18** for the
optional bridge. MIT licensed; `mcpName` is `io.github.FunplayAI/funplay-cocos-mcp`.

## Shape of the integration

The extension embeds a streamable-HTTP MCP server inside the Cocos Creator editor
process. There is no separate daemon, so:

- The server exists only while the editor has the project open.
- Its port is per project. Current builds derive a stable port in `20000–29999`;
  projects configured under older builds keep `8765`. The authoritative value is
  `port` in the project-root `funplay-cocos-mcp.config.json`, which
  `lib/config.js` reads from `path.join(projectPath, 'funplay-cocos-mcp.config.json')`.
- `COCOS_MCP_HOST`, `COCOS_MCP_PORT` and `COCOS_MCP_PROFILE` override the file.
- `GET /health` and `GET /tools` are read-only debug endpoints usable without an
  MCP client.

## Client registration

The server id written to every client is `funplay_cocos`.

```json
{ "mcpServers": { "funplay_cocos": { "type": "http", "url": "http://127.0.0.1:8765/" } } }
```

```toml
[mcp_servers.funplay_cocos]
url = "http://127.0.0.1:8765/"
```

An optional npm wrapper bridges stdio to the same endpoint
(`npm install -g funplay-cocos-mcp`, env `FUNPLAY_COCOS_MCP_URL`,
`FUNPLAY_COCOS_MCP_TIMEOUT_SECONDS`, default 120). It is only useful for a client
that cannot speak HTTP; both Codex and Claude Code can.

## Tool surface

Profiles: `core` (39 high-signal tools, default), `full` (105), `custom`
(category/tool include-exclude, persisted in the project config). Categories seen
in a live 3.8.8 project: animation, assets, broadcast, build, camera, components,
diagnostics, events, execution, files, input, instructions, logs, prefabs,
preferences, project, runtime, scene, screenshots, selection, ui, updates.

Verified live against a running Cocos Creator 3.8.8 project on 2026-09-18
(`GET /tools` returned 99 tools under a `custom` profile). The names this package
set cares about:

- **Execution (approval-gated in every client):** `execute_javascript` (primary;
  `context: "scene" | "editor"`), `execute_scene_script`, `execute_editor_script`.
- **Desktop input and capture (denied in every client):** `simulate_mouse_click`,
  `simulate_mouse_drag`, `simulate_key_press`, `simulate_key_combo`,
  `simulate_preview_input`, `simulate_button_click`, `capture_desktop_screenshot`.
  These are desktop automation, which this package set prohibits regardless of
  transport. The in-editor captures (`capture_editor_screenshot`,
  `capture_scene_screenshot`, `capture_game_screenshot`,
  `capture_preview_screenshot`) are allowed.
- **Diagnostics:** `run_script_diagnostics`, `get_script_diagnostic_context`,
  `validate_scene`, `validate_prefab_references`, `validate_asset_dependencies`.
- **Prefabs:** `create_prefab_from_node`, `instantiate_prefab`,
  `apply_prefab_instance`, `revert_prefab_instance`, `duplicate_prefab`,
  `edit_prefab_json`, `inspect_prefab`, `inspect_prefab_instance`.
- **Scene/nodes:** `open_scene`, `save_current_scene`, `get_hierarchy`,
  `find_nodes`, `inspect_node`, `create_node`, `delete_node`,
  `set_node_transform`, `add_component`, `remove_component`,
  `set_component_property`, `invoke_component_method`.
- **Files and assets:** `read_file`, `write_file`, `replace_in_file`,
  `search_files`, `get_file_snippet`, `list_directory`, `exists`,
  `refresh_assets`, `list_assets`, `inspect_asset`, `inspect_asset_dependencies`.
- **Build/preview/runtime:** `get_build_status`, `open_build_panel`,
  `run_project_preview`, `get_preview_mode`, `set_preview_mode`,
  `get_runtime_state`, `pause_runtime`, `resume_runtime`, `set_time_scale`.
- **Instructions/skills:** `list_project_instructions`, `read_project_instruction`,
  `write_project_instruction` (knows `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
  `.cursorrules`, `.windsurfrules`, `.github/copilot-instructions.md`),
  `create_project_skill`, `create_cocos_mcp_project_skill`.

## Safety statements from upstream

- "This extension is **Editor-only**."
- "File tools and `cocos://asset/path/...` resources are restricted to the active
  Cocos project root."
- "All exposed MCP tools execute directly. There is no extra approval toggle
  inside the Cocos extension." — this is why the approval gate must be applied on
  the client side.
- `execute_javascript` safety checks are on by default and block obvious
  filesystem/shell patterns; a call may pass `safety_checks: false`. Upstream
  calls the checks "a guardrail, not a full sandbox", so setup never disables
  them and never passes that flag.
