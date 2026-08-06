# Lifetime, Cancellation, and Error Ownership

## Table of contents

- Model the lifetime
- Cancellation sources
- Disable-scoped pattern
- Replacement and concurrency policies
- Stale continuation protection
- Exception ownership
- Cleanup checklist

## Model the lifetime

Treat every asynchronous operation as an owned resource.

Specify:

- who starts it;
- whether the owner can start it again;
- what normal completion means;
- which lifecycle event cancels it;
- who observes the result;
- who handles failure;
- whether the underlying operation continues after the caller stops waiting;
- whether the operation may outlive a scene, component, pooled lease, or application session.

Use the narrowest lifetime that matches the feature:

- **Call lifetime:** canceled by the caller.
- **Enabled lifetime:** canceled in `OnDisable` and recreated in `OnEnable`.
- **Object lifetime:** canceled on `destroyCancellationToken`.
- **Scene lifetime:** owned by a scene scope or scene service.
- **Application lifetime:** linked to `Application.exitCancellationToken`.
- **Persistent service lifetime:** disposed by the composition root or application shutdown path.

## Cancellation sources

- Pass caller tokens downward; do not create unrelated token sources in every method.
- Create a token source only when the current layer owns a new cancellation boundary: timeout, disable lifetime, replacement, or service shutdown.
- Link tokens only when cancellation by any linked owner must terminate the same operation.
- Cancel before dispose.
- Dispose linked token sources and registrations.
- Do not reuse a canceled `CancellationTokenSource`; create a new source for the next enabled lease or operation.

## Disable-scoped UniTask pattern

```csharp
using System;
using System.Threading;
using Cysharp.Threading.Tasks;
using UnityEngine;

public sealed class EnabledLifetimeWorker : MonoBehaviour
{
    private CancellationTokenSource disableCancellation;

    private void OnEnable()
    {
        disableCancellation = CancellationTokenSource.CreateLinkedTokenSource(
            destroyCancellationToken,
            Application.exitCancellationToken);

        RunWhileEnabledAsync(disableCancellation.Token)
            .Forget(Debug.LogException);
    }

    private void OnDisable()
    {
        if (disableCancellation == null)
            return;

        disableCancellation.Cancel();
        disableCancellation.Dispose();
        disableCancellation = null;
    }

    private async UniTask RunWhileEnabledAsync(CancellationToken cancellationToken)
    {
        try
        {
            while (true)
            {
                await UniTask.Delay(
                    TimeSpan.FromMilliseconds(250),
                    cancellationToken: cancellationToken);

                DoWork();
            }
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Expected end of this enabled lifetime.
        }
    }

    private void DoWork()
    {
        // Main-thread Unity work.
    }
}
```

This pattern is appropriate only when the work should stop on disable. For destroy-only work, use `destroyCancellationToken` directly and avoid the extra source.

## Replacement and concurrency policies

Choose one policy for repeated calls:

- **Reject:** ignore or fail while an operation is already active.
- **Join:** return the same observable completion to all callers.
- **Replace:** cancel the previous operation and start the latest.
- **Queue:** preserve request order and process one at a time.
- **Parallel:** allow independent operations with separate ownership.
- **Coalesce:** combine equivalent requests into one operation and distribute the result.

Do not let the policy emerge accidentally from shared fields.

### Replace-previous outline

```csharp
private CancellationTokenSource requestCancellation;

public void Refresh()
{
    requestCancellation?.Cancel();
    requestCancellation?.Dispose();

    requestCancellation = CancellationTokenSource.CreateLinkedTokenSource(
        destroyCancellationToken,
        Application.exitCancellationToken);

    RefreshAsync(requestCancellation.Token).Forget(Debug.LogException);
}
```

Catch expected cancellation inside `RefreshAsync` or in a dedicated root wrapper so replacement does not log as an error.

## Stale continuation protection

Cancellation is cooperative. A non-cancelable native operation, callback, or external SDK may complete after the owner no longer wants the result.

Protect against late completion when needed:

- compare a request generation/version before applying the result;
- compare a pooled object's lease ID;
- verify the owner is still active and the request is still current;
- retain and release resource handles even when the consumer cancels;
- avoid relying only on Unity's overloaded null comparison after destruction;
- separate "stop waiting" from "stop underlying work" in the contract.

Example generation guard:

```csharp
private int requestVersion;

private async UniTask ApplyLatestAsync(CancellationToken cancellationToken)
{
    int version = ++requestVersion;
    Result result = await LoadResultAsync(cancellationToken);

    if (version != requestVersion || cancellationToken.IsCancellationRequested)
        return;

    Apply(result);
}
```

## Exception ownership

- Let intermediate methods propagate failures unless they can add context, recover, retry, or translate to a domain result.
- Catch expected `OperationCanceledException` at the operation root when its token was canceled.
- Do not use `catch (Exception) { }`.
- Avoid logging and rethrowing at every layer, which duplicates reports.
- Define one final destination for unhandled asynchronous failures: caller, feature error state, global logger, or `UniTaskScheduler.UnobservedTaskException`.
- Keep retry policy explicit: maximum attempts, backoff, cancelability, idempotency, and errors eligible for retry.
- Never retry programming errors or permanent validation failures automatically.

## Cleanup checklist

Before considering the operation complete, verify:

- token sources and registrations are disposed;
- event handlers are unsubscribed;
- coroutine handles are cleared;
- resources, web requests, streams, and Addressables handles have defined ownership;
- progress listeners cannot target destroyed UI;
- pooled objects cannot receive a continuation from an earlier lease;
- cancellation is not misreported as failure;
- non-cancellation failure is not silently ignored;
- application exit does not start replacement or retry work.
