# Unity Flyweight Production Guide

## Contents

- [Video reconstruction](#video-reconstruction)
- [Pattern boundaries](#pattern-boundaries)
- [Decision matrix](#decision-matrix)
- [Intrinsic and extrinsic state](#intrinsic-and-extrinsic-state)
- [Production architecture](#production-architecture)
- [Pooling lifecycle](#pooling-lifecycle)
- [Inheritance and typing](#inheritance-and-typing)
- [Failure modes](#failure-modes)
- [Verification](#verification)
- [Official sources](#official-sources)

## Video Reconstruction

The analyzed tutorial, [Flyweight Factory with Unity Object Pooling](https://www.youtube.com/watch?v=qHn4sschAro), builds this progression:

1. A `FlyweightSettings` ScriptableObject stores shared projectile prefab and values.
2. A `Flyweight` MonoBehaviour references those settings and initially destroys itself after a delay.
3. Fire and frost settings assets provide authored variants.
4. `FlyweightFactory` adds one `IObjectPool<Flyweight>` per enum variant and exposes static spawn and return methods.
5. Pool callbacks on the settings asset create, activate, deactivate, and destroy instances.
6. The example generalizes projectile behavior through an abstract `Flyweight` base plus `ProjectileSettings` and `Projectile` subclasses.

Selective frame inspection confirmed the enum-keyed dictionary, singleton with `DontDestroyOnLoad`, `ObjectPool` callback wiring, defaults of 10 and 100, static spawn/return API, and a derived settings cast. The presenter also recognizes that the dictionary key and base-versus-interface design deserve further work.

Treat the tutorial as a useful teaching composition, not a production template. The sections below retain its insight while correcting ownership and lifecycle risks.

## Pattern Boundaries

### Flyweight

Shares intrinsic data among many contexts. The win is lower duplicated memory and centralized authoring. The costs are indirection, shared-state hazards, asset/reference management, and a stricter data boundary.

### Factory

Owns variant lookup, validation, and construction. The win is one construction policy and a smaller caller API. The costs are another service, registry identity, initialization, and teardown.

### Object pool

Reuses mutable objects. The win is reduced repeated create/destroy CPU and allocation cost. The costs are retained memory, reset bugs, capacity tuning, duplicate-release risk, and lifecycle complexity.

These patterns are orthogonal. A project can use any one, any combination, or none.

## Decision Matrix

| Candidate | Benefit | Drawback | Prerequisite | Reject when |
|---|---|---|---|---|
| Direct prefab or existing shared Unity asset | Minimum custom architecture | Limited custom data model | Fixed authored variants | It still duplicates a material data payload |
| ScriptableObject config | Designer-authored shared data by reference | Asset count, mutable shared object, reference wiring | Stable intrinsic data | Data is tiny, instance-specific, or runtime-generated only |
| Flyweight registry/factory | Central variant identity and validated lookup | Indirection and lifecycle ownership | Many contexts reuse a stable set of variants | Direct references stay clearer |
| Object pool | Reuses costly or frequent instances | Reset and retained-memory complexity | Measured churn or latency | Spawn/despawn is rare or cheap |
| Strategy | Swappable behavior policy | Extra types/assets and communication design | Behavior substitutes behind a stable contract | Only data is shared or branches are few and stable |
| Builder | Validated complex construction | More API surface and state | Many optional/ordered spawn inputs | Factory method or parameter object suffices |
| VContainer service | Explicit scope and composition | Container registration complexity | Project already uses VContainer and scope matters | Serialized/direct dependency is simpler |
| Data-oriented table/index | Compact large-scale data access | Authoring/debugging conversion cost | Very large homogeneous populations | GameObject scale and workflow do not justify it |

Compare all candidates that change the solution. Do not rank skills as primary and supporting.

## Intrinsic and Extrinsic State

Intrinsic state is stable and shareable across every context referencing a flyweight. Examples include a prefab reference, immutable visual/audio assets, a curve, icon, base speed, or base damage when those values truly define the variant.

Extrinsic state belongs to one live context. Examples include position, rotation, owner, team, target, current velocity, lifetime remaining, collision history, critical roll, mutable health, active buffs, and callbacks.

Practical rules:

- Expose ScriptableObject configuration through read-only properties.
- Do not store a current runtime instance, pool borrow state, coroutine, target, or owner on the settings asset.
- Do not mutate the asset to implement temporary buffs or per-shot damage.
- Make a runtime copy only for the fields that must mutate, with explicit ownership.
- Remember that prefab, mesh, material, animation, and audio assets are already reference-shared; do not wrap them merely to claim Flyweight.

## Production Architecture

A safe default decomposition is:

```text
ProjectileDefinition asset
  immutable variant data and prefab reference
         |
         v
ProjectileFactory or pool registry
  validates identity, prefab component, pool config and scope
         |
         v
ProjectileInstance component
  mutable spawn context, behavior, reset and return token
```

Prefer the settings asset itself as the dictionary key when each asset owns one pool identity. A broad enum key is unsafe when two assets can share the enum but use different prefabs or values. If runtime-created definitions are possible, define stable identity and equality deliberately.

Keep factory lifecycle explicit. A static singleton is acceptable only when the global lifetime is real, initialization is guaranteed, teardown is handled, tests can replace it, and disabled Domain Reload cannot retain stale state. Otherwise compare a serialized scene reference, a bootstrap service, or a VContainer lifetime scope.

Validate on pool creation:

- definition and prefab are non-null;
- prefab contains exactly the expected component;
- concrete component and settings types are compatible;
- pool identity is unique and deterministic;
- capacity values are valid;
- asset-loading ownership is known.

If Addressables owns the prefab, the factory must preserve the handle and release it only after all inactive and borrowed instances are resolved according to the chosen policy.

## Pooling Lifecycle

### Create

- Instantiate under a known inactive pool root when appropriate.
- Retrieve and validate the required component rather than unconditionally adding it.
- Bind the immutable definition once if it never changes.
- Avoid repeated diagnostic names or strings in hot paths unless useful.

### Get

- Increment a generation/version token.
- Apply a complete spawn context: position, rotation, owner, target, team and mutable values.
- Reset physics, colliders, trails, particles, animator, audio, hit sets and presentation as needed.
- Subscribe only the listeners owned by this borrow.
- Activate after state is coherent when activation callbacks observe it.

### Release

- Make return idempotence policy explicit; throw/log in development if appropriate.
- Stop or invalidate delayed work before clearing state.
- Unsubscribe listeners and delegates.
- Clear owner, target, hit history, transient modifiers and callbacks.
- Stop/reset Rigidbody motion, particles, trails, animation and audio.
- Deactivate and reparent only after cleanup.

### Destroy or dispose

- Destroy objects rejected because the retained pool is full.
- Clear or dispose inactive objects when the service scope ends.
- Define what happens to active borrowed objects on scene unload or application teardown.
- Do not confuse `defaultCapacity` with prewarming.
- Do not confuse `maxSize` with an active concurrency cap.

## Inheritance and Typing

An abstract base is useful when all flyweights share storage and lifecycle. Its drawbacks are inheritance coupling, derived casts, property hiding, and a heterogeneous registry that tends toward base types.

An interface supports composition and capability-based design. Its drawbacks are that common state must live elsewhere and pool registries still need an identity and concrete construction path.

A generic typed base can remove repeated casts but increases type complexity and makes heterogeneous storage and Unity serialization harder. Separate concrete pools can be simplest for a small fixed variant set.

Reject a hierarchy if it requires unsafe casts such as converting base settings to `ProjectileSettings` without validation. Prefer a typed initialization method, a validated generic/concrete binding, or a direct component-definition pair. Avoid hiding a base `settings` member with another member of the same name because the visible type changes with the reference type.

## Failure Modes

| Symptom | Likely cause | Correction |
|---|---|---|
| Frost projectile spawns with fire prefab | Pool keyed by shared enum/category | Key by definition asset or unique pool identity |
| A buff changes every projectile | Per-instance value written to shared settings | Move mutable value into spawn context/instance |
| Reused projectile returns too early | Old coroutine or callback survived release | Stop it or check a generation token |
| Duplicate components appear | Factory always calls `AddComponent` | Author and validate the component on the prefab |
| Cast exception on spawn | Base and derived settings/component mismatch | Validate typed binding before the pool is usable |
| Pool grows memory after spikes | Retention max is too high or scope never disposes | Measure peaks, lower retention, clear on teardown |
| Expected prewarm never happened | `defaultCapacity` mistaken for object count | Explicitly get/create and release warm instances |
| More than `maxSize` objects are active | `maxSize` mistaken for concurrency cap | Add a separate borrow limit/back-pressure policy |
| Duplicate release only fails in Editor | Collection checks are Editor-only | Track active state/token if builds require enforcement |
| Timer cache keeps growing | Arbitrary floats used as dictionary keys | Bound to finite durations or remove the cache |
| Stale static pools after entering Play mode | Static lifetime assumes Domain Reload | Reset statics and own lifecycle explicitly |

## Verification

### Memory evidence

- Capture a baseline and optimized snapshot at the same gameplay state.
- Compare retained instance data, ScriptableObject assets, native objects, textures/meshes, and total process memory.
- Ensure the flyweight did not merely move a tiny payload into many new assets.

### Runtime evidence

- Profile first-spawn and steady-state spawn/despawn frames.
- Measure GC allocations, create/destroy calls, pool misses and retained peak.
- Inspect `CountAll`, `CountActive`, and `CountInactive` without treating any one number as success.

### Correctness matrix

- first borrow and repeated reuse;
- two definitions with the same category but different prefabs;
- early collision return before timeout;
- delayed callback after reuse;
- duplicate return;
- retained pool overflow;
- scene unload and factory disposal with inactive and active items;
- paused time and scaled versus unscaled lifetime;
- disabled Domain Reload;
- incompatible or missing prefab component;
- shared setting mutation attempt.

## Official Sources

Video evidence:

- [Flyweight Factory with Unity Object Pooling](https://www.youtube.com/watch?v=qHn4sschAro)

Unity 6.3 documentation:

- [ScriptableObject manual](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html)
- [ObjectPool class](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.html)
- [ObjectPool constructor](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1-ctor.html)
- [ObjectPool Get](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.Get.html)
- [ObjectPool Release](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.Release.html)
- [ObjectPool Clear](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.Clear.html)
- [ObjectPool Dispose](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.Dispose.html)
- [IObjectPool interface](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.IObjectPool_1.html)
- [GameObject.SetActive](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/GameObject.SetActive.html)
- [MonoBehaviour.StartCoroutine](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.StartCoroutine.html)
- [MonoBehaviour.StopCoroutine](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.StopCoroutine.html)
- [MonoBehaviour.StopAllCoroutines](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.StopAllCoroutines.html)
- [WaitForSeconds](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/WaitForSeconds.html)
- [RequireComponent](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/RequireComponent.html)
- [Garbage collection best practices](https://docs.unity3d.com/6000.3/Documentation/Manual/performance-garbage-collection-best-practices.html)
- [Configurable Enter Play Mode and Domain Reload](https://docs.unity3d.com/6000.3/Documentation/Manual/DomainReloading.html)
- [Memory Profiler package manual](https://docs.unity3d.com/Packages/com.unity.memoryprofiler@1.1/manual/index.html)

Microsoft C# documentation:

- [Dictionary key equality](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.dictionary-2?view=netstandard-2.1)
- [Casting and type conversions](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/types/casting-and-type-conversions)
- [new modifier and member hiding](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/new-modifier)
