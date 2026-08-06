---
name: unity-object-pooling
description: Design, implement, review, and optimize object pooling in Unity projects, with a primary focus on Unity 2022.3 LTS and UnityEngine.Pool. Use when tasks involve repeated Instantiate/Destroy calls, bullets, projectiles, enemies, VFX, particles, audio emitters, damage numbers, UI items, reusable managed objects or temporary collections, pool sizing or prewarming, dirty pooled state, double release, pool ownership, lifecycle cleanup, GC spikes, allocation reduction, or deciding whether pooling is worth its complexity.
---

# Unity Object Pooling

Use pooling as a measured lifecycle optimization, not as a default architecture. Reduce repeated creation and destruction while preserving correctness, explicit ownership, clean reset behavior, and maintainable code.

Target Unity 2022.3 LTS by default. Inspect `ProjectSettings/ProjectVersion.txt`, package versions, scripting backend, target platform, existing pool code, `AGENTS.md`, and the GDD before choosing APIs or changing architecture.

## Core Principles

1. Make the non-pooled behavior correct first.
2. Pool only reusable objects whose repeated creation or destruction is frequent, expensive, or measured as a meaningful source of frame-time or allocation pressure.
3. Prefer Unity's built-in `UnityEngine.Pool` APIs for Unity 2021 LTS and newer unless the requirements justify a custom pool.
4. Give every pool one clear owner and every leased object one clear return path.
5. Treat reset behavior as part of the object's contract. A pooled object must behave like a clean instance on every lease.
6. Pair every `Get` with exactly one `Release`. Prevent double release, use-after-release, external destruction, and forgotten returns.
7. Size and prewarm from expected concurrency, then verify with measured peak usage.
8. Profile before and after. Keep the cleaner implementation when a more complex optimization provides little practical value.

## Workflow

### 1. Inspect the Project and Use Case

Determine:

- Unity and C# compatibility.
- Existing architecture, factories, spawners, pool managers, and ownership conventions.
- Object type, prefab identity, lifetime, spawn frequency, burst behavior, and peak concurrent count.
- Construction cost: components, hierarchy, renderers, physics, animation, initialization, asset loading, and subscriptions.
- Despawn conditions: timeout, collision, death, effect completion, scene unload, cancellation, or explicit owner action.
- Whether target-device profiling already shows `Instantiate`, `Destroy`, managed allocations, or GC-related stutter.

Do not create a second pooling framework when the project already has a suitable one. Extend the existing approach within task scope when it is correct and maintainable.

### 2. Decide Whether to Pool

Pool when several of these are true:

- The same type is created and destroyed repeatedly during gameplay.
- Objects have short or repeated lifetimes, such as projectiles, particles, enemies, damage numbers, audio emitters, decals, or scrolling UI cells.
- Construction or destruction causes measurable CPU spikes, native work, managed allocations, or GC pressure.
- Concurrent usage is bounded or can be estimated.
- Resetting the object is cheaper and simpler than reconstructing it.

Usually do not pool when:

- The object is created rarely or only during loading.
- The object remains alive for most of the scene.
- Its state is difficult to reset safely.
- Retaining pooled objects causes unacceptable memory use.
- A simpler cache, reusable component, disabled scene object, or data-only reuse solves the problem.
- Profiling shows no meaningful benefit and pooling would add lifecycle complexity.

Read `references/pool-selection-and-sizing.md` for detailed selection rules.

### 3. Select the Pool Type

Use the smallest suitable option:

- `ObjectPool<T>`: default for reusable `GameObject`, `Component`, and managed-object instances. It stores inactive items in a stack and creates an item when empty.
- `LinkedPool<T>`: consider only after profiling when its storage trade-off is preferable. Do not assume it is faster.
- `IObjectPool<T>`: depend on this interface when code should not care which built-in pool implementation is used.
- `ListPool<T>`, `HashSetPool<T>`, `DictionaryPool<TKey,TValue>`, or `CollectionPool<TCollection,TItem>`: use for temporary managed collections with explicit release ownership.
- Custom bounded pool: use when an empty pool must fail instead of creating, active count must be hard-capped, allocation during gameplay is forbidden, deterministic slot identity is required, or built-in lifecycle semantics do not fit.
- Addressables-aware pool: use only with explicit asset and handle ownership; also load `unity-assets-addressables`.

