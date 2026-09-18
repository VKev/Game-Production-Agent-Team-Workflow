# Unity Architecture and Pattern Catalog

## Table of contents

1. Direct component composition
2. MonoBehaviour shell with plain C# core
3. Feature-oriented modules
4. ScriptableObject-driven architecture
5. Event-driven architecture and Observer
6. MVC and MVP
7. Finite state machines and State
8. Strategy
9. Factory and spawners
10. Command
11. Services, composition roots, and dependency injection
12. Layered, Clean, and ports-and-adapters architecture
13. Data-oriented architecture, Jobs, Burst, and ECS
14. Supporting patterns

## Folder placement rule

Keep every pattern inside the feature or capability that owns it unless it is a genuinely shared application/platform boundary. Do not create project-wide folders named only after patterns by default. Keep small features flat and create `States`, `Strategies`, `Commands`, `Spawning`, `Presentation`, `Domain`, or similar subfolders only when current files establish those boundaries. Read `folder-structures.md` for architecture-specific folder layouts, safe file moves, tests, Editor code, and assembly placement.

## 1. Direct component composition

Use for behavior local to a GameObject, prefab, or tightly owned group.

Prefer:

- Small MonoBehaviours with one coherent responsibility.
- Serialized references for explicit scene/prefab dependencies.
- Direct method calls for clear one-to-one collaboration.
- Prefabs as reusable compositions.

Benefits:

- Easy to inspect and debug.
- Minimal indirection and setup.
- Natural fit for Unity lifecycle and Inspector workflows.

Costs:

- Large components can accumulate unrelated logic.
- Scene references can become fragile if ownership is unclear.

Escalate only when responsibilities, tests, variants, or cross-system dependencies justify another pattern.

**Typical placement:** keep the involved components together in one flat, owning feature or prefab-support folder.

## 2. MonoBehaviour shell with plain C# core

Use when gameplay rules, calculations, simulation, state transitions, or orchestration can be expressed independently from Unity objects.

Structure:

- MonoBehaviour: callbacks, serialized references, Transform/physics access, coroutines, GameObject lifetime.
- Plain C# core: rules, decisions, state, calculations, interfaces that do not require Unity inheritance.
- Adapter: converts Unity data into domain inputs and applies outputs.

Benefits:

- Easier Edit Mode unit tests.
- Clear engine boundary.
- Reuse across scene objects where appropriate.

Costs:

- Additional mapping and lifecycle setup.
- Poor separation can create a fake domain layer that only forwards Unity calls.

Do not extract trivial getters, direct Transform changes, or single callback bodies without a real boundary benefit.

**Typical placement:** keep plain rules and Unity integration under the same feature; split into `Core` and `Unity` only when the boundary contains real code and dependency value.

## 3. Feature-oriented modules

Group code by gameplay capability rather than by generic technical type when it improves locality.

Example:

```text
Features/
  Combat/
    Runtime/
    UI/
    Config/
    Tests/
  Inventory/
    Runtime/
    UI/
    Config/
    Tests/
```

Use when a feature contains multiple related components, rules, configuration, presentation, and tests.

Define:

- Public entry points.
- Internal implementation.
- Dependencies the feature may consume.
- Events or results it exposes.
- Assembly boundaries only when stable and useful.

Avoid generic dumping grounds such as `Managers`, `Helpers`, or `Scripts` when a feature owner is clearer.

Create only the `Runtime`, `Config`/`Definitions`, `Presentation`, `Editor`, or `Tests` branches that current files require.

See `folder-structures.md` for architecture-aligned feature layouts and assembly placement.

## 4. ScriptableObject-driven architecture

Use ScriptableObjects for project assets that centralize shared, designer-authored data independent of GameObject instances.

Good fits:

- Weapon/enemy/item definitions.
- Balance configuration.
- Catalogs and databases of asset references.
- Strategy/configuration assets when behavior is intentionally asset-authored.
- Event channels or runtime sets when scene-independent asset wiring is a deliberate project convention.

Separate:

- Immutable or authoring configuration.
- Mutable runtime instance state.
- Persistent save data.

Risks:

