# Implementation Patterns

## Table of contents

- Synchronous event wrapper
- Sequential UniTask operation
- Parallel operations
- Callback adapter
- Scene loading timing
- Coroutine-to-UniTask migration checklist

## Synchronous event wrapper

Keep Unity event signatures synchronous and route them to an owned async method.

```csharp
public void OnReloadPressed()
{
    ReloadAsync(destroyCancellationToken).Forget(Debug.LogException);
}

private async UniTask ReloadAsync(CancellationToken cancellationToken)
{
    try
    {
        await UniTask.Delay(
            TimeSpan.FromSeconds(reloadSeconds),
            cancellationToken: cancellationToken);

        CompleteReload();
    }
    catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
    {
        // Expected object-lifetime cancellation.
    }
}
```

If repeated presses must reject, join, restart, or queue, implement that policy rather than allowing accidental parallel reloads.

## Sequential UniTask operation

```csharp
private async UniTask<WeaponData> LoadWeaponAsync(
    string id,
    CancellationToken cancellationToken)
{
    WeaponMetadata metadata = await LoadMetadataAsync(id, cancellationToken);
    WeaponData data = await LoadAssetAsync(metadata, cancellationToken);
    Validate(data);
    return data;
}
```

Use a typed result instead of writing intermediate values into shared fields. Let cancellation and failure propagate to the owner.

## Parallel operations

Start independent operations before awaiting the join:

```csharp
private async UniTask<Loadout> LoadLoadoutAsync(CancellationToken cancellationToken)
{
    UniTask<WeaponData> weaponTask = LoadWeaponAsync(cancellationToken);
    UniTask<ArmorData> armorTask = LoadArmorAsync(cancellationToken);

    (WeaponData weapon, ArmorData armor) = await UniTask.WhenAll(
        weaponTask,
        armorTask);

    return new Loadout(weapon, armor);
}
```

Use parallel composition only when operations are independent and the underlying systems permit concurrency. Define cleanup if one fails while another continues.

## Callback adapter

Before wrapping a callback, check whether the API already exposes a `Task`, UniTask extension, `AsyncOperation`, or completion event that can be awaited directly.

When adaptation is necessary:

```csharp
private UniTask<Result> RequestAsync(CancellationToken cancellationToken)
{
    var completion = new UniTaskCompletionSource<Result>();

    IDisposable registration = externalApi.Request(
        onSuccess: result => completion.TrySetResult(result),
        onFailure: error => completion.TrySetException(error));

    CancellationTokenRegistration cancellationRegistration =
        cancellationToken.Register(() => completion.TrySetCanceled(cancellationToken));

    return AwaitAndCleanupAsync(
        completion.Task,
        registration,
        cancellationRegistration);
}

private static async UniTask<Result> AwaitAndCleanupAsync(
    UniTask<Result> task,
    IDisposable registration,
    CancellationTokenRegistration cancellationRegistration)
{
    try
    {
        return await task;
    }
    finally
    {
        cancellationRegistration.Dispose();
        registration.Dispose();
    }
}
```

Adapt this pattern to the external API's actual unsubscribe/cancel contract. If canceling the wait does not cancel the external request, document and handle late completion.

## Scene loading timing

For UniTask with Unity scene loading, prefer direct await when native timing is intended:

```csharp
private async UniTask LoadSceneAsync(
    string sceneName,
    CancellationToken cancellationToken)
{
    AsyncOperation operation = SceneManager.LoadSceneAsync(sceneName);

    // WithCancellation changes the continuation scheduling model.
    await operation.WithCancellation(cancellationToken);
}
```

However, cancellation of the wrapper does not necessarily stop Unity's scene operation. Define whether scene activation continues and who handles the resulting scene. When exact continuation order relative to the new scene's `Start` matters, test direct `await operation` against cancellation requirements rather than automatically using `ToUniTask`.

## Coroutine-to-UniTask migration checklist

Map every behavior deliberately:

| Coroutine behavior | UniTask consideration |
|---|---|
| `yield return null` | `UniTask.NextFrame()` for guaranteed next frame |
| `WaitForSeconds` | `UniTask.Delay` using scaled time |
| `WaitForSecondsRealtime` | `UniTask.Delay` using unscaled/realtime behavior |
| `WaitUntil` / `WaitWhile` | `UniTask.WaitUntil` / `WaitWhile` with cancellation |
| `WaitForFixedUpdate` | Select and test fixed PlayerLoop timing |
| `WaitForEndOfFrame` on Unity 2022.3 | `UniTask.WaitForEndOfFrame(MonoBehaviour)` |
| `yield return AsyncOperation` | Direct await, or cancellation wrapper with timing review |
| `StopCoroutine` | Cancellation token owned by the same lifecycle |
| GameObject deactivation stops coroutine | Add explicit enabled-lifetime cancellation if equivalent behavior is required |
| Enumerator has no typed result | Return `UniTask<T>` instead of shared mutable state |

Do not claim equivalence until timing, disable/destroy behavior, cancellation, and errors have been tested.
