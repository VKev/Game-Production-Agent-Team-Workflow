# Testing and Profiling

## Table of contents

- Correctness matrix
- Unity Test Framework
- Timing and lifecycle tests
- Profiling workflow
- Optimization rules
- Completion checklist

## Correctness matrix

Test each relevant row, not only the happy path:

| Scenario | What to verify |
|---|---|
| Success | Result applied once; operation completes; ownership cleared |
| Failure | Exception observed once; user/system state remains valid |
| Caller cancellation | Work stops at a defined point; no failure log for expected cancellation |
| Disable | Operation stops or continues according to the active-lifetime contract |
| Destroy | No continuation touches the destroyed object |
| Scene unload | Scene-owned work and resources are cleaned up |
| Application exit | No retries, replacement work, or stale callbacks start during shutdown |
| Timeout | Distinguish timeout from caller cancellation and actual failure |
| Repeated call | Reject, join, replace, queue, coalesce, or parallel policy behaves as specified |
| Underlying non-cancelable operation | Late result is ignored or safely finalized |
| `Time.timeScale = 0` | Scaled/unscaled waits match pause behavior |
| Low frame rate / long frame | No assumption of exact timer resumption |
| IL2CPP/AOT | Build compiles and behavior matches Editor tests |
| WebGL | No unsupported thread-pool dependency |

## Unity Test Framework

Use Edit Mode tests for pure logic, cancellation policy, error translation, and state transitions that do not need a running scene.

Use Play Mode tests for:

- PlayerLoop timing;
- `MonoBehaviour` enable/disable/destroy behavior;
- scene loading;
- Unity `AsyncOperation` integration;
- coroutine and UniTask frame waits;
- time-scale behavior;
- pooled object lifetime;
- UI or physics interactions.

`[UnityTest]` supports coroutine-style `IEnumerator` tests. Bridge a UniTask operation with `UniTask.ToCoroutine`:

```csharp
[UnityTest]
public IEnumerator CancelsWhenOwnerIsDestroyed()
{
    return UniTask.ToCoroutine(async () =>
    {
        // Arrange, await, and assert.
        await UniTask.NextFrame();
    });
}
```

Reset global state such as `Time.timeScale` in `finally` blocks so a failed test does not poison following tests.

## Timing and lifecycle tests

When timing matters, assert ordering rather than relying only on elapsed seconds:

- before/after `Update`;
- before/after `LateUpdate`;
- fixed-step order;
- loaded scene `Awake`/`Start` relative to continuation;
- true end-of-frame screenshot/readback behavior;
- same-frame versus next-frame continuation;
- cancellation before and after the awaited operation reports completion.

Use frame counters or an event log in tests. Avoid brittle exact millisecond assertions unless testing realtime behavior with a reasonable tolerance.

## Profiling workflow

1. Establish a representative repeatable workload.
2. Record current CPU time, `GC.Alloc`, operation count, and frame spikes.
3. Inspect coroutine resumes under `DelayedCallManager`.
4. Use UniTaskTracker to find forgotten or unexpectedly long-lived UniTasks.
5. Enable expensive UniTask stack-trace tracking only during diagnosis.
6. Compare an optimized/development player build on target hardware when the decision matters.
7. Change one meaningful factor at a time.
8. Re-run the same workload and report before/after measurements.

Be careful interpreting async state-machine allocations in the Editor. Debug/development compiler optimization can differ from release builds. Do not claim a zero-allocation result from an Editor-only observation.

## Optimization rules

Optimize only after the implementation is correct and tested.

Prefer, in order:

1. remove unnecessary work or duplicate operation starts;
2. reduce polling frequency or replace polling with completion signals;
3. cancel obsolete operations early;
4. avoid nested or fragmented coroutine chains;
5. reuse stable buffers/progress implementations where measured;
6. select a better execution model for actual CPU work;
7. apply micro-optimizations only to a measured hot path.

Do not replace readable coroutine code with UniTask solely to reduce a small one-time allocation. Do not retain a complex cancellation-suppression or custom promise design unless the measured benefit exceeds its maintenance cost.

## Completion checklist

- [ ] A single owner starts and ends the operation.
- [ ] Duplicate-call policy is tested.
- [ ] Expected cancellation is not logged as failure.
- [ ] Non-cancellation failure is observed.
- [ ] No stale continuation mutates destroyed, disabled, or reused state.
- [ ] Token sources, event handlers, and handles are cleaned up.
- [ ] Scaled/unscaled and frame-phase behavior is intentional.
- [ ] Target platform restrictions are tested.
- [ ] Console has no relevant warnings or errors.
- [ ] Performance claims include measurements, or are clearly labeled unverified.