- Accidentally mutating project assets during Play Mode.
- Treating shared assets as per-instance state.
- Hidden global state through asset references.
- Using ScriptableObjects as a universal service container.

Prefer explicit initialization and cloning when runtime mutation must not affect the source asset.

**Typical placement:** keep definition classes under the owning feature's `Definitions` or `Config` area and keep mutable runtime state in `Runtime`; place `.asset` instances according to the project's established content convention.

## 5. Event-driven architecture and Observer

Use when a publisher announces a fact and multiple independent listeners may react.

Choose the narrowest mechanism:

- Direct call: owned one-to-one collaboration.
- C# event/delegate: code-controlled runtime publisher/subscriber.
- UnityEvent: Inspector-configured callback where designer wiring matters.
- ScriptableObject event channel: asset-based cross-scene wiring when project conventions support it.
- Message bus: only for a genuine shared messaging boundary across many modules.

Rules:

- Name events as facts that happened, not commands to unknown listeners.
- Define who may publish.
- Subscribe and unsubscribe symmetrically.
- Avoid anonymous subscriptions that cannot be removed when lifetime matters.
- Decide whether late subscribers need current state; an event is not state storage.
- Avoid events when the caller requires a return value or ordered transaction.

Costs include hidden control flow, listener ordering concerns, duplicate subscriptions, and difficult debugging. Keep communication traceable.

**Typical placement:** keep event contracts beside the publisher or in the owning feature's narrow `Events`/`Contracts` area; avoid one global folder for unrelated events.

## 6. MVC and MVP

Use mainly for nontrivial UI, menus, shops, HUDs, inventory screens, settings, and input views.

### MVP default for classic Unity UI

- Model: state and rules independent from the concrete UI.
- View: displays values and emits user interactions.
- Presenter: coordinates the View and Model/dependencies.

Rules:

- Keep the View passive where practical.
- Do not let the Presenter become a universal gameplay manager.
- Keep subscriptions lifetime-safe.
- Expose semantic View events (`PurchaseRequested`) rather than raw button internals where useful.
- Test Presenter decisions without rendering the real UI when the value justifies it.

Use MVC only when its controller/model/view flow fits an existing project convention. Do not force every MonoBehaviour into an MVC role.

**Typical placement:** organize by feature or screen first; add `Presentation` or `Views` only when several current UI types justify the grouping.

## 7. Finite state machines and State

Use a state model when an actor or system has mutually exclusive behavior modes.

### Simple FSM

Use enum/switch when:

- States are few and stable.
- State behavior is short.
- Transitions are easy to understand in one place.

### State objects

Use State objects when:

- Behavior differs substantially by state.
- Transitions are growing.
- States need independent dependencies or tests.
- Adding a state should not expand one monolithic switch.

Define:

- State ownership.
- Enter/Tick/Exit contract as needed.
- Transition authority.
- Re-entry behavior.
- Invalid transitions.
- Update phase: Update, FixedUpdate, LateUpdate, event-driven, or explicit tick.

Do not use a class per state for a tiny stable toggle.

**Typical placement:** keep simple state logic with its owner; create a feature-local `States` folder only after multiple state classes exist.

## 8. Strategy

Use when a consumer needs interchangeable algorithms with the same responsibility.

Examples:

- Target selection.
- Damage calculation.
- Movement steering.
- Loot selection.
- Weapon firing mode.

Choose implementation form based on needs:

- Plain C# interface/classes for runtime composition and testing.
- ScriptableObject strategies for designer-authored reusable assets.
- Delegates for very small stateless behavior.

Do not create Strategy for one implementation unless a test boundary or imminent GDD-backed variant makes the contract valuable now.

**Typical placement:** place strategies under the capability they vary, such as `Targeting` or `Firing`, rather than a global `Strategies` folder.

## 9. Factory and spawners

Use when creation varies, setup is complex, or callers should not know concrete construction details.

Factory responsibilities may include:

- Selecting a prefab or implementation.
- Instantiating or obtaining from a pool.
- Injecting dependencies/configuration.
- Initializing runtime state.
- Returning a stable interface or handle.

Keep ownership explicit: creation does not automatically imply lifetime ownership.

Use a dedicated spawner when placement, waves, pacing, or spawn policy is part of gameplay. Do not call a trivial wrapper a factory if it adds no selection or setup logic.

