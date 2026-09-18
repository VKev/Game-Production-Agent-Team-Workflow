# CPU and garbage-collection profiling

## Table of contents

1. CPU investigation order
2. Timeline and Hierarchy
3. Wait markers
4. Managed allocations
5. Garbage collection
6. Custom instrumentation
7. CPU optimization decision rules

## 1. CPU investigation order

1. Confirm the frame is CPU-bound or contains a CPU spike.
2. Inspect Timeline to identify the busy thread and synchronization pattern.
3. Inspect Hierarchy for total time, self time, call count, and `GC Alloc`.
4. Expand the dominant path until reaching actionable project code or an engine subsystem.
5. Add a targeted marker when existing samples are too broad.
6. Reproduce without Deep Profiling before accepting exact timings.
7. Measure the fix on the target Player.

Separate:

- Main-thread script and engine work.
- Render-thread submission.
- Job worker work.
- Background loading or audio threads.
- Time spent waiting rather than executing.

## 2. Timeline and Hierarchy

Use Timeline for:

- Thread overlap and idle periods.
- Main-thread and render-thread handoff.
- Job scheduling, execution, and fences.
- Long frames and ordering.
- Multiple subsystems active in the same frame.

Use Hierarchy for:

- Ranking samples by total time.
- Finding high self time.
- Finding excessive call counts.
- Inspecting `GC Alloc` by sample.
- Comparing a marker across selected frames.

A method with high total time can mostly contain expensive children. A method with high self time is spending time directly in its own sample. Inspect both before editing it.

## 3. Wait markers

Treat wait markers as synchronization evidence:

- `WaitForTargetFPS` or related frame-pacing samples can be expected when VSync or a frame cap is active.
- `Gfx.WaitForPresentOnGfxThread` can involve frame presentation, driver behavior, pacing, or GPU completion; inspect CPU and GPU context before deciding.
- `WaitForJobGroupID`, `WaitForJobGroup`, or `JobHandle.Complete` can show that the main thread needs job results before the jobs finish. Inspect job duration, dependency chains, schedule timing, and worker saturation.
- A render-thread wait can mean the main thread is not feeding it, or the render thread is waiting on the GPU/driver. Inspect adjacent threads.

Temporarily remove frame caps only as a diagnostic experiment. Restore shipping frame pacing and verify the final result under real settings.

## 4. Managed allocations

Use the CPU module's `GC Alloc` column and allocation call stacks to identify allocation sites. Common sources include:

- New arrays, lists, dictionaries, delegates, closures, enumerators, or temporary objects in hot paths.
- LINQ materialization and captured lambdas.
- Repeated string concatenation, interpolation, and logging.
- Boxing value types through `object`, non-generic APIs, or interfaces.
- APIs that return a new array on each property access.
- Coroutines and iterator state machines created repeatedly.
- Per-frame event subscriptions or temporary callback objects.

Do not remove every allocation indiscriminately. Prioritize frequent allocations that contribute to GC pressure or spikes in the target workload. Keep rare setup allocations when removing them would significantly damage clarity without measurable value.

When replacing allocation:

- Reuse a collection with `Clear()` when ownership and maximum capacity are controlled.
- Use caller-provided buffers for repeated queries.
- Use a Unity non-allocating API only after handling truncation and buffer capacity correctly.
- Use pooling only when object lifetime and reset contracts are clear.
- Cache immutable strings or format less frequently for UI.

## 5. Garbage collection

Distinguish allocation rate from collection cost:

- `GC Allocated in Frame` indicates managed bytes allocated during the frame, not net heap growth.
- Incremental GC spreads work across frames; it does not make the total collection work disappear.
- A collection spike can be caused by sustained allocation long before the spike frame.
- Disabling GC can make memory grow without bound and is not a general fix.
- Calling `GC.Collect()` manually can create a blocking spike and should not replace allocation control.

Profile the shipped incremental-GC setting. If experimenting with manual or disabled collection, calculate the allocation budget, constrain the duration, restore normal collection, and verify memory on the target device.

## 6. Custom instrumentation

Use `Unity.Profiling.ProfilerMarker` for project-owned regions that are otherwise opaque:

```csharp
using Unity.Profiling;

public static class CombatProfiler
{
    public static readonly ProfilerMarker ResolveHits =
        new ProfilerMarker("Combat.ResolveHits");
}

public void ResolveHits()
{
    using (CombatProfiler.ResolveHits.Auto())
    {
        // Work to measure.
    }
}
```

Keep marker names stable and hierarchical. Add markers around meaningful phases, not every trivial method. Avoid dynamic marker names in hot paths.

Use `ProfilerRecorder` for selected counters or markers when a repeatable runtime metric is needed. Dispose recorders and avoid APIs such as `ToArray()` every frame when they allocate. Keep instrumentation overhead out of the production path unless it is intentionally supported.

## 7. CPU optimization decision rules

Apply the fix that matches evidence:

| Evidence | Candidate actions |
|---|---|
| High call count, low per-call cost | Reduce frequency, batch work, cache stable results, move to events or intervals |
| High self time in algorithm | Improve complexity, data layout, lookup structure, or early exits |
| Main thread waiting for jobs | Schedule earlier, complete later, reduce dependencies, tune batch size, reduce job workload |
| Worker threads underused | Increase independent work, remove false dependencies, reconsider job granularity |
| Worker threads saturated by long jobs | Split work, adjust batch size, prioritize chains, reduce total work |
| Repeated managed allocation | Reuse buffers, remove boxing/closures, avoid repeated materialization, pool only where justified |
| Excessive engine calls | Cache references/data, batch queries, use bulk APIs, reduce transitions across managed/native boundaries |
| Rare initialization spike | Prewarm, stage loading, or accept if outside the player-facing budget |

Do not convert readable code to lower-level code until the profiler shows the method matters. Re-measure total frame time after every local improvement.
