---
name: dev-unity-async-coroutines-unitask
description: Documentation-grounded selection, implementation, review, migration, and optimization of asynchronous workflows in Unity, including MonoBehaviour coroutines, standard C# Task/async-await, Cysharp UniTask, Unity AsyncOperation, cancellation, PlayerLoop timing, exceptions, timeouts, concurrency, testing, and profiling. Use when a Unity task mentions IEnumerator, yield, coroutine, async/await, Task, UniTask, UniTaskVoid, CancellationToken, UnityWebRequest, asynchronous scene or asset loading, delays, sequencing, parallel operations, fire-and-forget, race conditions, lifetime-safe cancellation, WebGL threading, or choosing and converting between Unity asynchronous models.
---

# Unity Async, Coroutines, and UniTask

Choose the smallest asynchronous model that correctly expresses the operation's timing, ownership, lifetime, result, cancellation, and platform requirements. Preserve the project's established conventions unless a measured or architectural benefit justifies changing them.

## Core rules

- Inspect the actual project before selecting an API or installing a dependency.
- Do not replace a working coroutine with UniTask only for style.
- Do not install UniTask unless the task, project convention, or chosen architecture justifies the dependency.
- Treat coroutines, `Task`, and most UniTask operations as coordination mechanisms, not automatic CPU parallelism.
- Keep Unity object access on the main thread unless the specific API explicitly documents thread safety.
- Define who owns every long-lived operation and exactly when it ends.
- Propagate cancellation from the owner to the leaf operation.
- Observe every exception. Use fire-and-forget only when completion is intentionally unobserved and failures still have a defined reporting path.
- Prefer correctness and clean ownership before allocation or micro-performance work. Profile before retaining a more complex optimization.

## Workflow

1. **Inspect project context.** Read the root and local `AGENTS.md` files, GDD, Unity version, package manifests, target platforms, scripting backend, API Compatibility Level, assembly definitions, and existing async conventions.
2. **Classify the work.** Determine whether it is frame sequencing, a Unity engine async operation, external I/O, CPU-bound computation, permanent per-frame behavior, an event stream, or editor-only work.
3. **Select the mechanism.** Compare `Update` callbacks, coroutine, standard `Task`, UniTask, Unity `Awaitable`, Job System/Burst, or a direct callback. Read [decision-guide.md](references/decision-guide.md).
4. **Design the contract.** Define result type, ownership, cancellation lifetime, error propagation, timeout behavior, PlayerLoop timing, concurrency policy, and repeated-call behavior before coding.
5. **Implement in scope.** Follow the project's architecture. Add only the abstractions and package dependencies required by the selected design.
6. **Verify behavior.** Test success, failure, cancellation, disable/destroy, scene unload, application exit, repeated invocation, pause/time scale, and relevant target platforms.
7. **Profile when justified.** Compare CPU time, `GC.Alloc`, operation counts, and frame spikes on the same workload. Keep an optimization only when its value exceeds the clarity and maintenance cost.

## Inspect before choosing

Check at minimum:

- `ProjectSettings/ProjectVersion.txt`
- `Packages/manifest.json` and `Packages/packages-lock.json`
- whether UniTask is installed as `com.cysharp.unitask` or under `Assets/Plugins/UniTask`
- current UniTask version and assembly definitions
- Unity scripting backend and API Compatibility Level
- target platforms, especially WebGL, mobile, and IL2CPP
- existing coroutine, `Task`, UniTask, cancellation, and error-handling patterns
- object lifetime expectations: disable, destroy, scene unload, application exit, or persistent service

Unity 6.3 includes native `Awaitable`. Compare it with the project's installed UniTask version and existing conventions rather than assuming either mechanism is mandatory.

## Select by semantics

Use these defaults, then adapt to project evidence:

| Need | Preferred starting point |
|---|---|
| Permanent per-frame component behavior | `Update`, `LateUpdate`, or `FixedUpdate` |
| Small local sequence over frames or time, owned by one `MonoBehaviour` | Coroutine |
| Standard .NET or third-party API already returning `Task` | Preserve `Task` at that boundary |
| Composable Unity async flow with results, cancellation, parallel joins, or PlayerLoop control, and UniTask is accepted by the project | UniTask |
| Unity 6.3 library API that should avoid a third-party dependency | Consider Unity `Awaitable` |
| Large measured data-parallel CPU workload | Job System/Burst; invoke `dev-unity-jobs-burst-native-collections` |
| Pure managed CPU work on a supported threaded platform | Carefully consider a background thread or `Task.Run`; never touch Unity objects there |
| Infrequent callback with no useful asynchronous composition | Keep the callback; do not wrap it without a benefit |

Read [decision-guide.md](references/decision-guide.md) for the complete decision matrix and migration rules.

## Coroutine guidance

- Use coroutines for readable local sequences tied to a `MonoBehaviour` and Unity's frame/time yield instructions.
- Remember that coroutines are not threads; synchronous work inside them still blocks the main thread.
- Store the returned `Coroutine` or original `IEnumerator` when deterministic stopping is required. Do not mix string and enumerator stopping styles.
- Define whether the operation stops on component disable, GameObject deactivation, destruction, scene unload, or explicit replacement. Disabling a `MonoBehaviour` does not automatically stop its coroutines; deactivating its GameObject does.
- Use scaled and unscaled waits intentionally. Treat waits as frame-scheduled, not exact wall-clock timers.
- Prefer `Update` or `LateUpdate` for a permanent every-frame loop that does not spend meaningful time suspended.
- Avoid unnecessary nesting and repeated starts because each coroutine has state-machine memory overhead.

