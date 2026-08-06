# Unity-Specific Guidance

## Contents

1. Responsibility boundaries
2. Serialization and Inspector compatibility
3. Lifecycle and ownership
4. Dependencies and scene composition
5. Events and communication
6. Update loops and hot paths
7. Static state and services
8. Debuggability and testing

## 1. Responsibility Boundaries

Choose the Unity construct that matches the responsibility.

| Construct | Prefer for | Avoid as default for |
|---|---|---|
| `MonoBehaviour` | Engine callbacks, component references, scene/prefab integration, `GameObject` lifetime | Large independent gameplay rule sets |
| Plain C# class/struct | Pure rules, simulation, calculations, testable policies, domain values | Direct Inspector authoring or unrestricted Unity API access |
| `ScriptableObject` | Shared designer-authored configuration, project assets, selected event or registry patterns | Player save data or every runtime service/state |
| Prefab | Reusable `GameObject` composition and authored defaults | Global mutable configuration |
| Scene | Composition, environment, scoped ownership | Hidden service locator |
| Service | Explicit shared capability with defined lifetime | Generic replacement for every component |

Keep logic in a `MonoBehaviour` when extraction would only create forwarding wrappers. Extract plain C# logic when it creates a clearer responsibility, independent test boundary, reusable policy, or separation from scene lifetime.

## 2. Serialization and Inspector Compatibility

Unity serializes fields under its own rules. Treat serialized data as a compatibility surface.

- Prefer `[SerializeField] private` for Inspector-assigned dependencies and authored values unless the project style differs.
- Do not change a serialized field name casually. Use `UnityEngine.Serialization.FormerlySerializedAsAttribute` when a rename must preserve existing scenes and prefabs.
- Verify prefab overrides and scene references after moving fields or components.
- Do not replace a serializable field with an unsupported type without a migration plan.
- Distinguish authored configuration from runtime state; avoid serializing caches or duplicated derived values.
- Do not assume property setters run when the Inspector modifies serialized backing fields.
- Avoid Unity API calls in constructors or field initializers for `MonoBehaviour` and serialized classes.
- Use `[SerializeReference]` only when null, polymorphism, shared references, or graphs justify its overhead and authoring complexity.

For dictionaries or nested containers, keep a supported serialized representation and build the runtime representation when appropriate. Use the collection-specific skill for detailed choices.

## 3. Lifecycle and Ownership

Make ownership explicit for every stateful resource.

### Initialization

- Use `Awake` for local component setup and invariant establishment.
- Use `OnEnable` for enable-scoped subscriptions or operations.
- Use `Start` for initialization that depends on other objects completing `Awake` when project conventions support that contract.
- Avoid relying on incidental script execution order. Configure or design an explicit order only when necessary.

### Cleanup

Pair acquisition with release:

- `OnEnable` subscription -> `OnDisable` unsubscription.
- Created object -> owner destroys or returns it.
- Addressables handle -> matching release.
- Pool lease -> release exactly once.
- Coroutine/task -> cancellation or completion ownership.
- Native container -> disposal after dependencies complete.

Do not let child logic destroy or dispose resources it does not own unless the contract explicitly transfers ownership.

### Reuse

Reset all lease-specific state for pooled or re-enabled objects. Include timers, events, targets, physics, animation, particles, trails, cancellation, and async continuations where relevant.

## 4. Dependencies and Scene Composition

Prefer explicit dependency wiring.

- Use serialized references for stable prefab or scene relationships.
- Cache required components during initialization when repeated lookup would obscure ownership or add cost.
- Use `GetComponent` when the dependency is naturally colocated; use `[RequireComponent]` when that invariant should be enforced.
- Avoid repeated `Find*`, tag search, or scene-wide lookup in gameplay flow unless the project architecture intentionally provides that lookup mechanism.
- Avoid mutable global static references for convenience.
- Resolve cross-scene dependencies through an explicit composition root, persistent scene, scoped service, or architecture already used by the project.

A direct reference is cleaner than an event bus or interface when the objects have stable local ownership and no meaningful variation.

## 5. Events and Communication

Choose the lightest communication mechanism that preserves ownership.

- Call a method directly for local request/response behavior.
- Use an interface when the consumer needs a capability independent of the concrete type.
- Use C# events for runtime publisher/subscriber communication controlled by code.
- Use `UnityEvent` when Inspector wiring is a genuine authoring requirement.
- Use ScriptableObject event channels only when asset-based, scene-independent communication provides concrete value.
- Use a message bus only when many systems need a deliberate shared boundary; avoid a global bus for local interactions.

Document who publishes, who subscribes, subscription lifetime, event ordering assumptions, and whether handlers may mutate or destroy objects.

## 6. Update Loops and Hot Paths

Keep `Update`, `FixedUpdate`, and `LateUpdate` readable and intentional.

- Put physics-affecting Rigidbody work in the appropriate physics flow.
- Put camera follow or presentation work in the appropriate late flow when required.
- Avoid polling when a reliable event can represent an infrequent state change, but do not replace simple frame-driven gameplay with a complex event system.
- Avoid per-frame scene searches, avoidable managed allocations, repeated component discovery, and expensive work that can be scheduled less often or cached safely.
- Do not ban LINQ, delegates, closures, or virtual calls globally. Evaluate their location, frequency, scale, and profile.
- Keep hot-path optimizations isolated behind clear names and comments explaining the measured reason.

Use `unity-performance-profiling` before significant rewrites.

## 7. Static State and Services

Use static members for stateless utilities, constants, immutable shared data, or deliberately process-wide state with controlled reset.

Avoid static mutable gameplay state when it:

- Hides dependencies.
- Survives scene or Enter Play Mode transitions unexpectedly.
- Makes tests order-dependent.
- Prevents multiple instances or sessions.
- Has no explicit initialization and shutdown owner.

Use a singleton only when the project intentionally defines one instance, the lifetime is explicit, and callers truly need global access. Prefer a composition root or serialized dependency for local systems.

Do not introduce a dependency-injection framework for a focused feature unless the project already uses one or the scale and boundaries justify it.

## 8. Debuggability and Testing

Treat debuggability as part of clean code.

- Make important state observable in the Inspector, debugger, custom diagnostics, or targeted logs.
- Use validation for required references and authored constraints.
- Keep pure calculations testable without scene setup where useful.
- Use Edit Mode tests for isolated rules and Play Mode tests for lifecycle, scene, physics, animation, or frame-timing behavior.
- Test disable/enable, destruction, scene unload, domain-reload configuration, repeated invocation, and pooled reuse when relevant.
- Remove temporary debug code or guard it through project-approved diagnostics.

Never claim a refactor is behavior-preserving until compilation and the relevant tests or focused playtest confirm it.
