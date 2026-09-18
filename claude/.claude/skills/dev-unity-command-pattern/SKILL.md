---
name: dev-unity-command-pattern
description: Design, implement, review, refactor, debug, and test Command pattern systems in Unity C#. Use when actions must become objects for queueing, scheduling, input rebinding, undo/redo, replay, planning, networking, deterministic logs, worker orders, or macro composition; and when comparing Command with a direct call, delegate, coroutine/async workflow, Input System action, Memento, State, Strategy, or object pooling.
---

# Unity Command Pattern

Use Command when an action must be represented, stored, reordered, delayed, replayed, undone, serialized, or inspected independently of its caller.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and valid combinations for every candidate. Use any justified combination or none; do not assign ranks.

Compare a direct call, `Action`/delegate, coroutine or async operation, Input System action, Command, Memento, State, Strategy, and a domain-specific task record.

## Define Command Semantics

1. Define receiver, immutable input payload, execution result, and ownership.
2. Decide one-shot, repeatable, idempotent, undoable, serializable, or networkable behavior.
3. Define queue ordering, failure, cancellation, retries, and shutdown.
4. For undo, choose inverse operation or captured prior state.

Benefit: manipulate actions as data and decouple invocation from execution. Drawbacks: many command types, captured-reference lifetime, history memory, nondeterminism, failed undo, and queue complexity.

Reject Command when the action is immediate, never stored or transformed, and a direct call/delegate remains clear.

## Keep Commands Durable

- Prefer stable IDs and value payloads over raw scene-object references for saved/networked commands.
- Resolve receivers at execution with explicit missing-target behavior.
- Make command state transitions visible: pending, running, succeeded, failed, cancelled, undone.
- Do not assume every operation has a mathematical inverse.
- Use Memento when undo needs the exact previous state.
- Bound history and payload memory.
- Record randomness seeds and time inputs for deterministic replay.
- Pool command objects only after profiling; reset every payload and reference.

Coroutines can delay work but are not automatically Command objects because they may lack identity, storage, undo, serialization, and result contracts.

## Verify

- Test execute, repeated execute, cancel, fail, retry, undo, redo, and history truncation.
- Replay the same deterministic command log twice and compare state.
- Destroy or unload receivers before execution.
- Test serialization/versioning if commands cross sessions or network boundaries.
- Test application shutdown with pending/running commands.
- Profile command allocation and history retention at expected scale.

Read [references/command-guide.md](references/command-guide.md) for undo/replay guidance and sources.
