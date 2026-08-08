# Safety, dependencies, and lifetime

## Table of contents

1. Conflict model
2. Read-only access
3. Exclusive output
4. Parallel writers
5. Determinism
6. Dangerous escape hatches
7. Static data and Unity objects
8. Lifetime and teardown

## 1. Conflict model

Two scheduled accesses conflict when:

1. They touch the same native allocation or overlapping range, and
2. At least one access writes.

Resolve the conflict by:

- Adding a dependency.
- Splitting data into non-overlapping allocations/ranges.
- Changing one access to true read-only.
- Using a supported concurrent writer.
- Redesigning the stages.

Do not silence the safety exception until the access model is proven.

While a scheduled job holds conflicting access, the main thread must not read, write, resize, clear, or dispose the collection. Call `Complete()` on the relevant dependency before regaining ownership.

## 2. Read-only access

Mark job fields with `[ReadOnly]` when the job never writes them:

```csharp
[ReadOnly] public NativeArray<float3> Positions;
```

This documents intent and permits multiple jobs to read the same data concurrently without false write conflicts.

Do not mark data read-only and then mutate it through an unsafe alias. That defeats the safety contract.

## 3. Exclusive output

The safest parallel-write pattern is one output element per iteration:

```text
iteration i reads any read-only input
iteration i writes output[i]
```

For neighborhoods or variable ranges:

- Partition into disjoint ranges.
- Use two passes: count/flag, then offset/write.
- Use per-thread buffers and merge.
- Use atomics only for small, well-defined reductions where contention is acceptable.

Avoid multiple iterations performing read-modify-write on the same element.

## 4. Parallel writers

Use only the collection's supported writer:

- `NativeList<T>.ParallelWriter`
- `NativeQueue<T>.ParallelWriter`
- `NativeParallelHashMap<TKey,TValue>.ParallelWriter`
- `NativeParallelMultiHashMap<TKey,TValue>.ParallelWriter`
- Other writer types exposed by the installed package

Rules:

- Pre-size capacity.
- Use methods allowed by the writer, such as `AddNoResize` where required.
- Check duplicate/overflow behavior.
- Assume insertion order is nondeterministic.
- Complete the writer job before reading the collection.

A writer provides safe concurrent mutation for its documented methods, not a general lock around the collection.

## 5. Determinism

Parallel scheduling order varies. Determinism can be lost through:

- Concurrent append order.
- Hash-map/set iteration order.
- Floating-point reduction order.
- Atomics and race-dependent winner selection.
- `FloatMode.Fast` and architecture-specific SIMD.

When determinism matters:

- Write by stable index.
- Sort by stable keys after parallel generation.
- Use deterministic range partitioning and merge order.
- Reduce in a fixed tree/order if numeric reproducibility is required.
- Define tie-breaking explicitly.
- Test repeated runs and target architectures.

Thread-safe is not the same as deterministic.

## 6. Dangerous escape hatches

Treat these as last-resort tools:

- `[NativeDisableParallelForRestriction]`
- `[NativeDisableContainerSafetyRestriction]`
- Unsafe collections and pointers
- Manual atomics
- Aliasing assumptions
- Disabling Burst safety checks

Use an escape hatch only when:

- The normal safety system cannot express a proven non-overlapping pattern.
- Access ranges can be demonstrated mathematically or by construction.
- The code is isolated and reviewed.
- Tests stress random sizes, scheduling, and boundaries.
- Target Player profiling proves meaningful benefit.
- A comment explains the invariant and owner.

Never use one to work around a missing dependency.

## 7. Static data and Unity objects

Do not access mutable static data from jobs. The Job System cannot track it, and it can cause races or crashes.

Do not pass `GameObject`, `Component`, ordinary `Transform`, `ScriptableObject`, managed delegate, or arbitrary managed service into a job.

Use:

- Value snapshots.
- IDs or indices resolved outside the job.
- Native buffers.
- `TransformAccessArray` only through its supported job API.
- ECS component data when the project uses Entities.

Do not call Physics, rendering, Animator, NavMesh, or other main-thread APIs from generic worker jobs. Compute commands/results in jobs and apply them on the main thread.

## 8. Lifetime and teardown

A scheduled job cannot be cancelled. Teardown must wait or preserve memory until completion.

Before destroying the owner, unloading a scene, changing buffer capacity, or disposing:

1. Complete the last handle that can access the data.
2. Prevent new scheduling.
3. Dispose each owned allocation once.
4. Clear references/flags.

For persistent services:

- Make initialization idempotent.
- Handle domain reload and Enter Play Mode settings according to project policy.
- Complete jobs during explicit shutdown and `OnDestroy`.
- Avoid duplicate persistent owners after scene reload.

For pooled or versioned consumers, attach a request/generation ID to output. If the consumer becomes stale before the job finishes, complete safely and ignore the stale result rather than accessing destroyed objects.
