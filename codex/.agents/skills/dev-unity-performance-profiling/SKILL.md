---
name: dev-unity-performance-profiling
description: Evidence-driven Unity performance diagnosis, profiling, optimization, and regression verification. Use for low or unstable frame rate, stutter, long frames, GC allocations, memory growth, CPU or GPU bottlenecks, rendering cost, physics or UI cost, loading spikes, profiler setup, performance budgets, custom ProfilerMarker or ProfilerRecorder instrumentation, Memory Profiler snapshots, Profile Analyzer comparisons, Frame Debugger inspection, and before-versus-after validation. Apply to Unity 2022.3 projects by default, but inspect the actual Unity version, packages, target platform, render pipeline, scripting backend, quality settings, and hardware before giving version-sensitive guidance.
---

# Unity Performance Profiling

## Objective

Diagnose performance with evidence before changing code. Find the dominant bottleneck, make the smallest justified change, measure the same workload again, and keep the change only when its value exceeds its complexity and maintenance cost.

Do not treat optimization tips as universal rules. Preserve correctness, deterministic gameplay behavior where required, clean ownership, and readability.

## Required workflow

1. **Inspect project context.**
   - Read the root and relevant local `AGENTS.md` files and the GDD.
   - Read `ProjectSettings/ProjectVersion.txt`, `Packages/manifest.json`, and `Packages/packages-lock.json`.
   - Identify target platform and device tier, render pipeline, scripting backend, API compatibility level, graphics API, quality level, resolution, frame cap, VSync, and installed profiling packages.
   - Reuse existing performance budgets, test scenes, capture scripts, markers, and reporting conventions.

2. **Define the performance contract.**
   - Name one reproducible gameplay scenario.
   - Define the target device, target frame rate, frame-time budget, quality settings, resolution, expected entity counts, and acceptable memory ceiling.
   - State whether the test is cold-start, cold-cache, warm-cache, steady-state, burst-load, or long-session.
   - Decide which metric proves success before editing code.

3. **Capture a baseline.**
   - Prefer a Development Build on the target device for authoritative timing and memory conclusions.
   - Use Editor profiling only for fast iteration after reproducing the issue on the target.
   - Capture only the Profiler modules needed for the current question.
   - Avoid Deep Profiling initially. Enable targeted allocation call stacks or add custom markers before accepting Deep Profiling overhead.
   - Warm up JIT, shader, asset, and pool initialization when measuring steady-state behavior.
   - Record several representative runs; do not select a single favorable frame.

4. **Classify the bottleneck before optimizing.**
   - Distinguish CPU main-thread, render-thread, worker-thread, GPU, managed allocation/GC, native or graphics memory, physics, UI, loading/streaming, animation, audio, and frame-pacing problems.
   - Interpret waiting markers in context. A large wait sample often identifies where a thread waited, not the subsystem that created the work.
   - Account for VSync, `Application.targetFrameRate`, thermal throttling, background applications, and capture overhead.

5. **Narrow the cause.**
   - Use Timeline to inspect thread interaction and Hierarchy to rank total and self time.
   - Use allocation call stacks and targeted markers for script allocations.
   - Use GPU Profiler or a platform GPU tool for GPU timings and Frame Debugger for render-event composition.
   - Use Memory Profiler snapshots for retained memory, leaks, asset duplication, and native/managed ownership.
   - Use Profile Analyzer for multi-frame distributions and before/after capture comparison.
   - Read the relevant reference file before diagnosing a subsystem.

6. **Form one testable hypothesis.**
   - State the suspected root cause and the evidence supporting it.
   - Predict the metric that should improve.
   - Change one dominant factor at a time when practical.
   - Prefer a local fix over a broad rewrite unless measurements show an architectural bottleneck.

7. **Measure the same scenario again.**
   - Match device, build type, scene state, camera, quality, resolution, frame cap, capture duration, warmup, and input path.
   - Compare distributions across multiple frames and runs, not only average FPS.
   - Check regressions in correctness, visual quality, memory, loading time, battery/thermal behavior, and code complexity.

8. **Keep, revise, or revert.**
   - Keep the optimization only when the improvement is meaningful for the stated budget and remains stable on the target device.
   - Revert an optimization that produces negligible value, shifts cost to a worse subsystem, introduces bugs, or makes the code substantially harder to maintain without sufficient benefit.
   - Document the evidence and remaining bottleneck.

