# Architecture Folder Structures

## Table of contents

1. Selection principles
2. Folder-selection workflow
3. Shared folder and assembly rules
4. Direct component composition
5. Feature-oriented module
6. MonoBehaviour shell with plain C# core
7. ScriptableObject-driven feature
8. Event-driven feature
9. MVP UI feature
10. State machine feature
11. Strategy, Factory, and Command placement
12. Shared service and composition root
13. Layered, Clean, and ports-and-adapters feature
14. Jobs, Burst, and Native Collections subsystem
15. Reusable Unity package
16. Combined feature example
17. Migration and maintenance rules

## 1. Selection principles

Treat folder structure as part of the architecture decision. A folder tree should make ownership, dependency direction, Unity boundaries, and test boundaries easier to understand.

Always prefer the project's existing project-owned root and naming convention. The examples below use placeholders such as `<ProjectRoot>`, `<FeatureName>`, and `<Company>`; do not create a new top-level convention merely to match an example.

Create only folders that contain real files required by the current task. Do not create empty `Domain`, `Services`, `Factories`, `Interfaces`, `Repositories`, `Tests`, or `Editor` folders for anticipated work.

A good folder structure should answer:

- Which feature owns this file?
- Is the file runtime, Editor-only, test-only, authoring data, presentation, or infrastructure?
- Which assembly may reference which other assembly?
- Which files can change together for the same reason?
- Which Unity assets belong to the feature?

## 2. Folder-selection workflow

1. Read the root and relevant local `AGENTS.md` files.
2. Locate the existing project-owned source root, such as `Assets/Game`, `Assets/_Project`, `Assets/Scripts`, or a package under `Packages/`.
3. Locate the closest existing feature with similar responsibilities.
4. Reuse its layout when it remains suitable.
5. Select the architecture before selecting folders.
6. Choose the smallest template below that expresses the selected boundaries.
7. Materialize only folders needed by files created or moved in the current task.
8. Add or change `.asmdef` files only when a stable dependency, compile, Editor/runtime, platform, package, or test boundary justifies them.
9. Keep namespaces aligned with established project conventions; do not mechanically mirror every folder level.
10. Use `dev-unity-project-context` to refresh the applicable managed maps after creating, moving, renaming, or deleting folders; never edit generated rows manually.

## 3. Shared folder and assembly rules

### Prefer feature ownership over generic buckets

For a growing project, prefer:

```text
<ProjectRoot>/
  Features/
    Combat/
    Inventory/
    Shop/
```

rather than placing all unrelated files into global buckets such as:

```text
Scripts/
  Managers/
  Controllers/
  Helpers/
  Data/
```

Use technical buckets only when the project is small, the convention already exists, or the files genuinely form a shared technical module.

### Separate by deployment boundary when it matters

Common optional boundaries are:

```text
Runtime/        Player-build code
Editor/         UnityEditor-only tooling
Tests/          Edit Mode and Play Mode tests
Samples~/       Package samples
Documentation~/ Package documentation
```

Do not create these folders when the feature has no corresponding files.

### Keep Unity assets close to their owner

A feature may own code and assets together:

```text
<FeatureName>/
  Runtime/
  Prefabs/
  Data/
  UI/
  Tests/
```

Alternatively, an existing project may separate all code from all art/assets. Follow that convention unless there is a concrete reason to change it.

### Use `.asmdef` intentionally

For detailed graph design, incremental migration, `.asmref` ownership, Editor/test boundaries, and exact Inspector settings, use `dev-unity-assembly-definitions`. This section remains the folder-architecture overview.

Introduce an assembly definition when it creates a useful boundary, such as:

- Runtime versus Editor code.
- A reusable feature or package.
- A platform adapter.
- A test assembly.
- A stable feature dependency boundary that reduces recompilation or prevents accidental references.

Avoid one assembly per script, state, small folder, or prefab. Keep the assembly dependency graph one-way and acyclic.

## 4. Direct component composition

Use for a small, local feature owned by one GameObject or prefab.

Minimal structure:

