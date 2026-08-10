# Timer Scheduler Contracts

## Use an explicit state model

Keep logical state and registry membership consistent:

| State | Registered | Advances | Legal transitions |
| --- | --- | --- | --- |
| Stopped | No | No | Start, Dispose |
| Running | Yes | Yes | Pause, Stop, Dispose, Reset |
| Paused | Policy-dependent | No | Resume, Stop, Dispose, Reset |
| Disposed | No | No | None |

Choose whether paused timers remain registered. Keeping them registered makes pause/resume cheap but still dispatches no-op ticks. Deregistering them reduces idle work but requires resume to register exactly once. Do not mix the two policies.

Make `Start`, `Stop`, `Pause`, `Resume`, `Reset`, and `Dispose` idempotent where practical. Reject invalid transitions or document their no-op behavior. A disposed timer must not restart.

## Choose the clock explicitly

Do not hard-code `Time.deltaTime` into a reusable timer abstraction without a stated scaled-time contract.

| Clock | Typical use |
| --- | --- |
| Scaled delta time | Gameplay cooldowns affected by `timeScale` |
| Unscaled delta time | Menus, UI, pause screens |
| Fixed-step time | Physics-aligned simulation |
| Realtime/monotonic clock | Wall-clock-like elapsed duration |
| Injected clock | Deterministic tests or custom simulation |

Pass elapsed time into the scheduler/timer or inject a clock when different policies must coexist. Document clamping and behavior after long stalls.

## Define progress per timer kind

- Countdown progress needs a positive duration and an explicit direction: remaining fraction or completed fraction.
- Stopwatch timers normally expose elapsed time, not normalized progress.
- Infinite timers must not inherit a calculation that divides by a zero initial duration.
- Clamp only after validating the denominator; clamping does not turn an invalid numeric result into a meaningful contract.

Validate finite, nonnegative durations and strictly positive frequency/interval values at construction and reset boundaries.

## Define missed-tick behavior

A frequency or interval timer must choose one policy for a long frame:

- **Skip:** emit at most once and discard missed ticks.
- **Catch up:** emit once per crossed threshold.
- **Capped catch up:** emit up to a maximum burst, then drop or carry the remainder.
- **Coalesce:** emit once with the number or elapsed duration of missed ticks.

Use a loop only with a validated positive interval. Add a burst cap when callbacks can be expensive or a long stall could create an event storm.

## Keep registry mutation safe

- Prevent duplicate registration of the same timer unless multiplicity is intentional.
- Define whether a timer stopped during another timer's callback still ticks in the current sweep.
- Define whether a newly started timer ticks immediately or on the next scheduler pass.
- Use a reusable sweep, deferred add/remove queues, or another tested mutation policy.
- Avoid allocating a new list or set on every frame without profiling evidence that the cost is acceptable.

If callbacks can dispose other timers, verify both registry membership and the snapshot membership rule before invoking each timer.

## Dispose managed subscriptions deterministically

Use `IDisposable` when the timer must release a registry subscription, but keep the pattern proportional:

- Make disposal idempotent and terminal.
- Deregister even when the timer is paused or already stopped.
- Clear or release owned delegates only when the API's ownership contract says the timer owns them.
- Do not add a finalizer solely to deregister from a managed static collection. The collection's strong reference prevents a forgotten registered timer from becoming collectible.
- Let the owning Unity component or feature dispose timers during its normal lifetime teardown.

## Define callback and exception policy

Specify whether start, stop, interval, and tick callbacks:

- Run before or after state changes.
- May restart, stop, reset, or dispose the same timer.
- May mutate other timers.
- Propagate exceptions or isolate them so the scheduler can continue.

Avoid invoking user callbacks while internal state is only partially updated.
