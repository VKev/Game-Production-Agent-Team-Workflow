# Unity Collections and Native Containers

## Contents

- [Use this reference only after the package gate](#use-this-reference-only-after-the-package-gate)
- [When native containers fit](#when-native-containers-fit)
- [When they do not fit](#when-they-do-not-fit)
- [Allocator and lifetime rules](#allocator-and-lifetime-rules)
- [Container catalog](#container-catalog)
- [Parallel access](#parallel-access)
- [Safety and ownership](#safety-and-ownership)
- [Managed-to-native conversion cost](#managed-to-native-conversion-cost)
- [Future architecture impact](#future-architecture-impact)
- [Verification checklist](#verification-checklist)

Use [source-of-truth.md](source-of-truth.md) for source keys. This reference targets the `com.unity.collections` version actually installed in a Unity **2022.3.62f2** project.

## Use this reference only after the package gate

Unity 2022.3 lists `com.unity.collections` 2.1.4 as a released package, but the project may install another compatible version or no package at all. [U13]

Before writing native-container code:

1. Read `Packages/manifest.json` and `Packages/packages-lock.json`.
2. Record the exact `com.unity.collections` version.
3. Open the matching package documentation.
4. Check whether Burst and Jobs are part of the proposed path.
5. Confirm platform, scripting backend, safety-check configuration, and assembly references.
6. Do not add the package merely to replace a small managed collection.

The package provides native data structures designed for use in jobs and optimization by Burst. [U13][UC1]

## When native containers fit

Consider native containers when one or more are true:

- Data must be accessed from Unity Jobs.
- Burst-compatible code requires unmanaged storage.
- A measured CPU-heavy workload benefits from data-oriented contiguous access or parallel processing.
- Native lifetime and explicit allocation are already part of the subsystem architecture.
- The data volume and repeated workload justify conversion and disposal complexity.

A native container is not automatically faster. The full pipeline includes allocation, initialization, managed/native conversion, scheduling, synchronization, completion, and disposal.

## When they do not fit

Prefer managed containers when:

- Work is small, infrequent, or naturally object-oriented.
- Data primarily consists of managed references or `UnityEngine.Object` references.
- The subsystem runs entirely on the main thread and does not have a measured bottleneck.
- Designer serialization and Inspector authoring are primary concerns.
- Conversion to native data would be repeated more often than the useful work.
- Team complexity, debugging cost, or package ownership outweighs expected gains.

Do not use native containers as a generic solution to managed garbage collection. First remove unnecessary work, avoid repeated temporary results, reuse appropriate buffers, and profile.

## Allocator and lifetime rules

Unity's NativeContainer documentation defines allocator choices and lifetime expectations. [U12]

### `Allocator.Temp`

Use for very short-lived allocations whose lifetime fits the documented temporary-use restriction. It has the lowest setup intent but the strictest lifetime.

**Benefits**: suitable for immediate temporary work.

**Drawbacks**: cannot be retained for later frames or arbitrary job lifetimes; misuse is a safety/lifetime error.

### `Allocator.TempJob`

Use for temporary job data that must survive long enough for scheduled work within the documented frame limit.

**Benefits**: supports short job pipelines.

**Drawbacks**: requires prompt disposal and completion/dependency discipline.

### `Allocator.Persistent`

Use for long-lived native data retained across many frames or system lifetime.

**Benefits**: explicit long-term ownership.

**Drawbacks**: highest lifecycle responsibility; leaks persist until disposal and retained capacity consumes native memory.

Always follow the exact documentation of the installed package. Allocator rules can evolve across versions.

## Container catalog

The Collections 2.1 catalog contains more types than most projects need. Choose from access semantics, not novelty. [UC1]

### `NativeArray<T>`

Use for fixed-length contiguous unmanaged data, job inputs/outputs, or stable buffers.

**Benefits**

- Simple fixed-size ownership.
- Indexable and commonly accepted by Job APIs.
- Clear read/write dependency modeling.

**Drawbacks**

- Cannot dynamically grow.
- Requires explicit allocation and disposal unless ownership is transferred through a documented API.
- Copying the struct copies a handle/view, not the underlying data; ownership can become confusing.

### `NativeSlice<T>`

Use for a view into a range or stride of an existing compatible native buffer.

**Benefits**: avoids copying subsets and communicates bounded access.

**Drawbacks**: does not own the data; it becomes invalid with its source and can have non-contiguous stride behavior.

### `NativeList<T>`

Use for an unmanaged resizable list when Jobs/Burst/native memory are justified. It stores elements in a contiguous buffer. [UC2]

**Benefits**

- Dynamic count and capacity.
- Familiar indexed/list semantics.
- Useful for variable result counts in native pipelines.

**Drawbacks**

- Growth can reallocate.
- Parallel writing requires the specific documented parallel writer or another safe pattern.
- Must be disposed.
- Retained capacity consumes native memory.

### `NativeQueue<T>`

Use for native FIFO producer/consumer behavior.

**Benefits**: communicates FIFO intent and may provide a parallel-writer path in supported versions.

**Drawbacks**: not suitable for arbitrary lookup, sorting, or deterministic multi-producer order without additional design.

### `NativeRingQueue<T>`

Use only when the installed version documents it and fixed-capacity ring behavior matches the requirement.

**Benefits**: bounded storage and no growth after initialization.

**Drawbacks**: capacity is fixed; overflow policy and API constraints must be explicit.

### `NativeHashMap<TKey,TValue>`

Use for an unordered native one-key-to-one-value index with unmanaged key/value types. The 2.1 API describes it as expandable and not suitable for parallel write access. [UC3]

**Benefits**

- Native key lookup.
- Dynamic capacity.
- Fits single-writer/native job pipelines.

**Drawbacks**

- Unordered.
- Hash/equality behavior must be stable.
- Duplicate policy must be explicit.
- Not a parallel-write container; use the documented parallel variant when required.
- Must be disposed.

### `NativeParallelHashMap<TKey,TValue>`

Use when multiple job workers must safely add key/value entries through the documented parallel writer. [UC4]

**Benefits**: supports parallel population patterns.

**Drawbacks**

- Adds capacity planning and parallel conflict semantics.
- Does not make compound multi-step logic automatically atomic.
- Enumeration/order should not be treated as deterministic.
- Requires job dependency and lifetime correctness.

### `NativeHashSet<T>` and `NativeParallelHashSet<T>`

Use for native uniqueness/membership, selecting the parallel variant only for documented concurrent writing needs.

**Benefits**: explicit set semantics and set operations where available.

**Drawbacks**: unordered, native-only element restrictions, disposal, capacity, and equality concerns.

### `NativeParallelMultiHashMap<TKey,TValue>`

Use when one key legitimately maps to multiple values in a native/parallel pipeline.

**Benefits**: represents one-to-many relationships without building managed lists per key.

**Drawbacks**

- More complex enumeration per key.
- Value order should not be assumed unless documented and enforced separately.
- Removal/update patterns may require rebuilding or extra indexes.

### `NativeStream`

Use for variable numbers of records written by parallel workers and consumed later in a defined pipeline.

**Benefits**: supports per-for-each-index streams and avoids forcing a single fixed result count.

**Drawbacks**: specialized read/write protocol, lifecycle complexity, and sequential consumption constraints.

### Fixed-size native lists and strings

Use `FixedList*Bytes<T>` or fixed strings when bounded inline storage is intentional and the exact capacity is acceptable.

**Benefits**: no separate dynamic allocation for the contained payload and Burst-compatible value semantics.

**Drawbacks**: hard capacity limits, larger struct copies, and truncation/overflow policy requirements.

### Bit arrays

Use native bit arrays when dense boolean flags over a known index range justify bit-level storage.

**Benefits**: compact representation and bulk bit operations.

**Drawbacks**: index mapping must remain stable; not a replacement for keyed set semantics when IDs are sparse.

### Unsafe containers

Use `Unsafe*` variants only when safety-check removal is justified by measured need and the caller can prove lifetime, aliasing, threading, and bounds correctness.

**Benefit**: lower safety overhead or APIs unavailable in safe wrappers.

**Drawback**: memory corruption, races, invalid access, and difficult debugging. Never select unsafe containers merely because they sound faster.

## Parallel access

Native containers participate in Unity's job safety and dependency model. [U11][U12]

Before parallel use, define:

- Which job owns writes.
- Which jobs only read.
- Whether parallel writers are supported by the exact container/version.
- Capacity before parallel population.
- What happens when two workers produce the same key.
- Dependency chain and completion point.
- Whether result ordering is meaningful.

`[ReadOnly]` communicates read access to the safety system and can permit concurrent readers when dependencies allow. It does not make the underlying data immutable outside the scheduled graph.

Do not use managed collection locks as a substitute for the Job System dependency model inside Burst jobs.

## Safety and ownership

### Dispose exactly once

Every owning native allocation needs a clear disposal owner. Use `Dispose`, scheduled disposal, or documented ownership transfer. Never dispose while a job still uses the container.

### Struct copies are aliases

Native containers are value-type handles to native memory. Passing or assigning the struct can create aliases to the same allocation. Document which alias is the owner and avoid double disposal.

### Capacity and overflow

Pre-size containers for expected workloads when parallel writers cannot safely grow or when growth cost matters. Define behavior for underestimated capacity.

### Domain and scene lifetime

Persistent native data must be released during system shutdown, scene changes, play-mode transitions, and error paths. Test with the project's domain-reload settings.

### Element restrictions

Native containers store unmanaged-compatible data according to the exact package API. Convert references and polymorphic object graphs into compact IDs or data records only when that representation is architecturally sound.

## Managed-to-native conversion cost

Account for the complete data path:

```text
Managed authoring/state
    -> validation and packing
    -> native allocation or reuse
    -> copy/update
    -> job scheduling
    -> synchronization/completion
    -> result copy or application
    -> disposal/reuse
```

A fast job can still lose overall if data is repacked every frame, completed immediately, or copied back excessively.

Prefer persistent native mirrors only when mutation/invalidation ownership is clear. Otherwise, stale-data bugs can outweigh performance gains.

## Future architecture impact

Evaluate native adoption against plausible GDD changes:

- More enemies may justify data-parallel evaluation.
- More polymorphic behaviors may make compact native representation harder.
- Deterministic replay may require explicit stable ordering beyond hash containers.
- Live content updates may require robust repacking and versioning.
- Network authority may shift which data is source-of-truth.
- Designer-authored references may still need a managed/Unity-object authoring layer.

State the migration boundary between authoring objects, managed runtime state, and native processing data.

## Verification checklist

Before recommending or merging native-container code:

- Exact Collections package version confirmed.
- Container and API exist in that version.
- Lifetime and allocator documented.
- All ownership aliases identified.
- Disposal verified across success, cancellation, exception, shutdown, and scene transitions.
- Job dependencies and access modes validated.
- Capacity and duplicate/overflow behavior tested.
- Managed/native conversion included in profiling.
- Burst and non-Burst behavior compared where relevant.
- Target-platform Development Build profiled.
- Functional output compared against a trusted implementation.
- Future GDD assumptions and migration triggers stated.
