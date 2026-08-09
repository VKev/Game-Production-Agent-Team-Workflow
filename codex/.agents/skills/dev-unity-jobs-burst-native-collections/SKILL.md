---
name: dev-unity-jobs-burst-native-collections
description: Documentation-grounded selection, implementation, review, and optimization of Unity C# Job System workloads, Burst-compiled code, Unity.Mathematics, and Native Collections. Use for measured CPU bottlenecks, large data-parallel loops, worker-thread scheduling, `IJob`, `IJobFor`, `IJobParallelFor`, `IJobParallelForTransform`, `JobHandle` dependencies, NativeArray/List/Queue/HashMap/Stream/Reference containers, allocator and disposal decisions, race-condition or safety errors, Burst compiler restrictions, vectorization, batch-size tuning, determinism, and main-thread job stalls. Target Unity 2022.3 by default, but inspect actual Unity, Burst, Collections, Entities, backend, platform, and package versions before using version-sensitive APIs.
---

# Unity Jobs, Burst, and Native Collections

## Objective

Use Jobs, Burst, and Native Collections only when the workload benefits from data-oriented CPU execution and the measured value justifies the added lifetime, safety, and debugging complexity.

Do not “jobify” code merely because parallelism is available. Preserve correctness, deterministic behavior where required, explicit ownership, safe disposal, and maintainability.

## Required workflow

1. **Inspect project context.**
   - Read root and relevant local `AGENTS.md` files and the GDD.
   - Read `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, and `Packages/packages-lock.json`.
   - Identify target platform, scripting backend, API compatibility level, Burst and Collections versions, Entities usage, safety-check settings, and existing job conventions.
   - Search for existing native-data owners, allocators, job pipelines, assembly definitions, tests, and profiler markers before adding another system.

2. **Prove that the workload is suitable.**
   - Establish a Profiler baseline on the target workload.
   - Confirm a CPU-bound task with enough repeated or parallel work to amortize scheduling and data-conversion overhead.
   - Confirm that the core computation can operate on unmanaged, contiguous, explicitly owned data without calling general `UnityEngine.Object` APIs.
   - Define latency: same-frame result, next-frame result, background preparation, or occasional batch.
   - Keep the main-thread implementation when the workload is small, infrequent, branch-heavy, I/O-bound, dominated by Unity API calls, or not measured as a bottleneck.

3. **Design the data boundary before the job.**
   - Define input, output, ownership, lifetime, capacity, and update frequency.
   - Separate managed authoring or scene objects from unmanaged runtime data.
   - Minimize gather/copy and scatter/apply cost.
   - Prefer persistent native buffers for recurring workloads when their lifetime and disposal are explicit.
   - Consider one-frame latency or double buffering when it removes an immediate main-thread fence without breaking gameplay.

4. **Select the smallest job shape.**
   - Use `IJob` for one independent unit of work.
   - Use `IJobFor` or `IJobParallelFor` for indexed work over many independent elements.
   - Use `IJobParallelForTransform` only when Transform access is the actual boundary and its constraints are acceptable.
   - Use an ECS-specific job only when the project already uses Entities and the data belongs in ECS.
   - Keep code on the main thread when parallel scheduling adds more cost or complexity than the work itself.

5. **Select Native Collections and allocators deliberately.**
   - Match collection semantics to access pattern, concurrency, ordering, capacity, and output shape.
   - Use `Allocator.Temp`, `TempJob`, or `Persistent` according to the actual lifetime and package rules.
   - Pre-size parallel-writer collections; do not rely on resizing from worker threads.
   - Define exactly which owner disposes each allocation and on which dependency.

6. **Declare access and dependencies.**
   - Mark read-only native inputs with `[ReadOnly]`.
   - Give each parallel iteration an exclusive output index when possible.
   - Use supported `ParallelWriter` APIs for genuine concurrent append/map/set writes.
   - Chain write/read and write/write access with `JobHandle` dependencies.
   - Combine independent dependencies only when a downstream job truly needs all results.
   - Schedule early and call `Complete()` as late as correctness allows.

7. **Make the computation Burst-compatible.**
   - Add `[BurstCompile]` to supported jobs or methods that are actually on the measured path.
   - Use unmanaged data and `Unity.Mathematics` where it improves compatibility and generated code.
   - Remove managed allocation, managed object graphs, unsupported calls, reflection, and exception-driven control flow from Burst paths.
   - Keep default floating-point semantics unless looser precision or reordering is explicitly acceptable and tested.

8. **Implement lifetime and failure safety.**
   - Complete outstanding jobs before main-thread access, mutation, disposal, scene teardown, or owner destruction.
   - Use `Dispose(JobHandle)` when disposal can safely depend on a scheduled job.
   - Guard persistent allocations with `IsCreated` and one clear owner.
   - Handle zero length, capacity exhaustion, scene reload, application exit, and repeated initialization.
   - Remember that a scheduled job cannot be cancelled; design smaller jobs or ignore stale output through ownership/version checks when needed.

9. **Profile and verify.**
   - Compare the same workload before and after jobification.
   - Inspect worker utilization, schedule overhead, gather/scatter cost, `WaitForJobGroupID`, `JobHandle.Complete`, batch behavior, and total frame time.
   - Verify Burst is enabled and inspect generated code in Burst Inspector when the result matters.
   - Test safety checks on, Burst on/off, Editor and target Player, Mono/IL2CPP as relevant, small and large datasets, determinism, and lifecycle cleanup.
   - Keep the jobified version only when the measured gain is meaningful for the project budget.

## Reference routing

Read only the references relevant to the current task:

- Read [decision-and-data-design.md](references/decision-and-data-design.md) before deciding to use Jobs/Burst or restructuring managed data.
- Read [job-types-and-scheduling.md](references/job-types-and-scheduling.md) for job selection, dependencies, scheduling, completion, batching, and latency.
- Read [native-collections-and-allocators.md](references/native-collections-and-allocators.md) for container selection, capacity, allocator lifetime, ownership, and disposal.
- Read [burst-compatibility-and-math.md](references/burst-compatibility-and-math.md) for Burst compilation, C# restrictions, `Unity.Mathematics`, precision, vectorization, and Burst Inspector.
- Read [safety-dependencies-and-lifetime.md](references/safety-dependencies-and-lifetime.md) for race prevention, `[ReadOnly]`, parallel writers, determinism, unsafe attributes, teardown, and copied-container semantics.
- Read [patterns-and-examples.md](references/patterns-and-examples.md) for Unity 2022.3-oriented implementation patterns.
- Read [profiling-testing-and-troubleshooting.md](references/profiling-testing-and-troubleshooting.md) for evidence, test matrices, common stalls, compiler errors, leaks, and rollback decisions.
- Read [sources.md](references/sources.md) for official version-pinned documentation.

## Hard rules

- Never access mutable static data from a job. It bypasses safety tracking and can crash the Player or Editor.
- Never access a NativeContainer from the main thread while a scheduled job owns conflicting access.
- Never read job output before completing the relevant dependency.
- Never dispose native memory while a job can still access it.
- Never assume copying a NativeContainer struct copies its allocation; copies usually reference the same native memory and safety state.
- Never write to the same element from parallel iterations unless synchronization and semantics explicitly support it.
- Never use `ParallelWriter` without preallocating enough capacity and accepting its ordering guarantees.
- Never treat thread-safe concurrent writes as deterministic ordering.
- Never suppress safety with `NativeDisableParallelForRestriction`, `NativeDisableContainerSafetyRestriction`, unsafe containers, pointers, or atomics merely to silence an exception.
- Never call general GameObject, Component, Transform, Physics, rendering, or other main-thread-only Unity APIs from a generic job.
- Never allocate managed objects, use managed collections, or depend on managed references inside Burst code.
- Never use `FloatMode.Fast` or reduced precision without a correctness tolerance, tests, and measured benefit.
- Never schedule a job and immediately complete it unless debugging or evidence shows the synchronous path still provides value.
- Never assume Burst or multiple cores guarantee improvement. Measure end-to-end cost, including data conversion and synchronization.

## Optimization policy

Keep the simplest correct implementation until profiling proves a CPU bottleneck suitable for data-parallel execution. After jobification is correct and tested, tune data layout, capacity, dependency width, batch size, Burst options, and latency one factor at a time.

If the gain is minor but the native-memory ownership, synchronization, or debugging burden grows substantially, keep the cleaner main-thread implementation. Accept complexity only when the measured benefit is material for the target hardware and workload.

## Required result format

When proposing or implementing a jobified solution, report:

```text
Environment:
- Unity/Burst/Collections/Entities versions:
- Platform/backend/architecture:
- Safety and Burst settings:

