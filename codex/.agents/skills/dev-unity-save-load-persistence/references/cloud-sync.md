# Cloud Synchronization

Treat cloud persistence as a distributed system, not as a synchronous file-service replacement.

## Define the role of cloud

Choose one explicitly:

- Backup and cross-device synchronization of a local authoritative slot.
- Cloud-authoritative player data.
- Server-authoritative game state mediated through Cloud Code or a backend.
- Large player-file storage for an opaque save blob.

The choice changes trust, offline support, merge behavior, latency, and recovery.

## Use an asynchronous contract

Represent:

- Cancellation and request timeouts.
- Authentication unavailable or expired.
- Offline, rate-limited, transient, validation, quota, conflict, and permanent failures.
- Remote revision or write lock.
- Pending upload and last synchronized revision.
- Idempotent retry behavior.

Do not block the Unity main thread waiting for a remote request. Do not use `async void` except at a narrow Unity event boundary that catches and reports every failure.

## Commit local progress first when offline play is supported

A common local-first flow is:

```text
capture -> validate -> commit local slot -> enqueue cloud revision
-> authenticate -> upload with expected remote revision
-> mark synchronized or retain pending/conflict state
```

Persist enough queue metadata to survive application restart without duplicating or losing operations. Bound retry frequency and use backoff with jitter according to the service guidance.

## Resolve conflicts intentionally

Unity Cloud Save write locks expose optimistic concurrency: send the last retrieved write lock and handle a conflict when the remote value changed.

Choose a product policy per data class:

- Latest validated revision wins only when clocks and lost progress are acceptable.
- Highest progress wins only for monotonic values with anti-cheat controls.
- Field-level merge only for independently mergeable fields.
- User choice for two divergent opaque slots.
- Server-authoritative rejection for protected state.

Never merge whole save files generically without understanding invariants. Preserve both conflicting revisions until resolution succeeds.

## Choose key-value or file storage

Use structured cloud items when individual values need querying, server-side updates, or fine-grained conflict policy. Use player files for larger opaque blobs when the service limits, upload cost, and whole-file conflicts are acceptable.

Verify current SDK limits, authentication dependencies, write-lock behavior, exception types, request timeouts, and package version against the installed Unity Cloud Save package.

## Keep authority on the right side

Client encryption does not make client-generated progress trustworthy. Use Cloud Code or another trusted backend for protected economy, entitlement, competitive progress, or validation rules. Define what the client may propose and what the server must verify.

