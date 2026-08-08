---
name: unity-gameplay-hierarchy-architecture
description: Design, audit, and refactor scalable non-UI Unity gameplay hierarchies and scene architecture. Use for organizing players, enemies, NPCs, managers and services, bootstrap and persistent systems, scene-local controllers, world content, runtime-spawned objects, object pools, cameras, audio, VFX, additive scenes, DontDestroyOnLoad, prefab composition, and communication patterns such as singleton, service locator, dependency injection, events, and ScriptableObjects. Produce readable hierarchy trees, ownership and lifetime reasoning, benefits, risks, performance implications, migration steps, and validation checklists. Distinguish hierarchy organization from rendering optimization and verify version-specific Unity behavior when needed.
---

# Unity Gameplay Hierarchy Architecture

## Purpose

Design or review non-UI Unity hierarchies so they are readable, maintainable, performant, and safe across scene loading. Treat the hierarchy as a model of ownership, lifetime, transform inheritance, activation boundaries, and authoring responsibility.

## Core doctrine

Apply these rules before proposing any structure:

- Use hierarchy parentage only when there is a real ownership, lifetime, transform, or activation relationship.
- Do not use the hierarchy as a hidden dependency graph or as a substitute for explicit references.
- Do not claim that grouping gameplay objects under one parent automatically reduces draw calls.
- Separate application, session, scene, entity, and transient lifetimes.
- Keep persistent systems small and deliberate.
- Keep authored level content separate from runtime-spawned objects.
- Prefer composition over deep inheritance and giant manager classes.
- Prefer explicit dependencies over global lookup.
- Use meaningful names. Do not add numeric prefixes, sorting IDs, or names such as `C90_Overlay`, `00_Root`, or `Manager_01` unless the user explicitly requests them.
- Profile before recommending architecture solely for performance.

## Workflow

### 1. Establish the scope

Identify or reasonably infer:

- Unity version and render pipeline when relevant.
- Game scale: prototype, small production, medium team, or large live project.
- Scene strategy: single scene, scene replacement, additive scenes, world streaming, or networked sessions.
- Object lifetimes and unload boundaries.
- Whether the request is about hierarchy readability, code architecture, runtime performance, teamwork, or all of them.

When details are missing, state assumptions and proceed. Ask a question only when a different answer would materially change the architecture.

### 2. Inventory the current structure

For every important GameObject or system, classify:

- **Lifetime:** application, session, scene, entity, or transient.
- **Owner:** which system, scene, or entity is responsible for it.
- **Transform relationship:** whether it must move, rotate, or scale with its parent.
- **Activation relationship:** whether enabling or disabling the parent should affect it.
- **Creation mode:** authored in a scene, instantiated from a prefab, or rented from a pool.
- **Dependency direction:** what it needs and what is allowed to depend on it.
- **Unload behavior:** what must be cleaned up when a scene, match, or entity ends.

Do not preserve a parent-child relationship that fails all of these tests.

### 3. Select lifetime roots

Use only the roots the project needs. Start from this model:

```text
BootstrapScene
`-- ApplicationRoot
    |-- GameFlow
    |-- SceneLoading
    |-- Save
    |-- Input
    |-- Audio
    |-- PlatformServices
    `-- Diagnostics
```

```text
GameplayScene
|-- SceneContext
|   |-- LevelController
|   |-- SpawnDirector
|   |-- ObjectiveController
|   `-- SceneReferences
|-- World
|   |-- Environment
|   |-- Navigation
|   |-- SpawnPoints
|   |-- Checkpoints
|   `-- Triggers
|-- Actors
|   |-- Players
|   |-- Enemies
|   |-- NPCs
|   `-- Companions
|-- RuntimeObjects
|   |-- Projectiles
|   |-- Pickups
|   |-- Effects
|   `-- PooledObjects
|-- Cameras
|-- SceneAudio
`-- DebugTools
```

Add a `SessionRoot` only when match or run state must survive multiple gameplay scenes but should not survive the entire application.

Read [hierarchy-patterns.md](references/hierarchy-patterns.md) for additive-scene, world-streaming, networked, and entity-prefab variants.

### 4. Place systems by responsibility

Use these defaults:

- Put platform-wide and cross-scene services under `ApplicationRoot`.
- Put match-wide state under `SessionRoot` when one exists.
- Put level rules, objectives, spawn coordination, and scene references under `SceneContext`.
- Put behavior that belongs to one player, enemy, or interactable on that entity prefab.
- Put static configuration in ScriptableObject assets instead of scene hierarchy objects when appropriate.
- Put runtime registries, event channels, or runtime sets behind clear interfaces rather than using repeated scene searches.
- Avoid a generic `Managers` root that mixes unrelated lifetimes.

Read [decision-guide.md](references/decision-guide.md) for placement and communication decisions.

### 5. Design self-contained entity prefabs

Use a root that represents entity identity and owns the main gameplay components. Group only concrete transform or presentation concerns below it.

```text
Player
|-- Visuals
|   |-- CharacterModel
|   `-- Animator
|-- Collision
|   |-- BodyCollider
|   `-- HitBoxes
|-- Sensors
|   |-- GroundCheck
|   |-- InteractionSensor
|   `-- TargetSensor
|-- AttachmentPoints
|   |-- WeaponSocket
|   |-- EffectSocket
|   `-- CameraTarget
`-- LocalEffects
    |-- FootstepEffects
    `-- StatusEffects