Read [coroutines.md](references/coroutines.md) before implementing or reviewing coroutine ownership and timing.

## Standard Task guidance

- Return `Task` or `Task<T>` for awaitable standard .NET boundaries. Reserve `async void` for unavoidable event-handler signatures.
- Never use `.Wait()`, `.Result`, or synchronous blocking on the Unity main thread.
- Treat cancellation as cooperative. Accept a `CancellationToken` as the final parameter and pass it through every cancellable layer.
- Use `Task.Run` only for pure managed CPU work on platforms that support threads. Do not use it to call Unity APIs or as a substitute for Jobs/Burst.
- Do not apply `ConfigureAwait(false)` mechanically inside Unity gameplay code. Use it only in a pure library layer that does not require Unity's main-thread context.
- Convert between `Task` and UniTask only at a clear boundary; do not create conversion chains throughout the feature.

Read [task-and-threading.md](references/task-and-threading.md) for boundaries and platform rules.

## UniTask guidance

- Prefer `UniTask`/`UniTask<T>` for awaitable operations. Use `UniTaskVoid` or `.Forget()` only for deliberate fire-and-forget roots.
- Pass a lifetime token from the root operation. In Unity 6.3, consider `MonoBehaviour.destroyCancellationToken` and `Application.exitCancellationToken`; create a separate token when cancellation must occur on disable.
- Do not await the same UniTask instance twice unless the selected API explicitly supports it. Use `Preserve`, `UniTask.Lazy`, or `UniTaskCompletionSource` only when repeated consumption is required.
- Use `UniTask.NextFrame()` when the contract is specifically "next frame". `UniTask.Yield()` can resume later in the same frame depending on the current and requested PlayerLoop timing.
- Await Unity `AsyncOperation` directly when native completion timing is desired. Be cautious with `WithCancellation` and `ToUniTask` because they use selected PlayerLoop timing. Avoid `LoadSceneAsync().ToUniTask()` unless the changed continuation timing is intentional.
- For true end-of-frame behavior required by operations such as screen reads, use the overload supported by the exact installed UniTask version. On Unity 6.3, prefer the native end-of-frame path when that package version exposes it; `LastPostLateUpdate` is not equivalent.
- Prefer cancellation that stops owned work from inside. An external timeout that stops waiting does not necessarily stop the underlying operation.
- Use immediate cancellation only when the requirement justifies its extra registration cost.
- Use UniTaskTracker for leak diagnosis, then disable expensive stack-trace tracking after investigation.

Read [unitask.md](references/unitask.md) before installing, upgrading, or using advanced UniTask behavior.

## Lifetime, cancellation, and errors

Define all of the following before implementation:

- owner of the operation
- start condition and duplicate-start policy
- normal completion condition
- cancellation on disable, destroy, scene unload, replacement, timeout, or application exit
- whether cancellation is expected control flow or an error
- where non-cancellation exceptions are logged, translated, retried, or surfaced
- whether late completion may mutate an object that has been disabled, destroyed, pooled, or reused
- whether concurrent calls join, queue, replace, reject, or run independently

Use [lifetime-cancellation-errors.md](references/lifetime-cancellation-errors.md) for linked tokens, replacement patterns, stale-continuation guards, and error ownership.

## Implementation quality

- Name asynchronous methods with the `Async` suffix unless Unity requires a lifecycle/event signature.
- Keep the root operation visible and owned; do not scatter untracked `.Forget()` calls.
- Dispose owned `CancellationTokenSource` and registrations.
- Do not swallow non-cancellation exceptions.
- Do not catch `OperationCanceledException` at every layer. Usually let it propagate to the operation root, where expected cancellation can be distinguished from failure.
- Avoid polling every frame when an existing completion event or awaitable operation is available.
- Avoid wrapping a synchronous expensive operation in coroutine or UniTask and calling it "asynchronous". Chunk the work, move valid work to a job/thread, or use an actual asynchronous API.
- Preserve Addressables handle ownership and release rules; invoke `dev-unity-assets-addressables` when handles are involved.

Read [implementation-patterns.md](references/implementation-patterns.md) for focused examples.

## Verification

After implementation:

1. Compile all affected assemblies and clear Console errors and relevant warnings.
2. Test successful completion and returned results.
3. Test expected failure and confirm the exception is observed once.
4. Cancel during every important await point.
5. Disable, destroy, unload the scene, and quit while the operation is active.
6. Trigger the operation repeatedly and verify the defined concurrency policy.
7. Test `Time.timeScale == 0` when scaled or unscaled waiting matters.
8. Test target-platform restrictions, especially WebGL threading and IL2CPP/AOT.
9. Use Unity Test Framework where practical. Bridge UniTask to `[UnityTest]` with `UniTask.ToCoroutine` when needed.
10. Profile a representative build only when performance matters; inspect CPU timing, `GC.Alloc`, coroutine activity under `DelayedCallManager`, and UniTaskTracker.

Read [testing-profiling.md](references/testing-profiling.md) for the full matrix.

## Related skills

- Use `dev-unity-project-context` for repository navigation, Unity/package version discovery, and `AGENTS.md` maintenance.
- Use `dev-unity-gameplay-architecture` for ownership, service, feature-boundary, and dependency decisions.
- Use `dev-unity-assets-addressables` for Addressables handles, release ownership, and content loading architecture.
- Use `dev-unity-performance-profiling` for broader performance investigations.
- Use `dev-unity-jobs-burst-native-collections` for measured data-parallel CPU workloads.

## Source policy

Treat project files and version-matched official documentation as the source of truth. Treat public agent skills as structural references only. Read [sources.md](references/sources.md) for the researched source set and version notes.
