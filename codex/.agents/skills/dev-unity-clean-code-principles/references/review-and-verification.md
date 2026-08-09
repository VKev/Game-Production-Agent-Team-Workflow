# Review and Verification

## Contents

1. Review classifications
2. New implementation review
3. Refactor review
4. Unity compatibility review
5. Performance review
6. Verification matrix
7. Reporting format

## 1. Review Classifications

Classify findings to avoid presenting personal preference as a defect.

- **Correctness:** Can produce wrong behavior, invalid state, crash, leak, race, or lost data.
- **Lifecycle/ownership:** Acquisition, cleanup, subscription, cancellation, or reuse is unclear or incorrect.
- **Maintainability:** Creates credible change risk, duplicated knowledge, hidden dependency, or mixed responsibility.
- **Readability:** Intent is materially difficult to understand.
- **Performance:** Measured bottleneck or clear high-frequency allocation/cost.
- **Convention:** Conflicts with explicit repository style or architecture.
- **Optional preference:** Valid alternative with no clear project benefit. Do not demand it.

Prioritize findings by impact and confidence.

## 2. New Implementation Review

Check:

- Does the code solve exactly the assigned feature?
- Is the simplest complete approach used?
- Are responsibilities and owners clear?
- Are dependencies explicit and appropriately narrow?
- Is configuration separated from runtime state?
- Are names expressed in gameplay/domain language?
- Are failure and repeated-call behaviors defined?
- Are future seams tied to real requirements rather than guesses?
- Is the code consistent with neighboring project code?

## 3. Refactor Review

Check:

- Is observable behavior preserved?
- Are public APIs and call sites compatible?
- Are serialized field names, types, prefab references, and overrides preserved or migrated?
- Did event order, frame timing, physics timing, or coroutine/async timing change?
- Did visibility or ownership change?
- Did the refactor remove a specific smell or merely redistribute it?
- Is the resulting code easier to trace locally?
- Are tests and playtests at least as strong as before?

Avoid declaring success from compilation alone when runtime behavior, scenes, physics, animation, or serialization are involved.

## 4. Unity Compatibility Review

Verify when relevant:

- Unity and C# version compatibility.
- Serialized-field compatibility.
- Prefab and scene references.
- `Awake`, `OnEnable`, `Start`, `Update`, `FixedUpdate`, `LateUpdate`, `OnDisable`, and `OnDestroy` ordering assumptions.
- Event subscription/unsubscription.
- Destroyed `UnityEngine.Object` behavior.
- Object pooling reset and double release.
- Coroutine/async cancellation and late continuations.
- Addressables or resource handle release.
- Native container disposal.
- Scene reload and Enter Play Mode settings.
- IL2CPP/AOT or target-platform constraints.

## 5. Performance Review

Do not infer performance from visual cleanliness.

For a claimed optimization:

1. Define the workload and target metric.
2. Capture a comparable baseline.
3. Identify the actual bottleneck.
4. Make one focused change.
5. Capture the same workload again.
6. Compare CPU time, allocation, memory, physics, rendering, or relevant counters.
7. Assess readability and maintenance cost.
8. Keep or revert based on value.

Obvious per-frame allocations or repeated scene searches can justify immediate attention, but still verify the final result and avoid turning a local fix into a broad architecture rewrite.

## 6. Verification Matrix

| Change | Minimum verification |
|---|---|
| Rename local/private method | Compile, tests for affected behavior |
| Rename serialized field | Compile, `FormerlySerializedAs` or migration, inspect prefabs/scenes |
| Extract plain C# calculation | Unit/Edit Mode tests, caller playtest |
| Split MonoBehaviour | Compile, prefab/scene wiring, lifecycle playtest |
| Change event communication | Subscription lifecycle, event order, repeated enable/disable |
| Change physics flow | Play Mode test on fixed timestep and target scenario |
| Change coroutine/async flow | Completion, cancellation, disable, destroy, repeated call |
| Introduce pooling | First use, reuse, exhaustion, reset, double release, scene unload |
| Optimize hot path | Before/after profiler capture on representative workload |
| Change public API | All callers, assembly boundaries, tests, migration note |

## 7. Reporting Format

Use a concise report when needed:

```text
Clean-code outcome
- Problem addressed: ...
- Decision: ...
- Principle/tradeoff: ...
- Deliberately avoided: ...
- Compatibility/lifecycle notes: ...
- Verification: ...
- Performance evidence, if applicable: ...
```

Do not cite KISS, DRY, or SOLID as the sole reason. Explain the concrete project problem and the improvement.
