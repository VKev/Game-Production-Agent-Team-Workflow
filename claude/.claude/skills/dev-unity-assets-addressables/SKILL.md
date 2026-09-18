---
name: dev-unity-assets-addressables
description: Documentation-grounded guidance for choosing, implementing, reviewing, and optimizing Unity 6.3 runtime asset management with direct references, Resources, and the exact installed Addressables package. Use for AssetReference, AsyncOperationHandle, addresses and labels, loading or unloading assets and scenes, InstantiateAsync, handle or reference-count leaks, groups and bundle layout, profiles, remote catalogs, CDN delivery, predownloads, content updates, Analyze, Build Layout Report, migration from Resources or AssetBundles, and Addressables build or CI problems. Inspect the locked package version before using version-sensitive APIs.
---

# Unity Assets and Addressables

Choose the simplest asset-management mechanism that satisfies the real runtime, memory, delivery, and update requirements. Treat Addressables as a lifecycle and content-pipeline system, not as a replacement for every serialized reference.

## Operating principles

1. Inspect the project before proposing changes.
2. Do not introduce Addressables only because it is available.
3. Define ownership and lifetime before writing load code.
4. Pair every owned load or instantiate operation with the correct release operation.
5. Design groups around runtime usage and update behavior, not only folder structure.
6. Verify bundle layout, memory behavior, and update behavior with Addressables tools and a player build.
7. Preserve the project's existing async conventions unless a measured or functional need justifies changing them.

## Workflow

### 1. Inspect project context

Read the project `AGENTS.md`, GDD, relevant feature folders, and existing asset-loading code. Check:

- `ProjectSettings/ProjectVersion.txt`.
- `Packages/manifest.json` and `Packages/packages-lock.json`.
- The installed `com.unity.addressables` version.
- `Assets/AddressableAssetsData`, if present.
- Existing groups, schemas, profiles, labels, addresses, build scripts, and remote catalog settings.
- Current use of direct references, `Resources`, AssetBundles, `AssetReference`, and custom providers.
- Build target, scripting backend, API compatibility, platform restrictions, and CI workflow.

Use Unity 6.3 documentation plus the exact installed Addressables package documentation and source. Never infer an API from a different package major or minor line.

### 2. Decide whether Addressables is appropriate

Use the decision rules in [decision-guide.md](references/decision-guide.md).

Start with:

- **Direct serialized reference** when content ships with the player, is always needed with its owner, and does not need independent unloading or remote delivery.
- **Resources** only for a deliberately small and stable bootstrap or compatibility case where its limitations are accepted.
- **Addressables** when the feature needs on-demand loading, explicit release, optional or remote content, content updates, streaming scenes, download-size control, or inspector-authored soft references.
- **Native AssetBundles or custom providers** only when the project has a concrete pipeline requirement that Addressables cannot satisfy.

Do not migrate a working fixed-content feature to Addressables without a specific benefit.

### 3. Define the asset contract

Before implementation, write down:

- What is loaded: asset, prefab instance, scene, label set, or dependencies only.
- Who starts the operation.
- Who owns the returned handle.
- How long the result must remain valid.
- What event ends that lifetime.
- Whether repeated calls join, reject, replace, queue, or run in parallel.
- What happens on failure, offline startup, scene unload, owner destruction, or application exit.
- Whether the content is local, remote, or profile-dependent.

Never return a loaded asset from a service while silently releasing its handle before the caller's usage lifetime ends.

### 4. Select the lookup mechanism

Choose deliberately:

- Use a typed `AssetReference` field for Inspector authoring, type filtering, and asset renaming safety.
- Use a stable address when code or external configuration identifies one asset.
- Use a label to select a set. Do not assume a label identifies one unique asset.
- Use multiple keys plus `MergeMode` when a query needs union, intersection, or first-match semantics.
- Resolve and cache `IResourceLocation` values only when repeated location lookup is a measured concern or custom provider logic needs locations directly.

Avoid scattered magic strings. Follow existing project conventions for constants, catalogs, ScriptableObject configuration, or generated keys.

### 5. Design ownership and release

Read [loading-and-ownership.md](references/loading-and-ownership.md) before editing loading code.

Enforce these invariants:

- Keep an `AsyncOperationHandle` for at least as long as its result is in use.
- Release successful and failed operation handles when ownership ends, except when the selected API overload explicitly auto-releases the failed operation and its dependencies.
- Treat release-before-completion as release-on-completion, not true cancellation.
- Check `IsValid()` before releasing a stored handle when lifecycle paths can overlap.
- Prevent double release with one explicit ownership flag or state.
- Release an `InstantiateAsync` result with `Addressables.ReleaseInstance`, not only `Object.Destroy`.
- Destroy manually instantiated clones yourself and keep the prefab load handle until every dependent clone is finished.
- Unload Addressable scenes through `Addressables.UnloadSceneAsync` using the load handle or `SceneInstance`.
- Do not expect releasing one asset to immediately free memory when another asset keeps the containing bundle loaded.

