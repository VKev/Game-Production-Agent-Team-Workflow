---
name: dev-unity-optimizers
description: Configure, extend, profile, and verify FImpossible Optimizers for camera-distance and visibility based runtime optimization. Use for Essential Optimizer, CullingGroup containers, component LOD, particle/terrain optimization, obstacle detection, Progressive Culling, or custom LOD types.
---

# Optimizers Development

Read [references/sources.md](references/sources.md) and the installed manual/readme. The readme declares package version `2.2.3.1`.

## Decide whether to use it

Measure first. Prefer Unity `LODGroup` for ordinary single-mesh rendering LOD. Optimizers is most valuable when a distance/visibility state must change multiple components, expensive MonoBehaviours, particles, audio, terrain settings, or very large groups sharing the same culling bands.

## Workflow

1. Capture a Profiler baseline and identify the component work that becomes unnecessary by distance or visibility.
2. Prefer `EssentialOptimizer`. Add only the components/settings that can safely change at each LOD.
3. Choose `Effective` for dynamic objects with CullingGroup support, `Static` for stationary objects, and other modes only when their documented tradeoff is required.
4. Reuse identical LOD counts, maximum distance, and distance bands across similar objects so they share Culling Containers. Arbitrary per-prefab ranges defeat batching.
5. Configure hidden-camera settings separately from far-distance settings; an offscreen nearby AI may still need simulation.
6. If the main camera changes, call `FIMSpace.FOptimizing.OptimizersManager.SetNewMainCamera(camera)` at the ownership transition.
7. Inspect Optimizers Manager container counts/capacity and memory rather than assuming more capacity is always faster.

## Optional systems

- Obstacle detection uses raycasts; use it for grouped expensive content, not thousands of cheap meshes.
- Progressive Culling is experimental and requires compatible Mathematics, Jobs, Collections, and Burst packages plus correct asmdef references/defines. Enable only after feature-specific testing.
- `ScriptableOptimizer` enables shared/custom LOD types but adds asset/sub-asset ownership complexity. Prefer Essential unless custom type support justifies it.
- Terrain Optimizer helps multi-terrain layouts; it is unlikely to help one large terrain.

## Verification

Profile CPU, render cost, allocations, culling-container count, transition spikes, and memory with representative object counts. Move/rotate/swap cameras, cross every LOD band, look away/return, disable/re-enable objects, and confirm state restoration. Compare against the baseline; “FPS feels higher” is not sufficient evidence.

## Boundaries

- Do not add an optimizer to every object by default.
- Do not disable gameplay-authoritative components solely because they are invisible.
- Do not edit FImpossible package/shared source or manifest files to activate optional features.