```text
<ProjectRoot>/
  Features/
    Door/
      DoorController.cs
      DoorInteraction.cs
      Door.prefab
```

Add subfolders only after the feature contains enough files to benefit:

```text
Door/
  Runtime/
    DoorController.cs
    DoorInteraction.cs
  Prefabs/
    Door.prefab
  Tests/
    PlayMode/
      DoorInteractionTests.cs
```

Do not add `Interfaces`, `Services`, `Factories`, or `Domain` for a simple owned interaction.

## 5. Feature-oriented module

Use when one gameplay capability contains several cooperating responsibilities and should remain locally understandable.

Minimal scalable structure:

```text
<ProjectRoot>/
  Features/
    <FeatureName>/
      Runtime/
        <feature runtime code>
      Data/
        <authoring assets or definitions>
      Prefabs/
        <feature prefabs>
      Tests/
        EditMode/
        PlayMode/
```

Expand `Runtime` by responsibility only when needed:

```text
<FeatureName>/
  Runtime/
    Core/          Rules and feature-owned models
    Unity/         MonoBehaviours and Unity adapters
    Presentation/  Views, presenters, animation/audio adapters
    Public/        Optional narrow public contracts or facade
    Internal/      Optional implementation hidden behind the public surface
  Data/
  Prefabs/
  Tests/
```

Do not create `Public` and `Internal` unless the feature has a real module boundary. An `.asmdef` may sit in `Runtime/` when the feature is sufficiently stable and reusable.

## 6. MonoBehaviour shell with plain C# core

Use when gameplay rules are meaningful without scene objects and benefit from isolation or Edit Mode tests.

```text
<FeatureName>/
  Runtime/
    Core/
      <rules, state, calculations, value types>
    Unity/
      <MonoBehaviour shells, adapters, scene integration>
  Tests/
    EditMode/
      <Core tests>
    PlayMode/
      <Unity integration tests>
```

Example:

```text
Combat/
  Runtime/
    Core/
      DamageCalculator.cs
      DamageResult.cs
      DamageRules.cs
    Unity/
      DamageReceiver.cs
      Hitbox.cs
      CombatController.cs
  Tests/
    EditMode/
      DamageCalculatorTests.cs
    PlayMode/
      DamageReceiverTests.cs
```

Keep configuration either beside the layer that owns it or in a `Data`/`Config` folder when multiple files justify that folder. Do not create a plain C# mirror for every Unity component.

## 7. ScriptableObject-driven feature

Use for shared designer-authored definitions, catalogs, configuration, or intentional asset-authored strategies.

```text
<FeatureName>/
  Runtime/
    Definitions/
      <ScriptableObject types and immutable definition contracts>
    RuntimeState/
      <per-instance mutable state when needed>
    Unity/
      <consumers and adapters>
  Data/
    <created .asset files>
  Editor/
    <inspectors, validators, creation tools when needed>
  Tests/
```

Example:

```text
Weapons/
  Runtime/
    Definitions/
      WeaponDefinition.cs
      WeaponCatalog.cs
    RuntimeState/
      WeaponInstance.cs
    Unity/
      WeaponController.cs
  Data/
    Definitions/
      Rifle.asset
      Shotgun.asset
```

Keep source `.asset` files separate from mutable runtime state and persistent save data. Do not add a universal `ScriptableObjects` folder that mixes unrelated features unless that is the established project convention.

## 8. Event-driven feature

Events are communication mechanisms, not necessarily a top-level architecture folder.

Prefer keeping event contracts with the feature that owns the fact:

```text
Combat/
  Runtime/
    Events/
      ShotFired.cs
      DamageApplied.cs
    Unity/
    Core/
```

For C# events declared directly on a publisher, keep them in the publisher file unless separate event payload types have independent value.

For established ScriptableObject event channels:

```text
Shared/
  Events/
    Runtime/
      GameEvent.cs
      GameEventListener.cs
    Data/
      PlayerDied.asset
```

Create a shared event module only when multiple features intentionally depend on the same communication boundary. Do not create a global `Events` dumping ground for every local callback.

