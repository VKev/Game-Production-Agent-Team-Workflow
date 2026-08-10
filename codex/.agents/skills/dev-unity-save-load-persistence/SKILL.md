---
name: dev-unity-save-load-persistence
description: Design, implement, review, debug, migrate, and verify Unity save and load systems with explicit state ownership, stable entity identity, versioned schemas, safe local-file persistence, corruption recovery, scene rebinding, and optional cloud synchronization. Use for GameData or SaveData models, save slots, checkpoints, autosaves, JsonUtility or custom serializers, Application.persistentDataPath, inventory or player persistence, live save-state binding, snapshot-on-save flows, GUID mapping, schema migrations, atomic writes and backups, corrupt or missing saves, cross-scene restoration, Cloud Save conflicts, or save-related performance and security claims.
---

# Unity Save and Load Persistence

Treat persistence as a recoverable data pipeline, not as serialization attached directly to arbitrary `MonoBehaviour` fields. Make state ownership, schema evolution, file integrity, identity, lifecycle, and verification explicit before choosing APIs.

Read only the references needed for the task:

- Read [architecture-and-state-ownership.md](references/architecture-and-state-ownership.md) when selecting snapshot, live binding, event-fed state, repository, or service boundaries.
- Read [live-save-state-binding.md](references/live-save-state-binding.md) when gameplay models share persistent DTOs or keep a save aggregate current during play.
- Read [serialization-versioning-and-migrations.md](references/serialization-versioning-and-migrations.md) for `JsonUtility`, serializer selection, Unity object references, schema versions, validation, and migrations.
- Read [storage-integrity-and-security.md](references/storage-integrity-and-security.md) for slot paths, atomic replacement, backups, recovery, deletion, threading, tamper limits, and platform constraints.
- Read [cloud-sync.md](references/cloud-sync.md) for asynchronous repositories, offline behavior, write locks, conflict policy, and server authority.
- Read [verification.md](references/verification.md) before completing an implementation or claiming reliability or performance.
- Read [sources.md](references/sources.md) when exact APIs, version-sensitive behavior, or source attribution matter.

## Required workflow

1. **Inspect the actual project.**
   - Read the relevant instructions, GDD, Unity version, target platforms, source, tests, packages, and current save files or fixtures.
   - Identify the current boot flow, scene flow, runtime state owners, serializers, storage locations, cloud services, IDs, and save entry points.
   - Preserve a sound existing schema and repository boundary instead of creating a parallel system.

2. **Define the persistence contract.**
   - List what must persist, what must reset per run or scene, and what can be recomputed.
   - Define save triggers, autosave frequency, slot behavior, supported old versions, failure UX, cloud/offline behavior, and target-platform constraints.
   - Classify authoritative, derived, cached, presentation, configuration, and secret data. Do not persist caches or scene references merely because they are available.

3. **Choose state ownership deliberately.**
   - Prefer a snapshot produced by domain models at save time for small or moderate state and infrequent saves.
   - Prefer event-fed or dirty-section state when gathering is expensive or autosaves are frequent.
   - Use live save-state binding only when one owner controls mutation, new sections are assigned back into the root, and lifecycle and concurrency are explicit.
   - Do not make views, UI binding contexts, or arbitrary scene components the canonical persistence model.

4. **Design a versioned root schema.**
   - Give the root an explicit schema version and stable section boundaries.
   - Separate internal slot ID from user-facing display name.
   - Store stable content and entity identifiers instead of array positions, object instance IDs, or fragile scene searches.
   - Define validation and a migration chain before changing an existing shipped schema.

5. **Separate pipeline responsibilities.**
   Use distinct responsibilities even when a small project keeps them in few files:

   ```text
   runtime/domain state
   -> snapshot or persistent aggregate
   -> validation and migration boundary
   -> serializer
   -> local or remote repository
   -> integrity/recovery policy
   -> load and rebind coordinator
   ```

   Add interfaces only for real variation, platform boundaries, tests, or ownership. Do not create empty repository, mapper, migration, encryption, and cloud layers speculatively.

