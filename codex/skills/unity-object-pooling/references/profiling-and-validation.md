# Profiling and Validation

## Contents

1. Baseline design
2. Profiler inspection
3. Correctness test matrix
4. Performance comparison
5. Acceptance criteria

## 1. Baseline Design

Before replacing a correct non-pooled implementation, record:

- Target hardware and build configuration.
- Representative worst-case scene.
- Spawn rate and burst pattern.
- Object active lifetime.
- Maximum concurrent objects.
- Frame-time target.
- CPU time around spawn and despawn.
- Managed allocation per frame and during bursts.
- Native and managed memory.

Use the same workload after pooling. Do not compare unrelated scenes, different quality settings, or different spawn rates.

## 2. Profiler Inspection

Use the Unity Profiler to inspect:

- CPU Usage hierarchy or timeline around `Object.Instantiate`, `Object.Destroy`, pool create, get, reset, release, and overflow destroy.
- `GC Alloc` in the CPU module.
- Memory module object counts and memory trends.
- Memory Profiler snapshots when retained objects or leaked references are suspected.
- Physics, animation, particle, or UI cost added by reset and reactivation.

Profile in the Editor for quick iteration, then use a Development Build on the target platform or device for decisions. Editor overhead and behavior can differ from a player build.

Do not enable Deep Profiling for final comparison unless necessary; its overhead can distort results. Use focused `ProfilerMarker` instrumentation around custom pool operations when built-in markers are insufficient.

## 3. Correctness Test Matrix

### Construction and first use

- Pool creates a valid item when empty.
- One-time initialization happens exactly once.
- Spawn context is applied before dependent activation callbacks.

### Reuse

- Lease an item, mutate every relevant field, release it, then lease it again.
- Verify no dirty state remains.
- Repeat multiple cycles, not only one reuse.

### Terminal path races

Trigger combinations such as:

- Collision and timeout in the same frame.
- Death and scene unload.
- Cancellation and owner destruction.
- Particle stopped callback and manual despawn.

Verify one release only.

### Exhaustion and overflow

- Acquire beyond prewarm count.
- Verify built-in pool creates on empty when allowed.
- Release more inactive items than `maxSize`.
- Verify overflow invokes permanent destruction.
- For a custom bounded pool, verify `TryAcquire` fails or follows the documented policy without allocating.

### Pool cleanup

- Call `Clear` with inactive objects.
- Destroy the pool owner with inactive and active objects.
- Reload the scene repeatedly.
- Test persistent pools across scene transitions.
- Verify no duplicate owners or retained scene references.

### Misuse defense

- Attempt double release in the Editor.
- Attempt return to the wrong pool.
- Attempt external `Destroy` if the architecture could permit it.
- Disable the pooled object externally.
- Verify guard behavior and diagnostics.

### Subsystem-specific cycles

- Rigidbody projectile: velocity and collision state.
- Particle: play, stop, clear, and replay.
- Audio: play, stop, new clip, and replay.
- Animator/ragdoll: transition, death, reset, and respawn.
- AI/NavMesh: target, path, death, reset, and respawn.
- UI/tween: show, animate, hide, reset, and show again.
- Async item: start, release, re-lease, then allow old continuation to complete; it must not affect the new lease.

## 4. Performance Comparison

Compare at least:

- Average and worst relevant frame time during the test window.
- Spawn/despawn CPU cost.
- GC allocation during steady state and bursts.
- GC or hitch frequency.
- Total active and inactive pool counts.
- Managed and native memory retained after the workload.
- Load-time cost from prewarming.

Interpret carefully:

- Reduced `Instantiate`/`Destroy` cost can be offset by expensive reset logic.
- Zero steady-state GC is useful only if memory remains bounded and frame time improves where needed.
- A large inactive pool can reduce spikes but exceed mobile memory budgets.
- A pool that constantly creates on get and destroys on overflow release is undersized, leaking returns, or mismatched to the workload.
- A high `CountAll` that never falls can indicate forgotten releases or a workload whose concurrency estimate was wrong.

## 5. Acceptance Criteria

Accept the pooling change only when:

- Correctness tests pass for fresh and reused items.
- Ownership and cleanup are explicit.
- No known double release, stale state, or leaked work remains.
- The pool is sized from evidence or a defensible estimate.
- Target-device measurements show meaningful value, or the high-frequency use case is clear and subsequent verification confirms it.
- Memory increase is acceptable.
- Code remains understandable and maintainable.

Revert or simplify when the measured gain is too small relative to complexity, memory, and lifecycle risk.
