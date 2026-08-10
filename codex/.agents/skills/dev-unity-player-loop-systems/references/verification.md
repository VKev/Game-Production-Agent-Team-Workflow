# PlayerLoop and Timer Verification

## Static inspection

- Confirm one owner for loop installation and cleanup.
- Confirm the marker type, anchor type, and relative position are explicit.
- Confirm installation handles an existing marker and a missing anchor.
- Confirm runtime source has no unguarded `UnityEditor` dependency.
- Confirm static reset works with Domain Reload disabled.
- Confirm timer state, registry membership, clock, catch-up, exception, and disposal policies are documented.
- Confirm no per-frame allocation claim is based only on code appearance.

## Loop lifecycle tests

Run the relevant cases in the actual Unity version:

1. Enter Play Mode and assert exactly one marker at the expected location.
2. Exit and enter again with Domain Reload enabled.
3. Repeat with Domain Reload disabled.
4. Trigger script recompilation or assembly reload when supported by the workflow.
5. Load and unload relevant scenes.
6. Exercise application shutdown or test teardown.
7. Verify the final loop after UniTask, Entities, or another writer initializes.
8. Simulate a missing or changed anchor and verify a visible, nonpartial failure.

Do not treat a printed loop from one startup as proof of lifecycle correctness.

## Registry and timer tests

- Duplicate start/register attempts.
- Stop, pause, resume, reset, and dispose from every legal state.
- Invalid transitions after disposal.
- Self-stop/self-dispose during a tick.
- One timer starting, stopping, or disposing another during dispatch.
- Listener exception behavior.
- Scaled and unscaled clocks with `timeScale` set to zero and a nondefault value.
- Zero, negative, NaN, and infinite inputs where the API accepts floating-point values.
- Countdown completion and progress endpoints.
- Stopwatch elapsed-time behavior without normalized division by zero.
- Long-frame frequency behavior for the selected skip/catch-up/cap policy.
- No infinite loop for zero or invalid interval values.

## Build and runtime verification

- Compile the Editor assembly and the actual target-player assembly.
- Build with the intended scripting backend and managed stripping level.
- Inspect the Console for new errors and warnings.
- Run Edit Mode tests for pure state/clock logic and Play Mode tests for loop/lifecycle integration.
- Verify development-only diagnostics are absent or disabled in release builds.

Editor compilation alone does not prove player-build safety, especially when runtime files reference Editor namespaces or reflection-only types.

## Performance verification

Only claim improvement after comparable before/after captures:

- Use the same scene, entity/timer count, target device, build settings, warmup, and capture interval.
- Record main-thread time, scheduler self time, managed allocations, GC behavior, and frame-time percentiles.
- Compare against the simplest credible baseline, usually ordinary callbacks or a MonoBehaviour update manager.
- Test idle subscribers as well as active work.
- Keep the custom scheduler only when the measured benefit justifies its lifecycle and debugging complexity.
