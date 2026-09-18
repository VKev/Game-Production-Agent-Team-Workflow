---
name: dev-unity-gltfast
description: Import, load, instantiate, debug, optimize, and verify glTF or GLB assets with the exact glTFast package pinned for Unity 6000.3.21f1. Use for Editor importers, runtime URLs/streams, async lifecycle, materials, textures, animation, memory, disposal, URI security, or platform limitations.
---

# Unity glTFast

Read [references/guidance.md](references/guidance.md) before implementation and [references/sources.md](references/sources.md) when API/package behavior needs verification.

## Workflow

1. Inspect `com.unity.cloud.gltfast` in the package lock, active render pipeline, source format/URI, importer/runtime path, material requirements, target platforms, and memory budget.
2. Use the Editor importer for authored project assets. Use runtime loading only for dynamic content and define ownership, cancellation, failure, and disposal before coding.
3. Validate remote URI policy, redirects, content size/type, external buffers/textures, and cache behavior. Do not load untrusted arbitrary paths.
4. Await loading and instantiation through the pinned API; never block the Unity main thread. Handle scene unload, cancellation, retries, and partial failure.
5. Verify hierarchy, transforms, animation, materials, colors, texture orientation/compression, bounds, memory release, Console delta, and representative platforms.

Read `dev-unity-mcp` for Editor import, asset inspection, scene placement, capture, and Console verification.