Do not use `UnityEngine.Pool` from worker threads or Jobs. It is not thread-safe, and Unity objects must remain on the main thread. Load `unity-jobs-burst-native-collections` for data-parallel native workloads.

### 4. Define Ownership and Lifecycle Before Coding

Specify:

- Who creates and owns the pool.
- Whether the pool is scene-scoped, feature-scoped, or persistent across scenes.
- Who may spawn and who may return objects.
- Whether active items remain children of the pool owner.
- What happens on owner destruction, scene unload, application shutdown, and domain-reload-disabled Play Mode.
- Whether active borrowed items must be tracked separately for cleanup.

Prefer a typed feature-level wrapper such as `ProjectilePool` or `DamageNumberPool`. Expose narrow `Spawn` and `Despawn` operations instead of exposing the raw pool everywhere.

Avoid a universal global pool manager keyed by strings unless the project genuinely needs many dynamic prefab pools and has a clear ownership and cleanup model. Prefer one pool per concrete prefab or compatible object family.

### 5. Define the Lease and Reset Contract

Centralize lifecycle behavior:

- `createFunc`: instantiate or construct once, cache required components, and assign the owning pool reference.
- `actionOnGet` or wrapper `Spawn`: apply spawn context and reset state before activation when `OnEnable` depends on that state.
- `actionOnRelease`: stop work, clear state and references, then deactivate or otherwise make the item reusable.
- `actionOnDestroy`: permanently destroy overflow or cleared Unity objects.

For `GameObject` and `Component` pools, always provide an `actionOnDestroy` that calls `Object.Destroy` on the owned object. A released item that exceeds `maxSize` must not leave its native Unity object alive.

Reset every state value mutated during a lease. Check transforms, parent, active state, rigidbody state, colliders, particles, trails, animation, audio, health, timers, targets, owners, event subscriptions, coroutines, async operations, cancellation, renderer state, UI state, and temporary collections as applicable.

Do not use `OnDisable` as an automatic return path unless re-entrancy and intentional external disabling are handled explicitly. Prefer one explicit idempotent `ReturnToPool` method guarded by lease state.

Read `references/reset-contracts.md` before pooling complex GameObjects.

### 6. Understand Built-In Capacity Semantics

Do not confuse these values:

- `defaultCapacity` reserves the backing stack capacity. It does not instantiate or prewarm objects.
- `maxSize` limits how many inactive items the pool retains. It does not cap active leases, total created items, or calls to `Get`.
- When empty, `ObjectPool<T>.Get` creates another item.
- When full, `Release` invokes the destroy callback rather than retaining the returned item.
- `collectionCheck` detects returning an item already held by the pool in the Editor. Do not rely on it as a player-build safety mechanism.
- `Clear` and `Dispose` remove inactive stored items and invoke the destroy callback for them. Active borrowed items remain the caller's responsibility.

If gameplay requires a hard active limit or no runtime creation, implement that requirement explicitly instead of assuming `maxSize` provides it.

### 7. Prewarm Deliberately

Estimate an initial count from actual concurrency, for example:

```text
steady concurrency ~= spawn rate per second * maximum active lifetime
initial prewarm     ~= steady concurrency + measured burst headroom
```

Treat the estimate only as a starting point. Track peak active count in representative worst-case gameplay and adjust from evidence.

Prewarm during a loading phase or another acceptable time, not on the first critical gameplay frame. Prewarm by acquiring distinct items before releasing them; repeatedly getting and immediately releasing one item only reuses the same instance.

Do not prewarm to `maxSize` automatically. Pooling trades runtime work for resident memory, so oversized pools can be worse on memory-constrained mobile devices.

### 8. Implement Cleanly

Use these defaults unless project conventions require otherwise:

