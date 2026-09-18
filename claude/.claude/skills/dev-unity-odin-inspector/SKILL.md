---
name: dev-unity-odin-inspector
description: Design, implement, refactor, and verify Unity inspectors, editor tools, validation, and serialization with Odin Inspector and Serializer. Use when code uses Sirenix attributes or serialized base classes, or when a Unity workflow needs an Odin-powered inspector or editor window.
---

# Odin Inspector Development

Work against the installed Odin build, not remembered APIs. Read [references/sources.md](references/sources.md), confirm `Assets/Plugins/Sirenix/Odin Inspector/Version.txt`, and use the package's Getting Started window or API documentation when an attribute or serializer behavior is version-sensitive.

## Choose the smallest tool

1. Use Unity serialization and ordinary fields/properties when it already represents the data correctly.
2. Add Odin attributes to improve grouping, visibility, validation, actions, or authoring ergonomics without changing runtime ownership.
3. Use an `OdinEditorWindow` for a real multi-object workflow, not to avoid a small custom inspector.
4. Use Odin serialization only when Unity serialization cannot represent the required graph or type. Make the persistence choice explicit.

`ShowInInspector` displays a member; it does not make that member persistent. `OdinSerialize` requires an Odin-serialized host such as `SerializedMonoBehaviour` or `SerializedScriptableObject` for Unity object data.

## Workflow

1. Inspect the target type, its current serialized data, prefab/scene usage, and assembly boundary.
2. Decide whether the change is presentation-only or changes persistence. Preserve field names and serialized compatibility unless migration is explicitly required.
3. Prefer a few readable attributes over dense conditional expressions. Keep business rules in runtime code and editor presentation in editor-only code.
4. Put custom drawers, processors, validators, and windows in an Editor-only assembly/folder. Do not introduce `UnityEditor` references into runtime assemblies.
5. For buttons or fixes, make actions idempotent, Undo-aware, dirty the correct targets, and support multi-object editing where appropriate.
6. For serializer changes, test domain reload, scene/prefab save/reopen, prefab overrides, cloning, and the target build backend. Review AOT requirements when using IL2CPP.

## Verification

- Compile after adding Sirenix namespaces and after any asmdef change.
- Inspect the actual Unity Inspector for grouping, mixed values, validation messages, and undo/redo behavior.
- Save and reopen affected assets/scenes to prove persistence instead of relying on the live Inspector.
- Treat Odin Validator results as additional evidence, not a replacement for project tests.

## Boundaries

- Do not add Odin serialization merely for inspector cosmetics.
- Do not hide invalid runtime state behind conditional display attributes.
- Do not edit package source under `Assets/Plugins/Sirenix`.
- Do not assume every team member or build pipeline has a compatible Odin license/module; preserve the project's established dependency policy.
