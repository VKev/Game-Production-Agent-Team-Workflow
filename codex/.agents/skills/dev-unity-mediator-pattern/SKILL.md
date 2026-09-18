---
name: dev-unity-mediator-pattern
description: Design, implement, review, refactor, debug, and test Mediator pattern solutions in Unity C#. Use when a bounded set of peer components, widgets, services, or gameplay collaborators need coordinated interaction without direct many-to-many references; for screen controllers, feature coordinators, encounter/dialog mediators, and decisions among Mediator, direct references, Observer/events, Facade, VContainer, GameManager, or gameplay architecture.
---

# Unity Mediator Pattern

Use Mediator to centralize interaction rules among a bounded set of collaborators that would otherwise depend on one another.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for every relevant option. Use any justified combination or none; do not assign ranks.

Compare direct references, Observer/events, a screen/feature controller, Mediator, Facade, VContainer, GameManager, and gameplay architecture.

## Bound the Collaboration

1. List collaborators and the interactions currently forming a dependency mesh.
2. Define the mediator’s feature/screen/encounter boundary and lifetime.
3. Decide typed methods, typed messages, ordering, reentrancy, and failure behavior.
4. Keep state ownership with the correct collaborator or domain model.

Benefit: reduce many-to-many references and make coordination rules explicit. Drawbacks: god-mediator growth, hidden coupling through message names, ordering/reentrancy bugs, broad lifetime, and difficult local reasoning.

Reject Mediator when a direct reference or local event clearly expresses the interaction, or when the proposed mediator would span unrelated features.

## Keep It a Coordinator

- Give the mediator orchestration, not every collaborator’s domain logic.
- Use narrow typed APIs instead of stringly global messages.
- Keep collaborators unaware of each other where that is the intended boundary.
- Declare subscription/unsubscription and lifecycle.
- Define reentrant requests and mutation during notification.
- Split mediators when responsibilities or lifetimes diverge.
- Do not turn the mediator into a service locator.

Observer broadcasts state changes without owning the interaction workflow. Facade simplifies a subsystem for clients. VContainer composes dependencies. They can combine with Mediator when each concern is real.

## Verify

- Test every interaction with collaborators replaced by fakes.
- Test missing, disabled, destroyed, and late-registered collaborators.
- Test ordering, reentrancy, recursive notifications, and exceptions.
- Test scene/screen teardown and subscription cleanup.
- Review mediator size and change reasons as the feature grows.

Read [references/mediator-guide.md](references/mediator-guide.md) for boundaries and sources.
