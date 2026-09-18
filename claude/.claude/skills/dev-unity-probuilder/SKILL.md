---
name: dev-unity-probuilder
description: Design, create, edit, debug, and verify level geometry with the exact ProBuilder package pinned for Unity 6000.3.21f1. Use for ProBuilder meshes, faces, edges, vertices, UVs, materials, smoothing, colliders, prefabs, runtime mesh APIs, Editor tooling, or safe scene changes.
---

# Unity ProBuilder

Read [references/guidance.md](references/guidance.md) before implementation and [references/sources.md](references/sources.md) when API/package behavior needs verification.

## Workflow

1. Inspect the pinned `com.unity.probuilder` version, active scene, target object, scale, materials, colliders, prefab ownership, and source-control state.
2. Decide whether the geometry is an authored ProBuilder mesh, a runtime procedural mesh, or a final exported production asset. Do not mix Editor-only APIs into player assemblies.
3. For scene mutations, read `dev-unity-mcp` and use the official MCP with an exact scene/hierarchy target. Snapshot before destructive topology operations.
4. Keep topology simple and deterministic. Separate shape construction, UV/material assignment, collision, and gameplay components.
5. Refresh/rebuild the mesh using the pinned API, save intentionally, then verify normals, UVs, material slots, collider fit, prefab overrides, Console delta, and representative Game/Scene views.

Do not silently ProBuilderize arbitrary artist meshes or destructively export/replace source geometry. Ask when ownership or destructive intent is unclear.
