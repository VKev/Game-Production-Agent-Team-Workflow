# Architecture Verification

## Table of contents

1. Before coding
2. Compile and static verification
3. Automated tests
4. Playtest and lifecycle checks
5. Architecture review
6. Optimization after correctness
7. Completion report

## 1. Before coding

Confirm:

- The selected approach matches existing project conventions or explains a justified deviation.
- Current task scope and GDD-backed extension seams are separated.
- Ownership, lifetimes, dependencies, and communication paths are written down.
- Required packages and APIs exist in the project's Unity version.
- The selected folder tree matches the architecture and existing project convention without creating unused layers.
- The implementation plan does not require unrelated future features.

## 2. Compile and static verification

After implementation:

- Let Unity recompile all affected assemblies.
- Resolve compile and syntax errors.
- Inspect Console errors and warnings introduced by the change.
- Check assembly references, runtime/Editor separation, namespaces, serialized fields, and missing script/reference risks.
- If files moved, verify Unity `.meta` files, GUIDs, prefabs/scenes, Addressables or Resources paths, and local `AGENTS.md` navigation remain correct.
- Verify no accidental public API or serialized-field migration was introduced.

Do not claim successful compilation without actually running the available compile/check workflow.

## 3. Automated tests

Choose tests by boundary:

- Edit Mode tests for plain C# rules, calculations, state transitions, Presenters, and use cases.
- Play Mode tests for MonoBehaviour lifecycle, scene/prefab integration, physics timing, coroutines, and Unity object behavior.
- Integration tests for communication across feature boundaries.

Test important failure paths and invariants, not only the happy path.

Examples:

- Invalid state transition is rejected.
- Purchase does not mutate coins when validation fails.
- Subscriber is not called after destruction/unsubscription.
- Loading failure leaves the service in a valid state.
- Shared configuration asset is not mutated by per-instance runtime state.

## 4. Playtest and lifecycle checks

Playtest the exact implemented behavior, then check applicable lifecycle cases:

- Enable/disable repeatedly.
- Destroy and recreate entities.
- Reload the scene.
- Load/unload additive scenes.
- Pause/resume or application focus changes.
- Start with missing/invalid configuration where validation should catch it.
- Re-enter a state or reopen a screen.
- Verify no duplicate event subscriptions or initialization.
- Verify persistent services do not retain destroyed scene references.
- Verify pooled/reused objects reset all required state when pooling is involved.

## 5. Architecture review

Check:

- Each type has one coherent responsibility.
- No god object, catch-all manager, or hidden service locator was introduced.
- Dependency direction is acyclic and understandable.
- Public contracts are narrower than implementations where a boundary exists.
- Direct calls remain direct when indirection adds no value.
- Events represent facts and have clear publishers/lifetimes.
- Configuration, runtime state, and save state are separate.
- Owners control creation and cleanup.
- The feature can be debugged through Inspector state, logs, tests, or dedicated tooling as appropriate.
- Extension seams correspond to real GDD requirements.
- Folder ownership matches feature ownership; no duplicate homes, empty architecture layers, or new catch-all folders were introduced.
- Runtime, Editor, tests, and assembly boundaries are separated only where they provide real value.

## 6. Optimization after correctness

Only optimize after the implementation is complete, passes relevant tests, and has no known bugs.

Evaluate relevant costs:

- Garbage collection allocations.
- Per-frame and frequently invoked method costs.
- Physics queries, collision setup, fixed timestep work, and Rigidbody interactions.
- Repeated component lookups or asset loads.
- Event/listener fan-out.
- Object creation/destruction.
- Rendering/UI rebuilds when architecture affects them.
- Algorithmic complexity and data locality.

Measure with the appropriate Profiler or instrumentation when the decision matters. Use `dev-unity-performance-profiling` for detailed measurement.

Refine code only when optimization provides meaningful value while preserving correctness, cleanliness, maintainability, and the selected boundaries. If an optimization yields a minor performance gain but significantly reduces clarity, keep the cleaner implementation. Accept additional complexity only when the performance benefit is substantial, demonstrated or strongly justified, and relevant to the target device/workload.

Retest after every optimization. Optimization is a code change, not a proof of unchanged behavior.

## 7. Completion report

Report concisely:

```text
Architecture selected:
Folder/assembly structure selected:
AGENTS.md/table-of-contents updates:
Implementation completed:
Compile/Console result:
Tests run and result:
Playtest performed:
Lifecycle cases checked:
Optimization evaluated/applied:
Known limitations or intentionally deferred GDD extensions:
```

Be explicit when a verification step could not be run in the available environment.
