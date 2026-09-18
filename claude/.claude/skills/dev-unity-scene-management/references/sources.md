# Sources and Research Boundaries

Prefer the installed Unity/package documentation and project source when behavior differs from these links. Use tutorials as design evidence, not as authority over version-matched primary documentation.

## Tutorial evidence

- [Additive Async Multi-Scene Loading in Unity](https://www.youtube.com/watch?v=JFP-cCFID7o) — analyzed with automatic English captions and targeted visual frames.
- [Exact accompanying source commit](https://github.com/adammyhre/Unity-Inventory-System/commit/e9931acafefae7177540d9da0f054c6bd5603102) — confirms the bootstrap, group manager, progress, event, and unload implementation shown in the video.

Retain the tutorial's useful architecture ideas: a persistent bootstrap, declarative scene groups, asynchronous additive loads, and explicit active-scene selection. Do not inherit its constant-one progress target, prematurely emitted load/unload events, name-based ownership, accidental index-zero retention, missing transition gate, or absent failure recovery.

## Unity scene lifecycle and loading

- [Unity 6 SceneManager](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager.html)
- [Unity 6 SceneManager.LoadSceneAsync](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager.LoadSceneAsync.html)
- [Unity 6 SceneManager.UnloadSceneAsync](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager.UnloadSceneAsync.html)
- [Unity 6 SceneManager.SetActiveScene](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager.SetActiveScene.html)
- [Unity 6 SceneManager.GetSceneByPath](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager.GetSceneByPath.html)
- [Unity 6 SceneManager.sceneLoaded](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager-sceneLoaded.html)
- [Unity 6 LoadSceneMode.Additive](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.LoadSceneMode.Additive.html)
- [Unity 6 LoadSceneParameters](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.LoadSceneParameters.html)
- [Unity 6 LocalPhysicsMode](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.LocalPhysicsMode.html)
- [Unity 6 RuntimeInitializeOnLoadMethodAttribute](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html)
- [Unity 6 Object.DontDestroyOnLoad](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.DontDestroyOnLoad.html)

## Async behavior, progress, and memory

- [Unity 6.3 Await support](https://docs.unity3d.com/6000.3/Documentation/Manual/AwaitSupport.html)
- [Unity 6 AsyncOperation.allowSceneActivation](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AsyncOperation-allowSceneActivation.html)
- [Unity 6 AsyncOperation.progress](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AsyncOperation-progress.html)
- [Unity 6 Resources.UnloadUnusedAssets](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Resources.UnloadUnusedAssets.html)
- [Unity 6 Configurable Enter Play Mode and Domain Reloading](https://docs.unity3d.com/6000.3/Documentation/Manual/domain-reloading.html)

## Build inclusion and post-load systems

- [Unity 6 Manage scenes in a build](https://docs.unity3d.com/6000.3/Documentation/Manual/build-profile-scene-list.html)
- [Unity 6 BuildProfile](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Build.Profile.BuildProfile.html)
- [Unity 6 EditorBuildSettings.scenes](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/EditorBuildSettings-scenes.html)
- [Unity 6 LightProbes.TetrahedralizeAsync](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/LightProbes.TetrahedralizeAsync.html)

## Addressables scene APIs

The `@1.21` pages below are researched examples. Route to the exact installed Addressables documentation/source before copying an API signature.

- [Loading Addressable scenes](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/manual/LoadingScenes.html)
- [Addressables.LoadSceneAsync](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.LoadSceneAsync.html)
- [Addressables.UnloadSceneAsync](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.AddressableAssets.Addressables.UnloadSceneAsync.html)
- [SceneInstance.ActivateAsync](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.ResourceManagement.ResourceProviders.SceneInstance.ActivateAsync.html)
- [AsyncOperationHandle.GetDownloadStatus](https://docs.unity3d.com/Packages/com.unity.addressables@1.21/api/UnityEngine.ResourceManagement.AsyncOperations.AsyncOperationHandle.GetDownloadStatus.html)

## Scene reference authoring

- [Eflatun.SceneReference](https://github.com/starikcetin/Eflatun.SceneReference) — use the installed version's state, unsafe-reason, `TryGet`, Inspector, and Addressables documentation.