```

Keep controller, health, movement, abilities, team identity, and similar coordinating components on the entity root unless another placement has a clear reason.

Do not create pass-through objects named `Root`, `Main`, `Content`, or `Container` without a distinct responsibility. Do not reorganize an imported animation skeleton merely to make the hierarchy look flatter.

### 6. Choose dependency and communication patterns

Prefer this order:

1. Use serialized references for relationships inside the same prefab or authored scene.
2. Use explicit initialization or constructor injection for pure C# modules and runtime-created systems.
3. Use events for one-to-many notifications where publishers should not know subscribers.
4. Use ScriptableObject configuration, event channels, or runtime sets when asset-based decoupling fits the project.
5. Use a singleton only for a small number of truly unique application services.
6. Restrict service locator access to bootstrap or composition boundaries when possible.

Never introduce a dependency-injection framework solely to make a small project appear architecturally advanced. Match complexity to team size and test requirements.

### 7. Review scene and persistence safety

Require all persistent architecture to satisfy:

- Create persistent services from one bootstrap path.
- Prevent duplicate persistent roots.
- Never parent scene-owned actors, bosses, effects, or cameras under a persistent root.
- Avoid persistent services retaining stale references to unloaded scene objects.
- Unsubscribe scene-local listeners and release pooled or addressable content at the correct boundary.
- Treat `DontDestroyOnLoad` as a lifetime tool, not a general convenience.

Prefer a bootstrap scene plus additive or replacement scene loading when it makes ownership and unloading clearer.

### 8. Review performance implications correctly

Explain the distinction between organization and optimization:

- Hierarchy grouping alone does not merge gameplay draw calls.
- Rendering performance depends on material and shader compatibility, render pipeline batching, GPU instancing, static batching, LOD, culling, mesh and light setup, and shader passes.
- Moving a parent causes descendant transforms to require updates; do not place unrelated dynamic objects below a frequently moving root.
- Deep pass-through hierarchies make transform behavior and prefab overrides harder to reason about.
- Frequent `Instantiate` and `Destroy` of projectiles, effects, pickups, and damage indicators are candidates for pooling.
- A global update manager is justified only after profiling many per-frame callbacks.
- Disabling a large parent can activate or deactivate many components at once; consider the spike and lifecycle callbacks.
- Static and dynamic grouping is useful for authoring and applying correct flags, but the flags and rendering conditions create the optimization.

When advice depends on a Unity version or render pipeline, verify it against current official Unity documentation and cite the source.

### 9. Deliver an actionable answer

Use this structure for substantial reviews or designs:

```text
# Architecture summary

## Scope and assumptions

## Current risks or design pressures

## Recommended hierarchy

## Placement and lifetime rules

## Why this structure helps

## Dependency and communication plan

## Performance implications

## Migration steps

## Validation checklist
```

Adapt the sections for small questions. Always explain:

- What each root or group represents.
- Why each important object belongs there.
- What benefit the structure creates.
- Which tradeoffs or exceptions apply.
- Which changes affect only readability and which can affect runtime behavior.

For an audit, include a before-and-after hierarchy and a migration order that can be applied incrementally.

## Quality rules

- Use clear English and concrete nouns.
- Do not present one hierarchy as universally correct.
- Do not create roots that remain empty or exist only for visual symmetry.
- Do not put all systems into one `GameManager` or all services into one undifferentiated `Managers` group.
- Do not force every class to be a MonoBehaviour.
- Do not recommend `GameObject.Find`, tag searches, or scene-wide searches as routine dependency wiring.
- Do not recommend global state without explaining lifecycle, duplication, testing, and unload risks.
- Do not use numeric naming conventions unless explicitly requested.
- Distinguish scene hierarchy, prefab hierarchy, code/module structure, and project-folder structure; do not treat them as the same problem.
- Flag uncertain or version-dependent claims and verify them.

## Reference loading

- Read [hierarchy-patterns.md](references/hierarchy-patterns.md) for concrete scene, additive-loading, runtime, and prefab layouts.
- Read [decision-guide.md](references/decision-guide.md) for lifetime, ownership, manager, dependency, and performance decisions.
- Read [audit-checklist.md](references/audit-checklist.md) when reviewing an existing project, screenshot, hierarchy export, or architecture proposal.
- Read [sources.md](references/sources.md) when current Unity documentation or citations are requested.
