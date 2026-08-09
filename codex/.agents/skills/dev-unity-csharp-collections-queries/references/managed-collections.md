# Managed Collections Decision Catalog

## Contents

- [Selection questions](#selection-questions)
- [Arrays](#arrays)
- [List](#listt)
- [Dictionary](#dictionarytkey-tvalue)
- [HashSet](#hashsett)
- [Queue and Stack](#queuet-and-stackt)
- [LinkedList](#linkedlistt)
- [Sorted collections](#sorted-collections)
- [Read-only interfaces and wrappers](#read-only-interfaces-and-wrappers)
- [Views, slices, and rented buffers](#views-slices-and-rented-buffers)
- [Concurrent managed collections](#concurrent-managed-collections)
- [Composite indexes](#composite-indexes)
- [Equality, keys, and ordering](#equality-keys-and-ordering)

Use [source-of-truth.md](source-of-truth.md) for source keys. This catalog summarizes official Unity 2022.3 and Microsoft documentation; verify project-specific costs with profiling.

## Selection questions

Before choosing a container, answer:

1. Is size fixed, bounded, or dynamically growing?
2. Is access primarily by index, key, membership, insertion order, sorted order, FIFO, or LIFO?
3. Are duplicates valid?
4. Is stable order required by gameplay, save data, tests, networking, or replay?
5. How often are items added, removed, searched, sorted, or enumerated?
6. Must Unity serialize the data directly in an Inspector, scene, prefab, or ScriptableObject?
7. Is this main-thread managed code, a custom managed thread, or a Unity Job/Burst path?
8. Does the public API need mutation or only read access?

Do not select a collection only from average asymptotic complexity. Also consider small collection sizes, memory layout, resizing, comparer behavior, mutation frequency, and readability. [M1][M2][M5]

## Arrays

**Use when**

- Length is fixed or established before repeated use.
- Index access and contiguous storage are valuable.
- Unity must serialize a simple sequence directly.
- A caller-owned result buffer is appropriate.

**Typical usage**

```csharp
private readonly RaycastHit[] hits = new RaycastHit[32];

int hitCount = Physics.RaycastNonAlloc(ray, hits, maxDistance, layerMask);
for (int i = 0; i < hitCount; i++)
{
    Process(hits[i]);
}
```

**Benefits**

- Simple fixed-size semantics.
- Direct indexed access.
- Unity serializes arrays of supported element types. [U3]
- Suitable as preallocated buffers for Unity non-allocating APIs. [U5][U10]

**Drawbacks and limits**

- Resizing requires a new array and copy.
- A fixed result buffer can truncate results; define overflow behavior.
- Returning a new array from a frequently called method creates managed allocations. [U5]
- The array itself does not enforce uniqueness, sorting, or ownership.

**Choose instead**

- `List<T>` when size changes often.
- `Dictionary<TKey,TValue>` for repeated key lookup.
- `HashSet<T>` for uniqueness and membership.
- Native containers for Jobs/Burst-compatible native memory.

## `List<T>`

**Use when**

- Ordered items need dynamic growth.
- Indexing and iteration are common.
- Duplicates are valid.
- Unity must serialize a simple variable-length sequence.

**Typical usage**

```csharp
[SerializeField] private List<GunDefinition> guns = new();

private readonly List<Collider> results = new(32);

private void CollectColliders()
{
    results.Clear();
    GetComponents(results);
}
```

**Benefits**

- Familiar ordered container with index access.
- Supports capacity preallocation and reuse.
- Unity serializes `List<T>` when `T` is supported. [U3]
- Many Unity APIs provide overloads that fill a supplied list. [U9]

**Drawbacks and limits**

- Membership or key lookup scans unless a second index exists.
- Insertions/removals away from the end shift elements.
- Growth can reallocate and copy.
- `Clear` preserves capacity; this is useful for reuse but retains memory. [U5]
- Exposing the mutable list directly allows external code to bypass invariants.

**Future-feature trigger**

Add a lookup index when the GDD introduces frequent access by a stable identifier, category, or ownership key. Keep one authoritative source and rebuild derived indexes predictably.

## `Dictionary<TKey, TValue>`

**Use when**

- Each unique key maps to one value.
- Repeated lookup, insertion, replacement, or removal by key is central.
- The key has stable equality and hash behavior.

**Typical usage**

```csharp
private readonly Dictionary<GunType, GunDefinition> gunByType = new();

private bool TryBuildIndex(IEnumerable<GunDefinition> source)
{
    gunByType.Clear();

    foreach (GunDefinition gun in source)
    {
        if (gun == null || !gunByType.TryAdd(gun.Type, gun))
            return false;
    }

    return true;
}
```

**Benefits**

- Expresses one-key-to-one-value ownership clearly.
- Supports explicit duplicate policy through `Add`, assignment, or `TryAdd`.
- Capacity and equality comparer can be selected up front. [M6]

**Drawbacks and limits**

- Keys must remain logically stable while stored.
- Duplicate insertion behavior differs by API; define it explicitly.
- Do not depend on enumeration order for gameplay correctness; use explicit ordering when order matters.
- Unity does not directly serialize dictionaries. Use serialized source data plus a rebuilt runtime index, or custom serialization when justified. [U3]
- A cached dictionary can become stale when its source mutates; define rebuild/invalidation ownership.
- Maintaining both a list and dictionary adds memory and synchronization effort.

**Do not use as a default replacement for every search**

For a tiny collection queried rarely, a linear scan may be simpler and sufficiently cheap. Measure repeated workload before adding an index.

## `HashSet<T>`

**Use when**

- Values must be unique.
- Membership, add-if-absent, remove, union, intersection, or subset logic is central.
- Values have stable equality and hash behavior.

**Typical usage**

```csharp
private readonly HashSet<int> activeEnemyIds = new();

if (activeEnemyIds.Add(enemyId))
    RegisterEnemy(enemyId);
```

**Benefits**

- Represents set semantics directly.
- Prevents duplicates by design.
- Supports in-place set operations such as union and intersection. [M7]

**Drawbacks and limits**

- Unordered; use a separate ordered representation when presentation or deterministic order matters.
- Unity does not directly serialize it under the standard field rules. [U3]
- Equality/comparer mistakes can silently produce incorrect membership behavior.
- Converting from another collection repeatedly can create work and allocations; retain a set only when repeated operations justify it.

## `Queue<T>` and `Stack<T>`

### `Queue<T>`

Use for **FIFO** behavior: command processing, spawn requests, breadth-first traversal, or ordered work consumption. [M1]

```csharp
private readonly Queue<SpawnRequest> pendingSpawns = new();

pendingSpawns.Enqueue(request);
while (pendingSpawns.Count > 0)
    Spawn(pendingSpawns.Dequeue());
```

**Benefits**: communicates FIFO intent and avoids manual index bookkeeping.

**Drawbacks**: not designed for arbitrary lookup, sorting, or removing an item from the middle.

### `Stack<T>`

Use for **LIFO** behavior: undo history, nested traversal, backtracking, or reusable object storage. [M1]

```csharp
private readonly Stack<GameState> history = new();

history.Push(currentState);
GameState previous = history.Pop();
```

**Benefits**: communicates LIFO intent and keeps operations focused.

**Drawbacks**: not suitable for arbitrary access or stable oldest-first processing.

For both types, define empty behavior (`TryDequeue`/`TryPop` availability depends on the profile/API version; verify before use) and maximum growth policy.

## `LinkedList<T>`

**Use when**

- Code already holds valid node references and performs frequent insertion/removal around those nodes.
- Bidirectional traversal is required.

**Benefits**

- Node insertion/removal can avoid shifting contiguous elements.
- Supports traversal from either end. [M1]

**Drawbacks and limits**

- Per-node memory overhead and poor locality.
- Indexed access is not provided.
- Searching for the node remains a traversal unless nodes are indexed elsewhere.
- Often worse than `List<T>` when code does not already retain node references.

Do not choose it merely because middle removal sounds common; include the cost of finding the node.

## Sorted collections

Use an ordered container only when the collection must remain sorted across updates. If data changes in batches and is read many times, a normal list plus explicit sort may be simpler.

### `SortedList<TKey, TValue>`

**Use when**

- Key order is required.
- Data is populated mostly in a batch or changes infrequently.
- Lower memory use and indexed key/value access are useful.

**Drawbacks**

- Insert/remove for unsorted incoming data can shift elements.
- Requires a valid key comparer.

Microsoft documents that `SortedList` uses less memory than `SortedDictionary`, while unsorted insertion/removal is slower. [M8]

### `SortedDictionary<TKey, TValue>`

**Use when**

- Key order is required.
- Insertions/removals occur regularly.

**Drawbacks**

- More memory overhead than `SortedList`.
- Still not a Unity-serializable dictionary field under standard rules. [U3][M9]

### `SortedSet<T>`

Use when values must remain unique and sorted. Costs include comparer requirements and more overhead than an unordered set. Verify API availability under the selected profile.

## Read-only interfaces and wrappers

Use `IReadOnlyList<T>`, `IReadOnlyCollection<T>`, or `IReadOnlyDictionary<TKey,TValue>` at public boundaries when callers should inspect but not mutate the collection through that API.

**Benefits**

- Communicates ownership and protects invariants at the API level.
- Allows implementation changes behind the interface.

**Drawbacks and limits**

- A read-only interface or `ReadOnlyCollection<T>` wrapper is not an immutable snapshot. The owner may still mutate the underlying collection, and a wrapper reflects those changes. [M11]
- Returning a copied snapshot adds allocation and copy cost.
- Returning an interface can affect enumeration implementation details; profile only if the path matters.

State whether consumers need a live view or a snapshot.

## Views, slices, and rented buffers

These types do not replace the normal collection catalog. Use them when the important requirement is **viewing or temporarily borrowing contiguous storage without copying**.

### `ArraySegment<T>`

Use when an API needs a range of an existing one-dimensional array and the range can share the source array's lifetime. It wraps an array plus offset and count rather than copying the range. [M12]

```csharp
ArraySegment<Enemy> visibleRange = new(enemies, start, count);
```

**Benefits**

- Avoids copying a subsection into a new array.
- Can be stored, passed, and enumerated like an ordinary value.
- Makes the represented bounds explicit.

**Drawbacks**

- The underlying array is still mutable and owned elsewhere.
- The view becomes semantically stale when the source content is reused or changed.
- It only represents array-backed ranges, not an arbitrary list slice.
- Holding the segment keeps the entire backing array reachable.

### `Span<T>` and `ReadOnlySpan<T>`

Use for synchronous processing of a contiguous memory region when a lightweight bounded view improves an API and the project profile supports it. Microsoft documents `Span<T>` as a type-safe, memory-safe view over contiguous memory. [M13][M14]

```csharp
private static int CountAlive(ReadOnlySpan<EnemyState> enemies)
{
    int count = 0;

    for (int i = 0; i < enemies.Length; i++)
    {
        if (enemies[i].IsAlive)
            count++;
    }

    return count;
}
```

**Benefits**

- Can slice contiguous storage without copying.
- Expresses read-only versus writable access.
- Useful for low-level parsers, buffers, and synchronous pipelines.

**Drawbacks and limits**

- `Span<T>` is a `ref struct`; it cannot be stored in ordinary fields, boxed, used across `await`, or captured by iterators/closures. [M14]
- It is not a Unity-serializable field and is not a replacement for authoring data.
- Passing spans through every layer can make ordinary gameplay code harder to read.
- Verify API/backend behavior in the actual Unity project before relying on a modern BCL pattern.

### `Memory<T>` and `ReadOnlyMemory<T>`

Use when a contiguous memory view must survive beyond a synchronous stack scope or cross an asynchronous boundary. [M14]

**Benefits**: longer-lived view semantics than `Span<T>` and conversion to spans for processing.

**Drawbacks**: ownership/lifetime becomes less obvious, the backing storage is still shared, and ordinary gameplay systems rarely need this abstraction.

### `ArrayPool<T>`

Use when variable-size temporary arrays are created and discarded frequently enough to create meaningful managed-memory pressure. `Rent` returns an array whose length is **at least** the requested minimum, and `Return` gives ownership back to the pool. [M15]

```csharp
int[] buffer = ArrayPool<int>.Shared.Rent(requiredCount);
try
{
    Process(buffer, requiredCount);
}
finally
{
    ArrayPool<int>.Shared.Return(buffer, clearArray: false);
}
```

**Benefits**

- Reuses managed arrays without permanently assigning one buffer to each owner.
- Can reduce repeated large/variable array allocations.

**Drawbacks and correctness requirements**

- The rented array may be larger than requested and may contain previous data.
- The caller must track the logical length separately.
- Once returned, the array must not be read, written, or returned again. [M15]
- Use `clearArray: true` when references or sensitive/stale data must be cleared; clearing has a cost.
- Pooling may retain large buffers and adds strict ownership complexity.
- For a stable repeated query, one owner-local array is often simpler.

Do not expose a rented buffer to code that can retain it beyond the rental scope.

## Concurrent managed collections

Use concurrent collections only for actual custom managed-thread access. They add synchronization and API constraints. [M1][M10]

Do not use them as a substitute for Unity Job System containers. Burst does not support managed objects; Jobs use unmanaged/native data and Unity's safety system. [U11][U12]

Before introducing concurrent collections, define:

- thread ownership;
- producer/consumer model;
- cancellation and shutdown;
- whether Unity APIs are touched only on the main thread;
- whether lock-free behavior is actually required.

## Composite indexes

Sometimes one container cannot express all access patterns. Example:

- serialized `List<GunDefinition>` as authoritative designer data;
- runtime `Dictionary<GunType, GunDefinition>` for key lookup;
- optional sorted list for shop display.

**Benefits**

- Each read path uses an appropriate representation.
- Designer data remains serializable.

**Drawbacks**

- Extra memory.
- Rebuild/invalidation complexity.
- Duplicate and missing-key policies must be centralized.
- Multiple representations can drift if more than one is treated as authoritative.

Prefer one source of truth and derived indexes. Rebuild at a defined lifecycle point or update through one controlled mutation API.

## Equality, keys, and ordering

- Use `IEqualityComparer<T>` when domain equality differs from default equality. [M5][M6][M7]
- Use `IComparer<T>` when domain ordering differs from default ordering. [M5][M8][M9]
- Do not mutate fields that participate in equality/hash semantics while an item is inside a hash-based container.
- Do not use unstable runtime references as save/network identifiers.
- When deterministic order matters, sort by explicit stable keys and define tie-breakers.
- Treat comparer changes as behavior changes and test duplicates, boundaries, and ordering.

