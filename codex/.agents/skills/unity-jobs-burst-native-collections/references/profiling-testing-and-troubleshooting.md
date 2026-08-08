# Profiling, testing, and troubleshooting

## Table of contents

1. Baseline and proof
2. Profiler interpretation
3. Burst verification
4. Correctness test matrix
5. Common failures
6. Keep or revert

## 1. Baseline and proof

Record before jobification:

- Dataset size and distribution.
- Main-thread method total/self time.
- Call frequency.
- Managed allocation.
- Target-device frame time.
- Existing worker utilization.

After jobification, record:

- Gather/copy time.
- Scheduling time.
- Worker job execution time.
- `JobHandle.Complete` or wait time.
- Scatter/apply time.
- Total frame time and over-budget frames.
- Native memory and allocation lifetime.

A shorter worker sample is not sufficient. Keep the design only when end-to-end behavior improves.

## 2. Profiler interpretation

Inspect Timeline for:

- Job schedule points.
- Worker occupancy and idle periods.
- Overlap with main-thread work.
- `WaitForJobGroupID`, `WaitForJobGroup`, `JobFence.Complete`, or `JobHandle.Complete` markers.
- Long batches and final stragglers.
- Other Unity jobs competing for workers.

Common diagnoses:

| Symptom | Likely investigation |
|---|---|
| Immediate long `Complete()` wait | Schedule earlier, complete later, reduce work/dependencies, increase overlap |
| Many tiny worker samples | Job granularity or batch too small |
| One worker runs much longer | Load imbalance, batch too large, uneven iteration cost |
| Workers busy but frame unchanged | Main thread/GPU is dominant or gather/scatter cost offsets gain |
| Main thread slower after conversion | Native data gathering, copying, allocation, or result application dominates |
| Job not visible as Burst target | Missing `[BurstCompile]`, unsupported code, Burst disabled, or wrong package context |
| Frequent native allocation | Reuse persistent capacity or redesign lifetime |

Profile in a Development Player on target hardware. Editor safety, JIT, and tooling overhead can alter results.

## 3. Burst verification

Verify:

- Jobs > Burst > Enable Compilation is active.
- Target appears in Burst Inspector.
- Console has no Burst fallback or compile errors.
- Player Burst AOT settings include the target architecture.
- Warmup is complete before Editor timing.
- Generated assembly is inspected only when a specific optimization question exists.

Compare Burst enabled/disabled to confirm behavior is identical within numeric tolerance. Do not ship with Burst disabled silently after an unsupported-code workaround.

## 4. Correctness test matrix

Test:

- Zero elements.
- One element.
- Typical count.
- Maximum supported count.
- Capacity boundary and overflow policy.
- Duplicate keys and ties.
- Negative, zero, extreme, NaN, and infinity inputs when relevant.
- Repeated scheduling.
- Scene unload/reload.
- Owner disable/destroy while work is scheduled.
- Application shutdown.
- Safety checks enabled.
- Burst enabled and disabled.
- Mono Editor and IL2CPP target Player as relevant.
- Repeated runs for deterministic outputs.
- Different target CPU architectures when numerical behavior matters.

Compare job output against a trusted scalar/reference implementation for representative random datasets.

## 5. Common failures

### Safety exception when scheduling

Cause: two jobs or the main thread have conflicting access without a dependency.

Fix: identify the allocation and access mode, add the correct handle dependency, split buffers, or make access genuinely read-only. Do not disable safety first.

### `TempJob` lifetime warning

Cause: allocation survived beyond its intended short lifetime or disposal path was lost.

Fix: dispose on the last-use dependency or assign a persistent owner if the data truly spans longer.

### Native leak warning

Cause: allocation was never disposed, an exception skipped cleanup, or shutdown lost the owner.

Fix: centralize ownership, preserve handles, use `IsCreated`, add teardown tests, and inspect all initialization failure paths.

### Parallel writer capacity error

Cause: collection cannot grow during parallel append.

Fix: pre-size to the maximum, use two-pass exact sizing, or define a bounded overflow policy.

### Nondeterministic results

Cause: concurrent append order, hash iteration, atomics, floating reduction order, or fast float mode.

Fix: stable indices, deterministic merge/sort/reduction, explicit tie-breaks, or relaxed requirement documented by the feature.

### Burst compile error

Cause: managed field, unsupported API, exception path, string/collection, generic/virtual behavior, or version mismatch.

Fix: isolate managed work outside the Burst boundary, use supported native/fixed types, and read the installed Burst diagnostics.

### No speedup

Cause: workload too small, schedule overhead, immediate completion, data conversion, poor overlap, memory bandwidth, branch divergence, or another subsystem dominates.

Fix: measure each phase; batch work, reuse data, change latency, simplify algorithm, or revert.

### Crash with static or unsafe access

Cause: bypassed safety system or invalid lifetime/range.

Fix: remove static mutable access, restore safe collections, prove ranges, and add stress tests before reconsidering unsafe code.

## 6. Keep or revert

Keep the jobified solution when:

- Target-device total frame or throughput improves meaningfully.
- Main-thread headroom improves without harmful worker contention.
- Native memory is bounded and correctly disposed.
- Correctness and determinism requirements pass.
- The team can maintain the ownership and dependency model.

Revert or simplify when:

- Improvement is within run variance.
- Gather/scatter and fences erase the compute gain.
- Memory or latency cost violates the feature budget.
- Safety suppression becomes necessary for a marginal benefit.
- Debugging and lifecycle complexity exceeds the measured value.
