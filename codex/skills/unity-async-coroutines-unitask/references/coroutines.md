# Coroutine Guidance

## Table of contents

- Mental model
- Lifecycle and ownership
- Yield timing
- Performance
- Safe patterns
- Pitfalls

## Mental model

A coroutine is an `IEnumerator` state machine scheduled by Unity. It can suspend and resume across frames, but it is not a thread. Synchronous code before and between yields still executes on the main thread and can block the frame.

Use coroutines to express local time/frame sequences, not to disguise expensive synchronous work.

## Lifecycle and ownership

- Start with `StartCoroutine(IEnumerator)` and store the returned `Coroutine` when deterministic stopping is required.
- Stop using the same style used to start. Do not start by string and stop by enumerator, or the reverse.
- Avoid the string overload unless reflective name-based control is genuinely needed; it has more runtime overhead and supports only one argument.
- `StopAllCoroutines` affects all coroutines on that `MonoBehaviour`. Use it only when the component truly owns one operation group.
- Deactivating the GameObject or destroying the `MonoBehaviour` stops attached coroutines.
- Setting `enabled = false` on the `MonoBehaviour` does not stop them. Stop explicitly in `OnDisable` if active-state ownership requires it.
- Clear stored handles when a coroutine completes or is stopped.
- Define duplicate-start behavior: ignore, restart, join, or allow concurrent instances.

## Yield timing

- `yield return null`: resume on a following frame.
- `WaitForSeconds`: scaled time. The wait begins at the end of the current frame and resumes on the first eligible frame after the duration, so it is not an exact timer.
- `WaitForSecondsRealtime`: unscaled time.
- `WaitForFixedUpdate`: resume around the next fixed-step phase.
- `WaitForEndOfFrame`: resume after cameras and GUI render, just before frame presentation. It has Editor and batch-mode caveats.
- `WaitUntil` and `WaitWhile`: evaluate their delegates every frame after `Update` and before `LateUpdate`.
- `AsyncOperation`: yield until completion rather than polling `isDone` unless progress or activation control is required.

Choose the yield instruction from the gameplay contract, especially during pause or time-scale changes.

## Performance

Unity's compiler-generated iterator object stores coroutine state and local variables on the managed heap. Starting a coroutine therefore has a fixed allocation plus storage for captured state. Nested coroutines create additional state objects.

Apply these rules:

- Do not start new coroutines repeatedly from `Update` without a guard.
- Consolidate unnecessary nested chains while preserving clarity.
- Use `Update`/`LateUpdate` for permanent per-frame work that rarely suspends.
- Run infrequent checks at a lower cadence when the gameplay contract permits it.
- Do not cache every yield instruction blindly. Cache only immutable, constant-duration instructions when profiling shows value and reuse is semantically safe.
- Inspect coroutine work under `DelayedCallManager` in the CPU Profiler.

## Safe patterns

### Owned one-at-a-time sequence

```csharp
using System.Collections;
using UnityEngine;

public sealed class ReloadSequence : MonoBehaviour
{
    [SerializeField] private float reloadSeconds = 1.2f;

    private Coroutine reloadRoutine;

    public void BeginReload()
    {
        if (reloadRoutine != null)
            return;

        reloadRoutine = StartCoroutine(ReloadRoutine());
    }

    private IEnumerator ReloadRoutine()
    {
        yield return new WaitForSeconds(reloadSeconds);

        CompleteReload();
        reloadRoutine = null;
    }

    private void OnDisable()
    {
        if (reloadRoutine == null)
            return;

        StopCoroutine(reloadRoutine);
        reloadRoutine = null;
    }

    private void CompleteReload()
    {
        // Apply the feature result.
    }
}
```

This pattern makes the owner, duplicate policy, active-lifetime policy, and cleanup visible.

### Yield a Unity async operation

```csharp
private IEnumerator LoadSceneRoutine(string sceneName)
{
    AsyncOperation operation = UnityEngine.SceneManagement.SceneManager.LoadSceneAsync(sceneName);
    yield return operation;

    // Continue after Unity reports completion.
}
```

## Pitfalls

- Assuming coroutine means background execution.
- Starting the same loop many times accidentally.
- Depending on component disable to stop work.
- Using scaled waits for pause menus or unscaled waits for gameplay cooldowns without intent.
- Mutating pooled or destroyed objects after a delayed continuation.
- Swallowing errors by placing risky work in an unowned sequence.
- Converting a simple coroutine into multiple services and adapters without a requirement.
