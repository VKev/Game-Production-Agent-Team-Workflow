---
name: dev-unity-chain-of-responsibility-pattern
description: Design, implement, review, refactor, debug, and test Chain of Responsibility solutions in Unity C#. Use for ordered request handlers, validation or damage pipelines, AI sensor checks, input-context routing, middleware-like processing, first-handler-wins or all-handlers-run semantics, and decisions among a handler chain, direct branch/switch, explicit list pipeline, Command, State, Decorator, or gameplay architecture.
---

# Unity Chain of Responsibility Pattern

Use Chain of Responsibility when a request should travel through an ordered set of handlers without the sender selecting the receiver.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and clean combinations for every relevant candidate. Use any justified combination or none; do not assign ranks.

Compare direct conditions, a switch, an explicit loop over functions, Chain of Responsibility, Command, State, Decorator, and a domain-specific pipeline.

## Choose Propagation Semantics First

1. Define the request and mutable/immutable context.
2. Choose first-handler-wins, all-handlers-run, transform-and-continue, or mixed semantics.
3. Define explicit outcomes such as `Continue`, `Handled`, `Stop`, and `Error`.
4. Define ordering, ownership, mutation, cancellation, and failure policy.

Benefit: reorder and extend handling without a central conditional. Drawbacks: hidden control flow, order dependence, unhandled requests, accidental multiple handling, allocation, and difficult debugging.

Reject the pattern when a short stable switch or explicit list loop communicates the rules better.

## Build a Visible Pipeline

- Keep handler responsibilities narrow and independently testable.
- Configure order in one inspectable place.
- Prevent cycles and duplicate handler registration.
- Prefer iteration over recursive forwarding for long or runtime-edited chains.
- Do not encode propagation in ambiguous booleans.
- Decide whether handlers may mutate the request or must return a new result.
- Define async/cancellation behavior before introducing asynchronous handlers.
- Emit diagnostics showing which handlers ran and why processing stopped.

Use Command when requests must be stored/replayed, State when behavior depends on one active mode, and Decorator when same-contract wrappers surround one component.

## Verify

- Test no handlers, one handler, every ordering, and no-match behavior.
- Test short-circuit and all-run semantics explicitly.
- Test duplicate/cyclic configuration and mutation during dispatch.
- Test handler exceptions, cancellation, and async completion order.
- Profile the hot path if the chain runs per entity per frame.

Read [references/chain-guide.md](references/chain-guide.md) for result contracts, video context, and sources.
