# Storage Integrity and Security

## Isolate save files

Use a dedicated child directory under `Application.persistentDataPath`, for example `Saves`, rather than mixing save slots with logs, caches, settings, analytics, or other packages.

Use an internal slot identifier for the filename. Keep the player-facing name inside the serialized metadata.

Before any read, write, replace, enumerate, or delete:

1. Reject rooted or empty slot identifiers.
2. Restrict the identifier to an internal format such as a generated GUID or validated slug.
3. Build and canonicalize the candidate path against the known save root.
4. Verify the canonical result remains inside that exact root using platform-appropriate case comparison.
5. Operate only on the exact validated path.

`Path.Combine` does not provide containment: a later rooted component can discard earlier components. `Path.GetExtension` includes the period.

## Commit local saves transactionally

Use a platform-tested same-directory transaction:

1. Capture a stable snapshot.
2. Serialize to memory or a temporary file.
3. Write a uniquely named temporary file in the save directory.
4. Flush managed and intermediate file buffers where the target API supports it.
5. Deserialize or checksum the temporary result when the product's risk justifies it.
6. Replace the destination while preserving a backup when the target supports `File.Replace` semantics.
7. Use a separately verified same-volume move/rename fallback when replacement is unsupported.
8. Update slot metadata only after the payload commit succeeds.
9. Clean stale temporary files through a bounded recovery policy.

No cross-platform API call guarantees crash consistency for every Unity target. Verify the exact runtime, filesystem, and device. Treat WebGL, consoles, mobile lifecycle termination, and sandboxed platforms as separate targets.

## Recover predictably

Define a read order such as:

```text
primary -> backup -> validated autosave -> product-approved new-game flow
```

For every candidate:

- Read without mutating live state.
- Deserialize, validate, and migrate completely.
- Record a diagnostic reason when rejected, without exposing secrets or excessive personal data.
- Ask or notify the player according to the product UX; do not silently destroy evidence.

Keep a bounded number of backups or generations. Storage quotas and cloud upload size must be part of the policy.

## Delete narrowly

- Delete one validated slot by internal ID.
- Enumerate only the dedicated directory and known filename pattern.
- Keep unrelated settings, logs, caches, and package files untouched.
- Define whether deleting a slot also deletes its backup, cloud revision, screenshots, and metadata.
- Make delete-all a product-level operation with explicit scope and user confirmation when applicable.

## Handle errors as outcomes

Account for:

- Missing directories and files.
- Permission and sandbox failures.
- Full storage and quota limits.
- Interrupted writes and stale temporary files.
- Invalid encoding or JSON.
- Unsupported schema versions.
- File locks and concurrent writers.
- Application pause, suspend, focus loss, or forced termination.

Return typed or structured outcomes that let the coordinator and UI distinguish not-found, corrupt, incompatible, unavailable, cancelled, and unexpected failures.

## Separate confidentiality, integrity, and authority

- Compression reduces size; it is not encryption.
- Encryption can hide casual inspection; it does not prove that client-authored values are legitimate.
- A checksum detects accidental corruption only if an attacker can recompute it.
- A keyed MAC or signature can detect unauthorized modification only while the key or signing authority remains protected.
- A key shipped in the client can be extracted by a determined attacker.
- Keep competitive economy, entitlement, purchase, and server-authoritative progression decisions on a trusted service when cheating matters.

Never store API credentials, service tokens, private signing keys, or unrelated personal data in the save file.

## Keep work off the frame safely

Separate main-thread capture/apply from background-compatible serialization and I/O. If the live model can mutate, produce an immutable or isolated snapshot before leaving the main thread. Marshal completion and Unity object access back to the main thread through the project's established async mechanism.

