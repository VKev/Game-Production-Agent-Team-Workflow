# Architecture Decision Guide

## Contents

- Lifetime classification
- Ownership tests
- Placement matrix
- Manager and service decisions
- Dependency and communication decisions
- ScriptableObject use
- Scene reference strategy
- Hierarchy and performance
- Anti-pattern diagnosis

## Lifetime classification

Classify every system or object before choosing a parent.

| Lifetime | Ends when | Typical examples | Typical owner |
|---|---|---|---|
| Application | The application exits | save access, platform services, scene loading, global audio routing | `ApplicationRoot` |
| Session | A match, run, lobby, or campaign session ends | match rules, run inventory, network session, session score | `SessionRoot` |
| Scene | A scene or streamed region unloads | objectives, spawn director, checkpoints, scene references | `SceneContext` or region root |
| Entity | The entity despawns or dies | movement, health, combat, AI, local effects | entity prefab root |
| Transient | A short action ends | projectile, impact, pickup, damage indicator | runtime root or pool |

### Decision question

Ask: "Should this object still exist after the current level unloads?"

- If yes for the whole application, consider application lifetime.
- If yes only for the current run or match, use session lifetime.
- If no, keep it scene owned.
- If it exists only because one entity exists, make the entity its owner.

## Ownership tests

A child relationship is justified when at least one statement is true:

- The child is destroyed when the parent is destroyed.
- The child is enabled and disabled with the parent.
- The child must inherit movement, rotation, or scale.
- The child is an authored part of the parent prefab.
- The parent is the clear owner responsible for initialization and cleanup.

A child relationship is suspicious when:

- It exists only to make the Hierarchy look grouped.
- The child is global but the parent is scene local.
- The child should survive the parent.
- The child must compensate for unwanted parent scale or rotation.
- Code searches the parent chain merely to locate unrelated services.

## Placement matrix

| Responsibility | Preferred placement | Why |
|---|---|---|
| Cross-scene platform or application service | `ApplicationRoot` or pure C# composition root | Stable lifetime and one startup path |
| Match or run state | `SessionRoot` | Survives level changes without becoming global forever |
| Level rules and objectives | `SceneContext` | Unloads with the level and keeps references local |
| Spawn scheduling | Scene or encounter coordinator | Coordinates creation without owning entity behavior |
| Player movement and health | Player prefab | Entity owns its behavior and lifetime |
| Enemy AI and combat | Enemy prefab | Self-contained behavior and reusable variants |
| Static game configuration | ScriptableObject asset or data file | Not tied to scene lifetime |
| Runtime collection of active entities | Registry or runtime set | Avoid repeated global searches |
| Projectiles and impacts | Runtime root and pool | Clear transient ownership and reuse |
| Scene ambience and zones | `SceneAudio` | Unloads with the scene |
| Global audio routing | `ApplicationRoot/Audio` | Survives scene changes |
| Debug visualizers | `DebugTools` or conditional debug scene | Easy to disable or remove |

## Manager and service decisions

The word `Manager` is not automatically wrong. The responsibility and lifetime must be precise.

### Use an entity component when

- The behavior belongs to one entity.
- It needs that entity's transform, health, animator, or local state.
- It should be instantiated and destroyed with the prefab.

Examples: `PlayerMovement`, `EnemyPerception`, `WeaponController`.

### Use a scene coordinator when

- The system orchestrates several entities or authored locations in one scene.
- It owns level rules, encounter progress, objectives, or spawn timing.
- It should unload with the scene.

Examples: `SpawnDirector`, `ObjectiveController`, `EncounterCoordinator`.

### Use a session service when

- State spans several scene loads but belongs only to the current run or match.

Examples: `MatchFlow`, `RunInventory`, `NetworkSession`.

### Use an application service when

- The function is unique across the process and independent of the current level.

Examples: `SceneLoading`, `Save`, `PlatformServices`.

### Use a pure C# object when

- The logic does not need Transform, Unity messages, coroutines, or inspector-driven component references.
- The code benefits from unit testing and explicit construction.

### Avoid a god manager when

- One class knows players, enemies, audio, save, UI, scenes, and effects.
- A change in one feature creates regressions across unrelated systems.
- The class becomes the only route for communication.

Split by responsibility and lifetime, not by arbitrary file size alone.

## Dependency and communication decisions

### Serialized references

Use for stable relationships authored in one scene or prefab.

Benefits:

- Visible in the Inspector.
- Fast and explicit at runtime.
- Easy to validate before play.

Risks:

- Cross-scene references can break unload boundaries.
- Large prefabs can become tightly coupled if every component references every other component.

### Explicit initialization or constructor injection

Use for runtime-created systems and pure C# modules.

Benefits:

- Dependencies are visible in the API.
- Easy to replace with tests or alternative implementations.
- Avoid hidden global access.

Tradeoff:

- Requires a composition root or initialization step.

### Events

Use for one-to-many notifications when the publisher should not know all consumers.

Examples:

- `PlayerDied`
- `ObjectiveCompleted`
- `SceneReady`
- `CurrencyChanged`

Rules:

