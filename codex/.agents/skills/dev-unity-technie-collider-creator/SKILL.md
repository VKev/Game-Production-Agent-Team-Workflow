---
name: dev-unity-technie-collider-creator
description: Author, regenerate, optimize, automate, and verify rigid, skinned, and dynamic colliders with Technie Collider Creator 2. Use for painted hulls, convex decomposition, collider fitting, skinned-bone colliders, DynamicSkinnedCollider, batch generation, or collider performance.
---

# Technie Collider Creator 2 Development

Read [references/sources.md](references/sources.md) and the installed PDF. Confirm compatible Burst and Collections packages before using the registered build because its asmdefs reference both.

## Rigid collider workflow

1. Select the model/object and generate the Collider Creator data assets.
2. Paint representative faces for each hull; complete surface coverage is not required.
3. Choose the cheapest shape that preserves gameplay:
   - Convex hull as the default accurate rigidbody-compatible choice.
   - Box/sphere/capsule for simple volumes.
   - Face/face-as-box for thin surfaces.
   - Auto/V-HACD for deliberate multi-hull decomposition.
4. Tune max faces, inflation, fitting, and auto-hull granularity/concavity/smoothness. Start from presets before custom decomposition settings.
5. Generate colliders and inspect the actual created components, layers, materials, triggers, and Rigidbody interaction.

## Skinned and dynamic workflows

- For bone colliders, select the `SkinnedMeshRenderer`, generate assets, use Auto Setup as a starting point, adjust bone weight thresholds/types, then Generate Colliders again after edits.
- Kinematic rigidbodies are normally required for colliders that follow animated bones.
- `DynamicSkinnedCollider` deforms a collider asynchronously with Jobs/Burst. Choose Continuous, On Demand, or Throttled updates from gameplay need; use mesh LOD/simplification where available and leave expensive cooking options off unless evidence requires them.

## Ownership and automation

Generated painting/runtime data is project-owned. If a collider is edited manually, the tool can treat it as user-owned and stop regenerating it; delete/regenerate deliberately to return ownership. Use the included `Examples/Editor/ApiExample.cs` as the starting point for batch tooling.

Disconnecting editor data can remove runtime editor-component overhead while keeping generated colliders; preserve hull data when future editing is expected.

## Verification

Test collision shape in Scene/Play Mode, Rigidbody motion, trigger behavior, animation extremes, fast movement, layers/materials, prefab instances, regeneration, and build output. Profile Physics, Jobs/Burst work, dynamic update frequency, and collider counts. Check tiny-model import scale when PhysX precision collapses hull detail.

## Boundaries

- Do not delete `Assets/Physics Hulls` or other generated project data during an upgrade.
- Do not assume boxes outperform a substantially more accurate convex hull without profiling.
- Do not edit Technie package code or generated `.csproj` files.
