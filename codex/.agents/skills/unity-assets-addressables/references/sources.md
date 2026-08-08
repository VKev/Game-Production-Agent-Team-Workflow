# Official sources and research boundaries

Research date: 2026-07-28.

Use the installed package documentation and package source as the final authority when project behavior differs. These sources are official Unity documentation or Unity's official sample repository. The primary target is Unity 2022.3 with the Addressables 1.21 package family.

## Unity 2022.3 package compatibility

- Unity 2022.3 Addressables package page:
  https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.addressables.html

## Core runtime operations

- Loading Addressable assets:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/load-addressable-assets.html
- Async operation handles:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetsAsyncOperationHandle.html
- Synchronous loading and `WaitForCompletion` limitations:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/SynchronousAddressables.html
- `LoadAssetAsync` API:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.LoadAssetAsync.html
- `LoadAssetsAsync` API and partial-failure behavior:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.LoadAssetsAsync.html
- `InstantiateAsync` API and handle tracking:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.InstantiateAsync.html
- `ReleaseInstance` API:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.ReleaseInstance.html
- AssetReference loading:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/LoadingAssetReferences.html
- `AssetReference` API:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.AssetReference.html

## Scenes and downloads

- Loading scenes:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/LoadingScenes.html
- `LoadSceneAsync` API:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.LoadSceneAsync.html
- `UnloadSceneAsync` API:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.UnloadSceneAsync.html
- Predownloading dependencies and querying download size:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/DownloadDependenciesAsync.html
- Clearing dependency cache:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.ClearDependencyCacheAsync.html

## Groups, bundles, profiles, and reports

- Packing groups into AssetBundles:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/PackingGroupsAsBundles.html
- Content Packing & Loading schema:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ContentPackingAndLoadingSchema.html
- AssetBundle memory overhead:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/memory-assetbundles.html
- Profile variables:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ProfileVariables.html
- Build/load paths:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/profiles-build-load-paths.html
- Addressables settings:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/AddressableAssetSettings.html
- Addressables Report:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/addressables-report-window.html
- Addressables Profiler module:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/ProfilerModule.html

## Remote content and updates

- Remote content distribution overview:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/remote-content-intro.html
- Content update overview:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/content-update-builds-overview.html
- Content update settings and group restrictions:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/content-update-build-settings.html
- Creating an update build:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/content-update-build-create.html
- Updating catalogs and bundle-conflict considerations:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.UpdateCatalogs.html
- Content catalogs:
  https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/build-content-catalogs.html

## Official examples

- Unity Technologies Addressables sample repository:
  https://github.com/Unity-Technologies/Addressables-Sample

Treat examples as starting points rather than universal production architecture. Verify each pattern against the installed package and the project's ownership, update, platform, and failure requirements.

## Scope boundaries

This skill intentionally avoids prescribing one universal group layout, Addressables for every asset, a global static loading manager, UniTask as a required dependency, a custom provider without a concrete requirement, or version-sensitive settings without target-platform verification.
