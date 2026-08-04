# Decision and data design

## Table of contents

1. Suitability test
2. Choose the execution model
3. Cost model
4. Gather-compute-scatter boundary
5. Data layout
6. Latency and buffering
7. Migration strategy

## 1. Suitability test

Use Jobs/Burst when most answers are yes:

- Does the Profiler show a CPU bottleneck in project-owned work?
- Does the workload process many elements or perform substantial pure computation?
- Can elements be processed independently or through explicit dependency stages?
- Can inputs and outputs be represented as unmanaged values or Native Collections?
- Can the job avoid general UnityEngine object access?
- Is there enough work to amortize scheduling, safety, and data movement?
- Can result consumption be delayed until later in the frame or a later frame?
- Is the target hardware multi-core and supported by the chosen packages?
- Does the team accept explicit native-memory lifetime and concurrency testing?

Keep the existing implementation when:

- The method is not measured as a bottleneck.
- The dataset is small or work is rare.
- The algorithm is mostly I/O, network waiting, asset loading, or main-thread engine calls.
- Gathering managed data costs as much as the computation.
- The result must be consumed immediately, forcing an expensive fence.
- Work is highly sequential, branchy, lock-heavy, or depends on a shared mutable object graph.
- The project cannot safely own and dispose persistent native memory.

There is no universal element-count threshold. Measure the actual platform, data type, job shape, and algorithm.

## 2. Choose the execution model

| Work | Preferred starting point |
|---|---|
| Small gameplay rule using GameObjects | Main-thread C# |
| Repeated indexed CPU math over many independent elements | `IJobFor` or `IJobParallelFor` + Burst |
| One heavy independent CPU calculation | `IJob` + Burst |
| Transform array processing without full ECS migration | `IJobParallelForTransform` when appropriate |
| Existing Entities data/system | ECS job APIs matching the installed Entities version |
| File/network/database/SDK waiting | Task, UniTask, coroutine, or callback; not Job System |
| Massive GPU-friendly numeric work | Consider compute shader after GPU profiling and platform review |
| Background managed computation with unsupported Burst types | Consider `Task.Run` only on supported platforms and without Unity API access |

Jobs can be used without ECS. Do not migrate a GameObject feature to Entities merely to gain Burst unless the full data/lifecycle tradeoff is justified.

## 3. Cost model

End-to-end cost includes:

```text
gather managed data
+ allocate/resize native buffers
+ schedule jobs
+ worker execution
+ dependency and fence waits
+ scatter results to Unity objects
+ disposal or persistent-memory maintenance
```

A faster `Execute()` method can still make the frame slower if gather, schedule, or `Complete()` cost dominates.

For recurring workloads:

- Allocate persistent buffers once.
- Reuse capacity.
- Update only changed data when safe and simpler.
- Schedule work before unrelated main-thread work.
- Complete immediately before the result is required.
- Consider consuming previous-frame output while current-frame work runs.

## 4. Gather-compute-scatter boundary

Design three explicit phases:

1. **Gather:** Read GameObjects, ScriptableObjects, or managed state on the main thread into native inputs.
2. **Compute:** Run pure jobs over native data.
3. **Scatter:** Complete dependencies and apply results to GameObjects or managed systems on the main thread.

Keep engine-facing operations at the boundary. Examples:

- Gather Transform positions into `NativeArray<float3>` if not using a supported Transform job API.
- Compute targeting scores, steering vectors, spatial queries over prebuilt data, procedural geometry, or simulation state.
- Scatter chosen targets, positions, mesh data, or commands after completion.

Do not repeatedly convert the same stable data every frame. Cache immutable data or assign a persistent owner.

## 5. Data layout

Prefer data that is:

- Contiguous.
- Unmanaged.
- Fixed-size or predictably bounded.
- Accessed linearly.
- Split into read-only inputs and exclusive outputs.
- Free of hidden references and virtual dispatch.

Choose Array of Structures when each iteration consumes most fields of one element. Consider Structure of Arrays when hot loops consume only a subset of fields, vectorization benefits from contiguous fields, or systems update different components independently.

Avoid changing layout for theoretical cache benefits without profiling. Simpler layout can be more valuable when the workload is not memory-bandwidth bound.

## 6. Latency and buffering

Same-frame flow:

```text
Gather early -> Schedule -> unrelated main-thread work -> Complete late -> Scatter
```

One-frame-latency flow:

```text
Frame N: gather/schedule current data; consume completed result from N-1
Frame N+1: complete/consume N; schedule N+1
```

One-frame latency often increases overlap but is valid only when gameplay can tolerate stale results. Document the latency contract.

Double buffering can prevent main-thread writes to a buffer still owned by jobs, but doubles memory and complicates versioning. Use it only when overlap is valuable.

## 7. Migration strategy

Migrate incrementally:

1. Add markers and baseline the managed implementation.
2. Extract pure computation without changing behavior.
3. Write correctness tests against known inputs.
4. Introduce native inputs/outputs at one boundary.
5. Run the job synchronously with `Run()` for debugging if useful.
6. Schedule it and preserve dependency/lifetime ownership.
7. Add Burst.
8. Compare end-to-end cost.
9. Tune only after correctness and measured improvement.

Keep a clear rollback path until the target-device result is proven.
