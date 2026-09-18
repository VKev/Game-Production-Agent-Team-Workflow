---
name: dev-cocos-mcp
description: Use the funplay-cocos-mcp editor tools safely and effectively in a Cocos Creator 3.8 project — execute_javascript-first workflows, scene and prefab operations, node and component inspection, diagnostics, screenshots, preview and build state. Read before every live Cocos MCP call, including when choosing between an MCP call, a file edit, and an editor action.
---

# Cocos MCP runtime use

`funplay_cocos` is an MCP server embedded in the Cocos Creator editor. It can read and change the live project. Read this skill before the first call of a session and whenever an operation would mutate the project.

Setup, installation, ports, and client registration belong to `setup-cocos-mcp`. This skill is about using what setup registered.

## Before any call

1. Confirm the server is connected and that it belongs to the intended project (`get_project_info`). A tool failing with a connection error means the editor is closed — say so and fall back to file-based work; never try to launch the editor.
2. Prefer the smallest read-only tool that answers the question. `get_hierarchy`, `find_nodes`, `inspect_node`, `inspect_component`, `list_components`, `inspect_prefab`, `list_assets`, `inspect_asset`, and `get_scene_info` cost nothing and cannot damage a project.
3. Know which scene is open (`get_scene_info`). Node and component tools act on the **open scene**, not on the start scene and not on a file you were reading.

## The three execution tools

`execute_javascript` (with `context: "scene" | "editor"`), `execute_scene_script`, and `execute_editor_script` run arbitrary code inside the editor. This package set gates all three behind explicit approval in every client.

- Ask before each call, state exactly what the code will do, and keep it minimal and reversible.
- Never pass `safety_checks: false`. The upstream guardrail blocks obvious filesystem and shell patterns; disabling it is not a decision setup or a task takes casually.
- Prefer a focused tool when one exists: `create_node`, `add_component`, `set_component_property`, `create_prefab_from_node`, `bind_button_click_event` are inspectable and reversible in a way that a script is not.
- Execution is the right tool when the operation is structural and repetitive — building a node tree, wiring many properties, or reading a derived value the dedicated tools do not expose. That is exactly how a checkpoint scene gets built without touching JSON.

## Prohibited tools

The server also exposes desktop-level automation: `simulate_mouse_click`, `simulate_mouse_drag`, `simulate_key_press`, `simulate_key_combo`, `simulate_preview_input`, `simulate_button_click`, and `capture_desktop_screenshot`. This package set prohibits desktop/UI automation regardless of the transport that offers it, and setup denies them client-side. Never ask for them to be re-enabled; use the in-editor captures (`capture_editor_screenshot`, `capture_scene_screenshot`, `capture_game_screenshot`, `capture_preview_screenshot`) and the dedicated tools instead.

## Mutating safely

1. Save or confirm the scene state first (`get_scene_info`); an unsaved editor scene can lose work if the editor reloads.
2. Make one logical change, then verify it with a read-only call before the next one.
3. After editing `.ts` files on disk, call `refresh_assets` and wait before any tool that resolves a uuid or class-id, or the `.meta` will not exist yet.
4. Validate before declaring success: `run_script_diagnostics` (TypeScript no-emit), `validate_scene`, `validate_prefab_references`, `validate_asset_dependencies`, and `get_recent_logs` / `search_project_logs` for editor errors.
5. `save_current_scene` only when the user expects the change persisted; say that you are about to write to the scene file.

## Prefabs

Use the prefab tools rather than raw scene operations: `create_prefab_from_node` (the supported path on 3.8.x), `instantiate_prefab`, `apply_prefab_instance`, `revert_prefab_instance`, `duplicate_prefab` (creates a new uuid instead of cloning one), and `inspect_prefab_instance`. `edit_prefab_json` exists for surgical fixes — treat it as a last resort and always follow it with `validate_prefab_references`.

## Boundaries

- Never call a mutating tool without the user's intent being clear; "inspect" requests never include changes.
- Never write to `library/`, `temp/`, `build/`, or `profiles/` through the file tools; they are regenerated and the editor owns them.
- Never use `write_file`/`replace_in_file` on `.scene`, `.prefab`, or `.meta` files. Scene and prefab structure is edited through the scene/prefab tools or the editor.
- Never claim a scene or prefab is correct from a successful write; verify with the validation tools and, when visual, a screenshot.
- Never leave the editor in a state the user did not ask for: no changed selection as the final state, no half-built node tree, no unsaved scene presented as saved.
- Never enter play mode or change `set_time_scale` on a shared editor without saying so first.
- If the connection drops mid-operation, re-inspect before retrying; a disconnect is not proof the operation failed.
