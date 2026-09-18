# Unity-Specific Architecture Boundaries

## Table of contents

1. Project and version context
2. MonoBehaviour boundary
3. Plain C# boundary
4. ScriptableObject boundary
5. Prefabs and scenes
6. Data categories and serialization
7. Ownership and lifetimes
8. Communication
9. Assembly definitions
10. Update and physics boundaries
11. Editor and runtime separation
12. Folder and asset movement boundaries

## 1. Project and version context

Before using an API or architecture framework, inspect:

- `ProjectSettings/ProjectVersion.txt`.
- `Packages/manifest.json` and `packages-lock.json`.
- Existing `.asmdef` files.
- Existing bootstrapping, service, event, state, UI, and test conventions.
- Relevant `AGENTS.md` files and GDD sections.
- Existing project-owned roots, feature folders, namespace conventions, special Unity folders, and local folder documentation.

Do not assume a Unity 6 tutorial API is available in Unity 6.3. Preserve project-compatible syntax and packages.

## 2. MonoBehaviour boundary

Keep these Unity-facing concerns in MonoBehaviours or equivalent Unity objects:

- Unity event functions such as `Awake`, `OnEnable`, `Start`, `Update`, `FixedUpdate`, `LateUpdate`, collision/trigger callbacks, and destruction callbacks.
- GameObject/Component lookup and serialized scene references.
- Transform and Rigidbody application.
- Coroutine hosting.
- GameObject activation and lifetime control.
- Scene-bound visual/audio presentation.

Keep a MonoBehaviour thin when its logic can be represented as independently useful rules. Thin does not mean empty forwarding: retain cohesive Unity orchestration where extraction has no value.

## 3. Plain C# boundary

Use plain C# for:

- Deterministic calculations.
- Rules and validation.
- State transitions.
- Use-case orchestration.
- Algorithms independent from Unity object identity.
- Testable domain behavior.

Inject only the capabilities required. Avoid passing a large MonoBehaviour into a core class when a value, delegate, or narrow interface is enough.

Do not mirror every Unity object with a domain object. Create a boundary only when it reduces coupling, supports tests/reuse, or isolates infrastructure.

## 4. ScriptableObject boundary

Use ScriptableObjects as assets for shared data and intentional asset-based architecture.

Good uses:

- Definitions and catalogs.
- Shared balancing/configuration.
- Designer-authored strategies or effects.
- Event channels/runtime sets under an established project convention.

Guardrails:

- Treat source assets as authoring data unless runtime mutation is explicitly designed.
- Avoid storing per-instance actor state in a shared asset.
- Do not use ScriptableObjects as player save files in a deployed build.
- Reset mutable shared runtime assets reliably when domain reload or scene transitions occur.
- Clone assets when an independent runtime instance is required.
- Validate assets and show useful debug state.

## 5. Prefabs and scenes

Use prefabs for reusable object composition. Prefer self-contained prefab functionality with explicit external dependencies.

Use scenes as composition contexts, not as hidden global state containers. For larger projects:

- Separate bootstrap/persistent services from gameplay scenes when justified.
- Define additive scene ownership and unload behavior.
- Avoid relying on scene load order without an explicit bootstrap contract.
- Use prefabs to reduce merge-prone scene content where practical.

## 6. Data categories and serialization

Separate:

1. **Authoring configuration:** values designed in assets/prefabs/scenes.
2. **Runtime state:** mutable values for one play session or entity instance.
3. **Persistent save state:** versioned data written outside project assets.
4. **Presentation state:** UI/animation/view details derived from gameplay state.

Do not use one field for both initial configuration and current runtime state when that destroys the original intent.

Respect Unity serialization constraints. Avoid architecture that depends on unsupported Inspector serialization without an explicit adapter, wrapper, or custom tooling plan.

## 7. Ownership and lifetimes

For every created object, subscription, handle, task, or resource, define:

- Who creates it?
- Who initializes it?
- Who may mutate it?
- Who disables/cancels/releases/destroys it?
- What happens on scene unload, GameObject disable/destroy, application quit, and domain reload?

Prefer owners destroying what they own rather than deep dependencies destroying themselves unexpectedly.

Common lifetimes:

- Application: persistent platform/audio/save service.
- Scene: scene coordinator, scene-specific systems.
- Feature/session: combat encounter, run, match, shop session.
- Entity: weapon, enemy, projectile.
- Operation: load, purchase, request, command.

Do not let an application-lifetime object retain references to destroyed scene objects.

## 8. Communication

Choose by semantics:

- **Direct reference:** clear owner/collaborator relationship.
- **Interface:** consumer needs a narrow capability or replaceable boundary.
- **Event:** publisher announces a fact to zero or more independent listeners.
- **Request/response:** caller needs a result or failure; use a method/async result, not a broadcast.
- **Shared state:** expose state deliberately; do not reconstruct it only from past events.

Make event lifetimes explicit. Subscribe in a phase matching the desired availability and unsubscribe in the symmetrical phase. Guard against duplicate subscriptions.

## 9. Assembly definitions

Use assembly definitions to establish useful compilation and dependency boundaries.

Good boundaries:

- Stable feature modules.
- Runtime versus Editor code.
- Platform-specific adapters.
- Tests.
- Reusable packages.

Rules:

- Keep the dependency graph one-way and acyclic.
- Put interfaces/contracts in the assembly that owns the abstraction.
- Do not create an assembly per script or tiny folder.
- Account for special folders such as `Editor` when an ancestor has an `.asmdef`.
- Use test assemblies and `InternalsVisibleTo` only when justified.
- Preserve existing assembly naming and reference conventions.

## 10. Update and physics boundaries

Architecture must make execution timing clear:

- Use `Update` for frame-based input and non-physics behavior.
- Use `FixedUpdate` or appropriate Rigidbody APIs for physics-step work.
- Use `LateUpdate` for follow-up presentation such as cameras where appropriate.
- Avoid every component polling every frame when events or centralized ticking better fit the workload.
- Do not centralize all updates into one manager without evidence; it can trade visible component behavior for hidden scheduling complexity.

When plain C# logic requires ticking, let a Unity-facing owner call an explicit `Tick`, `FixedTick`, or domain-specific method.

## 11. Editor and runtime separation

Keep `UnityEditor` dependencies out of runtime assemblies. Place editor tooling behind Editor folders/assemblies.

Architect validation and debugging intentionally:

- Custom inspectors or validation methods for authoring errors when beneficial.
- Runtime debug views/logging for state that is otherwise hidden.
- Avoid shipping editor-only helpers in player code.

## 12. Folder and asset movement boundaries

Treat folders as ownership and dependency signals, not decoration. Read `folder-structures.md` before reorganizing architecture-related files.

Rules:

- Preserve the existing project-owned root when it is usable.
- Prefer feature ownership and keep small features flat.
- Add `Runtime`, `Editor`, `Tests`, `Domain`, `Application`, `Infrastructure`, or pattern subfolders only when current files establish those boundaries.
- Keep Unity special-folder semantics intentional; do not use `Resources`, `StreamingAssets`, `Plugins`, or `Editor` as generic organization names.
- Preserve `.meta` files and GUIDs when moving scripts, prefabs, scenes, ScriptableObjects, and other assets.
- Check namespace and `.asmdef` changes rather than assuming folder moves are behavior-neutral.
- Verify serialized references, custom editors, reflection strings, resource paths, and package/platform constraints after moves.
- Avoid broad folder migrations while delivering a narrow feature.
- Update root and local `AGENTS.md` tables of contents through `dev-unity-project-context` after project-owned folder or important-file changes.
