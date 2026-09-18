# Unity 6.3 Integration Guide

## Contents

- [Compatibility gate](#compatibility-gate)
- [Unity serialization](#unity-serialization)
- [Managed allocation and garbage collection](#managed-allocation-and-garbage-collection)
- [Collection reuse](#collection-reuse)
- [Unity collection pools](#unity-collection-pools)
- [Caller-provided result buffers](#caller-provided-result-buffers)
- [Unity non-allocating APIs](#unity-non-allocating-apis)
- [Profiler workflow](#profiler-workflow)
- [Correctness and ownership traps](#correctness-and-ownership-traps)
- [Decision checklist](#decision-checklist)

Use [source-of-truth.md](source-of-truth.md) for source keys. This reference targets Unity **6000.3.21f1** and must not import Unity 6 behavior without verification.

## Compatibility gate

Before using any language, BCL, package, or Unity API:

1. Confirm `ProjectSettings/ProjectVersion.txt` reports Unity 6000.3.21f1.
2. Confirm the API Compatibility Level and scripting backend.
3. Check `Packages/manifest.json` and `Packages/packages-lock.json` for optional packages.
4. Compile a minimal use site in the actual project when API availability is uncertain.
5. Test IL2CPP builds when generics, reflection, custom comparers, or platform differences matter.

Unity 6.3 uses Roslyn and documents its supported and unsupported C# features. Select the exact API compatibility profile configured by the project, and verify both language syntax and BCL availability against Unity's version-matched documentation. [U1][U2]

Do not assume that an API shown in current Microsoft documentation is available merely because the language syntax compiles. Select the documentation view matching the project's profile and verify in Unity.

## Unity serialization

Unity's built-in serializer directly supports one-dimensional arrays and `List<T>` when the element type is supported. It does not directly support dictionaries, jagged arrays, multidimensional arrays, or nested container types. [U3]

### Use serialized arrays or lists when

- Designers need to author an ordered sequence in the Inspector.
- Prefabs, scenes, or ScriptableObjects must persist the values.
- The serialized representation is the authoritative source.

```csharp
[SerializeField] private List<GunDefinition> guns = new();
```

### Build runtime indexes when

- Runtime systems repeatedly query serialized data by ID, enum, tag, category, or another stable key.
- The list is convenient for authoring but inefficient or unclear for repeated lookup.

```csharp
[SerializeField] private List<GunDefinition> guns = new();

private readonly Dictionary<GunType, GunDefinition> gunByType = new();

private void RebuildIndex()
{
    gunByType.Clear();

    foreach (GunDefinition gun in guns)
    {
        if (gun == null)
            continue;

        if (gunByType.ContainsKey(gun.Type))
            throw new InvalidOperationException($"Duplicate gun type: {gun.Type}");

        gunByType.Add(gun.Type, gun);
    }
}
```

**Benefits**

- Keeps Inspector authoring simple.
- Makes duplicate and null policy explicit.
- Separates persisted source data from derived runtime state.

**Drawbacks**

- Maintains two representations.
- Requires a clear rebuild or invalidation owner.
- Runtime index can become stale after editor/runtime mutation.
- Rebuilding has time and memory cost.

Use `ISerializationCallbackReceiver` only when custom serialization is justified. Its callbacks transform supported serialized fields into the desired runtime form; they do not make unsupported containers magically Inspector-friendly. Keep callback code deterministic and avoid Unity API calls that are unsafe during serialization. [U3]

### Do not serialize caches by default

Indexes, lookup tables, filtered views, and temporary buffers should normally be rebuilt from authoritative serialized data. Serializing derived data creates versioning and synchronization risks unless load time makes precomputation necessary and a robust validation/versioning scheme exists.

## Managed allocation and garbage collection

Unity's managed garbage collector reclaims unreachable managed objects. Frequent temporary allocations can increase CPU cost and create collection spikes. Unity's 6000.3 guidance highlights temporary allocations, collection reuse, closures, boxing, array-returning APIs, and reusable pools. [U4][U5]

### Treat allocation risk by execution context

| Context | Default stance |
|---|---|
| Editor tool, import step, build step | Prefer clarity unless scale proves problematic |
| One-time initialization or scene loading | Moderate allocations can be acceptable; avoid unnecessary peaks |
| Event-driven gameplay called infrequently | Evaluate expected frequency and target hardware |
| Per-frame, per-physics-step, per-agent path | Inspect allocation and total work carefully |
| Loading thousands of content records | Measure peak memory, total allocations, and load time |

Do not label syntax as allocating or allocation-free without checking the actual operation, overload, captured state, materialization, and runtime profile.

### Common managed-allocation sources

- Creating arrays, lists, dictionaries, sets, or query result objects.
- LINQ materializers and some query implementations.
- Iterator state machines from `yield return`.
- Capturing lambdas/closures.
- Boxing value types through non-generic APIs or interface paths.
- Repeated string construction.
- Unity properties or methods that return new arrays.
- Expanding a collection beyond its current capacity.

These are investigation prompts, not universal bans. Profile representative builds. [U5][U6][U7]

## Collection reuse

Reuse a collection when the same owner repeatedly needs temporary storage and retaining capacity is acceptable.

```csharp
private readonly List<Collider> overlaps = new(32);

private void RefreshOverlaps()
{
    overlaps.Clear();
    // Fill overlaps through a caller-provided-list API or explicit loop.
}
```

**Benefits**

- Avoids repeatedly creating the collection object and backing storage.
- Makes ownership and lifetime explicit.
- Allows capacity to stabilize for repeated workloads.

**Drawbacks and limits**

- `Clear` removes logical elements but normally retains capacity, so memory remains held.
- Reused buffers are unsafe when returned to callers that keep references.
- Reentrancy or overlapping asynchronous operations can corrupt shared temporary state.
- Large one-time spikes can leave oversized retained buffers.
- Stale contents remain possible if every fill path does not clear/reset correctly.

### Capacity policy

- Pre-size only when a reasonable bound or measured typical size exists.
- Do not set huge capacities from speculation.
- Consider replacing or trimming a buffer after rare extreme spikes only if retained memory is meaningful.
- Define what happens when a fixed buffer is too small: truncate, retry with growth, log, or fail.

## Unity collection pools

Unity 6.3 provides `CollectionPool<TCollection,TItem>` and specialized pools through `UnityEngine.Pool`. [U8]

Use a collection pool when:

- Temporary collections have non-overlapping lifetimes.
- Creating them repeatedly is measured or reasonably expected to be significant.
- Ownership can be expressed as a strict acquire/use/release scope.

```csharp
using (CollectionPool<List<Enemy>, Enemy>.Get(out List<Enemy> targets))
{
    CollectTargets(targets);
    ProcessTargets(targets);
}
```

**Benefits**

- Reuses collection instances and backing capacity.
- Avoids making every consumer own a permanent scratch buffer.
- The disposable pattern can make release reliable across early returns and exceptions.

**Drawbacks and limits**

- A released collection must never escape to another owner.
- Pooled capacity can retain memory.
- Pool misuse creates double-release, use-after-release, or cross-request data bugs.
- Pool synchronization and implementation details should not be assumed beyond documented behavior.
- Pooling adds lifecycle complexity and can be slower than local allocation for rare operations.

Never pool by reflex. Compare a permanent owner-local buffer, caller-owned buffer, pooled buffer, and ordinary allocation for the actual lifetime.

## Caller-provided result buffers

Prefer a caller-provided collection or array when the caller owns result lifetime and repeated calls should reuse storage.

```csharp
public int CollectVisibleEnemies(List<Enemy> results)
{
    if (results == null)
        throw new ArgumentNullException(nameof(results));

    results.Clear();

    foreach (Enemy enemy in enemies)
    {
        if (IsVisible(enemy))
            results.Add(enemy);
    }

    return results.Count;
}
```

Define the contract:

- Does the method clear or append?
- Can the same collection be used as both source and destination?
- Is result order stable?
- Can duplicates occur?
- What happens on failure?
- May the method retain the supplied collection?

**Benefit**: explicit ownership and reusable storage.

**Cost**: more verbose call sites and a contract that callers must follow.

Avoid returning internal mutable scratch collections. A caller could retain or modify them and corrupt later calls.

## Unity non-allocating APIs

Unity exposes API variants that fill caller-supplied arrays or lists. Examples in the 6000.3 documentation include component query list overloads and physics `NonAlloc` methods. [U5][U9][U10]

### List-filling overloads

Use list overloads when available and when the list's ownership is clear.

```csharp
private readonly List<Collider> colliders = new(16);

private void CacheColliders()
{
    colliders.Clear();
    GetComponents(colliders);
}
```

The Unity API documentation states that the list overload avoids allocating a new `List<T>` for each call. [U9]

### Fixed-array `NonAlloc` APIs

```csharp
private readonly RaycastHit[] hits = new RaycastHit[32];

private void Query(Ray ray)
{
    int count = Physics.RaycastNonAlloc(ray, hits, 100f, hitMask);

    for (int i = 0; i < count; i++)
        Process(hits[i]);
}
```

**Benefits**

- Reuses caller storage.
- Gives predictable maximum storage.
- Can remove repeated result-array allocation.

**Drawbacks and correctness requirements**

- Results beyond buffer capacity are not available; define overflow handling.
- A successful result count applies only to the first `count` slots; old data remains beyond that count.
- Do not assume result order unless the specific API documents it. Unity documents that `RaycastAll` result order is undefined; sort explicitly when order matters. [U10]
- Large per-object buffers can waste memory.
- Shared buffers are unsafe for overlapping calls.

### Choose among allocating, list-filling, and fixed-buffer APIs

- Use an allocating API for rare, simple calls when clarity matters and profiling shows no issue.
- Use a reusable list when result count varies and dynamic growth is acceptable.
- Use a fixed array when a defensible maximum exists and overflow behavior is explicit.
- Use a two-phase or growing strategy when complete results are required but the maximum is unknown.

## Profiler workflow

Do not claim an optimization from code inspection alone.

1. Reproduce a representative scenario in a Development Build.
2. Profile the target platform/device when possible.
3. Use the CPU Usage module to identify the actual caller and total cost. [U7]
4. Inspect `GC.Alloc` samples and their call stacks. [U6]
5. Distinguish Editor-only allocations and profiler overhead from player behavior.
6. Record call frequency, allocated bytes, CPU time, peak collection size, and frame impact.
7. Change one meaningful factor.
8. Re-run the same scenario and compare.
9. Verify result semantics did not change.

### Evidence labels

- **Documented**: official Unity/Microsoft/package docs establish the behavior.
- **Observed**: profiler, test, or benchmark in this project establishes the result.
- **Inferred**: engineering reasoning predicts an effect but it is not yet measured.

Never convert an inferred improvement into a measured claim.

## Correctness and ownership traps

### Shared scratch collections

A shared field buffer fails when calls can overlap through recursion, events, coroutines, asynchronous operations, or multiple consumers. Use caller ownership, separate buffers, pooling with strict scopes, or serialize access.

### Deferred queries over mutable sources

A deferred query can observe source changes at enumeration time. Materialize a snapshot when timing must be fixed. See [query-techniques.md](query-techniques.md).

### Unity object references

Collections of `UnityEngine.Object` references can retain destroyed-object wrappers and use Unity's special null behavior. Remove invalid entries according to an explicit lifecycle policy; do not assume ordinary CLR null semantics cover every case.

### Deterministic gameplay

Do not rely on unspecified hash-container or physics-query order for lockstep logic, replay, save comparison, or network determinism. Establish an explicit stable ordering and tie-breaker when the GDD requires reproducibility.

### Source and cache divergence

When a serialized list and runtime index coexist, assign one owner to mutation and index invalidation. Avoid allowing unrelated systems to modify both structures directly.

## Decision checklist

Before recommending a Unity-integrated collection/query approach, report:

- Unity version and relevant package/profile compatibility.
- Serialized source versus runtime-derived state.
- Execution context and expected frequency.
- Result ownership and lifetime.
- Allocation and capacity behavior.
- Overflow, duplicate, ordering, and stale-data policies.
- Reentrancy/threading assumptions.
- Profiler or test evidence collected.
- Future GDD changes likely to invalidate the choice.
