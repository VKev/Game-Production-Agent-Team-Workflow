# Query and Iteration Techniques

## Contents

- [Decision inputs](#decision-inputs)
- [Indexed for loops](#indexed-for-loops)
- [foreach loops](#foreach-loops)
- [Single-pass explicit queries](#single-pass-explicit-queries)
- [LINQ](#linq)
- [Materialization](#materialization)
- [Terminal operators](#terminal-operators)
- [Ordering, grouping, joins, and set operations](#ordering-grouping-joins-and-set-operations)
- [Custom iterators and yield return](#custom-iterators-and-yield-return)
- [Cached indexes and precomputation](#cached-indexes-and-precomputation)
- [Reusable result buffers](#reusable-result-buffers)
- [Mutation during enumeration](#mutation-during-enumeration)
- [Failure semantics](#failure-semantics)

Use [source-of-truth.md](source-of-truth.md) for source keys.

## Decision inputs

For any query, determine:

- whether all items or only one result is needed;
- whether early exit is possible;
- whether the source mutates during or between executions;
- whether order and tie-breaking are meaningful;
- whether the result is consumed once or repeatedly;
- whether a temporary result collection is needed;
- whether logging/validation needs to happen during traversal;
- whether the code runs in a repeated Unity runtime path.

The same syntax can be appropriate in initialization code and inappropriate in a high-frequency path. Do not decide from syntax alone.

## Indexed `for` loops

**Use when**

- The source has stable indexed access, such as an array or `List<T>`.
- The index is part of the logic.
- You need explicit bounds, reverse traversal, partial ranges, or in-place updates.
- A clear single-pass hot-path implementation is desirable.

```csharp
for (int i = 0; i < enemies.Count; i++)
{
    Enemy enemy = enemies[i];
    if (!enemy.IsAlive)
        continue;

    UpdateEnemy(enemy);
}
```

**Benefits**

- Execution and early-exit behavior are explicit.
- Easy to process a subset or mutate elements by index.
- Avoids hidden query composition.

**Drawbacks**

- More bookkeeping and opportunity for off-by-one errors.
- Can be less readable for complex transformations.
- Not suitable for containers without efficient indexing.

Do not claim `for` is universally faster than `foreach`; measure the actual source type, backend, and workload.

## `foreach` loops

**Use when**

- You need clear read-oriented traversal.
- The collection exposes an appropriate enumerator.
- Index values are irrelevant.

```csharp
foreach (GunDefinition gun in guns)
{
    if (gun.IsUnlocked)
        visibleGuns.Add(gun);
}
```

**Benefits**

- Expresses iteration directly.
- Reduces index bookkeeping.
- Microsoft recommends `foreach` rather than manually manipulating enumerators. [M2]

**Drawbacks and checks**

- Modifying the collection structure during enumeration is generally invalid.
- Enumeration through interfaces, non-generic APIs, closures, or custom enumerators can have different allocation behavior; inspect and profile rather than applying folklore.
- Early exit is available with `break`, but multiple derived outputs may require more explicit code.

## Single-pass explicit queries

Use one explicit loop when several decisions can be made together or when validation, logging, and duplicate policy must be visible.

```csharp
private bool TryBuildGunIndex(
    IReadOnlyList<GunDefinition> guns,
    Dictionary<GunType, GunDefinition> destination)
{
    destination.Clear();

    foreach (GunDefinition gun in guns)
    {
        if (gun == null)
        {
            Debug.LogError("Gun list contains a null entry.");
            return false;
        }

        if (!destination.TryAdd(gun.Type, gun))
        {
            Debug.LogError($"Duplicate gun type: {gun.Type}");
            return false;
        }
    }

    return true;
}
```

**Use when**

- Only one pass should produce multiple values.
- Exact failure behavior matters.
- The query has side effects, diagnostics, or mutation.
- Early exit avoids unnecessary work.

**Drawbacks**

- Longer than a declarative query.
- Can mix too many responsibilities if validation, transformation, and storage are not separated thoughtfully.

## LINQ

LINQ provides a common query pattern over `IEnumerable<T>`. Query syntax and method syntax are semantically equivalent; the compiler translates query syntax into method calls. [M3][M4]

### Use LINQ when

- The code is editor-only, test-only, initialization-time, loading-time, event-driven, or otherwise infrequent.
- The transformation reads naturally as filtering, projection, grouping, joining, ordering, or aggregation.
- The team understands deferred execution and materialization.
- The source is not being mutated unexpectedly between query creation and execution.
- The generated work and allocations are acceptable for the measured context.

```csharp
GunDefinition[] unlocked = guns
    .Where(gun => gun != null && gun.IsUnlocked)
    .OrderBy(gun => gun.Price)
    .ThenBy(gun => gun.Type)
    .ToArray();
```

### Benefits

- Concise composable transformations.
- Clear vocabulary for filtering, projection, grouping, joining, ordering, and aggregation.
- Easy to separate query declaration from consumption when deferred execution is useful.

### Drawbacks and limits

- Many sequence-returning operators are deferred; the source is read when enumerated, not when the query variable is declared. Re-enumeration repeats work and may see changed source data. [M3]
- Sorting and grouping are non-streaming and must consume source data before yielding results. [M3]
- Materializers create result collections.
- Predicates/selectors are delegates; closures that capture local state can allocate in performance-sensitive code. Unity specifically warns about closures and method references in frequently executed paths. [U5]
- Chained queries can hide multiple passes, temporary structures, duplicate policy, or exceptions.
- Debugging a long pipeline can be harder than inspecting named intermediate steps.
- LINQ to Objects is managed code and is not a general substitute for Burst-compatible job code.

### Do not ban or mandate LINQ

Ask whether it improves this exact code. A one-time readable query may be preferable to a verbose manual loop. A per-agent query repeated every frame may justify an explicit loop, cached index, or changed algorithm. Confirm with profiling when performance matters.

## Materialization

Materialization converts a query to stored results, commonly through `ToArray`, `ToList`, `ToDictionary`, or `ToLookup`. [M3]

**Use when**

- Results are consumed more than once.
- A snapshot at a specific time is required.
- The source may mutate later.
- An API requires a concrete collection.

**Benefits**

- Executes once and caches results.
- Makes snapshot timing explicit.
- Avoids accidental repeated enumeration.

**Drawbacks**

- Allocates and copies data.
- Can hold references longer than necessary.
- `ToDictionary` requires a unique key for each element; define duplicate behavior before using it.
- Snapshot results can become stale.

Prefer a named variable when materialized results are reused:

```csharp
List<Enemy> targets = enemies
    .Where(IsValidTarget)
    .ToList();

AimAt(targets);
DisplayTargets(targets);
```

## Terminal operators

Terminal operators return a scalar or single item and execute the query. [M3][M4]

### `Any`

Use to test existence. It can stop after the first match.

```csharp
bool hasBoss = enemies.Any(enemy => enemy.Type == EnemyType.Boss);
```

Avoid `Count(predicate) > 0` when only existence is needed; `Any` communicates intent and can early-exit.

### `All`

Use when every item must satisfy a condition. Define the expected result for an empty source; LINQ's logical semantics may surprise callers.

### `Count`

Use when the exact count is required. If the source is a concrete collection, prefer its `Count` property rather than enumerating through a general sequence.

### `First` / `FirstOrDefault`

Use when the first matching item according to source order is meaningful. Define behavior for no match and avoid ambiguous default values.

### `Single` / `SingleOrDefault`

Use when uniqueness is an invariant and multiple matches must be treated as an error. This is validation semantics, not merely retrieval.

### `Min`, `Max`, `Sum`, `Average`, `Aggregate`

Use for explicit aggregation. Check empty-source behavior, overflow, floating-point behavior, and whether the selected Unity/.NET profile contains the desired overload.

## Ordering, grouping, joins, and set operations

### Ordering

`OrderBy`/`ThenBy` are deferred but non-streaming: the full source must be consumed and ordered before results are yielded. [M3]

Use when a derived ordered view is required. For frequent reads with rare changes, consider sorting once and invalidating on mutation.

Always define stable tie-breakers when deterministic output matters:

```csharp
var ordered = enemies
    .OrderBy(enemy => enemy.Distance)
    .ThenBy(enemy => enemy.StableId);
```

### Grouping

Use `GroupBy` for one-off grouping or reporting. For repeated lookup by group key, a retained dictionary/list index may be more appropriate.

Drawbacks include materialized group state, deferred execution complexity, and unclear ownership when results outlive the source.

### Joins

Use LINQ joins when combining two in-memory data sources is clearer than nested loops. For repeated joins, build an index on the repeatedly searched key.

### Set operations

Use `Distinct`, `Union`, `Intersect`, and `Except` for derived sequences. Use a retained `HashSet<T>` when in-place set operations, repeated membership, or richer subset/superset checks are required. [M7]

Define equality with an appropriate comparer.

## Custom iterators and `yield return`

A method using `yield return` creates an iterator with deferred execution. [M3]

```csharp
private static IEnumerable<Enemy> AliveEnemies(IEnumerable<Enemy> enemies)
{
    foreach (Enemy enemy in enemies)
    {
        if (enemy.IsAlive)
            yield return enemy;
    }
}
```

**Use when**

- Streaming results is useful.
- Consumers may stop early.
- A reusable query abstraction is clearer than returning a full collection.

**Benefits**

- Avoids building the entire result collection when streaming is sufficient.
- Composes with `foreach` and LINQ.

**Drawbacks**

- Work happens during enumeration, so exceptions and source changes occur later than method call time.
- Re-enumeration repeats work.
- Iterator state machinery and interface use may matter in hot paths; profile.
- Lifetime of captured objects or source collections can become less obvious.

Do not return a deferred iterator when callers expect a stable snapshot.

## Cached indexes and precomputation

Use a cached lookup or precomputed result when the same query is repeated and the source changes less often than it is read.

```csharp
private readonly Dictionary<GunType, GunDefinition> gunByType = new();
private int indexedVersion = -1;

private void EnsureIndex(GunCatalog catalog)
{
    if (indexedVersion == catalog.Version)
        return;

    RebuildIndex(catalog.Guns, gunByType);
    indexedVersion = catalog.Version;
}
```

**Benefits**

- Moves repeated search work to controlled update points.
- Makes lookup semantics explicit.
- Can support several read paths with separate indexes.

**Drawbacks**

- Memory overhead.
- Stale-cache bugs.
- More mutation/invalidation architecture.
- Initialization/rebuild spikes.
- Serialization and domain reload considerations.

Define:

- authoritative data;
- who mutates it;
- when indexes rebuild;
- whether partial updates are safe;
- failure behavior for duplicates;
- how domain reload and scene transitions affect the cache.

## Reusable result buffers

Use caller-owned or component-owned buffers when a repeated API can fill existing storage. Unity documents collection/array reuse and several APIs that accept supplied buffers. [U5][U9][U10]

```csharp
private readonly List<AnimatorClipInfo> clips = new(4);

private void ReadClips(Animator animator, int layer)
{
    clips.Clear();
    animator.GetCurrentAnimatorClipInfo(layer, clips);
}
```

**Benefits**

- Reduces repeated managed allocations.
- Makes capacity and ownership visible.

**Drawbacks**

- Results are overwritten on the next call.
- Shared buffers are not reentrant or thread-safe.
- Retained capacity consumes memory.
- Fixed arrays require overflow policy.

Never return a shared mutable buffer as though it were an owned snapshot.

## Mutation during enumeration

Do not structurally modify most managed collections while enumerating them. Choose one of these patterns:

- collect changes and apply afterward;
- iterate backward by index when removing from a list;
- use a write index to compact an array/list;
- copy only when the snapshot semantics justify the allocation;
- use a container/API designed for the required concurrent mutation.

State whether element mutation is safe separately from collection-structure mutation.

## Failure semantics

Make these choices explicit:

- missing item: return `false`, return `null`, return default, or throw;
- duplicate key: reject, overwrite, keep first, merge, or log;
- empty source: valid empty result or error;
- buffer full: truncate, grow, retry, or reject;
- null entry: skip, reject, or preserve;
- stale cache: rebuild, version-check, or fail;
- unsorted input: sort, validate, or document precondition.

A shorter query is not cleaner if it hides domain behavior.
