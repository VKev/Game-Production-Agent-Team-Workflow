---
name: dev-unity-scene-management
description: Design, implement, review, debug, and refactor robust Unity scene loading and transition systems. Use for SceneManager, LoadSceneAsync, UnloadSceneAsync, additive or single-scene loading, bootstrap and persistent scenes, scene groups, loading screens and progress, active-scene selection, sceneLoaded or sceneUnloaded events, cross-scene lifetime and communication, deferred activation, light probes after additive changes, Build Settings or Unity 6 Build Profile scene lists, Eflatun SceneReference, Addressable scenes, scene-streaming boundaries, duplicate loads, transition cancellation, failure recovery, and scene-flow tests.
---

# Unity Scene Management

Build scene transitions as owned, observable lifecycle operations rather than scattered `SceneManager` calls. Preserve the project's current scene model unless a concrete correctness, memory, authoring, or delivery requirement justifies changing it.

## Required workflow

### 1. Inspect the project contract

1. Read the relevant project instructions, GDD, bootstrap code, scene loaders, flow coordinators, and scene-reference assets.
2. Confirm the Unity version from `ProjectSettings/ProjectVersion.txt`.
3. Inspect `Packages/manifest.json` and `Packages/packages-lock.json` before relying on Addressables, UniTask, VContainer, or a scene-reference package.
4. Determine how runtime scenes enter the player:
   - Unity 2022/2023 Build Settings,
   - Unity 6 global or Build Profile Scene List,
   - Addressables,
   - AssetBundles or another verified provider.
5. Inventory currently loaded scenes, persistent roots, active-scene policy, loading UI ownership, scene events, and all direct cross-scene references.
6. Preserve established identifiers, serialized fields, scene GUIDs, build entries, Addressables keys, and public transition contracts when practical.

Use `dev-unity-project-context` before navigating or editing a real Unity project. Use live Unity tooling for scene, hierarchy, Inspector, Console, compilation, test, and player-state verification when available.

### 2. Choose the smallest suitable scene model

- Use **single-scene replacement** for a small product whose complete playable state fits one scene and does not need persistent world composition.
- Use a **bootstrap plus replaceable content scene** when application services must survive level changes but content can still be replaced as one unit.
- Use **bootstrap plus additive scene groups** when gameplay, UI, environment, cinematics, or tooling have distinct authoring or lifetime boundaries.
- Use **streamed cells or chunks** only when world scale, memory, traversal, or authoring requires incremental spatial loading.
- Use **Addressable scenes** only when soft references, remote delivery, content updates, explicit handle ownership, or independent content builds are real requirements.

Read [references/architecture-and-lifetimes.md](references/architecture-and-lifetimes.md) before introducing additive groups, persistent roots, session scenes, streaming, or new cross-scene services.

### 3. Define the transition contract before coding

Record:

```text
Transition owner:
Request policy: join, queue, replace, reject, or coalesce
Source and target scene sets:
Retained scenes:
Load and unload identifiers:
Active-scene policy:
Activation and readiness policy:
Loading-overlay owner:
Progress contract:
Cancellation owner:
Failure and rollback policy:
Post-load work:
Verification paths:
```

Keep one transition authority. Do not let UI callbacks, game states, triggers, editor buttons, and static events independently load or unload scenes.

### 4. Validate scene definitions

Before mutating runtime state:

- Reject null or empty required references.
- Require unique stable identifiers. Prefer a full project-relative path, `Scene`, verified soft reference, or provider handle over a bare scene name.
- Require exactly one active-scene candidate when the group needs one.
- Reject duplicate entries unless multiple instances are explicitly supported and tracked by returned `Scene` values or handles.
- Confirm each native scene is enabled in the active build scene list for the intended player target.
- Confirm each Addressable scene resolves under the installed package version and active profile.
- Validate required persistent services and scene-context contracts.
- Detect duplicate cameras, AudioListeners, EventSystems, input routers, lighting owners, and persistent roots.

Use Eflatun SceneReference only when it is already present or its installation is explicitly in scope. Its Inspector validation improves authoring safety, but runtime code must still check state or `TryGet` results and handle failures.

### 5. Execute transitions as transactions

Use this sequence as the default, then document justified deviations:

```text
receive request
-> acquire the single transition gate
-> validate the complete target plan
-> publish transition-started
-> show the persistent loading presentation
-> retain, load, and unload according to the memory/recovery plan
-> await every owned operation
-> verify loaded scenes and provider handles
-> set and verify the active scene
-> perform required post-load work
-> initialize scene contexts and wait for group readiness
-> publish transition-completed
-> hide loading presentation
-> release the gate
```

- Put presentation cleanup and gate release in `finally`.
- Classify cancellation separately from failure.
- Define recovery for partial load, partial unload, activation failure, initialization failure, and application exit.
- If memory allows, consider loading and validating new content before releasing old content to improve rollback. If peak memory forbids that, unload first and provide a safe recovery scene or retry path.
- Store each returned native `Scene` or Addressables load handle. Do not re-resolve ownership later from a possibly duplicated name.
- Treat `Awake`, `OnEnable`, and `Start` in newly activated scenes as earlier than group readiness unless the project proves otherwise.
- Emit `LoadStarted` after a request begins and `LoadCompleted` only after the corresponding operation completes. Do not label a request-start event as loaded.

Read [references/transitions-progress-and-events.md](references/transitions-progress-and-events.md) before implementing concurrency, cancellation, deferred activation, progress, lifecycle events, or rollback.

### 6. Handle activation, progress, and presentation honestly

