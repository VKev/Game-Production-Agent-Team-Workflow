# ProBuilder guidance

## Editor-authored geometry

- Block out with stable dimensions and pivots; keep transform scale normalized before precision operations.
- Make selection scope explicit: object, face, edge, or vertex.
- Preserve shared-vertex topology intentionally. Extrude/bevel/subdivide/merge operations can change indices and invalidate code or stored selections.
- Use smoothing groups and explicit normals based on the intended hard edges.
- Assign materials by face only when multiple submeshes are justified; excessive material slots increase draw calls.
- Keep UV0 for surface texturing and generate/validate UV2 only when the lighting workflow needs it.
- Use simple colliders for gameplay where possible; do not assume render topology is appropriate collision topology.
- Before applying a prefab or destructive topology edit, inspect overrides and snapshot the scene/prefab.

## Runtime API

Keep `UnityEditor.ProBuilder` APIs in Editor assemblies. Runtime mesh construction uses the public ProBuilder runtime namespaces/types available in the pinned package. Build vertices/faces, create or update the mesh, then perform the package-required refresh/rebuild calls. Avoid per-frame reconstruction; pool/reuse meshes and profile allocations/bounds recalculation.

## Verification

Check mesh validity, face/index ranges, normals/tangents, UV seams, material/submesh alignment, bounds, collider, lightmapping data, prefab/scene serialization, and new Console errors. Use wireframe and several camera angles when topology correctness is visual.
