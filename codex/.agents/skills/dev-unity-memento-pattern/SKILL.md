---
name: dev-unity-memento-pattern
description: Design, implement, review, refactor, debug, and test Memento pattern solutions in Unity C#. Use for opaque state snapshots, undo/redo checkpoints, rollback, replay checkpoints, originator/caretaker boundaries, restoring object state without exposing internals, snapshot history and versioning, and decisions among Memento, Command inverse operations, Prototype/copying, save/load persistence, event sourcing, or direct state records.
---

# Unity Memento Pattern

Use Memento when an originator must capture and restore its state while the caretaker stores snapshots without understanding their internals.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for all relevant options. Use any justified combination or none; do not assign ranks.

Compare inverse Command, Memento, direct state records, Prototype copying, event replay, and full save/load persistence.

## Define Snapshot Scope

1. Identify the originator and invariants it must preserve.
2. List the minimum state required for exact restoration.
3. Make snapshot data immutable and versioned.
4. Define caretaker history bounds, eviction, ownership, and failure behavior.

Benefit: restore encapsulated state and support undo/checkpoints. Drawbacks: memory/storage cost, stale object references, schema migration, partial snapshots, deep-copy ambiguity, and restoration side effects.

Reject Memento when a simple inverse operation is reliable, the state is already a small public value, or event replay is the established source of truth.

## Keep Persistence Separate

- An in-memory memento is not automatically a durable save format.
- Disk saves need stable IDs, schema versions, migration, atomic writes, validation, and recovery.
- Do not persist raw UnityEngine.Object references; map stable identities.
- Rebuild derived caches and rebind runtime services after restoration.
- Decide whether restore emits events and in what order.
- Bound undo/rollback history by count and memory.
- Protect snapshots from mutation after capture.

Use `dev-unity-save-load-persistence` when mementos cross sessions. Use Command when actions themselves must be queued/replayed.

## Verify

- Round-trip every supported state and invariant.
- Restore after scene/entity recreation using stable IDs.
- Test missing/destroyed references and schema evolution.
- Test history eviction, branch-after-undo, and redo invalidation.
- Measure snapshot memory and capture/restore time at expected frequency.
- Confirm caretaker code cannot mutate originator internals through the snapshot.

Read [references/memento-guide.md](references/memento-guide.md) for snapshot design and sources.
