# Standard Task and Threading in Unity

## Table of contents

- Use `Task` at real boundaries
- Return types and exceptions
- Cancellation
- Main-thread and background-thread rules
- WebGL and platform constraints
- Interop with UniTask

## Use `Task` at real boundaries

Keep `Task` or `Task<T>` when the contract comes from standard .NET, a platform SDK, a server/client library, or shared non-Unity code. Do not convert every `Task` merely to make the codebase visually uniform.

Convert at a deliberate boundary when Unity-facing code needs UniTask composition, PlayerLoop waits, or lower-allocation Unity integration. Avoid repeated `Task -> UniTask -> Task` conversion chains.

## Return types and exceptions

- Return `Task` for an awaitable operation with no result.
- Return `Task<T>` for an awaitable operation with a result.
- Use `async void` only for an event signature that cannot return an awaitable type.
- Prefer a small synchronous event wrapper that starts an owned async method over embedding substantial logic in `async void`.
- Await tasks so exceptions are rethrown at an observable owner.
- For intentional fire-and-forget Task code, attach an explicit failure-reporting policy. Do not discard the task silently.
- Avoid `.Result`, `.Wait()`, and `.GetAwaiter().GetResult()` on Unity's main thread. Synchronous waiting can stall the frame and can deadlock when the operation needs the captured context.

## Cancellation

Cancellation is cooperative, not forced termination.

- Accept `CancellationToken cancellationToken` as the final parameter for cancellable APIs.
- Pass the token to every operation that can honor it.
- Check the token between chunks of owned CPU work.
- Return a canceled task only when cancellation actually caused the operation to stop.
- Distinguish caller cancellation, timeout, application exit, and real failure when the distinction changes behavior.
- Dispose each `CancellationTokenSource` owned by the feature.

A token can stop waiting while the underlying operation continues. Use this only when continued background work is safe and its result is intentionally ignored. Prefer passing cancellation into the owned operation itself.

## Main-thread and background-thread rules

Async syntax does not imply background execution. Code runs synchronously until the first incomplete await, then continuation behavior depends on the awaitable and context.

Treat UnityEngine object access as main-thread-only unless the specific Unity API documents otherwise.

Use a background thread only when all of these are true:

- the work is pure managed computation or a thread-safe external API;
- it does not read or mutate Unity objects, scene state, transforms, components, assets, or most Unity collections;
- target platforms support the required threading model;
- cancellation and completion ownership are defined;
- the continuation returns to the Unity main thread before touching Unity state.

Do not use `Task.Run` for:

- calling Unity APIs;
- per-object gameplay loops;
- work that belongs in Jobs/Burst;
- hiding a synchronous file/network API without understanding platform behavior;
- WebGL designs that depend on managed threads in Unity 2022.3.

Use Jobs/Burst for large data-parallel Unity workloads. Use chunking across frames when data cannot safely leave the main thread and occasional latency is acceptable.

## `ConfigureAwait`

Do not add `ConfigureAwait(false)` mechanically to Unity gameplay code.

Use it only inside a pure library layer when:

- the remainder of that method does not require Unity's main thread;
- the library intentionally avoids depending on Unity's synchronization context;
- callers know where they must switch back before Unity access.

Keep main-thread continuation explicit at the integration boundary.

## WebGL and platform constraints

For Unity 2022.3 WebGL, managed threads and `System.Threading`-based designs are not supported in the normal model. Prefer coroutines, Unity asynchronous operations, PlayerLoop-based UniTask operations, or platform-supported web APIs.

For IL2CPP/AOT targets:

- compile and test the actual player build;
- avoid assuming Editor/Mono behavior represents the target;
- verify third-party SDK and generic async code stripping requirements;
- test cancellation and exceptions in the built player.

## Interop with UniTask

- Await a standard `Task` from UniTask-aware code when that is the natural boundary.
- Use `AsUniTask` only when a UniTask value is needed for composition or API consistency.
- Use `AsTask` only at a consumer boundary that requires standard `Task`.
- Preserve one owner for cancellation and errors across the conversion.
- Document whether the continuation must return to the Unity main thread.
