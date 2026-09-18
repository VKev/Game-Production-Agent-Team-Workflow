# Async Mechanism Decision Guide

## Table of contents

- Decision sequence
- Mechanism comparison
- Selection heuristics
- Migration rules
- Architecture record

## Decision sequence

Answer these questions in order:

1. **Does the work need to happen every frame for the component's full active lifetime?**
   - Use `Update`, `LateUpdate`, or `FixedUpdate` unless the work intentionally sleeps for meaningful intervals.
2. **Is the work a short, local, frame/time sequence owned by one `MonoBehaviour`?**
   - Start with a coroutine.
3. **Does the operation return a result, compose with several operations, need structured cancellation, or cross service boundaries?**
   - Prefer an awaitable model. Preserve `Task` at standard .NET boundaries; prefer UniTask inside Unity when installed and accepted.
4. **Is the operation already a Unity `AsyncOperation`?**
   - Yield it in a coroutine or await it with UniTask. Preserve native timing unless changed timing is intentional.
5. **Is the work CPU-bound rather than waiting?**
   - A coroutine or UniTask alone does not move the computation off the main thread. Use Jobs/Burst for large data-parallel work, a supported background thread for pure managed work, or chunk the work across frames.
6. **Is the target WebGL?**
   - Do not design around managed thread-pool execution in Unity 6.3 WebGL.
7. **Is Unity 6.3 or newer?**
   - Native Unity `Awaitable` is available. Compare dependency policy and required composition features with UniTask.

## Mechanism comparison

| Mechanism | Best fit | Results/errors | Cancellation | Threading | Main costs/risks |
|---|---|---|---|---|---|
| `Update` / `LateUpdate` / `FixedUpdate` | Permanent frame-loop behavior | Manual state | Manual flags/state | Main thread | Scattered state if sequencing is complex |
| Coroutine | Local frame/time sequence | No typed return; exceptions are not naturally composed | Stop by owner or lifecycle | Main thread | State-machine allocation, lifecycle ambiguity, weak composition |
| `Task` | Standard .NET/SDK boundaries, true async I/O | Strong typed results and exception propagation | `CancellationToken` | May use captured context or thread pool | Allocations/context rules; Unity main-thread safety |
| UniTask | Unity-oriented async composition and PlayerLoop timing | Strong results, cancellation, joins | `CancellationToken` integrated | PlayerLoop by default; optional thread pool | Third-party dependency, single-consumption semantics, timing subtleties |
| Unity `Awaitable` | Unity 6.3 dependency-free Unity awaits | Typed awaitable flow | Token support depends on API | Unity model | Not available in 6000.3; fewer Task-like composition features than UniTask |
| Jobs/Burst | Large data-parallel CPU work | Job data/result containers | Job dependencies, explicit ownership | Worker threads | Data constraints and scheduling complexity |
| Callback/event | One-shot or event-driven completion | Manual | Manual unsubscribe/cancel | API-defined | Callback nesting and lifetime leaks if wrapped poorly |

## Selection heuristics

### Prefer a coroutine when

- the sequence is small and local to one component;
- the project already uses coroutines consistently;
- no typed result or multi-operation composition is needed;
- stopping behavior is simple and explicit;
- adding UniTask would create more dependency and architecture cost than value.

### Prefer UniTask when

- the project already depends on UniTask;
- results, exceptions, cancellation, parallel joins, or timeouts are central;
- the operation crosses several layers and needs one cancellation contract;
- Unity native async operations must compose with other awaitable work;
- PlayerLoop timing must be selected explicitly;
- tests and service APIs benefit from awaitable return values.

### Preserve standard `Task` when

- a .NET library or SDK owns the API contract;
- the code is shared with non-Unity .NET consumers;
- the boundary does not need Unity-specific PlayerLoop operations;
- converting would only add adapters without improving the feature.

### Prefer `Update` over an infinite coroutine when

- the operation runs every frame and rarely or never sleeps;
- the component naturally owns the behavior for its enabled lifetime;
- explicit state fields are simpler than an iterator state machine;
- profiling shows coroutine state or nesting is unnecessary overhead.

### Prefer Jobs/Burst over async syntax when

- the bottleneck is actual CPU computation, not waiting;
- the workload is large, independent, and data-oriented;
- profiling shows main-thread time is the limiting factor;
- the project can satisfy Native Container and thread-safety constraints.

## Migration rules

Do not migrate solely because one syntax looks newer.

Migrate when at least one concrete benefit exists:

- cancellation becomes explicit and reliable;
- exceptions become observable and testable;
- callback nesting is removed;
- several operations can be composed correctly;
- return values remove shared mutable state;
- lifecycle ownership becomes clearer;
- a measured allocation or CPU issue is improved;
- project-wide consistency reduces maintenance cost.

When migrating:

1. Record current timing and lifecycle behavior.
2. Preserve scaled versus unscaled time.
3. Preserve exact frame phase when it matters.
4. Preserve duplicate-call behavior.
5. Add cancellation before removing the old stop mechanism.
6. Test disable, destroy, scene reload, and failure paths.
7. Remove the old implementation only after equivalent behavior is verified.

## Architecture record

For a nontrivial choice, record:

```text
Operation:
Selected mechanism:
Alternatives considered:
Owner and lifetime:
Cancellation source:
Error destination:
PlayerLoop/frame timing:
Concurrency policy:
Platform constraints:
Why the added complexity is justified:
Verification performed:
```
