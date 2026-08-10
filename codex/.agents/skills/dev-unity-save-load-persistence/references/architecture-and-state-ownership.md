# Architecture and State Ownership

## Select the state strategy

Choose one primary strategy per persisted section. Mixing strategies is valid when ownership remains explicit.

| Strategy | Prefer when | Main cost |
|---|---|---|
| Snapshot on save | State is modest, saves are infrequent, and domain models can expose stable snapshots | Save-time traversal and allocation |
| Event-fed aggregate | Changes already pass through commands or domain events and autosaves are frequent | Subscription, ordering, and missed-event risk |
| Dirty-section snapshot | Large state changes in identifiable sections | Dirty-flag correctness and partial-snapshot coordination |
| Live save-state binding | Runtime models can safely use persistent DTOs as their backing state | Coupling, aliasing, lifecycle, and concurrency risk |
| Journal or command log | Replay, audit, rollback, or crash recovery is a product requirement | Compaction, ordering, idempotency, and migration complexity |

Default to snapshot-on-save or a hybrid: domain models own runtime state, mark changed sections dirty, and produce immutable DTO snapshots only for those sections.

## Define authority

For each field, identify exactly one mutation authority:

- Domain model: gameplay rules and invariant-preserving mutations.
- Save DTO: transport and compatibility representation, not a second rules engine.
- Coordinator: snapshot/apply sequencing, not gameplay decisions.
- Repository: bytes and recovery, not domain interpretation.
- View: display and input forwarding only.

Do not let the runtime model and save DTO evolve independently while both are treated as authoritative. If they differ, use an explicit mapper and test both directions.

## Keep the schema reconstructive

Persist authoritative facts, such as:

- Stable player, entity, quest, item, or content IDs.
- Quantities, progress, unlocked flags, selected choices, world deltas, and checkpoint identifiers.
- Required random seeds or deterministic simulation positions when reconstruction depends on them.

Recompute when practical:

- Cached totals, filtered lists, UI selection, animation phase, derived stats, lookup tables, navigation paths, and transient effects.
- References that can be resolved from stable IDs and an authored catalog.

Persisting less reduces migration surface and contradictory state.

## Shape the boundaries

Use a small-project shape when one serializer and one local repository are enough:

```text
SaveCoordinator
  - Capture or apply domain state
  - Validate and migrate
  - Call serializer and repository
```

Split responsibilities when they already vary independently:

```text
ISaveSnapshotProvider -> SaveRoot DTO
ISaveSerializer       -> bytes or text
ISaveRepository       -> local slot or remote revision
ISaveMigrator         -> version N to current
SaveCoordinator       -> transaction and lifecycle
```

Do not force every feature to implement infrastructure interfaces. A feature can expose a narrow capture/apply contract or register a section adapter at the composition root.

## Control save timing

Define save triggers from product behavior:

- Manual slot save.
- Checkpoint completion.
- Scene or session transition.
- Periodic autosave.
- Application pause or focus loss, only when the platform gives enough time and the operation is bounded.
- Explicit cloud sync after a durable local commit.

Coalesce overlapping requests. Decide whether a new request waits, replaces a queued snapshot, or is rejected. Never allow two writers to replace the same slot without ordering or revision control.

## Keep local and cloud concerns separate

Use local storage for durable offline progress and fast recovery. Treat cloud as synchronization unless the product intentionally requires online authority. A local save can succeed while cloud sync is pending; represent those states separately.

