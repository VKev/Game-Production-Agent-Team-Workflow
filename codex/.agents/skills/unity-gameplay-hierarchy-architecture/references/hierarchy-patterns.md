# Gameplay Hierarchy Patterns

## Contents

- Default application and gameplay structure
- Session lifetime pattern
- Additive scene pattern
- World streaming pattern
- Player and enemy prefab patterns
- Runtime objects and pooling
- Camera, audio, and VFX ownership
- Networked gameplay considerations
- Naming conventions
- Patterns to avoid

## Default application and gameplay structure

Use one intentional bootstrap path for systems that must survive scene changes.

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

### What it represents

`ApplicationRoot` owns services whose lifetime is the entire process or application session.

### Why it helps

- Prevent duplicate global services in individual gameplay scenes.
- Make startup order and persistent ownership visible.
- Give scene loading and shutdown one composition boundary.
- Reduce stale cross-scene references by keeping scene-owned systems elsewhere.

### Rules

- Include only services that genuinely survive scene replacement.
- Prefer pure C# objects for logic that does not require a Unity component lifecycle.
- Keep platform SDK bridges, audio devices, save access, and scene loading behind interfaces where practical.
- Do not parent current-level objects below this root.

Use a separate gameplay scene structure:

```text
GameplayScene
|-- SceneContext
|   |-- LevelController
|   |-- SpawnDirector
|   |-- ObjectiveController
|   `-- SceneReferences
|-- World
|   |-- Environment
|   |   |-- StaticGeometry
|   |   |-- DynamicProps
|   |   `-- Interactables
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

### What it represents

The scene is divided by ownership and creation mode rather than by arbitrary component type.

### Why it helps

- Level-authored content remains separate from spawned runtime content.
- Scene-local logic unloads with the scene.
- Designers can find navigation, spawn points, triggers, and environment content quickly.
- Profilers and runtime debugging become easier because actors and transient objects are visible in predictable locations.

## Session lifetime pattern

Use a session root when data survives several levels or rounds but should reset when the run, match, or lobby ends.

```text
SessionScene
`-- SessionRoot
    |-- MatchFlow
    |-- TeamState
    |-- ScoreState
    |-- NetworkSession
    |-- SessionInventory
    `-- SessionTelemetry
```

### Suitable examples

- Roguelike run state across multiple rooms.
- Multiplayer match state while arenas change.
- Campaign mission state across additive level sections.
- A lobby-to-match flow that keeps a network session alive.

### Avoid

Do not promote a scene-local system to application lifetime merely because several scenes need it. Give it session lifetime instead.

## Additive scene pattern

Separate stable systems from replaceable content when additive loading improves authoring or unloading.

```text
BootstrapScene
`-- ApplicationRoot

GameplayCoreScene
|-- SessionRoot
|-- SceneContext
|-- Players
|-- Cameras
`-- SharedRuntimeObjects

EnvironmentScene
|-- Environment
|-- Navigation
|-- Lighting
|-- ReflectionProbes
`-- SceneAudio

EncounterScene
|-- SpawnPoints
|-- EncounterTriggers
|-- EncounterControllers
`-- AuthoredEnemies
```

### Benefits

- Teams can edit different scenes with fewer merge conflicts.
- Environment, lighting, encounters, and gameplay core can load or unload independently.
- Large worlds can stream content by region.
- Ownership and unload rules become explicit.

### Required discipline

- Define which scene owns each root.
- Do not rely on whichever scene happens to be active without documenting the rule.
- Resolve cross-scene references through a composition step, registry, or stable interface.
- Clean up subscriptions and references before unloading a scene.
- Decide where newly instantiated objects should belong.

## World streaming pattern

For streamed regions, treat each region as an unloadable ownership boundary.

```text
WorldRuntime
|-- SharedWorldSystems
|   |-- TimeOfDay
|   |-- Weather
|   `-- WorldState
|-- LoadedRegions
|   |-- ForestRegion
|   |-- VillageRegion
|   `-- DungeonEntranceRegion
`-- GlobalRuntimeObjects
    |-- Players
    |-- PersistentCompanions
    `-- CrossRegionEffects
```

Inside a region scene:

```text
RegionRoot
|-- StaticEnvironment
|-- DynamicProps
|-- Navigation
|-- RegionTriggers
|-- RegionSpawners
|-- RegionAudio
`-- RegionReferences
```

### Benefits

- Unloading a region removes all region-owned objects together.
- Persistent actors remain independent from streamed world content.
- Region-specific pools, audio, and AI can be released intentionally.

### Risks

- Persistent actors must not retain direct references to unloaded region objects.
- A cross-region quest or save system should store stable identifiers or data, not scene object references.
- Reparenting an object between regions changes ownership and must be explicit.

## Player prefab pattern

