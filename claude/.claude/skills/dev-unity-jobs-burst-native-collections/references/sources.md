# Sources of truth

Use project-local package documentation when it differs from these references. Prefer official Unity documentation for API and version claims.

## Unity 6.3 package versions

- Burst package page for Unity 6.3: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.burst.html
- Collections package page for Unity 6.3: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.collections.html
- Entities package page for Unity 6.3, when the project explicitly uses Entities: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.entities.html

The setup resolver pins exact verified Burst and Collections versions. Always use `manifest.json`, `packages-lock.json`, and the installed package source as the API authority. Entities is not installed merely because Jobs/Burst is used.

## C# Job System

- Job System overview: https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystem.html
- Job types: https://docs.unity3d.com/6000.3/Documentation/Manual/job-system-jobs.html
- Creating, scheduling, completing, profiling waits, and long-job guidance: https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystemCreatingJobs.html
- Dependencies and `JobHandle`: https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystemJobDependencies.html
- Parallel jobs and batching: https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystemParallelForJobs.html
- Thread-safe types and NativeContainers: https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystemNativeContainer.html

Distilled guidance:

- Schedule only from the main thread.
- Pass dependencies for conflicting access.
- Complete as late as practical before main-thread access.
- Avoid mutable static data.
- Jobs do not yield once running; granularity and batch size matter.

## Collections API family

- Collections manual example: https://docs.unity3d.com/Packages/com.unity.collections@2.1/manual/index.html
- Collection types, safety, read-only access, parallel writers, and deterministic-order cautions: https://docs.unity3d.com/Packages/com.unity.collections@2.1/manual/collection-types.html
- Collections API: https://docs.unity3d.com/Packages/com.unity.collections@2.1/api/Unity.Collections.html
- `NativeParallelHashMap.ParallelWriter`: https://docs.unity3d.com/Packages/com.unity.collections@2.1/api/Unity.Collections.NativeParallelHashMap-2.ParallelWriter.html

Distilled guidance:

- Select collections by semantics, concurrency, and lifetime.
- Mark true read-only inputs.
- Pre-size parallel writers.
- Concurrent insertion order is generally nondeterministic.
- Keep clear allocation ownership and disposal.

## Burst API family

- Burst manual: https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/index.html
- Compilation model, Editor JIT and Player AOT: https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/compilation.html
- Burst menu, safety checks, synchronous compilation, native debug mode: https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/editor-burst-menu.html
- Burst Inspector: https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/editor-burst-inspector.html
- `[BurstCompile]`, float precision and float mode: https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/compilation-burstcompile.html
- Burst C# language support: https://docs.unity3d.com/Packages/com.unity.burst@1.8/manual/csharp-language-support.html

Distilled guidance:

- Burst supports a constrained, unmanaged-oriented subset of C#.
- Verify actual compilation and target architecture.
- Keep default numeric semantics unless relaxed behavior is tested and measured.
- Use Inspector and runtime profiling together.

## Profiling

- Unity Profiler: https://docs.unity3d.com/6000.3/Documentation/Manual/Profiler.html
- Profiling target Players: https://docs.unity3d.com/6000.3/Documentation/Manual/profiler-profiling-applications.html
- Job wait markers are discussed in the creating-jobs documentation above.

Measure worker execution, gather/scatter, schedule cost, completion stalls, total frame time, and native memory. A faster job body alone is not sufficient evidence.

## Official samples

- Unity DOTS samples and Job System learning material: https://github.com/Unity-Technologies/EntityComponentSystemSamples

The current branch may target newer Unity/Entities versions. Use it for concepts and samples only after adapting APIs to the actual project version.

## Community skill references reviewed for scope only

- `unity-ecs-patterns`: https://github.com/wshobson/agents
- `awesome-gamedev-agent-skills`: https://github.com/gamedev-skills/awesome-gamedev-agent-skills

Community skills are not the source of truth for Unity 6.3 package APIs. Some target Unity 6 or newer Entities versions and can over-recommend ECS/Burst. Verify every version-sensitive instruction against official docs and the project manifest.