Baseline:
- Reproducible workload and item count:
- Main-thread/worker timing:
- Bottleneck evidence:

Suitability:
- Why this work can be parallelized:
- Managed/Unity API boundaries:
- Required result latency:

Design:
- Job type(s):
- Input/output data layout:
- Native Collections and capacities:
- Allocators and owner:
- Dependency chain:
- Completion and disposal point:
- Determinism requirements:

Verification:
- Burst compiled:
- Before/after total frame time:
- Scheduling/gather/scatter/fence cost:
- Safety, lifecycle, target Player, and correctness tests:

Decision:
- Keep, revise, or revert:
- Remaining bottleneck or next measurement:
```

Clearly distinguish measured results from expected benefits.

## Related-skill boundaries

- Use `dev-unity-performance-profiling` to establish the bottleneck and verify the total result.
- Use `dev-unity-csharp-collections-queries` for managed collection, LINQ, iterator, Span, and reusable-buffer decisions outside native job memory.
- Use `dev-unity-gameplay-architecture` when jobification changes feature boundaries, service ownership, or data flow.
- Use `dev-unity-object-pooling` for GameObject and managed object reuse; do not confuse object pooling with NativeContainer lifetime.
- Use `dev-unity-async-coroutines-unitask` for I/O, sequencing, cancellation, and async composition. Jobs are CPU work units, not general async tasks.
