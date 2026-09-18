---
name: dev-cocos-scene-prefab
description: Work correctly with Cocos Creator 3.8 scenes and prefabs — the serialized JSON layout, class-ids compressed from script uuids, prefab instances and overrides, MissingScript diagnosis, button event bindings, and why hand-editing .scene/.prefab files silently breaks references. Use when creating, wiring, debugging, porting, or reviewing anything stored in a .scene or .prefab file.
---

# Cocos scenes and prefabs

Half of a Cocos project lives in serialized JSON, and it fails silently when it is wrong. This skill is about that half.

## The serialization model

A `.scene`/`.prefab` file is a JSON **array**. Every object is an element; every reference is an index:

- `{"__id__": 12}` points at element 12 of the same file.
- `{"__uuid__": "<uuid>[@sub]"}` points at another asset, by the uuid stored in that asset's sibling `.meta`.
- `"__type__"` names the class: `cc.Sprite` for engine types, and for a project component either the `@ccclass('Name')` string or a **23-character class-id compressed from the script's uuid** (5 hex characters kept verbatim, then each group of 3 hex characters encoded as 2 base64 characters).

The consequence: the binding between a scene and a script is the script's uuid, not its class name and not its path. `better-context-unity cocos show <asset>` and `cocos components` resolve class-ids back to `.ts` files; use them instead of reading JSON.

## Non-negotiable rules

1. **Never hand-edit `.scene`/`.prefab` JSON.** Rebuild through the editor or the Cocos MCP tools. A hand-edited reference drifts from the class-id map and fails with no error.
2. **Never delete or hand-edit a `.meta`.** The uuid lives there; a new uuid detaches every scene and prefab that referenced the asset, irreversibly.
3. **Exactly one `@ccclass` per `.ts` file.** Two `Component` subclasses in one file register the same class-id: the second is dropped and its serialized data is read as the first, with no warning.
4. **Renaming an `@ccclass` string is a runtime break.** Call sites do `getComponent('Name')` by string; `tsc` stays clean.
5. **A `@property` is data, not code.** Adding one compiles fine and is `null` at runtime until something wires it in the scene or prefab.

## Diagnosing the silent failures

| Symptom | Cause | Check |
|---|---|---|
| `MissingScript` on a node | class-id resolves to no script: file deleted/renamed/moved, duplicate `@ccclass`, or a stale scene | `validate_scene`, `cocos components --asset <scene>`, the unresolved-component count in the project map |
| Every button in a screen does nothing, but is still lit and tappable | `cc.EventHandler` serialized under the wrong type name (`cc.ClickEvent`) — the handler class cannot be found | inspect the button's `clickEvents` with `inspect_component`; rebuild the binding with `bind_button_click_event` |
| Runtime `null` on a field that clearly exists | `@property` never wired in the prefab/scene | `inspect_node` / `inspect_prefab` for the component's serialized fields |
| A prefab instance ignores a change made to the prefab | the instance holds an override | `inspect_prefab_instance`, then `revert_prefab_instance` or `apply_prefab_instance` deliberately |
| Reference broke after a folder rename | the uuid survived but the bundle/path contract changed | see `dev-cocos-assets-bundles` |

## Building and changing scenes

- Create structure with `create_node`, `add_component`, `set_component_property`, `set_node_transform`, and the UI helpers (`create_canvas`, `create_label`, `create_sprite`, `create_button`); use `execute_javascript` with `context: "scene"` for repetitive structural work, under the approval gate.
- Turn a node into a prefab with `create_prefab_from_node`, not by writing a file.
- Validate every change: `validate_scene`, `validate_prefab_references`, `validate_asset_dependencies`.
- A template node kept in a scene for cloning must be `active = false`, or it renders as a real item.
- A node's initial `width`/`height` is frequently read as data by code; changing it to "fix the layout" can change behavior.
- Node names are sometimes display strings and lookup keys at once (`getChildByName('...')`); renaming a node can break both layout and logic.

## Porting from Cocos Creator 2.x

- 2.x uuids do **not** map to 3.x uuids. Re-map by logical path and rebuild the references; never transplant a uuid.
- Convert prefabs with a conversion pass, then re-sync the start scene and any uuid the converter rewrote; converter runs can flip both.
- Keep behavior identical while porting. If the original is wrong, reproduce it and log it as an original bug; fixing it is a separate, approved change because it alters game balance.

## Boundaries

- Never repair a reference by editing JSON, patching a uuid, or copying a class-id between files.
- Never delete a scene or prefab to "regenerate" it.
- Never mass-edit serialized files with a regex; a `re.S`-style pattern silently spans thousands of lines and eats unrelated fields.
- Never assume a clean `tsc` means the scene layer is intact — it cannot see any of it.
- Never present a scene change as done without a validation call, and for visual work, a screenshot.