## Tool routing

Read only the references relevant to the current diagnosis:

- Read [profiling-workflow.md](references/profiling-workflow.md) for capture design, frame budgets, controlled comparisons, mobile conditions, and regression gates.
- Read [cpu-and-gc.md](references/cpu-and-gc.md) for CPU Timeline/Hierarchy, wait markers, managed allocations, garbage collection, and custom script markers.
- Read [gpu-and-rendering.md](references/gpu-and-rendering.md) for CPU/GPU classification, render-thread analysis, Frame Debugger, batching, overdraw, shaders, lights, shadows, and platform GPU tools.
- Read [memory-profiling.md](references/memory-profiling.md) for memory counters, snapshots, retained references, asset memory, fragmentation, and leak investigations.
- Read [subsystem-profiling.md](references/subsystem-profiling.md) for physics, UI, loading, animation, audio, navigation, and asynchronous work.
- Read [instrumentation-and-regression.md](references/instrumentation-and-regression.md) for `ProfilerMarker`, `ProfilerRecorder`, repeatable captures, performance tests, and reporting.
- Read [sources.md](references/sources.md) when verifying a version-sensitive claim or following the original documentation.

## Interpretation safeguards

- Measure frame time in milliseconds. FPS alone hides spikes and percentile behavior.
- Do not compare Editor timings directly with Player timings.
- Do not infer a GPU bottleneck from draw-call count alone.
- Do not infer a memory leak from a growing managed heap alone; separate reserved, used, retained, native, graphics, and operating-system memory.
- Do not infer that a `WaitFor...` marker is the expensive work itself.
- Do not use Deep Profiling data as an exact production cost measurement.
- Do not disable VSync or frame caps as a shipped fix merely because doing so exposes the bottleneck during diagnosis.
- Do not call `GC.Collect`, disable GC, pool objects, convert loops, add Jobs/Burst, lower visual quality, or rewrite architecture without evidence that the change addresses the measured bottleneck.
- Treat profiler overhead, Script Debugging, Development Build overhead, logging, safety checks, and editor windows as possible measurement distortions.
- For mobile, control thermal state and repeat after sustained load. A short cool-device capture is not enough to prove stable performance.

## Optimization policy

After the implementation is correct, tested, and has no known bugs, evaluate whether optimization is worthwhile. Review garbage collection allocations, method execution cost, physics cost, rendering cost, memory use, and other relevant factors. Refine only the areas supported by profiling evidence.

If an optimization provides only a minor gain but significantly reduces clarity, maintainability, or safety, keep the cleaner implementation. Accept additional complexity only when the performance benefit is meaningful, measured, and justified by the project budget.

## Required result format

When reporting a profiling or optimization task, include:

```text
Environment:
- Unity/package versions:
- Target device/platform:
- Build/backend/graphics API:
- Quality/resolution/frame pacing:

Scenario and budget:
- Reproduction steps:
- Target metric:
- Frame or memory budget:

Baseline evidence:
- Capture type and duration:
- Dominant bottleneck:
- Relevant markers/counters:

Hypothesis and change:
- Root-cause hypothesis:
- Minimal change made:
- Expected tradeoffs:

Verification:
- Before:
- After:
- Multiple-run or percentile result:
- Correctness/visual/memory regressions checked:

Decision:
- Keep, revise, or revert:
- Remaining bottleneck or next measurement:
```

Do not claim a speedup without recording comparable before-and-after evidence. Clearly label unmeasured recommendations as hypotheses.

## Related-skill boundaries

- Use `dev-unity-csharp-collections-queries` for collection, LINQ, iterator, and reusable-buffer decisions.
- Use `dev-unity-object-pooling` when profiling proves frequent create/destroy cost or allocation pressure and pooling is being designed or reviewed.
- Use `dev-unity-jobs-burst-native-collections` when profiling proves a suitable CPU-heavy, data-parallel workload.
- Use `dev-unity-assets-addressables` for asset/bundle loading, release ownership, remote content, and Addressables memory investigations.
- Use `dev-unity-gameplay-architecture` when the bottleneck requires changing feature boundaries or dependency direction.
