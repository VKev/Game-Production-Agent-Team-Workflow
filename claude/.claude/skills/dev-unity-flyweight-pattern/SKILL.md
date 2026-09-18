---
name: dev-unity-flyweight-pattern
description: Design, implement, review, refactor, debug, and profile Unity Flyweight pattern solutions. Use for intrinsic versus extrinsic state, shared immutable configuration across many similar instances, ScriptableObject flyweights, flyweight factories or registries, projectile or enemy variants, and combinations with UnityEngine.Pool. Also use when deciding whether Flyweight, direct shared assets, prefabs, pooling, Strategy, Builder, VContainer, Addressables, or a simpler design best fits the evidence.
---

# Unity Flyweight Pattern

Use Flyweight to share genuinely duplicated intrinsic data. Keep per-instance mutable context outside that shared data, and treat pooling and factories as separate choices.

## Start With a Tradeoff Comparison

Before adopting a design, state for every materially relevant skill or approach:

- benefit for this task;
- drawback or added complexity;
- prerequisite or evidence needed;
- rejection condition;
- whether it combines cleanly with the other candidates.

Use any justified combination, sequence, or no specialist skill. Do not assign primary/supporting ranks. Do not load a skill only because it shares a keyword.

## Decide Whether Flyweight Fits

1. Identify the repeated object population and duplicated data.
2. Measure or estimate the duplicated memory at the expected scale.
3. Separate intrinsic data that is identical and safely shareable from extrinsic state that varies by instance or spawn.
4. Compare the smallest alternatives: existing shared Unity assets, a prefab, one ScriptableObject reference, a plain immutable table, or direct concrete variants.
5. Adopt Flyweight only when sharing makes ownership and memory clearer enough to justify the indirection.

Reject Flyweight when the population is small, duplicated data is negligible, values mutate independently, or a prefab/material/mesh already supplies the required sharing.

## Preserve the State Boundary

Keep intrinsic data immutable in practice: prefab and shared visual/audio references, stable variant constants, curves, and authoring configuration. Keep transform, owner, faction, target, current lifetime, velocity, hit history, buffs, and other mutable runtime state on the instance or in an explicit spawn context.

Never write per-instance state into a shared ScriptableObject. Runtime writes affect every consumer; Editor asset writes can persist. Expose read-only properties and validate references and value ranges.

## Keep Patterns Separate

- Flyweight reduces duplicated shared data.
- Factory selects or creates a variant and owns construction policy.
- Object pooling reuses mutable instances to reduce repeated creation and destruction.

Use them together only when each solves an evidenced concern. Key a pool registry by the actual settings asset reference or another unique pool identity, not merely by a broad enum when multiple assets may share that enum.

Prefer shared data assets that describe a variant and a factory or pool adapter that owns runtime callbacks. Putting creation, activation, release, and destruction methods on the ScriptableObject couples immutable data to runtime lifecycle; do it only when that ownership is deliberate.

## Design Runtime Ownership

Compare an explicit serialized service, scene bootstrap, VContainer lifetime scope, and a static singleton. A singleton is convenient but introduces hidden dependencies, initialization order, cross-scene lifetime, teardown, testing, and Domain Reload concerns. Reject it when explicit ownership remains simple.

Validate prefab-component and settings compatibility when constructing the pool. Prefer the required component authored on the prefab; avoid unconditional `AddComponent` calls that can duplicate components. Avoid unsafe base-to-derived settings casts or property hiding when a validated typed initialization API is clearer.

## Make Pooling Correct When Selected

On every get, initialize all extrinsic state. On every release, stop or invalidate timers and async work, unsubscribe events, clear owner/target/hit state, reset physics, trails, particles, animation and audio as needed, then deactivate. Use a generation token when delayed callbacks could act on a released and reused instance.

Remember Unity `ObjectPool` semantics:

- `defaultCapacity` initializes the backing stack; it does not instantiate or prewarm objects.
- `maxSize` limits retained inactive objects. It does not cap simultaneously borrowed objects; releasing into a full pool invokes destruction behavior.
- collection checks catch duplicate release only in the Editor.
- the pool is stack-based and not thread-safe.

Define warmup separately. Size from measured concurrency and retained-memory limits. Clear or dispose inactive objects when their owning scope ends, and define what happens to borrowed objects during teardown.

## Handle Delayed Return Safely

An `OnEnable` coroutine that returns an object after a delay is unsafe if an object can be released early and borrowed again. Stop the specific coroutine or invalidate it by generation on release. Decide whether lifetime uses scaled or unscaled time.

Do not add a `Dictionary<float, WaitForSeconds>` cache by default. Arbitrary float keys can grow without bound and fragment by exact values. Use finite known durations or a centralized timer only after allocation evidence justifies it.

## Compare Neighboring Skills

- `dev-unity-object-pooling`: repeated instance reuse and reset lifecycle.
- `dev-unity-performance-profiling`: disputed memory, GC, spawn, or frame-time cause.
- `dev-unity-gameplay-architecture`: factory ownership, boundaries, and service topology.
- `dev-unity-strategy-pattern`: interchangeable behavior rather than shared data.
- `dev-unity-builder-pattern`: complex validated per-spawn construction.
- `dev-unity-vcontainer`: explicit composition and lifetime scopes.
- `dev-unity-assets-addressables`: loaded asset ownership and release.
- `dev-unity-async-coroutines-unitask` or `dev-unity-player-loop-systems`: timer and cancellation contracts.
- `dev-unity-stats-modifiers`: mutable or computed damage and stat state.
- `dev-unity-clean-code-principles` or `dev-ponytail`: simplicity review when it materially changes the result.

## Verify

- Profile memory before and after; confirm the duplicated payload actually shrank.
- Measure spawn/despawn time and GC allocation if pooling is claimed to help.
- Exercise first spawn, reuse, early return, duplicate return, pool overflow, scene teardown, disabled Domain Reload, and incompatible prefab/settings cases.
- Track `CountAll`, `CountActive`, and `CountInactive`, pool hits/misses, retained peak, and reset defects where useful.
- Confirm two settings assets with the same category cannot borrow from the wrong pool.
- Confirm shared settings never receive per-instance mutations.

For implementation alternatives, failure modes, a production checklist, the video reconstruction, and official sources, read [references/unity-flyweight-guide.md](references/unity-flyweight-guide.md).