### 6. Design groups and bundles

Read [groups-bundles-memory.md](references/groups-bundles-memory.md).

Group assets by a combination of:

- Load and unload lifetime.
- Content that is commonly requested together.
- Local versus remote delivery.
- Update frequency and release cadence.
- Platform or quality variant.
- Shared dependency behavior.

Do not create one group per folder or one bundle per asset by default. Do not make every dependency Addressable automatically.

Use Analyze and the Build Layout Report to inspect:

- Duplicate dependencies.
- Assets pulled in implicitly.
- Bundle-to-bundle dependencies.
- Bundle count and size.
- Built-in scene or `Resources` duplication.
- Unexpected large bundles or shared dependencies.

Fix reported duplication only when it creates meaningful build-size, download, memory, or update cost. Duplication can be intentional for mutually exclusive content.

### 7. Configure remote content and updates when required

Read [remote-content-updates.md](references/remote-content-updates.md).

Use separate profiles for development, local hosting, staging, and production when their paths differ. For remote updates:

- Enable and publish the remote catalog and its hash.
- Keep remote group build and load paths consistent with the active profile.
- Archive the published full build's `addressables_content_state.bin`.
- Classify groups by update cadence before release.
- Run content-update checks before an update build.
- Update catalogs before loading related bundles whenever possible.
- Test offline, retry, timeout, cache, and interrupted-download behavior.

Do not treat Addressables content updates as code updates. Code, Unity-version, or package-version changes normally require a new player and a new compatible content build.

### 8. Implement asynchronous operations

Use the project's established coroutine, callback, Task, or UniTask conventions. For deeper async and cancellation decisions, use the `dev-unity-async-coroutines-unitask` skill.

Follow these rules:

- Prefer asynchronous APIs during gameplay.
- Avoid `WaitForCompletion` for remote or potentially slow operations.
- Check `AsyncOperationStatus` and `OperationException` where relevant.
- Release valid failed handles unless the selected API overload explicitly documents automatic failure cleanup. For example, verify the installed `LoadAssetsAsync` overload and its `releaseDependenciesOnFailure` behavior.
- Do not assume an Addressables load is cancellable. If the requester no longer cares, release ownership and ignore late completion safely.
- Do not use `AsyncOperationHandle.Task` on WebGL without verifying platform support.
- Use `GetDownloadStatus().Percent` for byte-weighted download progress; `PercentComplete` weights sub-operations equally.

See [implementation-patterns.md](references/implementation-patterns.md) for code patterns.

### 9. Build and verify

Read [build-testing-profiling.md](references/build-testing-profiling.md).

At minimum:

1. Compile and clear relevant Console errors and warnings.
2. Test the feature using the fast Editor mode for iteration.
3. Build Addressables content and test with **Use Existing Build**.
4. Test a development player on the target platform.
5. Exercise success, failure, repeated calls, owner destruction, scene unload, and offline cases.
6. Verify every handle and instance has one owner and one release path.
7. Run Analyze rules and inspect the Build Layout Report.
8. Inspect Addressables and Memory Profiler data for retained assets, bundle dependencies, churn, and peak memory.
9. Compare download size, load latency, memory, and build/update size against the original requirement.

After correctness is proven, optimize only when the gain justifies added complexity. Keep the cleaner design when a proposed bundle split, cache layer, custom provider, or preload system adds substantial maintenance cost for little measured value.

## Architecture boundaries

Keep this skill focused on runtime asset management and content delivery.

- Use `dev-unity-project-context` for repository navigation and project-wide context.
- Use `dev-unity-gameplay-architecture` for feature boundaries and dependency direction.
- Use `dev-unity-async-coroutines-unitask` for async composition and cancellation architecture.
- Use `dev-unity-object-pooling` when instantiated Addressable prefabs are reused frequently.
- Use `dev-unity-performance-profiling` for broad CPU, GPU, memory, and target-device investigation.

Addressables loading and object pooling solve different problems. Loading a prefab once and pooling its instances can be valid, but keep the Addressables handle alive for the entire pool lifetime and release it only after the pool has destroyed all instances.

## Reference index

- [decision-guide.md](references/decision-guide.md): choose direct references, Resources, Addressables, keys, and architecture boundaries.
- [loading-and-ownership.md](references/loading-and-ownership.md): handle lifetime, loading, instantiation, scenes, errors, and concurrency.
- [groups-bundles-memory.md](references/groups-bundles-memory.md): groups, bundle modes, dependencies, duplication, memory, and churn.
- [remote-content-updates.md](references/remote-content-updates.md): profiles, CDN delivery, downloads, catalogs, cache, and update builds.
- [build-testing-profiling.md](references/build-testing-profiling.md): play modes, builds, CI, Analyze, reports, profiling, and test matrix.
- [implementation-patterns.md](references/implementation-patterns.md): Unity 6.3-oriented C# patterns.
- [sources.md](references/sources.md): official source list and research boundaries.
