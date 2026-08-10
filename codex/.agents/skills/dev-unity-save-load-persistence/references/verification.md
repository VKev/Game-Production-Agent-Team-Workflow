# Verification

## Round-trip and lifecycle matrix

Verify:

- New game with every optional section absent.
- Manual save and immediate load.
- Save, terminate, relaunch, and load.
- Reload current scene and load another scene.
- Additive scenes when supported.
- Repeated load without duplicate subscriptions, entities, inventory entries, or side effects.
- Inactive and runtime-spawned saveable entities.
- Intentionally destroyed entities and missing authored content.
- Multiple slots with independent metadata and backups.
- Autosave while gameplay continues.

Compare semantic state, not raw JSON text ordering or formatting.

## Failure and recovery matrix

Inject and observe:

- No save file.
- Empty, truncated, malformed, or otherwise corrupt data.
- Unsupported older and newer schema versions.
- Failure during serialization, temporary write, flush, replacement, and cleanup.
- Permission denied, storage full, quota exceeded, and locked file.
- Primary corrupt with valid backup.
- Stale temporary file after simulated interruption.
- Cancellation during local and remote operations.
- Two save requests targeting the same slot.

Confirm that the live game and last known-good file remain intact when a transaction fails.

## Migration matrix

- Keep fixtures for every supported historical version.
- Migrate each fixture to current and validate the complete result.
- Test removed content, renamed IDs, capacity changes, new required fields, enum changes, and collection restructuring.
- Verify idempotency expectations and ensure a migration never runs twice accidentally.
- Preserve an original fixture or backup until the migrated save is committed.

## Identity and binding matrix

- Reject duplicate scene-authored IDs.
- Restore reordered entities by ID rather than array position.
- Restore runtime-spawned entities with distinct instance IDs.
- Handle an entity present in the save but absent from current content.
- Handle a current entity with no old data using explicit defaults.
- Create a missing section and verify it is actually assigned into the root aggregate.
- Bind, unbind, reload, and bind again without stale references or duplicate callbacks.

## Cloud matrix

- First upload with no prior revision.
- Download on another device.
- Offline local save followed by reconnect.
- Expired authentication, timeout, rate limit, and transient service error.
- Conflict caused by a stale write lock.
- Retry after restart without duplicate application.
- User or server conflict resolution with both originals preserved.
- Local success while cloud sync remains pending.

## Performance evidence

Measure separately:

- Main-thread state capture.
- Serialization time and allocations.
- Payload size.
- Temporary write, flush, replacement, and backup cost.
- Load, migration, validation, and apply time.
- Ongoing cost of live binding, dirty tracking, or transform sampling.
- Cloud upload/download size, latency, retries, and timeout behavior.

Use representative worst-case saves. Profile the actual target build when frame time, storage, or lifecycle termination matters. Do not infer total performance from the duration of the public `Save()` method alone.

## Evidence report

Report:

```text
Unity version and target platform:
Schema versions tested:
Slot and recovery policy:
Round trips performed:
Faults injected:
Migrations verified:
Identity/lifecycle cases verified:
Performance evidence:
Cloud/offline/conflict evidence:
Build, automated, Editor, device, and human UX checks not performed:
```

