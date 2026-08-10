# Event Bus and Message Routing

## Contents

- [Choose the communication mechanism](#choose-the-communication-mechanism)
- [Define scope and ownership](#define-scope-and-ownership)
- [Define the dispatch contract](#define-the-dispatch-contract)
- [Design payloads deliberately](#design-payloads-deliberately)
- [Manage registration and lifetime](#manage-registration-and-lifetime)
- [Avoid fragile runtime discovery](#avoid-fragile-runtime-discovery)
- [Make communication observable](#make-communication-observable)
- [Verify the architecture](#verify-the-architecture)
- [Video case-study corrections](#video-case-study-corrections)

## Choose the communication mechanism

Use the least indirect mechanism that satisfies ownership, cardinality, designer workflow, and lifetime requirements.

| Need | Prefer | Avoid when |
| --- | --- | --- |
| Owned one-to-one collaboration | Direct method call or injected interface | The receiver is optional or there are many independent listeners |
| Local one-to-many notification | C# event/Observer on the owning object | Publisher lifetime is unclear or listeners cannot unsubscribe safely |
| Designer-wired persistent callback | `UnityEvent` | Hot-path cost, strong compile-time payloads, or code-only wiring dominates |
| Inspector-visible cross-scene/feature signal | ScriptableObject event channel | The asset would hide transient state or create accidental global scope |
| Many publishers/listeners across a real bounded context | Scoped typed event bus | Direct ownership is available or the bus would become a global dumping ground |
| Delayed, queued, replayable, or undoable work | Command/queue | Only immediate notification is needed |

Do not add a bus solely to avoid references. A bus replaces visible dependencies with a routing dependency and must repay that cost through real decoupling, modularity, tooling, or cross-cutting observability.

## Define scope and ownership

Name one owner for the bus and its registry:

- **Feature scope:** isolate messages inside one feature or bounded context.
- **Scene/session scope:** create and clear the bus with the scene or gameplay session.
- **Application scope:** reserve for genuinely application-wide messages with stable lifetime.
- **Test/operation scope:** construct an isolated bus per test or workflow.

Prefer an injected bus instance when scope matters. Use a static generic bus only when process-wide scope is intentional and static reset, tests, and diagnostics are solved.

Record who may publish each event, who may subscribe, whether the event crosses assembly/feature boundaries, and whether delivery is immediate or queued.

## Define the dispatch contract

Specify these rules before choosing a collection:

- **Mutation:** What happens when a handler subscribes, unsubscribes, or clears the bus during dispatch?
- **Ordering:** Is listener order unspecified, insertion-ordered, or priority-based?
- **Reentrancy:** Can a handler raise the same event recursively? Queue, coalesce, reject, or explicitly allow nested dispatch.
- **Exceptions:** Fail fast, isolate and log each handler, or aggregate failures after all handlers run.
- **Threading:** Enforce main-thread delivery for Unity-facing listeners, or provide an explicit handoff policy.
- **Duplicates:** Decide whether the same subscription identity can register more than once.
- **Cancellation/consumption:** Decide whether one listener can stop propagation; omit this feature unless required.

Collection choice follows the contract:

- Iterating a live `HashSet` or `List` is invalid when handlers mutate it.
- A fresh snapshot is simple but allocates in proportion to dispatch frequency and subscriber count.
- A reusable snapshot avoids steady-state allocation but needs a rule for listeners removed after capture.
- Deferred mutation queues avoid copying but complicate nested dispatch and failure recovery.
- Copy-on-write favors many raises and rare subscription changes but makes registration more expensive.

Do not promise deterministic order when using an unordered collection.

## Design payloads deliberately

- Use specific event types that describe completed facts or intentional requests; do not create a generic string/object envelope by default.
- Keep payloads small enough that value copies are reasonable, or use immutable reference payloads when identity/size warrants them.
- Structs are value types, not a guarantee of stack allocation or zero GC. Converting a struct to `object` or an interface boxes it.
- Closed generic delegates such as `Action<T>` can pass a struct without interface boxing, but bindings, captured lambdas, snapshots, and surrounding code can still allocate.
- Prefer immutable payload data during immediate dispatch so one listener cannot silently change what later listeners observe.
- Do not retain references to short-lived Unity objects beyond their valid lifetime.

Measure hot-path allocation claims with the actual scripting backend and build target.

## Manage registration and lifetime

- Make subscribe/unsubscribe symmetric and use the same subscription identity.
- Register Unity components in `OnEnable` and unregister in `OnDisable` when enabled lifetime is the intended scope.
- Return an idempotent subscription token when non-Unity consumers need deterministic teardown.
- Do not rely on a finalizer to remove managed subscriptions.
- Reset static registries explicitly for disabled Domain Reload.
- Clear scene/session buses when their owner ends, not from unrelated global cleanup.
- Decide whether a listener destroyed or disabled during a captured dispatch still receives the current event.

Avoid constructing a new binding during unsubscribe; retain the exact binding/token that was registered.

## Avoid fragile runtime discovery

Prefer explicit or generated registration over scanning every loaded assembly at startup.

If reflection is required:

- Include project asmdef assemblies, not only predefined `Assembly-CSharp` names.
- Filter out interfaces, abstract types, open generics, and other invalid payload types.
- Handle `ReflectionTypeLoadException` and report loader failures without discarding successfully loaded types.
- Cache the result and profile startup cost.
- Preserve reflected types and members for managed stripping/IL2CPP with an audited strategy.
- Keep package startup methods reachable; verify package/precompiled assemblies that depend on runtime-initialization attributes.
- Separate Editor discovery from player runtime code and guard `UnityEditor` imports.

`MakeGenericType` constructs a closed `Type` representation; it is not evidence that a bus instance was created or its static state was eagerly initialized. If a type catalog exists only to clear buses, say so directly.

## Make communication observable

Provide only the diagnostics the project needs:

- Development-only event tracing with event type, publisher context, and listener count.
- Subscription inventory or leak assertions at scene/session teardown.
- Duplicate-registration warnings keyed by subscription identity.
- Optional profiler markers for high-frequency buses.
- Clear logs for reflection discovery failures and stripped/missing event types.

Avoid unconditional per-event logs in production. Central routing without traceability makes gameplay behavior difficult to debug.

## Verify the architecture

Test the exact contract:

- No listeners and one/many listeners.
- Duplicate registration.
- Unsubscribe before and during dispatch.
- Subscribe during dispatch.
- Clear during dispatch.
- Nested raise of the same and a different event type.
- Listener exception behavior.
- Listener order when order is promised.
- Scene unload, object disable/destroy, session restart, and application shutdown.
- Two Play Mode runs with Domain Reload disabled.
- Custom asmdef event types.
- Target-player build with the intended stripping level and IL2CPP when applicable.
- Allocation and timing capture for any claimed hot-path benefit.

Use a test-scoped bus or clear fixture state so tests do not leak subscriptions into one another.

## Video case-study corrections

The analyzed generic-event-bus tutorial is useful for typed payloads, binding identity, symmetric Unity lifecycle registration, and static cleanup. Do not carry these tutorial assumptions into production:

- Iterating the live `HashSet` fails if handlers mutate subscriptions; the creator later added a snapshot.
- Allocating a new `HashSet` on every raise fixes mutation safety but may be inappropriate for frequent events.
- A `HashSet` does not establish listener order.
- Scanning only `Assembly-CSharp` and first-pass assemblies misses custom asmdefs.
- `Assembly.GetTypes()` needs partial-load failure handling.
- Reflection-only types require stripping/AOT verification.
- Struct payloads do not universally eliminate heap allocation.
- `UnityEditor` imports must not leak into player runtime assemblies.

Use the case study to identify required policies, not as a drop-in global bus.
