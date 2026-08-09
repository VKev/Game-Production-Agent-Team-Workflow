# Research Summary and Sources

## Filtered Conclusions

### No strong exact public Skill was found

Searches for a dedicated `dev-unity-object-pooling` Agent Skill did not reveal a mature, version-pinned public Skill with the complete scope needed here. The nearest public material was a broader game performance Skill that includes a small pooling section and a general Unity C# Skill that mentions pooling. Those are useful structural references but are not a complete source of truth for Unity pool semantics.

This Skill therefore synthesizes the official Unity 2022.3 API, Unity's GC and profiling guidance, Unity's official object-pooling tutorial, and carefully selected public Skill structure patterns.

### Pool only when the lifecycle and measurements justify it

Unity describes pooling as reusing objects rather than repeatedly creating and destroying them, reducing CPU work and garbage-collection pressure in appropriate high-frequency cases. Unity also warns that pooling adds lifecycle complexity and can reserve unnecessary memory when introduced prematurely.

### Prefer `UnityEngine.Pool` on supported Unity versions

Unity 2021 LTS and newer include built-in pool APIs. For Unity 2022.3, `ObjectPool<T>` is the default stack-based implementation, while `LinkedPool<T>` is an alternative storage strategy. Both are not thread-safe.

### Capacity terms are commonly misunderstood

`defaultCapacity` sets initial backing-stack capacity; it does not create pooled instances. `maxSize` limits inactive storage and controls overflow release behavior; it is not an active-object or total-creation cap. `Get` creates when the pool is empty.

### Reset is the central correctness problem

Unity's official tutorial identifies previously used, unreset objects as dirty items. Pool correctness depends on stopping and clearing each object's lease-specific state before reuse. The exact reset contract varies by Rigidbody, particles, trails, animation, AI, UI, audio, events, coroutines, and async work.

### Measure on target hardware

Unity's Profiler and Memory Profiler expose CPU cost, object counts, memory, and GC allocations. Unity recommends profiling a Development Build on the target platform because Editor behavior and overhead can differ.

## Primary Technical Sources

1. Unity 2022.3 `ObjectPool<T>` constructor
   - https://docs.unity.cn/2022.3/Documentation/ScriptReference/Pool.ObjectPool_1-ctor.html
   - Defines create/get/release/destroy callbacks, Editor collection checks, `defaultCapacity`, and `maxSize`.

2. Unity 2022.3 `ObjectPool<T>.Release`
   - https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.ObjectPool_1.Release.html
   - Documents release behavior and duplicate-return exceptions when collection checks are enabled.

3. Unity `ObjectPool<T>` API
   - https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.ObjectPool_1.html
   - Documents stack-based pooling, counts, get, release, clear, and dispose behavior.

4. Unity 2022.3 `LinkedPool<T>` constructor
   - https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.LinkedPool_1-ctor.html
   - Documents callbacks, collection checks, and maximum inactive size for the linked implementation.

5. Unity 2022.3 `IObjectPool<T>`
   - https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.IObjectPool_1.html
   - Defines the shared pool interface.

6. Unity 2022.3 GC best practices
   - https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html
   - Covers reusable object pools, frequent allocation reduction, and collection reuse.

7. Unity official object pooling tutorial
   - https://learn.unity.com/tutorial/65df850fedbc2a082fb11029
   - Explains built-in pooling, dirty-item reset, pre-instantiation, memory trade-offs, `ObjectPool<T>`, `LinkedPool<T>`, and avoiding premature pooling.

8. Unity advanced programming and code architecture guidance
   - https://unity.com/how-to/advanced-programming-and-code-architecture
   - Recommends pooling high-frequency reusable objects to reduce repetitive create/destroy work and managed allocation.

9. Unity 2022.3 `ListPool<T>`
   - https://docs.unity.cn/ScriptReference/Pool.ListPool_1.html
   - Documents reusable list pooling and scoped get patterns.

10. Unity 2022.3 `DictionaryPool<TKey,TValue>`
    - https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.DictionaryPool_2.html
    - Documents dictionary pooling.

11. Unity Memory Profiler package for 2022.3
    - https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.memoryprofiler.html
    - Provides memory snapshots and allocation analysis; package 1.0.0 is released for Unity 2022.3.

12. Unity profiling applications
    - https://docs.unity3d.com/2022.3/Documentation/Manual/profiler-profiling-applications.html
    - Describes profiling Development Builds on target platforms and Profiler connection options.

13. Unity C# reference implementation of pools
    - https://github.com/Unity-Technologies/UnityCsReference/blob/master/Runtime/Export/ObjectPool/ObjectPools.cs
    - Useful for implementation-level inspection; verify branch/version when relying on source details.

## Public Skill Structural References

1. `performance-optimization`
   - https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/disciplines/performance-optimization/SKILL.md
   - Useful for the profile-first workflow and positioning pooling among other performance choices. Its pooling coverage is intentionally brief and cross-engine.

2. `unity-csharp-scripting`
   - https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/main/skills/unity/unity-csharp-scripting/SKILL.md
   - Useful for Unity lifecycle, cached components, and Play Mode verification. Its main version target is Unity 6, so API examples must be checked against Unity 2022.3.

3. General `unity-csharp` public Skill listing
   - https://www.skills.sh/alexanderstephenthompson/claude-hub/unity-csharp
   - Mentions pooling as part of broad Unity performance guidance but is not a dedicated pooling decision and lifecycle Skill.

## Source Priority

Use sources in this order when guidance conflicts:

1. The actual project's Unity version, packages, code, tests, GDD, and measured behavior.
2. Unity 2022.3 official Manual and Scripting API.
3. Version-matched Unity package documentation.
4. Unity Learn and Unity best-practice articles.
5. Unity C# reference source on the relevant version branch.
6. Public Agent Skills and third-party tutorials for structure or supplementary examples only.