## 9. MVP UI feature

Use for a nontrivial screen or HUD that benefits from separating view rendering/input from coordination and rules.

```text
<FeatureName>/
  Runtime/
    Model/
      <screen state or feature-facing model contracts>
    Presentation/
      <View and Presenter types>
    Application/
      <use cases or coordination operations when nontrivial>
  UI/
    Prefabs/
    Sprites/
  Tests/
    EditMode/
      <Presenter and use-case tests>
    PlayMode/
      <View wiring tests when valuable>
```

Example:

```text
Shop/
  Runtime/
    Model/
      ShopState.cs
      PurchaseResult.cs
    Application/
      PurchaseGun.cs
    Presentation/
      GunShopView.cs
      GunShopPresenter.cs
      GunButtonView.cs
  UI/
    Prefabs/
      GunShopPanel.prefab
  Tests/
    EditMode/
      GunShopPresenterTests.cs
```

For a small panel, keep `View`, `Presenter`, and supporting files directly under the feature instead of creating empty architectural layers.

## 10. State machine feature

### Small enum/switch FSM

Keep the state definition with the owner:

```text
ZombieAI/
  Runtime/
    ZombieController.cs
    ZombieState.cs
```

### State objects

Use separate folders when states have substantial behavior:

```text
ZombieAI/
  Runtime/
    StateMachine/
      IState.cs
      StateMachine.cs
      StateTransition.cs
    States/
      PatrolState.cs
      ChaseState.cs
      AttackState.cs
      DeadState.cs
    Unity/
      ZombieController.cs
      ZombieSensors.cs
    Strategies/
      <targeting or movement policies only when real variants exist>
  Tests/
    EditMode/
      StateMachineTests.cs
    PlayMode/
      ZombieStateIntegrationTests.cs
```

Keep state-specific helpers beside their state when private to it. Do not create one folder per state unless each state owns several files.

## 11. Strategy, Factory, and Command placement

These patterns usually belong inside the feature that owns them.

```text
Weapons/
  Runtime/
    Strategies/
      IFiringStrategy.cs
      HitscanFiringStrategy.cs
      ProjectileFiringStrategy.cs
    Creation/
      WeaponFactory.cs
    Commands/
      ReloadCommand.cs
```

Use names based on domain responsibility when clearer than pattern names:

```text
Weapons/
  Runtime/
    Firing/
    Spawning/
    Reloading/
```

Prefer domain folders over generic `Patterns/`, `Factories/`, or `Commands/` roots shared by unrelated features.

## 12. Shared service and composition root

Use for a genuinely shared, long-lived capability with an explicit lifetime.

```text
<ProjectRoot>/
  Infrastructure/
    Audio/
      Runtime/
        IAudioService.cs
        AudioService.cs
        UnityAudioBackend.cs
      Data/
        AudioCatalog.asset
    Save/
      Runtime/
        ISaveStorage.cs
        LocalSaveStorage.cs
  Bootstrap/
    Runtime/
      GameBootstrap.cs
      ServiceCompositionRoot.cs
```

For scene-scoped services, keep the composition root with the scene or feature that owns the lifetime:

```text
Scenes/
  Gameplay/
    Runtime/
      GameplayCompositionRoot.cs
```

Do not create a global `Services` folder for feature-local collaborators. Put abstractions with the layer that owns the requirement, not automatically with the implementation.

## 13. Layered, Clean, and ports-and-adapters feature

Use only for a feature with meaningful domain rules and replaceable external mechanisms.

```text
<FeatureName>/
  Runtime/
    Domain/
      <entities, value objects, domain rules>
    Application/
      <use cases and orchestration>
    Ports/
      <contracts required by Application/Domain>
    Infrastructure/
      <file, network, SDK, Addressables, platform adapters>
    Presentation/
      <MonoBehaviours, Views, Presenters>
    Composition/
      <feature wiring and initialization>
  Tests/
    EditMode/
      Domain/
      Application/
    PlayMode/
      Infrastructure/
      Presentation/
```

