# Job types and scheduling

## Table of contents

1. Job type selection
2. Scheduling and completion
3. Dependencies
4. Batch size and granularity
5. Long-running jobs
6. Frame pipelines
7. ECS boundary

## 1. Job type selection

### `IJob`

Use for one independent work unit. It executes `Execute()` once. It can run alongside unrelated jobs, but does not parallelize its own loop automatically.

Use it for:

- One reduction stage.
- One preprocessing step.
- A dependency bridge between parallel stages.
- A substantial single calculation.

Do not split trivial methods into many tiny `IJob` instances without measuring schedule overhead.

### `IJobParallelFor`

Use for many indexed iterations that can execute independently. Each iteration receives an index. Prefer exclusive output by index.

Choose a batch size that balances:

- Scheduling and work-stealing overhead.
- Cache locality.
- Load balancing for uneven iterations.
- Worker monopolization by long batches.

Small cheap iterations often benefit from larger batches. Expensive or uneven iterations can benefit from smaller batches. Measure.

### `IJobFor`

Use when the installed Unity/Collections APIs support it and the same indexed job should be runnable sequentially or in parallel through its scheduling extensions. Verify exact extension methods in the project version.

### `IJobParallelForTransform`

Use only when direct Transform access through `TransformAccessArray` solves the actual boundary. Understand read-only versus read-write scheduling behavior, hierarchy constraints, invalid transforms, maintenance of the array, and main-thread setup cost.

### ECS job types

Use `IJobEntity`, `IJobChunk`, `Entities.ForEach`, or other Entities APIs only according to the installed Entities version and project conventions. Their API and source-generation behavior are version-sensitive and belong to ECS-owned data.

## 2. Scheduling and completion

Only schedule jobs from the main thread. `Schedule()` returns a `JobHandle` and does not make the result immediately safe to read.

Use this pattern:

1. Prepare all inputs.
2. Schedule as early as practical.
3. Perform unrelated main-thread work.
4. Call `Complete()` immediately before the result is needed.
5. Read/apply output.

`Complete()`:

- Waits if the dependency chain is unfinished.
- Restores safe main-thread access to the containers used by the completed chain.
- Cleans job safety-system state associated with that handle.

Store the authoritative `JobHandle`. Do not lose it while the job still owns native data.

Use `Run()` to execute immediately on the main thread for debugging or to compare scheduling overhead. Do not assume `Run()` is the shipped optimization.

Do not call `JobHandle.ScheduleBatchedJobs()` routinely. Unity batches scheduled jobs automatically; forcing a flush can reduce scheduling opportunities. Use it only with evidence and version-specific understanding.

## 3. Dependencies

A dependency is required when jobs access the same data and at least one writes.

Examples:

```text
A writes positions -> B reads positions
B depends on A

A reads config -> B reads config
No dependency required solely for that read-only sharing

A writes results -> B writes the same results
Serialize them with a dependency or redesign exclusive output
```

Pass the upstream `JobHandle` to downstream `Schedule()` calls. Use `JobHandle.CombineDependencies` when one job truly needs several independent results.

Avoid unnecessary chains. A wide dependency graph permits more overlap than a single serialized chain.

## 4. Batch size and granularity

Batch size is not a fixed best-practice number. Test representative data sizes and target CPUs.

Symptoms of batches that are too small:

- High scheduling/work-stealing overhead.
- Many tiny worker samples.
- Worker management cost close to compute cost.

Symptoms of batches that are too large:

- Poor load balance.
- One worker remains busy while others idle.
- Long jobs monopolize workers and delay other chains.
- Main thread waits on a final large batch.

Prefer enough work per iteration or batch to amortize overhead. Reduce total work before tuning batch size.

## 5. Long-running jobs

Jobs do not yield once a worker begins them. A very long job can occupy a worker and delay unrelated work.

For long workloads:

- Split into dependency stages where intermediate boundaries are natural.
- Increase parallel batch size if a long `IJobParallelFor` otherwise consumes every worker and harms higher-priority work.
- Spread optional work across frames.
- Use one-frame latency where acceptable.
- Consider a dedicated async or native plugin architecture only when the Job System is not the right scheduler.

Do not create artificial stages that increase memory traffic and dependencies more than they improve responsiveness.

## 6. Frame pipelines

### Same-frame pipeline

```text
Early Update: gather and schedule
Middle of frame: animation, input, other systems
Late Update: complete and apply
```

### Cross-frame pipeline

```text
Frame N: schedule computation
Frame N+1: complete only when result is required; apply; schedule next
```

### Dependency chain

```text
Gather/native update
-> broad-phase or score job
-> reduction/select job
-> main-thread scatter
```

Mark the exact point where the main thread needs ownership. Every earlier `Complete()` shortens useful overlap.

## 7. ECS boundary

Classic jobs and Native Collections do not require ECS. Use ECS when entity/component storage, chunk iteration, structural changes, and system scheduling are already part of the architecture.

When the project uses Entities:

- Follow the installed Entities 1.0.x API for Unity 6.3 unless the manifest says otherwise.
- Preserve system dependency handles.
- Use EntityCommandBuffer for deferred structural changes according to project conventions.
- Do not copy ECS data into a parallel GameObject-native system without comparing ownership and conversion cost.
