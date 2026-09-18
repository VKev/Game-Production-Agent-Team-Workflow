---
name: dev-unity-player-loop-systems
description: Design, implement, review, debug, and verify low-level Unity PlayerLoop integrations and centrally ticked runtime systems. Use for PlayerLoop.GetCurrentPlayerLoop, GetDefaultPlayerLoop, SetPlayerLoop, PlayerLoopSystem, custom Update or FixedUpdate phases, custom update managers, tick schedulers, pure C# countdown/stopwatch/frequency/interval timers, deterministic phase ordering, duplicated loop injection, disabled Domain Reload static leakage, or coexistence with UniTask, Entities, Input System, and other PlayerLoop writers.
---

# Unity PlayerLoop Systems

Use low-level PlayerLoop mutation only when an explicit ordering, lifetime, or measured callback-scale requirement earns the added lifecycle risk. Prefer an ordinary `MonoBehaviour` or a scene-owned update manager when it satisfies the contract.

## Required workflow

1. **Inspect before designing.**
   - Read the root and relevant local `AGENTS.md` files, GDD requirements, Unity version, target platforms, scripting backend, assembly boundaries, and existing runtime-system conventions.
   - Search for every `GetCurrentPlayerLoop`, `GetDefaultPlayerLoop`, `SetPlayerLoop`, `PlayerLoopSystem`, and runtime-initialization callback.
   - Identify packages that modify the loop, including UniTask, Entities/DOTS, Input System integrations, or project-owned schedulers.
   - Inspect the installed current loop when live Editor access is available; do not infer final order from source attributes alone.

2. **Define the execution contract.**
   - Name the owner and lifetime: application, play session, scene, feature, entity, or operation.
   - Name the anchor phase and whether the system must run before or after a specific subsystem.
   - Define scaled, unscaled, fixed-step, realtime, or injected-clock semantics.
   - Define registration mutation, ordering, exception, reentrancy, thread, pause, shutdown, and Domain Reload behavior.
   - Define the observable reason a low-level loop hook is preferable to a simpler mechanism.

3. **Choose the smallest suitable mechanism.**
   - Use normal Unity callbacks for small, local behavior.
   - Use a scene- or application-owned `MonoBehaviour` update manager when central dispatch is useful but exact low-level placement is not.
   - Use PlayerLoop injection for exact phase placement, GameObject-independent pure C# systems, or a measured callback-scale bottleneck.
   - Use an ECS system when Entities owns the workload and scheduling model.
   - Read `references/player-loop-lifecycle.md` before implementing or changing a PlayerLoop hook.

4. **Protect loop invariants.**
   - Start from `GetCurrentPlayerLoop` by default so earlier valid modifications survive. Use the default loop only for an intentional, coordinated reset.
   - Give each injected subsystem a stable marker type and deterministic anchor.
   - Make installation idempotent: remove or reject an existing matching marker before inserting one replacement.
   - Validate the anchor and insertion position; fail visibly without installing a partial loop.
   - Build the complete modified tree and call `SetPlayerLoop` once.
   - Keep `UnityEditor` dependencies in Editor-only files, assemblies, or guarded directives.
   - Reset runtime statics explicitly and provide Editor cleanup without relying on normal Play Mode exit as the only cleanup path.

5. **Design the tick registry and timer contracts.**
   - Read `references/timer-schedulers.md` for timer state, time sources, catch-up, disposal, and collection-mutation rules.
   - Make registration unique or document why duplicates are meaningful.
   - Define whether add/remove operations take effect immediately or after the current sweep.
   - Avoid per-frame collection copies unless measured traffic and simplicity justify them; do not sacrifice mutation safety to remove allocations.
   - Treat disposal as an idempotent terminal transition. Do not add a finalizer to release a managed registry subscription.

6. **Implement within the existing architecture.**
   - Change only the owning runtime module and directly required Editor/test integration.
   - Preserve public APIs, serialized data, namespaces, `.asmdef` references, and package compatibility when practical.
   - Add profiling markers and diagnostics only where they answer a real verification or support question.

7. **Verify the installed behavior.**
   - Read `references/verification.md`.
   - Compile both Editor and target-player assemblies.
   - Verify two consecutive Play Mode entries with Domain Reload disabled and exactly one installed marker.
   - Exercise mutation, pause/resume/stop/dispose, invalid input, time-scale, long-frame, exception, scene transition, and shutdown behavior as applicable.
   - Profile before claiming that the custom loop or scheduler improves performance.

## Decision record

Use this compact form before implementation:

```text
Selected mechanism:
Owner and lifetime:
Anchor and relative order:
Other PlayerLoop writers:
Time source:
Registry mutation policy:
Ordering, exception, reentrancy, and thread policy:
Static reset and cleanup:
Simpler alternative rejected:
Verification plan:
```

## Hard safeguards

- Do not replace the default PlayerLoop merely to insert one subsystem.
- Do not assume runtime-initialization methods with the same load type have deterministic order.
- Do not assume a hook installed early survives a later package that rewrites the loop.
- Do not install the same marker more than once.
- Do not leave Editor namespace imports in a player runtime assembly.
- Do not equate pure C# timers with automatic performance improvement; profile the real workload.
- Do not let `Stop`, `Pause`, `Resume`, and `Dispose` create contradictory registration state.
- Do not silently drop or burst missed frequency ticks without a documented policy.
- Do not claim build safety from Editor compilation alone.

## Reference loading guide

- Read `references/player-loop-lifecycle.md` for loop-tree mutation, initialization, idempotence, Domain Reload, package coexistence, and Editor boundaries.
- Read `references/timer-schedulers.md` for timer states, clock choices, progress, catch-up, registry mutation, disposal, and API validation.
- Read `references/verification.md` before completing an implementation or review.
- Read `references/sources.md` when validating version-sensitive behavior or tracing the video-derived lessons to primary sources.

## Related skills

- Use `dev-unity-gameplay-architecture` for ownership, scope, dependency direction, and event/message routing around the runtime system.
- Use `dev-unity-performance-profiling` for callback-scale evidence, allocation measurements, custom markers, and before/after validation.
- Use `dev-unity-async-coroutines-unitask` when UniTask timing, cancellation, or PlayerLoop coexistence materially affects the design.
- Use `dev-unity-jobs-burst-native-collections` when the workload is data-parallel and profiling supports moving it to Jobs/Burst or ECS.
- Use `dev-unity-project-context` for project retrieval, source editing, and managed context refreshes.