Example:

```text
SaveGame/
  Runtime/
    Domain/
      SaveSnapshot.cs
      SaveVersion.cs
    Application/
      SaveGame.cs
      LoadGame.cs
    Ports/
      ISaveStorage.cs
      IClock.cs
    Infrastructure/
      LocalFileSaveStorage.cs
      CloudSaveStorageAdapter.cs
    Composition/
      SaveGameInstaller.cs
  Tests/
    EditMode/
      SaveGameTests.cs
```

Assembly boundaries may follow stable layers, but do not create an `.asmdef` for every folder by default. Dependency direction should point toward `Domain`/`Application`; `Infrastructure` and `Presentation` implement outward-facing ports.

## 14. Jobs, Burst, and Native Collections subsystem

Keep data-oriented execution as a bounded subsystem unless the project is intentionally ECS-first.

```text
<FeatureName>/
  Runtime/
    Managed/
      <main-thread owners and gather/scatter adapters>
    Jobs/
      <IJob, IJobFor, IJobParallelFor implementations>
    NativeData/
      <native layouts, handles, buffers, ownership helpers>
    Unity/
      <MonoBehaviour integration and result application>
  Tests/
    EditMode/
      <deterministic calculation and job tests>
  Benchmarks/
      <only when the project has an established benchmark workflow>
```

Do not mix `UnityEngine.Object` ownership into worker-job folders. Use `dev-unity-jobs-burst-native-collections` for implementation and safety details.

## 15. Reusable Unity package

Use a package only when the module is meant to be versioned or reused independently.

```text
Packages/
  com.<company>.<feature>/
    package.json
    Runtime/
      <Company>.<Feature>.asmdef
    Editor/
      <Company>.<Feature>.Editor.asmdef
    Tests/
      Runtime/
      Editor/
    Samples~/
    Documentation~/
    CHANGELOG.md
    README.md
```

Do not move a project-local feature into `Packages/` merely for visual cleanliness.

## 16. Combined feature example

A weapon feature may combine feature modules, ScriptableObject configuration, plain C# rules, Unity adapters, strategies, events, and pooling without creating a separate top-level architecture for each pattern:

```text
Weapons/
  Runtime/
    Core/
      WeaponRuntimeState.cs
      DamageCalculator.cs
    Definitions/
      WeaponDefinition.cs
      WeaponCatalog.cs
    Firing/
      IFiringStrategy.cs
      HitscanFiringStrategy.cs
      ProjectileFiringStrategy.cs
    Unity/
      WeaponController.cs
      WeaponInputAdapter.cs
      WeaponAnimatorAdapter.cs
    Events/
      ShotFiredEvent.cs
  Data/
    Weapons/
      Rifle.asset
      Shotgun.asset
  Prefabs/
    Rifle.prefab
    Shotgun.prefab
  Tests/
    EditMode/
      DamageCalculatorTests.cs
    PlayMode/
      WeaponControllerTests.cs
```

This structure is valid only when the current implementation contains these responsibilities. For one simple gun, start flatter and split when the separation improves understanding.

## 17. Migration and maintenance rules

When changing an existing project structure:

- Move the smallest coherent set of files needed for the task.
- Preserve `.meta` files when moving Unity assets outside the Unity Editor.
- Update namespaces only when the project convention requires namespace-folder alignment.
- Update assembly references and test assemblies after moving scripts across `.asmdef` boundaries.
- Check serialized type names, custom editor targets, reflection strings, Resources paths, Addressables entries, and code-generated references.
- Let Unity reimport and compile before continuing.
- Verify prefabs, scenes, ScriptableObject assets, and tests after moves.
- Avoid combining a broad folder migration with unrelated feature implementation.
- Refresh root and local managed maps through `dev-unity-project-context`; do not hand-edit generated tables of contents.

Record the selected layout in the architecture decision:

```text
Project-owned root:
Selected folder structure:
Files/folders created now:
Optional folders intentionally deferred:
Assembly boundaries:
Dependency direction:
Managed context refresh required:
```
