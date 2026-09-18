---
name: dev-unity-vfx-graph
description: Design, implement, profile, debug, and verify Visual Effect Graph content with the Unity 6.3 core package line. Use for VFX Graph systems, properties, events, spawning, simulation, rendering, Shader Graph integration, bounds, pooling, compute/platform constraints, or render-pipeline compatibility.
---

# Unity VFX Graph

Read [references/guidance.md](references/guidance.md) before implementation and [references/sources.md](references/sources.md) when package behavior needs verification.

The setup always installs `com.unity.visualeffectgraph` from the exact Unity `6000.3.21f1` Editor catalog (17.3 line). Installation does not change the project's render pipeline. Usability still depends on the active pipeline, compute-shader support, graphics API, target platform, and chosen contexts/operators.

## Workflow

1. Inspect the locked package, render pipeline asset, graphics APIs, target platforms, quality levels, effect asset, renderer/bounds, and spawn/control code.
2. Define the event/property contract before graph edits. Separate spawn, initialize, update, and output responsibilities.
3. Read `dev-unity-mcp` for live asset/scene/Console/capture work; target exact assets and snapshot before mutation.
4. Prefer explicit capacity, deterministic bounds, pooled/reused components, and property IDs. Avoid per-frame string lookup and unbounded particle counts.
5. Compile the graph and project, inspect only new Console errors, profile representative hardware, and visually verify several frames only when appearance/timing requires it.

Ask before changing render pipeline or platform requirements. Never enable unsupported integrations merely because the package is installed.