**Typical placement:** keep factories and spawners in the owning feature's `Spawning` or creation area.

## 10. Command

Use when actions must be represented as data/objects for:

- Queuing or scheduling.
- Delayed execution.
- Recording/replay.
- Undo/redo.
- Turn-based planning.
- Input buffering.

Define:

- Command payload and validation.
- Execution authority.
- Whether commands are immutable.
- Undo state and failure behavior.
- Allocation/reuse policy for high-frequency commands.

Avoid Command when an immediate direct method call fully solves the problem.

**Typical placement:** keep commands in the feature that validates, queues, or executes them; create `Commands` only when multiple command types exist.

## 11. Services, composition roots, and dependency injection

Use a service for a cohesive capability shared across multiple consumers, such as save storage, audio routing, analytics, platform purchases, or scene loading.

Define a lifetime:

- Application.
- Scene.
- Feature/session.
- Operation/request.

Create and wire services in an explicit composition root, such as a bootstrap scene/object, installer, or feature initializer.

Prefer:

- Constructor injection for plain C# objects.
- Explicit initialization for Unity components.
- Serialized references for scene-local dependencies.
- Narrow interfaces at platform/test boundaries.

Avoid:

- A static service locator that hides dependencies.
- A singleton for every system.
- A dependency-injection framework when manual composition remains clearer.
- Service interfaces with only one implementation and no boundary value.

Use an existing DI framework if the project already depends on it and the task fits its conventions. Do not introduce one incidentally.

**Typical placement:** keep feature-local services with their feature; keep true application/platform services under a documented infrastructure boundary and wire them from an explicit `Bootstrap`/composition root.

## 12. Layered, Clean, and ports-and-adapters architecture

Use when a feature has substantial domain rules that must remain stable while external mechanisms vary.

Possible boundaries:

- Domain: rules and entities without Unity infrastructure knowledge.
- Application/use cases: orchestrates domain operations.
- Ports: narrow contracts required by use cases.
- Adapters/infrastructure: Unity, file storage, network, platform SDK, Addressables.
- Presentation: MonoBehaviours, UI Views, Presenters.

Dependency direction points toward stable rules; adapters implement outward-facing ports.

Use for save/cloud synchronization, economy/transactions, complex inventory rules, platform services, or simulation-heavy systems when isolation has measurable value.

Avoid for ordinary Transform movement, a small weapon, or thin scene interactions. Mapping every Unity type into duplicate domain types can cost more than it returns.

**Typical placement:** use `Domain`, `Application`, `Ports`, `Infrastructure`, and `Presentation` only for layers that contain current responsibilities; do not create empty layers.

## 13. Data-oriented architecture, Jobs, Burst, and ECS

Use only when the workload and project justify it.

Strong signals:

- Many homogeneous entities.
- Repeated data-parallel computation.
- Profiler evidence that main-thread object-oriented processing is a bottleneck.
- Stable data layout and limited managed-object interaction.
- Required packages are installed and compatible.
- Team can maintain the added constraints.

Options:

- Optimize the existing OOP design first.
- Move a bounded calculation to Jobs/Burst and Native Collections.
- Use ECS/DOTS for systems fundamentally suited to entity-component data processing.

Do not convert a feature to ECS merely because it may scale later. Use `dev-unity-jobs-burst-native-collections` for implementation details.

**Typical placement:** keep `Jobs`, native buffers, ECS authoring, components, systems, and the Unity bridge inside the owning feature so the data-oriented boundary remains visible.

## 14. Supporting patterns

### Facade

Expose a small stable API over a complex feature. Use to protect callers from internal structure, not to create a god object.

### Adapter

Translate one interface/data shape into another, especially at Unity, platform, package, or legacy boundaries.

### Repository

Use for a meaningful persistence/query abstraction when save, remote, cache, or test implementations vary. Avoid wrapping an in-memory list without benefit.

### Decorator

Compose optional behavior around a stable capability, such as damage modifiers. Ensure order is defined and debugging remains possible.

### Composite

Represent tree-like behavior or groups uniformly. Useful for goals, conditions, effects, or UI structures when recursive composition is natural.