- Use a typed wrapper around `IObjectPool<T>`.
- Keep prefab/configuration data serialized and runtime pool state private.
- Configure a spawned object before activating it when `OnEnable` reads spawn state.
- Store the owning pool or a release callback in the pooled item when the item must return itself.
- Guard return with a lease flag so collision, timeout, and owner cleanup cannot release twice.
- Do not let consumers call `Destroy` on pooled objects.
- Do not add a generic `IPoolable` hierarchy unless multiple types genuinely share a stable lifecycle contract.
- Do not clear expensive state indiscriminately when only a small known subset changes; reset exactly what the object owns and mutates.

Read `references/implementation-patterns.md` for Unity 2022.3-compatible examples.

### 9. Verify Correctness Before Judging Performance

Compile and test the exact feature. Verify:

- Fresh and reused items behave identically.
- No prior owner, target, health, timer, velocity, animation, particle, audio, material, UI, coroutine, event, or async state leaks into the next lease.
- Every get has one release under timeout, collision, cancellation, disable, death, scene unload, and owner-destroy paths.
- Double release and external destruction are prevented or detected.
- Pool exhaustion, burst spawning, overflow release, clear, and shutdown are safe.
- The pool does not retain scene objects, delegates, cancellation sources, assets, or handles after its lifetime.
- Repeated scene loads do not duplicate persistent pools or leave inactive objects behind.

Use Edit Mode tests for pure managed lifecycle logic and Play Mode tests for GameObject, physics, scene, particle, animation, and timing behavior.

### 10. Measure and Keep Only Valuable Optimization

After implementation is correct and has no known bugs, compare the same workload before and after pooling. Inspect:

- CPU time and spikes around `Instantiate`, `Destroy`, spawn, reset, and release.
- `GC Alloc` and garbage collection behavior.
- Frame-time stability, especially worst frames during bursts.
- Active, inactive, and total object counts.
- Resident managed and native memory.
- Startup or loading cost added by prewarming.

Profile a Development Build on the target device when the result matters. Editor-only measurements are preliminary.

Retain pooling when the measured value justifies its memory and code cost. If the performance gain is minor but the implementation significantly harms clarity, ownership, or reliability, keep the cleaner non-pooled solution. Accept additional complexity only when the benefit is substantial and verified.

Read `references/profiling-and-validation.md` for the complete test and profiling checklist.

## Common Failure Modes

- Treating `defaultCapacity` as prewarm count.
- Treating `maxSize` as a hard active-object cap.
- Prewarming the same instance repeatedly instead of holding distinct leases.
- Releasing twice from collision and timeout paths.
- Returning an object without stopping coroutines, async work, particles, audio, physics, or events.
- Activating before applying spawn state, causing `OnEnable` to read stale data.
- Destroying pooled objects outside the pool.
- Pooling several incompatible prefabs in one typed pool.
- Using one static global pool without scene or feature ownership.
- Retaining too much memory to avoid an unmeasured allocation problem.
- Claiming optimization without before-and-after target-device evidence.

## Related Skills

Load only when relevant:

- `unity-project-context`: inspect Unity version, packages, repository structure, and project conventions.
- `unity-gameplay-architecture`: choose pool ownership, feature boundaries, factories, and dependency direction.
- `unity-csharp-collections-queries`: reuse or pool managed collections and buffers correctly.
- `unity-async-coroutines-unitask`: cancel and reset asynchronous work when items are returned.
- `unity-assets-addressables`: manage pooled Addressable instances and handles.
- `unity-performance-profiling`: perform deeper CPU, memory, GC, and target-device measurement.
- `unity-jobs-burst-native-collections`: handle thread-safe native and data-parallel workloads instead of pooling Unity objects from Jobs.

## References

- Read `references/pool-selection-and-sizing.md` for the decision matrix, capacity semantics, ownership, and sizing.
- Read `references/reset-contracts.md` for component-specific reset requirements.
- Read `references/implementation-patterns.md` for typed pool, prewarm, collection-pool, and hard-cap examples.
- Read `references/profiling-and-validation.md` for verification, diagnostics, and measurement.
- Read `references/research-summary.md` for the filtered source synthesis and primary source links.