- Define who owns event lifetime.
- Unsubscribe listeners at the matching boundary.
- Avoid event chains that make control flow impossible to trace.
- Use commands or direct calls when a specific receiver must perform a required action.

### ScriptableObject event channels and runtime sets

Use when asset-based decoupling helps designers or multiple scenes share a stable contract.

Benefits:

- References can be assigned as assets.
- Publishers and listeners do not need direct object references.
- Runtime sets can track active objects without repeated scene searches.

Risks:

- Runtime state can leak between play sessions or tests if it is not reset correctly.
- Too many event assets can make behavior difficult to trace.
- Asset references do not automatically solve ownership or unsubscribe rules.

### Singleton

Use only for a small number of truly unique services.

Benefits:

- Simple access and setup.
- Suitable for small projects or platform boundaries.

Risks:

- Hidden dependencies.
- Duplicate instance problems.
- Difficult isolation in tests.
- Encourages unrelated systems to become global.

Require an explicit lifetime, duplicate policy, initialization order, and shutdown behavior.

### Service locator

A service locator is preferable to scattered singleton calls only when it is controlled.

Benefits:

- Central registration.
- Interfaces can replace concrete implementations.

Risks:

- Dependencies remain hidden at the call site.
- Any class can request any service.
- Runtime failures occur when registration is missing.

Restrict lookup to bootstrap, factories, or composition boundaries when possible. Pass the resulting dependency explicitly to gameplay modules.

### Dependency-injection framework

Use when the project has enough modules, automated tests, runtime composition, or team conventions to justify it.

Do not introduce a framework merely to avoid a small number of clear serialized references.

## ScriptableObject use

Good uses:

- Immutable or controlled configuration.
- Item, ability, enemy, and level definitions.
- Shared event contracts.
- Runtime sets with explicit reset behavior.
- Strategy data and authoring-friendly references.

Poor uses:

- Hiding uncontrolled mutable global state.
- Storing direct references to scene objects across unloads.
- Replacing every normal class with an asset.

Separate configuration data from mutable runtime state unless the design intentionally combines them and documents reset rules.

## Scene reference strategy

Prefer one scene composition component or a small set of context components over repeated searches.

```text
SceneContext
`-- SceneReferences
```

`SceneReferences` may serialize:

- Player spawn points.
- Camera bounds.
- Objective locations.
- Exit triggers.
- Boss arena anchors.
- Scene-specific registries.

Benefits:

- Missing references can be validated before play.
- Scene wiring is discoverable.
- Global services do not need to search for scene objects.

Do not turn `SceneReferences` into a generic bag containing every object. Group references by feature when it becomes large.

## Hierarchy and performance

### Draw calls

Reparenting players, enemies, or environment objects under a common root does not automatically reduce draw calls. Rendering optimization depends on compatible materials and shaders, the active render pipeline, batching or instancing support, LOD, culling, and object setup.

Use hierarchy groups to make correct optimization categories visible, for example `StaticGeometry` and `DynamicProps`, but verify actual rendering in the profiler and frame debugger.

### Transform propagation

A changed parent transform affects descendants. Avoid placing many unrelated active objects beneath a parent that moves, rotates, or scales frequently.

### Deep hierarchy

Deep nesting can create:

- Hard-to-understand local transforms.
- More descendant propagation when high-level transforms change.
- Fragile prefab overrides.
- Difficult authoring and debugging.

Keep intentional depth. Do not flatten imported skeletons or nested prefabs when their structure has a real purpose.

### Activation boundaries

Disabling a parent disables its active children and can trigger many Unity lifecycle callbacks. This is useful for scene modules but can cause a visible spike if the group is large. Measure large activation operations.

### Pooling

Pool high-frequency transient objects after measuring allocation, instantiation, destruction, or garbage-collection pressure. Pool ownership must match asset and scene lifetime.

### Per-frame callbacks

Many trivial `Update`, `FixedUpdate`, or `LateUpdate` methods can become expensive at scale. Consider event-driven updates, time-sliced work, visibility-based activation, jobs, or an update scheduler only when profiling shows a problem.

## Anti-pattern diagnosis

### `Managers` contains everything

Diagnosis: mixed lifetimes and responsibilities.

Repair:

- Move cross-scene services to `ApplicationRoot`.
- Move match state to `SessionRoot`.
- Move level systems to `SceneContext`.
- Move entity behavior onto entity prefabs.

### Global service holds scene references

Diagnosis: stale references after unload and hidden ownership.

Repair:

- Pass a scene context during scene initialization.
- Clear it before unload.
- Prefer events or interfaces for short interactions.

### Entity parts organized by component type

Diagnosis: ownership is lost.

Repair: keep visuals, colliders, sensors, and effects under their entity prefab.

### Every feature uses a singleton

Diagnosis: convenience has replaced architecture.

Repair: classify lifetime, expose interfaces, inject dependencies, and keep only truly unique application services global.

### Hierarchy refactor is presented as draw-call optimization

Diagnosis: cause and effect are confused.

Repair: profile rendering separately; discuss material, shader, batching, instancing, LOD, and culling conditions.
