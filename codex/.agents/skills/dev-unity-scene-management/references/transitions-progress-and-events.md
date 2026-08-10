# Transitions, Progress, and Events

## Contents

- [Protect transition invariants](#protect-transition-invariants)
- [Choose a concurrency policy](#choose-a-concurrency-policy)
- [Plan load and unload order](#plan-load-and-unload-order)
- [Control activation carefully](#control-activation-carefully)
- [Report honest progress](#report-honest-progress)
- [Name events by their actual timing](#name-events-by-their-actual-timing)
- [Handle cancellation and failure](#handle-cancellation-and-failure)

## Protect transition invariants

Maintain these invariants throughout every transition:

- Exactly one operation owns mutation of the loaded scene set.
- The current flow state never claims the target is playable before group readiness.
- Every retained scene is retained by policy, not by list index or incidental active status.
- Every started provider operation has one owner until completion and cleanup.
- Loading presentation remains available until success, cancellation recovery, or failure presentation takes ownership.
- Completion is published once.
- Gate, cancellation, subscription, and presentation cleanup occur on every exit path.

Represent the transition as an explicit state or operation object when several await points, recovery branches, or concurrent callers exist. A boolean `isLoading` can reject duplicates in a small loader, but it is not enough to express queued targets, replacement, rollback, or partial completion.

## Choose a concurrency policy

Select one policy for repeated requests:

| Policy | Use when | Required behavior |
|---|---|---|
| Reject | A second request is always invalid | Return a classified result; do not silently ignore |
| Join | Callers requesting the same target should share work | Return the same observable operation/result |
| Coalesce | Many requests can collapse to the newest or highest-priority target | Document which request wins |
| Queue | Every request must execute in order | Bound the queue and handle stale requests |
| Replace | A newer request cancels or supersedes the current transition | Guard against late completion mutating new state |

Do not allow independent fire-and-forget calls to share mutable fields such as active group, progress target, or retained handles.

## Plan load and unload order

Compute a set difference before acting:

```text
retained = current intersect target
removed  = current minus target
added    = target minus current
```

Choose order from product constraints:

- **Load before unload:** improves rollback and visual continuity, but raises peak memory.
- **Unload before load:** lowers peak memory, but removes the old state before the target is proven viable.
- **Interleaved/streamed:** limits memory and latency, but needs dependency and residency rules.

Never preserve the current active scene automatically. Preserve it only when it is a member of the target set or belongs to an explicit longer lifetime.

Store returned native `Scene` values or provider handles. Use full project-relative paths for lookup when native APIs require lookup. Bare names can collide, and the same additive scene can be loaded more than once.

## Control activation carefully

With normal native additive loading, Unity activates each scene when ready. Its `Awake` and `OnEnable` work can run before the rest of the group finishes. Use a separate group readiness gate even when activation is immediate.

Use deferred activation only when the product needs a controlled reveal or initialization barrier. Account for Unity's global async-operation queue behavior:

- Native progress stops at 0.9 while `allowSceneActivation` is false.
- `isDone` remains false.
- Later Unity AsyncOperations can be stalled until activation is allowed.
- Addressables `activateOnLoad: false` inherits the same engine behavior.

Do not start several supposedly parallel deferred scene loads without verifying their actual queue behavior on the installed version. Hold every operation reference until activation completes.

After activation:

1. Verify the loaded `Scene` or Addressables `SceneInstance`.
2. Set the intended native active scene and check the returned boolean.
3. Run required post-load work.
4. Initialize scene contexts.
5. Publish group readiness.

## Report honest progress

Separate three concepts:

- **Measured progress:** values reported by native or provider operations.
- **Phase progress:** a product-defined model combining unload, download, load, activation, initialization, and cleanup.
- **Presentation smoothing:** visual interpolation toward the latest measured target.

Never let smoothing write back into measured state. Do not initialize the target to 1 and then take `Max(reported, target)`; that makes every reported value irrelevant.

For native scene loading:

- Treat `AsyncOperation.progress` as operation progress, not bytes or total transition cost.
- Normalize 0..0.9 only when activation is intentionally deferred and the UI contract explains the activation phase.
- Do not assume an arithmetic average is work-weighted. A small UI scene and large environment scene do not necessarily cost the same.

For Addressables:

- Distinguish dependency download progress from operation/sub-operation progress.
- Use byte-weighted download status when communicating download percentage.
- Do not include work that has not been measured while labeling the result as precise total progress.

If reliable numeric progress is unavailable, show an indeterminate animation with a truthful status message.

## Name events by their actual timing

Use lifecycle-specific names:

```text
TransitionStarted
SceneLoadStarted
SceneLoadCompleted
SceneInitializationCompleted
SceneUnloadStarted
SceneUnloadCompleted
SceneGroupReady
TransitionFailed
TransitionCanceled
```

Do not emit `SceneLoadCompleted` immediately after calling `LoadSceneAsync`. Either await the owned operation or use the engine/provider completion signal.

Unity's `SceneManager.sceneLoaded` event occurs after scene `OnEnable` and before `Start`; it does not prove group readiness. Subscribe and unsubscribe symmetrically. Reset static handlers when Domain Reload can be disabled.

Keep a transition result richer than a boolean when callers need to distinguish invalid target, busy/rejected, cancellation, provider failure, activation failure, initialization failure, rollback success, or fatal recovery.

## Handle cancellation and failure

Define cancellation at the operation root:

- Decide whether cancellation truly stops provider work or only stops waiting for it.
- Ignore or release late results safely after the owner is gone.
- Prevent stale continuations from changing active scene, progress, flow state, or UI.
- Keep the loading overlay active until cancellation recovery reaches a stable state.

Handle failures by phase:

| Phase | Example recovery |
|---|---|
| Validation | Reject before mutation and present actionable diagnostics |
| Unload | Keep known-good retained scenes; stop destructive follow-up |
| Load | Release partial loads or retain them only through an explicit retry policy |
| Activation | Do not mark the group ready; activate recovery content or roll back |
| Initialization | Tear down newly registered services before unloading partial content |
| Cleanup | Report degraded cleanup separately from successful gameplay readiness |

Put transition-gate release, temporary subscription cleanup, and loading-presentation cleanup in `finally`. Observe non-cancellation exceptions once at an owned root; do not scatter untracked `async void`, `.Forget()`, or callback roots.
