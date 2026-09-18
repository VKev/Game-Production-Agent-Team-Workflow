# Tool selection and safe workflows

Always use the exact names and schemas returned by the current `tools/list`. Declared source names replace `.` with `_` for MCP exposure. Names longer than 42 characters are deterministically truncated and receive an 8-hex hash suffix; never derive a long exposed name by hand when the live catalog is available.

## Discovery

1. Call/observe `initialize`; record protocol version and advertised capabilities.
2. Refresh `tools/list` after connection, package reload, registry change, or a tool-change notification.
3. Use `tools/call` with only schema-valid fields. Respect required fields, enums, defaults, ranges, annotations, output schema, timeout, and cancellation.
4. Treat resource templates, resources, and prompts as MCP primitives only if the server advertises those capabilities.

## Common routes

- Editor status/play mode/refresh: `Unity.ManageEditor` actions.
- Scene read/create/load/save: `Unity.ManageScene` actions.
- Hierarchy/GameObject/component: `Unity.ManageGameObject`, then verify the resolved instance/path and component state.
- Assets/import/materials: `Unity.ManageAsset`, `Unity.ImportExternalModel`, and preview/result resources when returned.
- Scripts: `Unity.GetSha` before SHA-gated edits; prefer `Unity.ScriptApplyEdits` or `Unity.ApplyTextEdits` according to the live schema; run `Unity.ValidateScript` before apply when offered.
- Console: `Unity.ReadConsole` or the adapted `Unity.GetConsoleLogs`; capture a baseline and compare only new errors after mutation.
- Menu commands: `Unity.ManageMenuItem` with an exact menu path.
- Files/resources: `Unity.ListResources`, `Unity.ReadResource`, `Unity.FindInFile`; these are tools, not proof of standard MCP resource capability.
- Scene/camera images: use adapted capture tools returned by `tools/list`; request frames only when visual evidence is relevant.

Composite tools expose action/sub-operation fields. Do not infer actions from an older catalog: inspect the live enum and its per-action required fields. A successful transport response does not prove the intended Unity mutation happened; verify resulting state and Console delta.

## Compile/reload behavior

- Domain reload can interrupt a call after its side effect. Reconnect, inspect state, and retry only if evidence proves the action did not complete.
- Do not queue unrelated mutations while Unity compiles, imports, refreshes, enters/exits play mode, or reloads assemblies.
- Honor tool timeouts and cancellation. After timeout/disconnect, classify the result as unknown until state is checked.
- For package setup, do not add/upgrade UPM packages during Phase B; the package graph belongs to editor-closed Phase A.