```text
Player
|-- Visuals
|   |-- CharacterModel
|   |-- Animator
|   `-- EquipmentVisuals
|-- Collision
|   |-- BodyCollider
|   |-- HurtBoxes
|   `-- InteractionCollider
|-- Sensors
|   |-- GroundCheck
|   |-- TargetSensor
|   `-- InteractionSensor
|-- AttachmentPoints
|   |-- MainHandSocket
|   |-- OffHandSocket
|   |-- EffectSocket
|   `-- CameraTarget
|-- LocalAudio
`-- LocalEffects
```

Place identity and coordinating components on `Player`, for example:

```text
PlayerController
PlayerMovement
PlayerHealth
PlayerAbilities
PlayerInventoryBridge
TeamMember
```

### Benefits

- Replace visuals without changing movement or health logic.
- Keep colliders and sensors discoverable.
- Give weapons, effects, and cameras stable attachment points.
- Make the prefab testable outside the complete game scene.

### Rules

- Keep imported rig and bone structure under `Visuals`.
- Do not attach global services to the player.
- Put a component on a child only when the child has an independent transform, collider, renderer, or lifecycle reason.

## Enemy prefab pattern

```text
Enemy
|-- Visuals
|-- Collision
|-- Sensors
|-- NavigationAgent
|-- AttachmentPoints
|-- LocalAudio
`-- LocalEffects
```

The exact objects depend on the game. `NavigationAgent` may be a component on the root rather than a child.

### Benefits

- Each enemy is a self-contained entity rather than a record controlled by one giant `EnemyManager`.
- Spawn systems coordinate creation and encounter rules without owning every behavior.
- Enemy variants can use prefab variants and composition.

### Coordination boundary

An encounter or spawn director may decide when and where enemies appear. The enemy prefab should still own movement, health, combat, perception, and local presentation unless the game architecture has a specific data-oriented alternative.

## Runtime objects and pooling

Use a visible runtime boundary:

```text
RuntimeObjects
|-- Projectiles
|-- Pickups
|-- Effects
|-- Decals
`-- PooledObjects
```

A pool service can keep inactive instances below a collapsed pool root:

```text
PooledObjects
|-- ProjectilePool
|-- ImpactEffectPool
|-- DamageIndicatorPool
`-- PickupPool
```

### Benefits

- Detect runaway spawning and leaks in the Hierarchy.
- Reset transient state independently from authored level content.
- Avoid repeated allocation and destruction for frequently reused objects.
- Make pool ownership and cleanup visible.

### Rules

- Reset all mutable state when renting and returning an object.
- Decide whether pools are application, session, or scene owned.
- Do not keep scene-specific assets in an application pool after the scene unloads unless the asset lifetime is deliberately retained.
- Avoid thousands of expanded inactive children in normal editor workflows; provide debug tooling or collapsed roots.

## Camera, audio, and VFX ownership

### Cameras

Use `Cameras` for scene camera rigs and virtual cameras. Put a camera target under an actor only when it must follow that actor transform.

```text
Cameras
|-- GameplayCameraRig
|-- CinematicCameras
|-- CameraBounds
`-- CameraEffects
```

Application-wide capture or platform camera services may belong under `ApplicationRoot`; normal gameplay cameras usually do not.

### Audio

Separate global audio services from scene audio emitters.

```text
ApplicationRoot
`-- Audio

GameplayScene
`-- SceneAudio
    |-- Ambience
    |-- MusicZones
    |-- ReverbZones
    `-- AuthoredEmitters
```

### VFX

Place entity-owned effects under the entity only when they follow and share its lifetime. Put independent impacts, trails, explosions, and world effects under `RuntimeObjects/Effects` or an appropriate pool.

## Networked gameplay considerations

Network ownership can be distinct from transform parentage.

```text
NetworkSession
|-- ConnectionState
|-- ReplicationServices
`-- NetworkDiagnostics

Actors
|-- LocalPlayers
|-- RemotePlayers
`-- NetworkedNPCs
```

### Rules

- Do not use hierarchy location alone to infer authority.
- Keep server-authoritative state, client presentation, and local input responsibilities explicit in components or modules.
- Avoid parenting networked objects merely to categorize them if the networking solution treats parent changes as replicated state.
- Document which scene or session owns spawned network objects and who despawns them.

## Naming conventions

Use readable nouns that explain responsibility:

- `ApplicationRoot`
- `SessionRoot`
- `SceneContext`
- `World`
- `Environment`
- `Actors`
- `RuntimeObjects`
- `AttachmentPoints`
- `SceneAudio`
- `DebugTools`

Use plural names for collections and singular names for one concrete instance.

Avoid:

- Numeric prefixes or sorting IDs.
- `Root` below every object without a purpose.
- Generic chains such as `Root/Main/Content/Object`.
- One large `Managers` group for unrelated lifetimes.
- Names that encode an implementation detail likely to change.

## Patterns to avoid

### The giant manager bucket

```text
Managers
|-- GameManager
|-- PlayerManager
|-- EnemyManager
|-- LevelManager
|-- AudioManager
|-- DataManager
`-- EffectManager
```

This hides lifetime and responsibility. Replace it with application, session, scene, and entity ownership.

### Persistent contamination

```text
PersistentRoot
|-- Save
|-- Audio
`-- CurrentLevelBoss
```

The boss now shares persistent lifetime accidentally. Keep scene actors in their scene.

### Category without behavior ownership

```text
AllColliders
AllRenderers
AllScripts
```

This separates entity parts from their owner and makes prefabs difficult to reason about.

### Transform-only organization that changes behavior

Do not parent unrelated actors under a moving or scaled object simply to make the Hierarchy tidy. They will inherit transform changes and may cause unnecessary descendant transform updates.