6. **Make save and load transactional.**
   - Serialize a stable snapshot; do not let another thread mutate it during serialization.
   - Write local saves to an isolated save directory through validated internal filenames.
   - Use a temporary file on the same storage volume, flush where supported, validate, replace, and retain a recovery copy according to platform-tested behavior.
   - Load into temporary data, deserialize, validate, migrate, and only then replace live state.
   - Preserve the last known-good state when any stage fails.

7. **Restore through explicit ownership.**
   - Bind or apply data after required services and scene entities exist.
   - Register saveable entities explicitly or resolve them through a validated stable-ID registry.
   - Suppress gameplay side effects while applying state, then publish one deliberate restoration-complete signal.
   - Treat initial load, new game, scene reload, additive scenes, spawned entities, destroyed entities, and duplicate IDs as separate cases.

8. **Verify failure paths and the target build.**
   - Run the matrix in [verification.md](references/verification.md).
   - Test missing, corrupt, truncated, incompatible, interrupted, and permission-denied saves in addition to successful round trips.
   - Verify old-version migrations and identity restoration with realistic data.
   - Measure serialization, I/O, allocations, and frame impact before claiming a faster design.

## Record the design before implementation

Use this compact decision record unless the user requests another format:

```text
Persisted and excluded state:
State ownership strategy:
Root schema and current version:
Stable identity policy:
Serializer and known limits:
Local repository and recovery policy:
Cloud/offline/conflict policy, if any:
Load and scene-rebind order:
Migration support window:
Verification and fault-injection plan:
```

## Core rules

- Keep authored configuration, mutable runtime state, persistent save data, and presentation state distinct.
- Persist the minimum authoritative state required to reconstruct the game.
- Make every saveable collection resilient to reordering and content additions.
- Resolve ScriptableObject or other asset references through stable project-owned identifiers; never treat runtime instance IDs as cross-session references.
- Validate counts, ranges, IDs, scene identifiers, enum values, and required sections before applying loaded data.
- Keep the old save and the live game intact until the replacement has completed successfully.
- Treat encryption as confidentiality only. It does not make client-authored progress trustworthy or prevent a determined user from extracting a client-held key.
- Make cloud persistence asynchronous, cancellable, retry-aware, and conflict-aware; do not hide it behind a synchronous local-file contract.
- Confirm every API against the installed Unity version and target platform.

## Hard boundaries

- Do not serialize an entire scene graph or arbitrary `MonoBehaviour` tree as the save format.
- Do not use a display name directly as a filesystem path.
- Do not delete every file in `Application.persistentDataPath`; isolate and validate save targets.
- Do not overwrite the only good save in place without a tested recovery path.
- Do not silently discard an unknown schema version or coerce corrupt data into a new game without product-approved UX.
- Do not use `FindObjectsByType(...).FirstOrDefault()` as an identity system.
- Do not update thousands of persistent transforms every frame merely to make Save appear constant-time without profiling the total cost.
- Do not claim cloud synchronization is a simple repository swap when authentication, offline queues, retries, timeouts, revisions, and conflict resolution are unresolved.
- Do not claim compilation, migration coverage, platform safety, corruption recovery, performance, or cloud conflict behavior without direct evidence.

## Related skills

- Use `dev-unity-project-context` before navigating or editing a real project.
- Use `dev-unity-gameplay-architecture` when persistence changes module ownership or dependency direction.
- Use `dev-unity-game-manager` when boot, new-game, continue, checkpoint, session, or cross-scene flow owns persistence timing.
- Use `dev-unity-async-coroutines-unitask` for cancellable asynchronous save, load, retry, or cloud workflows.
- Use `dev-unity-assets-addressables` when persistent content IDs resolve through Addressables.
- Use `dev-unity-vcontainer` when repository, migration, or coordinator lifetimes use installed VContainer registrations.
- Use `dev-unity-performance-profiling` before making persistence performance claims.
- Use `dev-unity-clean-code-principles` for focused DTO, mapper, migration, and repository responsibilities.
- Use `dev-unity-ui-controller-binding` only for save-slot presentation; its `DataContext` is not persistent game state.

