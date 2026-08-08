# Architecture Selection Examples

## Table of contents

1. Small interactable
2. Weapon and combat feature
3. Shop UI
4. Zombie AI
5. Save and cloud storage
6. Cross-scene audio
7. High-volume projectiles
8. Inventory and item effects

Use `<game-root>` to mean the project's existing code root. Adapt names to the existing project and create only folders/files needed by the current implementation.

## 1. Small interactable

**Task:** A door opens when the player presses interact.

**Select:**

- Direct component composition.
- Serialized reference to the Animator or door mechanism.
- One small state flag if needed.

**Possible folder structure:**

```text
<game-root>/Features/Doors/
  DoorController.cs
  DoorInteractable.cs
```

Keep the folder flat. Do not create architecture-layer or pattern folders for two local components.

**Reject:**

- Global event bus.
- Factory.
- Service layer.
- State class hierarchy for open/closed unless transitions become complex.

## 2. Weapon and combat feature

**Task:** Implement multiple guns with shared firing flow, configurable stats, damage, effects, and later variants listed in the GDD.

**Possible selection:**

- Feature-oriented `Combat`/`Weapons` module.
- ScriptableObject weapon definitions for shared authoring data.
- MonoBehaviour weapon adapter for input, Animator, muzzle, physics, and Unity lifecycle.
- Plain C# damage/fire rules if they are testable and nontrivial.
- Strategy only for actual firing/damage variants.
- Events for facts such as `ShotFired` when multiple independent effects react.
- Factory/spawner if construction/setup varies.
- Object pooling through the dedicated pooling skill for projectiles/effects.

**Possible folder structure:**

```text
<game-root>/Features/Combat/
  Runtime/
    Damage/
      DamageCalculator.cs
      DamageResult.cs
    Weapons/
      WeaponController.cs
      WeaponRuntimeState.cs
      Firing/
        IFiringMode.cs
        HitscanFiringMode.cs
  Definitions/
    WeaponDefinition.cs
    WeaponCatalog.cs
  Presentation/
    WeaponView.cs
  Tests/
```

Omit `Firing`, `Presentation`, or `Tests` until current files need them. Keep projectile pooling under the Combat/Projectiles area or the existing owning module rather than a global pool folder.

**Do not:** prebuild every future weapon variant or create empty folders for them. Define only the contract/seam required by current behavior and known GDD direction.

## 3. Shop UI

**Task:** Display guns, purchase one, update coins, and show locked/unlocked state.

**Possible selection:**

- MVP for the nontrivial screen.
- View emits semantic purchase/select events and renders state.
- Presenter coordinates the View and shop/economy capability.
- Model/service owns purchase validation and coin mutation.
- ScriptableObject catalog stores authoring definitions, not mutable purchased state unless intentionally separated.
- Direct dependency from Presenter to a narrow shop interface; no global bus required.

**Possible folder structure for a modest screen:**

```text
<game-root>/Features/Shop/
  Runtime/
    ShopService.cs
    ShopPresenter.cs
    ShopView.cs
    GunButtonView.cs
  Tests/
    ShopPresenterTests.cs
```

**Possible structure after presentation grows:**

```text
<game-root>/Features/Shop/
  Runtime/
    Application/
      ShopService.cs
    Presentation/
      ShopPresenter.cs
      Views/
        ShopView.cs
        GunButtonView.cs
```

Do not create separate `Model`, `View`, and `Presenter` folders while each would contain one file.

**Reject:** one Presenter per button unless buttons have independent logic that earns the extra type.

## 4. Zombie AI

**Task:** Patrol, chase, attack, stagger, and die.

**Select based on complexity:**

- A small enum/switch if behavior and transitions remain compact.
- State objects when each state has substantial entry/tick/exit logic or dependencies.
- Strategy for target selection, attack selection, or navigation policy when variants exist.
- MonoBehaviour adapter for NavMeshAgent, Animator, sensing, and lifecycle.
- Plain C# transition/rule logic where test value is meaningful.

**Possible folder structure for a simple FSM:**

```text
<game-root>/Features/Zombies/
  Runtime/
    ZombieController.cs
    ZombieStateMachine.cs
```

**Possible folder structure after states become substantial:**

