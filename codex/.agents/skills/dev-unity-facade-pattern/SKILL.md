---
name: dev-unity-facade-pattern
description: Design, implement, review, refactor, and test Facade pattern solutions in Unity C#. Use when clients need a small stable entry point to a complex subsystem such as save/load, scene transitions, audio, commerce, analytics, networking, or content loading; for subsystem boundary APIs; and when comparing Facade with direct access, Mediator, Adapter, Proxy, GameManager, or gameplay architecture.
---

# Unity Facade Pattern

Use Facade to expose a small, cohesive API over a larger subsystem while keeping subsystem ownership behind the boundary.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for all relevant approaches. Use any justified combination or none; never force primary/supporting ranks.

Compare direct subsystem access, Facade, Mediator, Adapter, Proxy, GameManager, and gameplay architecture.

## Define the Boundary

1. Identify the subsystem and its real owners.
2. List the common client workflows, not every low-level operation.
3. Define async completion, cancellation, progress, error, and partial-failure semantics.
4. Decide whether advanced clients may access lower-level APIs directly.

Benefit: reduce coupling and present an intention-revealing entry point. Drawbacks: capability loss, oversized god facades, hidden cost, version pressure, and a tempting global access point.

Reject Facade when the subsystem API is already small, clients need fundamentally different capabilities, or the facade would merely rename one method.

## Keep It Thin and Cohesive

- Coordinate subsystem workflows without absorbing every subsystem responsibility.
- Return useful results; do not swallow failures.
- Preserve cancellation and lifecycle.
- Avoid static global access unless global lifetime is independently justified.
- Keep advanced APIs available where required rather than growing one enormous facade.
- Version the facade contract deliberately when multiple features depend on it.

Facade simplifies use; Adapter changes an incompatible interface; Proxy controls access through the same contract; Mediator coordinates peer collaborators. Combine them only for separate concerns.

## Verify

- Contract-test each public workflow and failure path.
- Confirm client code no longer depends on internal subsystem types.
- Test cancellation, partial completion, retry boundaries, and teardown.
- Measure whether the facade hides expensive work that callers must schedule.
- Add an advanced use case and ensure it does not turn the facade into a god service.

Read [references/facade-guide.md](references/facade-guide.md) for boundary examples and sources.
