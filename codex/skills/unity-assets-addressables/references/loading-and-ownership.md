# Loading, handles, and ownership

## Contents

1. Ownership worksheet
2. AsyncOperationHandle rules
3. Single and multiple asset loads
4. AssetReference behavior
5. Prefab instantiation
6. Scene loading
7. Failure and cancellation semantics
8. Repeated calls and concurrency
9. Common failure patterns

## 1. Ownership worksheet

For every operation, record:

| Question | Required answer |
|---|---|
| Starter | Component, service, scene loader, UI flow, or bootstrap |
| Owner | The code responsible for release |
| Result | Asset, instance, scene, locations, catalog, or download |
| Lifetime | Frame, screen, level, pool, session, or application |
| End event | Disable, close, unload, pool dispose, scene change, or shutdown |
| Repeat policy | Reject, join, replace, queue, or parallel |
| Failure policy | Retry, fallback, skip, block, or fail feature |
| Late completion policy | Ignore safely, consume, or release immediately |

If ownership cannot be stated in one sentence, fix the architecture before implementation.

## 2. AsyncOperationHandle rules

- Store the handle, not only `handle.Result`.
- Keep the handle valid for the entire result lifetime.
- Release the handle on success when usage ends.
- Release the handle on failure to clear operation data unless the selected API overload explicitly auto-releases the failed operation and dependencies.
- Set the ownership flag to false immediately after release.
- Use `handle.IsValid()` when multiple lifecycle paths can reach cleanup.
- Do not read `Result`, `Status`, or progress after releasing the handle.
- Avoid copying a handle into many owners. The struct can be copied, but the underlying ownership must remain singular and documented.

Reference counting is dependency-aware. Releasing an asset decrements its count and dependency counts, but the underlying asset can remain in memory until the containing bundle reaches zero references.

## 3. Single and multiple asset loads

### Single asset

Use `Addressables.LoadAssetAsync<T>(key)` when the key must resolve to one asset. If a key can resolve to several locations, the single-load API returns one match; do not depend on unspecified label ordering.

### Multiple assets

Use `LoadAssetsAsync<T>` when loading a set. Define:

- Key list or label.
- `MergeMode` semantics.
- Whether partial results are useful.
- `releaseDependenciesOnFailure` behavior available in the installed version.
- Ownership of the one operation handle that retains all results.

If one consumer needs only one asset, do not keep a large batch handle alive only for convenience unless the content intentionally shares a lifetime.

## 4. AssetReference behavior

`AssetReference` is a serialized key and convenience API, not automatic lifetime management.

- Unity does not automatically load or release an assigned `AssetReference`.
- `AssetReference.LoadAssetAsync<T>` uses an internal handle and cannot start a second internal load until released.
- Use `AssetReference.ReleaseAsset()` when using the convenience internal load API.
- Use `Addressables.LoadAssetAsync<T>(assetReference)` for independent handles owned by separate callers.
- Use a typed reference or custom validation when the field must accept only a specific asset type or component.

Do not access `AssetReference.Asset` as a substitute for checking operation status and errors.

## 5. Prefab instantiation

Choose one of two patterns.

### Pattern A: Addressables.InstantiateAsync per instance

Use when lifecycle simplicity matters more than minimizing operation overhead.

- Keep the returned `AsyncOperationHandle<GameObject>` or allow tracked instance lookup.
- Release with `Addressables.ReleaseInstance(instance)` or `Addressables.ReleaseInstance(handle)`.
- If `trackHandle` is false, retain the operation handle because instance-based release lookup is unavailable.
- On a failed instantiate operation, release the valid failed operation handle.

### Pattern B: Load prefab once, instantiate manually

Use when creating many instances from one loaded prefab, often with pooling.

- Load the prefab once and retain its asset handle.
- Create clones with `Object.Instantiate`.
- Destroy or return clones according to the owning feature.
- Keep the prefab handle alive until every clone and pool entry is destroyed.
- Release the prefab handle once at the end of the shared lifetime.

Addressables does not increment its reference count for clones created through `Object.Instantiate`. Releasing the prefab handle while clones are still in use can invalidate dependencies or produce hard-to-debug memory behavior.

## 6. Scene loading

- Keep the `AsyncOperationHandle<SceneInstance>` returned by `Addressables.LoadSceneAsync`.
- Use additive loading when a persistent bootstrap or streaming world owns multiple scenes.
- If `activateOnLoad` is false, explicitly activate the returned `SceneInstance` at the intended transition point.
- Unload with `Addressables.UnloadSceneAsync(handle)` or the corresponding `SceneInstance` overload.
- Avoid unloading an Addressable scene only through `SceneManager` because Addressables must release the scene's dependencies.
- Define who owns an additive scene if the requesting component lives inside that scene.

A persistent scene coordinator is usually a clearer owner than a transient component inside the loaded scene.

## 7. Failure and cancellation semantics

An Addressables load is generally not cancellable after it starts.

- Releasing a handle before completion decrements ownership and causes cleanup when the operation completes.
- Treat this as abandonment, not cancellation of network or disk work.
- Guard completion callbacks so they do not modify destroyed, disabled, replaced, or re-pooled owners.
- On failure, inspect `Status` and `OperationException` where available. Verify overload-specific cleanup; `LoadAssetsAsync` can auto-release failed dependencies when configured to do so.
- Distinguish missing key, provider failure, network failure, catalog mismatch, and type mismatch in diagnostics.
- Avoid infinite automatic retry. Use bounded retries with delay only for recoverable remote failures.

Do not use `async void` for general loading APIs. Use it only for Unity event signatures that cannot return an awaitable, and route exceptions to an observable path.

## 8. Repeated calls and concurrency

Choose one policy per operation:

- **Reject**: return busy when a second request is invalid.
- **Join**: share one in-flight operation and increment explicit consumer ownership.
- **Replace**: abandon the old request and ignore its late completion.
- **Queue**: serialize operations such as catalog updates or scene transitions.
- **Parallel**: allow independent loads with independent handles.

Do not implement an implicit cache without defining:

- Cache key.
- Handle owner.
- Consumer count.
- Eviction condition.
- Catalog-update invalidation.
- Failure entry behavior.

## 9. Common failure patterns

Avoid:

- Returning `handle.Result` and releasing the handle in the same method.
- Loading in `OnEnable` and releasing in both `OnDisable` and `OnDestroy` without a state guard.
- Calling `ReleaseInstance` and `Destroy` on the same Addressable instance.
- Releasing a prefab load handle while a pool still contains clones.
- Using a label with `LoadAssetAsync` as though it were a unique address.
- Calling `WaitForCompletion` on a remote download during gameplay.
- Keeping a cross-scene handle in a scene object that is destroyed before the asset lifetime ends.
- Updating catalogs while related bundles are loaded without a deliberate conflict strategy.
