# State Machines and Transition Sequencing

Use the smallest state model that keeps behavior, transition authority, and lifecycle observable.

## Contents

- [Select the model](#select-the-model)
- [Define the contracts first](#define-the-contracts-first)
- [Preserve lifecycle invariants](#preserve-lifecycle-invariants)
- [Resolve transition requests deliberately](#resolve-transition-requests-deliberately)
- [Sequence asynchronous transition work safely](#sequence-asynchronous-transition-work-safely)
- [Construct and wire explicitly](#construct-and-wire-explicitly)
- [Verification matrix](#verification-matrix)
- [Sources and example provenance](#sources-and-example-provenance)

## Select the model

| Need | Prefer |
|---|---|
| A few stable modes with short behavior | Enum and switch |
| Independently complex state behavior or tests | Feature-owned state objects |
| Parent modes own real shared behavior or transitions | Hierarchical state machine |
| Entering or leaving a branch requires timed work | State machine plus a transition sequencer |

Do not add hierarchy merely to group class names. A parent state must own a real invariant, update, transition, dependency, or lifecycle responsibility.

## Define the contracts first

Record:

- Machine owner and lifetime.
- State graph owner and construction path.
- Initial root and initial-child policy.
- Update phase and whether parents update before or after children.
- Transition authority and priority.
- Re-entry, self-transition, interruption, and invalid-target behavior.
- Whether a target means the exact state or its default descendant.
- Whether normal updates pause while a transition is in progress.

Keep the active branch as one valid path from root to leaf. Require every state in a transition to belong to the same acyclic tree and machine.

## Preserve lifecycle invariants

- Enter each state at most once while moving down a transition path.
- Exit each state at most once while moving up a transition path.
- Run parent entry before child entry.
- Run child exit before parent exit.
- Update the parent's active-child link exactly when ownership changes.
- Do not combine recursive `Exit()` with a loop that also exits every ancestor; that can exit descendants twice.
- Do not let intermediate ancestor entry automatically descend into a default child while entering a specific deeper target.

Use distinct internal operations when necessary:

```text
exit-self(state)
enter-self(state)
enter-default-descendants(target)
```

For a transition from source to target:

```text
validate same tree and machine
resolve source as the current active leaf unless the contract says otherwise
find lowest common ancestor
build exit path: source -> ancestor, excluding ancestor
build enter path: ancestor child -> target
exit each exit-path state exactly once
enter each enter-path state exactly once
optionally descend only from the requested target
publish the completed active path
```

Build the paths before mutating the machine so validation failure cannot leave a partially changed branch.

## Resolve transition requests deliberately

- Stop further state updates for the tick after accepting a transition request unless the project explicitly permits them.
- Define parent-versus-child transition priority rather than relying on traversal accident.
- Keep the state that requested a transition separate from the structural source. A parent may request a transition while a descendant is active; normally exit from the current active leaf, not merely from the requester.
- Choose one in-progress policy: reject, latest-wins coalescing, FIFO queue, priority queue, or cancel-and-replace.
- If latest-wins is selected, state plainly that intermediate requests are dropped.
- Revalidate queued targets against the current active path when execution begins. Do not retain a stale source state from an earlier branch.
- Put transition limits or cycle detection around immediate chains that could loop forever in one frame.

## Sequence asynchronous transition work safely

Keep the structural change separate from activities:

```text
deactivate old branch -> change active branch -> activate new branch
```

- Give each transition one owned cancellation source and dispose it after completion or shutdown.
- Cancel on owner destruction, Play Mode exit, machine disposal, or an allowed replacement.
- Treat `Task.IsCompleted` as terminal state, not success. Observe cancellation and exceptions before advancing.
- Define whether an activity failure aborts, rolls back, enters a fault state, skips the activity, or completes with an error report.
- Make activity activation and deactivation idempotent.
- Keep Unity object access on the Unity thread.
- Choose scaled game time, unscaled time, DSP time, or wall-clock delay deliberately; `Task.Delay` is wall-clock time.
- Decide whether parallel activities fail fast, wait for all, or collect failures.
- Never allow fire-and-forget activity tasks without an exception owner.

Use `dev-unity-async-coroutines-unitask` when exact coroutine, Task, UniTask, cancellation, or exception mechanics matter.

## Construct and wire explicitly

Prefer constructors, factories, or the existing composition root. Avoid reflection that mutates readonly fields or infers children from arbitrary fields unless editor-authored graph discovery is a documented requirement. If reflection is retained, validate cycles, ownership, stripped builds, renamed fields, and IL2CPP behavior.

## Verification matrix

Test at least:

- Initial root and default-child entry.
- Self, sibling, parent, child, ancestor, descendant, and cross-branch transitions.
- Exact-target versus default-descendant behavior.
- Enter and exit count and ordering.
- Parent and child update ordering.
- Conflicting requests in one tick.
- Requests during deactivation and activation.
- Latest-wins or queue semantics.
- Completed, faulted, cancelled, and interrupted activities.
- Machine shutdown, scene unload, and Play Mode exit during a transition.
- Repeated start and restart behavior.

Assert the active path after every structural transition. Compile and run relevant Edit Mode and Play Mode tests; treat a tutorial demo as an example, not verification of these invariants.

## Sources and example provenance

- Unity State pattern: https://learn.unity.com/course/design-patterns/tutorial/develop-a-modular-flexible-codebase-with-the-state-programming-pattern
- Microsoft Task exception handling: https://learn.microsoft.com/en-us/dotnet/standard/parallel-programming/exception-handling-task-parallel-library
- Analyzed HSM tutorial: https://www.youtube.com/watch?v=c-XoTg6Fba4
- Tutorial repository: https://github.com/adammyhre/Unity-Hierarchical-StateMachine
- Analyzed CRTP state-machine tutorial: https://www.youtube.com/watch?v=6sNJ57gnBvg
- CRTP example gist: https://gist.github.com/adammyhre/747371bc14470f3b31fdbb62d758e9bd

The tutorial code is example provenance, not the engine contract or a production-ready template.
