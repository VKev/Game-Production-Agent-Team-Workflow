# Pool Selection and Sizing

## Contents

1. Decision sequence
2. Built-in pool choices
3. Cases requiring a custom pool
4. Ownership and lifetime
5. Capacity and prewarming
6. Multi-prefab and cross-scene rules

## 1. Decision Sequence

Answer in order:

1. Is repeated creation or destruction frequent enough to matter?
2. Is the object expensive enough to create, initialize, enable, disable, or destroy?
3. Is reuse safe and cheaper than reconstructing it?
4. Is concurrent usage bounded or measurable?
5. Can one owner control every lease and return?
6. Can the object be reset to a clean state reliably?
7. Does profiling show useful CPU, allocation, or frame-stability improvement?

If the answer to several of these is no, prefer the simpler non-pooled implementation.

## 2. Built-In Pool Choices

### `ObjectPool<T>`

Use as the default for most Unity gameplay pools.

Properties:

- Stack-based inactive storage.
- Creates through `createFunc` when empty.
- Supports get, release, overflow-destroy, clear, and dispose callbacks.
- Exposes `CountActive`, `CountInactive`, and `CountAll` on the concrete type.
- Is not thread-safe.

Use for:

- Projectiles and bullets.
- Enemies or spawned actors with reliable reset behavior.
- Particle and VFX objects.
- Audio emitters.
- Damage numbers, world-space UI, and reusable UI cells.
- Managed helper objects that have explicit lifecycle reset.

### `LinkedPool<T>`

Consider when profiling demonstrates that its storage behavior is preferable. It uses linked storage rather than the stack backing used by `ObjectPool<T>` and can trade storage shape for extra per-item management cost.

Do not select it because the name sounds more flexible. Benchmark the real workload and memory profile.

### `IObjectPool<T>`

Depend on the interface when the consumer only requires `Get`, `Release`, `Clear`, and inactive count, or when the implementation may change between `ObjectPool<T>` and `LinkedPool<T>`.

Do not hide useful diagnostics behind the interface if the owner needs concrete count properties for profiling; keep the concrete pool privately as well when needed.

### Collection Pools

Use `ListPool<T>`, `HashSetPool<T>`, `DictionaryPool<TKey,TValue>`, or `CollectionPool<TCollection,TItem>` for temporary collections when:

- Allocation occurs repeatedly in a measured hot path.
- Ownership is local and release can be guaranteed.
- The retained collection capacity is reasonable.

Prefer scoped `Get(out collection)` usage for temporary local work. Do not return a pooled collection to unrelated code without documenting who releases it. Do not pool every small one-off collection.

## 3. Cases Requiring a Custom Pool

Use a custom pool or wrapper when the requirement includes any of these:

- `Get` must fail when empty instead of constructing.
- Active leases must never exceed a hard cap.
- Runtime allocation is forbidden after loading.
- Objects occupy fixed deterministic slots or IDs.
- Selection must be by priority rather than last-in-first-out reuse.
- The pool must track active objects for forced shutdown.
- Creation is asynchronous.
- Addressable asset and handle ownership must be coordinated.
- Multiple prefab types require distinct factories and lifecycle policies.
- Thread-safe managed-object reuse is needed outside Unity's main thread.

Do not modify built-in behavior through fragile assumptions. Wrap or replace it explicitly.

## 4. Ownership and Lifetime

Prefer these ownership models:

### Feature-scoped

A combat, VFX, audio, UI, or AI feature owns its concrete pool. This is usually the clearest model.

### Scene-scoped

A scene bootstrap or scene service owns pools used only in that scene. Destroy them with the scene.

### Persistent

A composition root owns pools that intentionally survive scene transitions. Use only when pooled prefabs and their dependencies are valid across those scenes. Prevent duplicate persistent owners.

For each pool, state:

- Owner object and destruction point.
- Parent transform for inactive and active objects.
- Whether active leases are tracked.
- Whether `Clear` is sufficient or active leases need forced return/destruction.
- Whether consumers may retain references after release. Usually they must not.

`Clear` and `Dispose` remove inactive stored items. They do not revoke active leases. Track active items when forced cleanup is a requirement.

## 5. Capacity and Prewarming

### Understand the numbers

`defaultCapacity`:

- Sets the initial capacity of `ObjectPool<T>`'s inactive backing stack.
- Avoids backing storage growth when enough inactive items are later stored.
- Does not construct any `T` instances.

`maxSize`:

- Limits inactive retained items.
- Does not limit active count.
- Does not prevent `Get` from creating when empty.
- Causes an overflow release to invoke `actionOnDestroy` rather than store the item.

### Estimate concurrency

For steady spawns:

```text
estimated active ~= spawn rate per second * maximum active lifetime
```

Then add only justified burst headroom. Examples:

```text
10 bullets/second * 2 seconds lifetime = about 20 steady active bullets
Add a measured burst margin, not an arbitrary 10x multiplier.
```

For waves or UI virtualization, use the maximum simultaneously visible or alive count rather than total objects created over the session.

### Prewarm correctly

To create `N` distinct objects with a built-in pool:

1. Call `Get` N times and retain all returned items temporarily.
2. Release all N after acquisition completes.
3. Clear the temporary buffer.

This is wrong:

```text
repeat N times: Get one item, immediately Release it
```

That loop can reuse one item repeatedly and fail to prewarm N instances.

Prewarm during loading or another non-critical phase. Measure startup time and memory. On mobile, an oversized prewarm can cause more harm than the runtime allocations it replaces.

### Track high-water usage

During development, record the maximum observed `CountActive` in representative worst-case gameplay. Compare it with prewarm and inactive capacity. Do not ship noisy per-frame logging.

## 6. Multi-Prefab and Cross-Scene Rules

- Use one pool per prefab when instances are not reset-compatible.
- Key multi-pool registries by stable asset identity, enum, or strongly typed configuration, not arbitrary strings when avoidable.
- Do not return an object to a pool created for another prefab.
- Remove registry entries and release owned assets when a pool lifetime ends.
- For scene-bound components, prevent a persistent pool from retaining references to unloaded scene objects.
- For Addressables, delegate handle and instance ownership details to `dev-unity-assets-addressables` and keep pooling ownership explicit.