```text
<game-root>/Features/Zombies/
  Runtime/
    AI/
      ZombieBrain.cs
      States/
        PatrolState.cs
        ChaseState.cs
        AttackState.cs
      Targeting/
        ITargetSelection.cs
        NearestTargetSelection.cs
    Unity/
      ZombieAgentAdapter.cs
      ZombieAnimationView.cs
```

Do not create `States` or `Targeting` until multiple current files justify them.

**Avoid:** one global AI manager owning all per-zombie state unless profiling or coordination requirements justify it.

## 5. Save and cloud storage

**Task:** Save progress locally now and support cloud storage later.

**Possible selection:**

- Application/use-case layer for save/load orchestration.
- Versioned save DTOs independent from ScriptableObject assets.
- Narrow storage port (`ISaveStorage`) because two real adapters are planned: local and cloud.
- Local file adapter now; leave a verified extension seam for cloud without implementing it.
- Explicit service lifetime and failure results.

**Possible folder structure now:**

```text
<game-root>/Features/Save/
  Domain/
    SaveGame.cs
    SaveVersion.cs
  Application/
    SaveGameUseCase.cs
    LoadGameUseCase.cs
    Ports/
      ISaveStorage.cs
  Infrastructure/
    LocalFileSaveStorage.cs
  Tests/
```

Add `CloudSaveStorage.cs` to `Infrastructure` only when that adapter is implemented. Do not create an empty `Cloud` folder merely because cloud support is planned.

**Reject:** using ScriptableObject assets as deployed player save state.

## 6. Cross-scene audio

**Task:** Music and SFX survive scene changes and are used by many features.

**Possible selection:**

- Application-lifetime audio service.
- Explicit bootstrap/composition root.
- Persistent Unity-facing host where required.
- Narrow commands such as play/stop/set volume.
- ScriptableObject audio definitions if designer-authored catalogs are useful.

**Possible folder structure:**

```text
<game-root>/
  Bootstrap/
    GameBootstrap.cs
  Infrastructure/
    Audio/
      AudioService.cs
      AudioServiceHost.cs
      AudioDefinition.cs
```

If audio is treated as a first-class gameplay feature by the existing project, place it under `Features/Audio` and keep only application composition in `Bootstrap`.

**Avoid:** allowing every scene object to find an unverified singleton at arbitrary times. Define initialization and shutdown.

## 7. High-volume projectiles

**Task:** Hundreds or thousands of projectiles cause frame spikes.

**Selection sequence:**

1. Preserve current architecture and profile.
2. Remove avoidable allocations and expensive queries.
3. Apply object pooling and non-allocating APIs where measured.
4. Separate bounded calculations into Jobs/Burst if data-parallel and justified.
5. Consider ECS only if the scale and project maintenance model warrant it.

**Initial folder structure:**

```text
<game-root>/Features/Combat/Projectiles/
  ProjectileController.cs
  ProjectilePool.cs
```

**Possible structure after a measured Jobs/Burst boundary is added:**

```text
<game-root>/Features/Combat/Projectiles/
  Runtime/
    ProjectileController.cs
    ProjectilePool.cs
    Jobs/
      IntegrateProjectilesJob.cs
    Native/
      ProjectileNativeBuffers.cs
```

**Possible ECS structure only after an intentional migration:**

```text
<game-root>/Features/Combat/Projectiles/
  Authoring/
  Components/
  Systems/
  Presentation/
```

Create only folders containing actual types. Do not jump directly from ordinary MonoBehaviours to ECS without evidence.

## 8. Inventory and item effects

**Task:** Items have shared data and different effects.

**Possible selection:**

- ScriptableObject item definitions/catalog.
- Runtime inventory entries separate from definitions.
- Strategy or command-like effect objects only for actual effect variation.
- Feature module containing inventory rules, presentation adapters, and persistence mapping.
- Events for independent UI/achievement reactions to inventory changes.

**Possible folder structure:**

```text
<game-root>/Features/Inventory/
  Runtime/
    Inventory.cs
    InventoryEntry.cs
    Effects/
      IItemEffect.cs
      HealItemEffect.cs
  Definitions/
    ItemDefinition.cs
    ItemCatalog.cs
  Presentation/
    InventoryPresenter.cs
    InventoryView.cs
  Persistence/
    InventorySaveMapper.cs
  Tests/
```

Omit `Effects`, `Presentation`, `Persistence`, or `Tests` until the current implementation contains those responsibilities.

**Avoid:** storing mutable quantity directly on a shared item definition asset.
