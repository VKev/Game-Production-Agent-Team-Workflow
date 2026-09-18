# PlayerLoop Lifecycle and Coexistence

## Select the mechanism

Use the lowest-risk mechanism that satisfies the requirement:

| Requirement | Prefer |
| --- | --- |
| A few local per-frame behaviors | Ordinary Unity callbacks |
| Central subscription without exact engine-phase placement | Scene/application-owned update manager |
| GameObject-independent system or exact phase placement | PlayerLoop injection |
| Entities-owned data and scheduling | ECS system |

Treat callback-count optimization as a profiling question. Central scheduling can reduce native-to-managed transitions at large scale, but it also introduces collection dispatch and lifecycle complexity.

## Modify the current tree deliberately

`PlayerLoopSystem` is a value-type tree whose children are arrays. Recursive utilities must write modified child structs back through the parent path.

- Start from `PlayerLoop.GetCurrentPlayerLoop()` when preserving earlier package or project modifications.
- Use `GetDefaultPlayerLoop()` only when intentionally reconstructing the whole loop under one coordinated owner.
- Select an exact anchor type and relative position. “Index zero under Update” means before every existing Update child, which might be stronger than the feature requires.
- Validate null child arrays, missing anchors, multiple anchors, and insertion bounds.
- Return a success/failure result. Do not call `SetPlayerLoop` after a failed or ambiguous edit.
- Apply all edits to one local tree and install it once.

## Make installation idempotent

Use a stable marker `type` for each custom subsystem. Before inserting:

1. Retrieve the current loop.
2. Count matching markers.
3. Remove all stale matching markers, or fail if another owner controls them.
4. Insert exactly one replacement at the selected anchor.
5. Install the tree.
6. Retrieve the current loop again and assert one matching marker at the expected position.

Match by marker type first. Delegate equality can supplement the marker but should not be the sole identity when delegates can be recreated.

Removal utilities must define whether they remove one match or every match. If cleanup is intended to repair duplication, removing only the first match is insufficient.

## Initialization and static reset

Unity invokes runtime initialization phases in a defined broad sequence, but ordering within the same phase is not guaranteed.

- Use `SubsystemRegistration` to reset runtime static fields and handlers when Domain Reload may be disabled.
- Choose the installation phase based on other loop writers and the required anchor, not tutorial convention alone.
- Keep the reset and installation operations individually idempotent.
- Avoid relying exclusively on `ExitingPlayMode`; abnormal termination or script errors can bypass the expected exit path.

For Editor-only cleanup or diagnostics:

- Isolate `UnityEditor` code in an Editor assembly/folder or guard both the import and usage.
- Subscribe and unsubscribe symmetrically from `EditorApplication.playModeStateChanged` and assembly-reload events.
- Do not let Editor hooks become required for correct player behavior.

## Coexist with other loop writers

Inventory every writer before choosing initialization order. UniTask, Entities, packages, and project infrastructure can retrieve, modify, or reset the loop after this subsystem installs.

- Do not assume attributes alone establish order between independent packages.
- Prefer explicit integration APIs when another package exposes them.
- Verify the final installed loop after all relevant initialization has completed.
- Revalidate after package upgrades because anchor structure and initialization behavior can change.
- If one framework intentionally owns the entire loop, integrate through that owner instead of competing with `SetPlayerLoop`.

## Define dispatch behavior

Specify these semantics for any central tick system:

- Main-thread requirement.
- Stable or unspecified subscriber order.
- Add/remove during dispatch: immediate, deferred, or next-tick.
- Reentrant dispatch: allowed, queued, coalesced, or rejected.
- Listener exceptions: fail-fast, isolate-and-log, or aggregate.
- Scene unload and application shutdown behavior.

Snapshot iteration is simple and mutation-safe but can allocate if recreated each frame. A reusable sweep buffer avoids steady-state allocation but still needs a clear rule for members removed after the snapshot. Deferred mutation avoids copying but adds queue and reentrancy complexity. Choose deliberately and test the chosen semantics.

## Failure and diagnostics

- Log one actionable installation failure, including the missing/ambiguous anchor and Unity/package context.
- Avoid printing the complete PlayerLoop on every startup in production.
- Add a development-only loop inspection command or assertion when supportability justifies it.
- Wrap custom work in a named profiler marker when its cost must be measured separately.
