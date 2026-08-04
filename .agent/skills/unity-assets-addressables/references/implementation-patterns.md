# Implementation patterns

## Contents

1. Load one asset with explicit handle ownership
2. Instantiate and release an Addressable prefab
3. Load a prefab once for a pool
4. Predownload dependencies with byte progress
5. Additive scene ownership
6. Result lease contract
7. Patterns to avoid

These examples target the Addressables 1.21 API family used by Unity 2022.3 projects. Inspect the installed package before copying them.

## 1. Load one asset with explicit handle ownership

Use an `AssetReference` as a serialized key but let this component own an independent handle.

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public sealed class AddressableMaterialOwner : MonoBehaviour
{
    [SerializeField] private AssetReference materialReference;
    [SerializeField] private Renderer targetRenderer;

    private AsyncOperationHandle<Material> loadHandle;
    private bool ownsHandle;

    private IEnumerator Start()
    {
        loadHandle = Addressables.LoadAssetAsync<Material>(materialReference);
        ownsHandle = true;

        if (!loadHandle.IsDone)
            yield return loadHandle;

        if (loadHandle.Status != AsyncOperationStatus.Succeeded)
        {
            Debug.LogError(
                $"Failed to load material: {loadHandle.OperationException}",
                this);
            ReleaseHandle();
            yield break;
        }

        targetRenderer.sharedMaterial = loadHandle.Result;
    }

    private void OnDestroy()
    {
        ReleaseHandle();
    }

    private void ReleaseHandle()
    {
        if (!ownsHandle)
            return;

        if (loadHandle.IsValid())
            Addressables.Release(loadHandle);

        ownsHandle = false;
    }
}
```

If another object must keep using the material after this component is destroyed, this component is the wrong owner. Move ownership to the longer-lived scope.

## 2. Instantiate and release an Addressable prefab

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public sealed class AddressableInstanceOwner : MonoBehaviour
{
    [SerializeField] private AssetReferenceGameObject prefabReference;
    [SerializeField] private Transform parent;

    private AsyncOperationHandle<GameObject> instanceHandle;
    private bool ownsOperation;

    private IEnumerator Start()
    {
        instanceHandle = Addressables.InstantiateAsync(prefabReference, parent);
        ownsOperation = true;

        if (!instanceHandle.IsDone)
            yield return instanceHandle;

        if (instanceHandle.Status == AsyncOperationStatus.Succeeded)
            yield break;

        Debug.LogError(
            $"Failed to instantiate Addressable prefab: " +
            $"{instanceHandle.OperationException}",
            this);

        ReleaseOwnedOperation();
    }

    private void OnDestroy()
    {
        ReleaseOwnedOperation();
    }

    private void ReleaseOwnedOperation()
    {
        if (!ownsOperation)
            return;

        if (instanceHandle.IsValid())
        {
            if (instanceHandle.IsDone &&
                instanceHandle.Status == AsyncOperationStatus.Succeeded)
            {
                Addressables.ReleaseInstance(instanceHandle);
            }
            else
            {
                Addressables.Release(instanceHandle);
            }
        }

        ownsOperation = false;
    }
}
```

This cleanup also covers destruction while the instantiate operation is still running. Do not also call `Destroy(instanceHandle.Result)` after `ReleaseInstance`.

## 3. Load a prefab once for a pool

Use this ownership model:

```text
Pool owner
  owns one LoadAssetAsync<GameObject> handle
  creates clones with Object.Instantiate
  owns every active and inactive clone
  destroys all clones during Dispose
  releases the prefab handle after all clones are destroyed
```

Do not release the prefab handle each time one pooled clone is returned. The handle lifetime is the entire pool lifetime.

## 4. Predownload dependencies with byte progress

```csharp
using System;
using System.Collections;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;

public sealed class AddressablePreloader : MonoBehaviour
{
    [SerializeField] private string preloadLabel = "preload-core";

    private AsyncOperationHandle<long> sizeHandle;
    private AsyncOperationHandle downloadHandle;
    private bool ownsSizeHandle;
    private bool ownsDownloadHandle;

    public IEnumerator Download(Action<float> onProgress)
    {
        if (ownsSizeHandle || ownsDownloadHandle)
            yield break;

        sizeHandle = Addressables.GetDownloadSizeAsync(preloadLabel);
        ownsSizeHandle = true;
        yield return sizeHandle;

        if (sizeHandle.Status != AsyncOperationStatus.Succeeded)
        {
            Debug.LogError(sizeHandle.OperationException, this);
            ReleaseSizeHandle();
            yield break;
        }

        long downloadBytes = sizeHandle.Result;
        ReleaseSizeHandle();

        if (downloadBytes <= 0)
        {
            onProgress?.Invoke(1f);
            yield break;
        }

        downloadHandle =
            Addressables.DownloadDependenciesAsync(preloadLabel, false);
        ownsDownloadHandle = true;

        while (!downloadHandle.IsDone)
        {
            onProgress?.Invoke(downloadHandle.GetDownloadStatus().Percent);
            yield return null;
        }

        bool succeeded =
            downloadHandle.Status == AsyncOperationStatus.Succeeded;

        if (!succeeded)
            Debug.LogError(downloadHandle.OperationException, this);

        onProgress?.Invoke(succeeded ? 1f : 0f);
        ReleaseDownloadHandle();
    }

    private void OnDestroy()
    {
        ReleaseSizeHandle();
        ReleaseDownloadHandle();
    }

    private void ReleaseSizeHandle()
    {
        if (!ownsSizeHandle)
            return;

        if (sizeHandle.IsValid())
            Addressables.Release(sizeHandle);

        ownsSizeHandle = false;
    }

    private void ReleaseDownloadHandle()
    {
        if (!ownsDownloadHandle)
            return;

        if (downloadHandle.IsValid())
            Addressables.Release(downloadHandle);

        ownsDownloadHandle = false;
    }
}
```

