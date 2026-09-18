# Native, Addressables, and Version Boundaries

## Contents

- [Confirm versions first](#confirm-versions-first)
- [Use native SceneManager safely](#use-native-scenemanager-safely)
- [Validate player scene inclusion](#validate-player-scene-inclusion)
- [Use Unity async APIs deliberately](#use-unity-async-apis-deliberately)
- [Own Addressable scenes by handle](#own-addressable-scenes-by-handle)
- [Use SceneReference as authoring validation](#use-scenereference-as-authoring-validation)
- [Handle lighting, physics, and cleanup](#handle-lighting-physics-and-cleanup)
- [Reset static state under configurable Enter Play Mode](#reset-static-state-under-configurable-enter-play-mode)

## Confirm versions first

Inspect the project rather than assuming current online APIs apply.

| Boundary | Version-sensitive fact |
|---|---|
| Unity 6.3 | No native Unity `Awaitable`; projects commonly use coroutines, Task adapters, or installed UniTask |
| Unity 6.3 | Unity supports awaiting `AsyncOperation`-derived APIs and provides pooled `Awaitable` |
| Unity 6 | Build Profiles can override the global scene list per active profile |
| Addressables | Load, activation, unload, handle, progress, and failure behavior must match the resolved package version |
| Third-party SceneReference | Runtime state, validation API, Addressables integration, and install syntax must match the installed version |

Do not silently upgrade Unity or install a package during a scene-management feature task.

## Use native SceneManager safely

- Prefer `LoadSceneAsync` during gameplay unless a verified requirement needs synchronous loading.
- Pass a full scene path when duplicate names can exist.
- Store the returned `Scene` or obtain it by full path after completion; avoid repeated name lookup.
- Use the `Scene` overload of `UnloadSceneAsync` when ownership already has that value.
- Remember that unloading destroys scene GameObjects and removes the scene, but does not automatically unload all associated assets.
- Ensure another scene remains loaded; Unity cannot unload the last loaded scene through `UnloadSceneAsync`.
- Treat `SceneManager.sceneCount` and `GetSceneAt` as a snapshot whose entries can include scenes currently loading or unloading.
- Use `SceneManager.sceneLoaded`, `sceneUnloaded`, and `activeSceneChanged` for engine lifecycle observation, not as a substitute for transition ownership.

`SetActiveScene` affects the target for newly instantiated GameObjects and the source of lighting settings. It does not determine which loaded scenes render. Check its returned boolean.

## Validate player scene inclusion

For native SceneManager loads:

- In Unity 2022/2023, validate enabled scenes in Build Settings.
- In Unity 6, inspect the active platform/build profile. A Build Profile can override the global Scene List.
- Test a player built with the intended active profile. An Editor-only play path may access scenes that the player does not contain.
- Preserve scene GUIDs and enabled/order intent when editing lists.

For Addressable scenes, validate the Addressables group, active profile, catalog, content build, and player compatibility instead of adding the scene to the native list unless the architecture intentionally needs both.

## Use Unity async APIs deliberately

Unity 6.3 allows direct awaiting of `AsyncOperation`-derived APIs. When using `Awaitable`:

- Do not await the same pooled Awaitable instance more than once.
- Keep continuations on the Unity main thread before accessing Unity APIs.
- Return `Awaitable` from Unity-facing asynchronous APIs when it fits the existing project; preserve `Task` or UniTask at established boundaries rather than mixing types throughout the feature.
- Reserve `async void` for unavoidable Unity lifecycle or event roots and observe exceptions at that root.

For Unity 6.3 or projects using UniTask, route exact continuation timing, cancellation, and conversion choices through `dev-unity-async-coroutines-unitask`.

Native scene loading does not become transactionally cancellable merely because the caller stops awaiting it. Define whether late completion is released, adopted, or ignored.

## Own Addressable scenes by handle

When the installed Addressables version is used:

1. Store the `AsyncOperationHandle<SceneInstance>` returned by `Addressables.LoadSceneAsync`.
2. Keep the handle alive for the entire scene lifetime.
3. Check operation status and failure information before using the result.
4. Activate deliberately when `activateOnLoad` is false.
5. Unload with `Addressables.UnloadSceneAsync` using the owned load handle or `SceneInstance`.
6. Understand the selected unload overload's `autoReleaseHandle` behavior and prevent double release.
7. Do not unload the same scene through native SceneManager and then separately release it without a verified ownership design.

Addressables delegates scene loading to Unity's SceneManager, so deferred activation can stall other Addressables and Unity AsyncOperations. Do not use `activateOnLoad: false` casually.

Use `GetDownloadStatus().Percent` for byte-weighted download progress when presenting downloads. `PercentComplete` weights sub-operations equally and may communicate a different meaning.

Treat release-before-completion as relinquishing ownership, not guaranteed cancellation. Guard against late completion accessing a destroyed owner.

## Use SceneReference as authoring validation

Eflatun SceneReference can provide GUID, path, build index, name, address, Inspector coloring, unsafe-reason checks, and `TryGet` methods. Use it to reduce string and build-list errors when the package is already part of the project.

Do not assume the package makes every reference loadable:

- A regular scene still needs to be enabled in the intended native scene list.
- An Addressable scene needs Addressables support and provider-specific loading.
- A red or unsafe Inspector field must fail validation before runtime mutation.
- Accessors that depend on valid state can fail; use validation or `TryGet`.
- The exact scene loader must branch correctly between native and Addressable ownership when both are supported.

Do not install this dependency solely because a tutorial uses it unless installation is explicitly authorized.

## Handle lighting, physics, and cleanup

After additive scene load or unload:

- Re-tetrahedralize Light Probes when loaded probe positions changed. Unity 6 provides `LightProbes.TetrahedralizeAsync`; older supported versions may require the synchronous API.
- Decide which active scene owns lighting settings.
- Define ownership for global volumes, reflection probes, baked data, and environment-specific systems.
- Use `LoadSceneParameters` with `LocalPhysicsMode.Physics2D` or `Physics3D` only for a deliberate isolated physics scene. Document how objects enter that physics scene and how simulation is driven.
- Rebuild or reconnect navigation only through version- and package-appropriate APIs; do not assume additively loaded navigation becomes ready with the scene event.

Call `Resources.UnloadUnusedAssets` only from an explicit memory policy. Unity determines reachability from hierarchies and static variables, not from the script execution stack. Measure transition cost and ensure local references do not unexpectedly lose their assets.

## Reset static state under configurable Enter Play Mode

When Domain Reload is disabled, static fields and static event handlers persist between Play Mode runs. Scene-management code must explicitly reset:

- Static singleton references.
- Static loaded-scene registries.
- Static transition gates or cached tasks.
- Static SceneManager event subscriptions.
- Static bootstrap-created flags.

Use an appropriate runtime initialization reset such as `SubsystemRegistration` when the project supports disabled Domain Reload. Keep subscription and unsubscription symmetric in both Editor and player lifecycles.
