# UniTask Guidance

## Table of contents

- Inspect and install
- Core model
- PlayerLoop timing
- Cancellation and timeouts
- Fire-and-forget
- Single-consumption rule
- Unity async operations
- Thread pool and platforms
- External integrations
- Unity Awaitable boundary

## Inspect and install

Before using UniTask:

1. Check `Packages/manifest.json`, `Packages/packages-lock.json`, and `Assets/Plugins/UniTask`.
2. Identify the installed version and import method.
3. Check project assembly definitions and existing namespace conventions.
4. Confirm target Unity and platform compatibility.
5. Do not upgrade or add the package as an incidental part of an unrelated feature.

The official repository supports UPM installation from its package path and release assets. Pin production dependencies to a reviewed tag or commit rather than a moving branch. As researched on 2026-07-28, the latest official GitHub release is 2.5.11; verify the official release page again before a future installation or upgrade.

## Core model

UniTask provides struct-based awaitable types integrated with Unity's PlayerLoop. It supports Unity `AsyncOperation` types, frame/time waits, cancellation, progress, parallel combinators, async streams, and bridges to coroutine and standard Task models.

Use:

- `UniTask` for no-result operations that callers can await;
- `UniTask<T>` for operations returning a result;
- `UniTaskVoid` only for a deliberate fire-and-forget root;
- `UniTaskCompletionSource<T>` to adapt a callback only when the callback cannot be awaited directly;
- `UniTask.WhenAll`, `WhenAny`, or `WhenEach` when concurrency semantics are explicit.

Do not claim that UniTask makes synchronous CPU work asynchronous. PlayerLoop-based UniTask code normally remains on Unity's main thread.

## PlayerLoop timing

Timing differences are part of correctness.

- `UniTask.NextFrame()` guarantees continuation on a later frame and is the closest replacement for `yield return null`.
- `UniTask.Yield()` resumes at the next occurrence of its PlayerLoop timing. It can resume later in the same frame when called before that phase.
- `UniTask.DelayFrame` waits a frame count.
- `UniTask.Delay` supports scaled/unscaled or realtime behavior through its options; match the original gameplay contract.
- `PlayerLoopTiming.FixedUpdate` is related to fixed-step timing but still requires testing when physics ordering matters.
- `PlayerLoopTiming.LastPostLateUpdate` is not a true replacement for coroutine `WaitForEndOfFrame`.
- In Unity 2022.3, use `await UniTask.WaitForEndOfFrame(this);` when true end-of-frame behavior is required.
- In Unity 2023.1+, UniTask can use Unity's native end-of-frame awaitable without a runner parameter.

Do not select a timing enum merely because its name sounds close. Test the exact interaction with `Update`, `LateUpdate`, physics, scene startup, rendering, and UI.

## Cancellation and timeouts

Pass cancellation from the root to every async layer:

```csharp
private async UniTask LoadAsync(CancellationToken cancellationToken)
{
    await LoadMetadataAsync(cancellationToken);
    await LoadContentAsync(cancellationToken);
}
```

For Unity 2022.2+:

- `destroyCancellationToken` represents `MonoBehaviour` destruction;
- `Application.exitCancellationToken` represents Play Mode exit or application quit;
- create a separate token source for disable-lifetime cancellation;
- link tokens only when the operation truly belongs to all linked lifetimes.

UniTask normally checks cancellation at PlayerLoop updates. `cancelImmediately: true` registers a callback and costs more. Use it only when immediate response is required.

`OperationCanceledException` is expected control flow when the owner's token was canceled. Let it propagate through intermediate layers. At the root, suppress or catch only expected cancellation; surface all other exceptions.

Prefer a timeout that cancels owned work internally. UniTask's external timeout helpers can stop observing a result without necessarily stopping the underlying operation. Use a cancellation token source and `CancelAfterSlim` when the operation supports cancellation. Link caller and timeout tokens when both apply.

Use `SuppressCancellationThrow` only at a leaf where cancellation-as-data is deliberately more useful than exception propagation and where profiling or control-flow clarity justifies it.

## Fire-and-forget

Default to returning a `UniTask` and awaiting it.

Use `.Forget()` or `UniTaskVoid` only when:

- the caller intentionally does not depend on completion;
- the owner and cancellation lifetime are explicit;
- non-cancellation exceptions are still reported;
- repeated invocation and shutdown behavior are tested.

Prefer:

```csharp
RunAsync(cancellationToken).Forget(Debug.LogException);
```

only when `RunAsync` catches expected cancellation before it reaches the exception handler. Otherwise expected cancellation may be logged as a failure by the custom handler.

For C# or Unity events, avoid `async void` lambdas where possible. Use `UniTask.Action` or `UniTask.UnityAction`, or invoke a named UniTask method through a synchronous wrapper.

## Single-consumption rule

A UniTask instance generally must not be awaited twice. This resembles `ValueTask`/`IValueTaskSource` semantics.

Do not store a raw in-flight UniTask field and let multiple callers await it repeatedly.

When repeated consumption is intentional, choose explicitly:

- `Preserve()` for cached completion within an appropriate scope;
- `UniTask.Lazy` for lazy reusable initiation;
- `UniTaskCompletionSource` for multi-caller completion;
- a service-level cached result rather than cached awaitable;
- start a fresh operation per caller when independence is required.

## Unity async operations

UniTask can await `AsyncOperation`, `ResourceRequest`, asset bundle requests, `UnityWebRequestAsyncOperation`, GPU readback, and other Unity operations.

Three forms have different semantics:

- `await operation`: native Unity completion timing;
- `operation.WithCancellation(token)`: cancellation-aware UniTask timing;
- `operation.ToUniTask(...)`: configurable progress, timing, and cancellation.

Use direct await when native timing is correct. In particular, avoid `SceneManager.LoadSceneAsync(...).ToUniTask()` unless changing continuation order relative to the loaded scene's `Start` is intentional and tested.

Cancellation of an await wrapper does not necessarily cancel the native Unity operation itself. Define what happens to the underlying operation and any loaded resource after the caller stops waiting.

## Thread pool and platforms

Most UniTask operations run on PlayerLoop, not a worker thread.

- Use `SwitchToThreadPool` or `RunOnThreadPool` only for pure managed thread-safe work.
- Switch back to main thread before accessing Unity state.
- Do not depend on thread-pool execution for WebGL.
- Prefer Jobs/Burst for large Unity data workloads.
- Do not use deprecated `UniTask.Run` in new code; inspect the installed version's current API.

## External integrations

UniTask includes or can enable separate assembly integrations for Addressables, TextMeshPro, and DOTween.

- Keep Addressables handle/release ownership independent from await syntax.
- Verify DOTween's completion/kill semantics, especially reusable tweens with `SetAutoKill(false)`.
- Enable only the integration assemblies and scripting symbols the project actually uses.

## Unity Awaitable boundary

Unity 2023.1 introduced native Awaitable support; Unity 2022.3 does not provide it.

For newer projects:

- consider native `Awaitable` for library APIs that should avoid a UniTask dependency;
- prefer UniTask when the project needs its richer combinators, PlayerLoop control, tracker, async streams, or existing conventions;
- do not migrate a stable project solely because native Awaitable exists;
- verify pooling/single-await semantics for the exact Awaitable API used.