Releasing an in-flight download handle does not guarantee immediate network cancellation; it abandons this owner's share and allows cleanup when the operation completes.

## 5. Additive scene ownership

```csharp
using System.Collections;
using UnityEngine;
using UnityEngine.AddressableAssets;
using UnityEngine.ResourceManagement.AsyncOperations;
using UnityEngine.ResourceManagement.ResourceProviders;
using UnityEngine.SceneManagement;

public sealed class AddressableSceneOwner : MonoBehaviour
{
    [SerializeField] private AssetReference sceneReference;

    private AsyncOperationHandle<SceneInstance> sceneHandle;
    private bool ownsLoadOperation;
    private bool unloadStarted;

    public IEnumerator Load()
    {
        if (ownsLoadOperation)
            yield break;

        sceneHandle = Addressables.LoadSceneAsync(
            sceneReference,
            LoadSceneMode.Additive,
            activateOnLoad: true);
        ownsLoadOperation = true;

        yield return sceneHandle;

        if (sceneHandle.Status == AsyncOperationStatus.Succeeded)
            yield break;

        Debug.LogError(sceneHandle.OperationException, this);
        ReleaseFailedOrPendingLoad();
    }

    public IEnumerator Unload()
    {
        if (!ownsLoadOperation || unloadStarted || !sceneHandle.IsValid())
            yield break;

        if (!sceneHandle.IsDone ||
            sceneHandle.Status != AsyncOperationStatus.Succeeded)
        {
            ReleaseFailedOrPendingLoad();
            yield break;
        }

        unloadStarted = true;
        AsyncOperationHandle<SceneInstance> unloadHandle =
            Addressables.UnloadSceneAsync(
                sceneHandle,
                autoReleaseHandle: true);

        yield return unloadHandle;

        ownsLoadOperation = false;
        unloadStarted = false;
    }

    private void OnDestroy()
    {
        if (!ownsLoadOperation || unloadStarted || !sceneHandle.IsValid())
            return;

        if (sceneHandle.IsDone &&
            sceneHandle.Status == AsyncOperationStatus.Succeeded)
        {
            unloadStarted = true;
            Addressables.UnloadSceneAsync(
                sceneHandle,
                autoReleaseHandle: true);
            return;
        }

        ReleaseFailedOrPendingLoad();
    }

    private void ReleaseFailedOrPendingLoad()
    {
        if (!ownsLoadOperation)
            return;

        if (sceneHandle.IsValid())
            Addressables.Release(sceneHandle);

        ownsLoadOperation = false;
    }
}
```

A production scene coordinator should also define queued or replacement transitions, deferred activation, and unload-failure telemetry.

## 6. Result lease contract

When wrapping Addressables, prefer a contract that makes ownership visible:

```csharp
public interface IAssetLease<out T> : System.IDisposable
    where T : UnityEngine.Object
{
    T Asset { get; }
}
```

The lease implementation owns the handle and releases it exactly once from `Dispose`. Use this only when the project benefits from a reusable testable abstraction. For a local component with one load, direct handle ownership is clearer.

## 7. Patterns to avoid

```csharp
// Wrong: result outlives the released handle.
var handle = Addressables.LoadAssetAsync<GameObject>(key);
await handle.Task;
GameObject result = handle.Result;
Addressables.Release(handle);
return result;
```

```csharp
// Wrong: Addressables cannot track clones created this way.
var handle = Addressables.LoadAssetAsync<GameObject>(key);
yield return handle;
GameObject clone = Object.Instantiate(handle.Result);
Addressables.Release(handle); // Too early while clone is still in use.
```

```csharp
// Wrong: per-frame loading and release creates churn and operations.
private void Update()
{
    Addressables.LoadAssetAsync<Sprite>(currentKey);
}
```