- Separate measured operation progress from visual smoothing. Smoothing may lag actual progress but must not overwrite it with a constant target.
- Treat arithmetic averages as approximate unless operations are intentionally weighted.
- Report phases such as unload, dependency/download, scene load, activation, initialization, and cleanup when those phases matter.
- Do not report completion before activation and required initialization finish.
- When native `allowSceneActivation` or Addressables `activateOnLoad` is false, account for the 0.9 progress plateau and the fact that an unactivated scene can stall Unity's async-operation queue.
- Do not use fake progress unless the product explicitly wants an indeterminate animation; label it as indeterminate rather than percentage complete.
- Keep the loading overlay and its camera outside scenes that are being unloaded.

### 7. Complete Unity-specific post-load work

- Call `SceneManager.SetActiveScene` deliberately and verify its boolean result.
- Rebuild light-probe tetrahedralization after additive scene load or unload when loaded content uses Light Probes; choose the version-appropriate synchronous or asynchronous API and profile the cost.
- Define lighting, volume, camera, AudioListener, EventSystem, input, physics, navigation, and save-state ownership across the composed scenes.
- Use `LoadSceneParameters` only when a separate local 2D or 3D physics scene is required and verify the project's physics contract.
- Call `Resources.UnloadUnusedAssets` deliberately, not automatically after every transition. Keep it outside reported load completion unless the user-facing transition actually waits for it.
- Reset static scene state and static event subscriptions when Domain Reload can be disabled.

Read [references/native-addressable-and-version-boundaries.md](references/native-addressable-and-version-boundaries.md) for native SceneManager, Addressables, Awaitable, build-list, activation, light-probe, and SceneReference boundaries.

### 8. Keep cross-scene communication owned

- Keep the bootstrap scene as a composition root, not a container for every runtime object.
- Put application services, optional session state, scene contexts, and transient operations in distinct lifetimes.
- Prefer explicit references or injection for owned one-to-one collaboration.
- Use narrow events for genuine one-to-many notifications and unsubscribe symmetrically.
- Avoid making a global event bus or service locator the default dependency mechanism.
- Prevent persistent services from retaining scene-owned objects after unload.
- Register scene services during scene-context initialization and remove them before or during unload.

### 9. Verify the real transition matrix

Read [references/verification.md](references/verification.md), then verify proportionally to risk:

1. Compile the actual Unity project and clear relevant Console errors and warnings.
2. Test every supported boot and direct-entry scene path.
3. Exercise every legal transition plus invalid and duplicate requests.
4. Test cancellation or application exit at each important await point.
5. Inject load, activation, initialization, and unload failures where practical.
6. Repeat transitions and inspect the hierarchy for duplicates, retained scenes, stale references, and leaked handles.
7. Verify the active scene, cameras, AudioListeners, EventSystems, lighting, input, navigation, and scene contexts.
8. Test the intended player build; Editor success does not prove build-list, Addressables, memory, or platform correctness.
9. Profile representative transitions only when performance or memory matters.

## Review red flags

Treat these as defects unless the project provides a verified reason:

- `async void` outside unavoidable Unity or event roots without owned exception handling.
- Concurrent transition calls mutating shared scene state.
- Events named `Loaded` or `Unloaded` emitted immediately after operations start.
- A progress target forced to `1` before receiving measured progress.
- Bare-name duplicate detection or unloading in projects with same-named scenes.
- Scene index zero or the current active scene retained accidentally rather than by explicit policy.
- Multiple or missing active-scene declarations.
- Additively activated scenes running gameplay before group readiness.
- Addressable scenes unloaded through native SceneManager calls instead of their owned handle.
- Releasing an Addressables scene handle while its scene remains in use.
- `allowSceneActivation = false` used without accounting for queue blocking.
- Persistent roots storing scene-owned cameras, actors, views, or callbacks.
- `Resources.UnloadUnusedAssets` called on every transition without measurement or a memory policy.
- Editor-only scene success used as evidence that a player build contains the scene.

## Related skills

- Use `dev-unity-game-manager` when high-level boot, menu, loading, gameplay, results, restart, or session phases own the transition request.
- Use `dev-unity-gameplay-hierarchy-architecture` for hierarchy roots, authored content, persistent objects, and `DontDestroyOnLoad` placement.
- Use `dev-unity-async-coroutines-unitask` for detailed coroutine, Task, Awaitable, UniTask, cancellation, and fire-and-forget behavior.
- Use `dev-unity-assets-addressables` for Addressables handles, groups, bundle layout, remote delivery, catalogs, and release ownership.
- Use `dev-unity-gameplay-architecture` for broader module, state-machine, dependency, and composition decisions.
- Use `dev-unity-vcontainer` only when the project uses VContainer and scene or session scopes need exact registration and parenting behavior.
- Use `dev-unity-performance-profiling` for measured transition timing, memory peaks, stalls, and device validation.

## Reference index

- [architecture-and-lifetimes.md](references/architecture-and-lifetimes.md): scene strategies, lifetime roots, group definitions, and communication boundaries.
- [transitions-progress-and-events.md](references/transitions-progress-and-events.md): transactional sequencing, concurrency, activation, progress, events, and recovery.
- [native-addressable-and-version-boundaries.md](references/native-addressable-and-version-boundaries.md): version-aware native, Addressables, SceneReference, build-list, physics, and lighting rules.
- [verification.md](references/verification.md): edit-time, play-mode, player, failure, repetition, and profiling checks.
- [sources.md](references/sources.md): analyzed tutorial evidence and primary source set.
