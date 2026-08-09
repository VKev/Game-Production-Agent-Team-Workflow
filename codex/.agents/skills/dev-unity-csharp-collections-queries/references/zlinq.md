# ZLinq in Unity

## Verify before use

Require all of the following:

- an explicit `ZLinq` entry in the active NuGetForUnity `packages.config`;
- a compatible installed `ZLinq.dll`;
- `com.cysharp.zlinq` resolved in `Packages/packages-lock.json` at the matching version;
- Unity 2021.3 or newer and a clean project compile.

If any layer is absent or mismatched, do not write ZLinq-dependent product code. Setup belongs to `setup-unity-zlinq`, not this development skill.

## Core pattern

Add `using ZLinq;`, convert a supported source with `AsValueEnumerable()`, compose operators, and consume the result:

```csharp
using ZLinq;

Enemy nearest = enemies
    .AsValueEnumerable()
    .Where(static enemy => enemy != null && enemy.IsAlive)
    .OrderBy(enemy => enemy.SqrDistanceToPlayer)
    .FirstOrDefault();
```

Prefer a non-capturing `static` lambda when no external state is needed. A capturing closure can allocate independently of the query enumerator. Preserve ordering, duplicate, null, empty-source, and exception semantics when replacing standard LINQ or a loop.

ZLinq.Unity also exposes Unity-specific sources, including hierarchy traversal and supported Unity collections. Confirm the exact overload in the installed package before relying on it; hierarchy enumeration can still be expensive even when the enumerator itself avoids managed allocation.

## When it fits

- A profiler or allocation test shows repeated standard LINQ iterator/delegate pressure in a runtime path.
- A streaming filter/projection/aggregation pipeline is clearer than a manual loop.
- The project already owns and restores the ZLinq dependency.
- The source and operators are supported by the installed version, and the result can be consumed without unnecessary materialization.

## When another approach is better

- Use ordinary LINQ for cold editor, test, setup, or loading code when it is clearest and its cost is immaterial.
- Use an explicit loop when several outputs, early exits, mutation, logging, validation, or exact control are clearer in one pass.
- Use a cached index or precomputation when the same lookup repeats more often than its source changes.
- Use Jobs/Burst-compatible native containers and algorithms for scheduled parallel work; ZLinq over managed objects is not a substitute for a Burst job design.
- Do not add ZLinq merely to replace one short query in a project that does not otherwise need the dependency.

## Limits and traps

- `ValueEnumerable` is generally not `IEnumerable<T>`. Passing it to an interface-based API can require a different boundary or materialization.
- Long operator chains over tiny collections can lose to simpler code because value-enumerable state is copied through the chain. Measure the actual path.
- `ToArray`, `ToList`, dictionaries, lookups, sorting buffers, captured closures, and the result objects themselves can allocate. “Zero allocation” is not a universal pipeline guarantee.
- Re-enumeration repeats deferred work and may observe changed source data.
- Unity uses the compatible .NET Standard build; do not promise the SIMD behavior documented for newer .NET runtimes.
- `ZLinq.DropInGenerator` is opt-in, requires separate assembly-level migration and version compatibility, and must never be enabled as incidental optimization.

## Verification

1. Compile the actual Unity project with its Mono/IL2CPP and API Compatibility settings.
2. Add semantic tests for empty input, nulls, duplicates, ordering/ties, mutation timing, and exceptions affected by the change.
3. Compare before/after result values and iteration count.
4. Measure the exact runtime path in the Unity Profiler and, when appropriate, `ProfilerRecorder` or an allocation-focused test. Report collection size, frequency, backend, target device, GC allocation, and CPU time.
5. Inspect generated/player behavior where IL2CPP or stripping could affect the package; an Editor-only measurement is not a player result.

## Official sources

- [Cysharp ZLinq repository](https://github.com/Cysharp/ZLinq): core usage, supported sources/operators, benchmarks, limitations, Unity installation order, hierarchy and Native Collections integration, and DropInGenerator guidance.
- [ZLinq Unity section](https://github.com/Cysharp/ZLinq#unity): Unity-specific package URL and requirements.
- [ZLinq on NuGet.org](https://www.nuget.org/packages/ZLinq): core package versions and target frameworks.
- [NuGetForUnity](https://github.com/GlitchEnzo/NuGetForUnity): Unity NuGet restore and installed-package ownership.
- [User-supplied ZLinq video](https://www.youtube.com/watch?v=gX5nD2LeAvQ): secondary demonstration only; use the official source and actual profiler evidence for technical decisions.
