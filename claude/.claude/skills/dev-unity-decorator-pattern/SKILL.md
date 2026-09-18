---
name: dev-unity-decorator-pattern
description: Design, implement, review, refactor, and test Decorator pattern solutions in Unity C#. Use for runtime wrappers that preserve a component contract while adding stackable behavior, buffs/modifiers, logging/metrics, damage or ability augmentation, configurable wrapper order, and decisions among Decorator, inheritance, ordinary component composition, Strategy, Proxy, Chain of Responsibility, or a dedicated stats/modifier pipeline.
---

# Unity Decorator Pattern

Use Decorator when individual objects need stackable behavior while preserving the wrapped object’s contract.

## Compare Before Selecting

State each candidate’s benefit, drawback, prerequisite, rejection condition, and valid combinations. Use any justified combination or none; do not assign ranks.

Compare a subclass, direct component composition, a modifier list, Strategy, Decorator, Proxy, and Chain of Responsibility.

## Prove Wrapping Is the Need

1. Define the stable component contract.
2. List independent behaviors that can be stacked per object.
3. Define wrapper order and whether it is observable.
4. Define ownership, removal, disposal, identity, and introspection.

Benefit: add behavior per object without subclass combinations. Drawbacks: nested indirection, order-dependent behavior, wrapper allocation, hard debugging, identity ambiguity, and lifecycle propagation.

Reject Decorator when a list of data modifiers, one Strategy, a normal component, or a small subclass hierarchy is clearer.

## Keep the Chain Honest

- Make every decorator implement the same contract and hold exactly one wrapped component.
- Forward contract members deliberately; do not rely on callers reaching through wrappers.
- Define ordering, duplicate decorators, and idempotence.
- Propagate cancellation, errors, disposal, and async completion.
- Provide diagnostics that reveal the active chain.
- Avoid cyclic wrapping and wrapper reuse across incompatible owners.

For mutable stats, compare `dev-unity-stats-modifiers`: a typed modifier pipeline is often clearer than recursive wrappers. For cross-cutting service access, compare Proxy. For ordered request handlers, compare Chain of Responsibility.

## Verify

- Test every decorator alone and in meaningful orders.
- Test duplicate, add/remove at runtime, base failure, and teardown.
- Verify identity/equality and serialization expectations.
- Profile allocations and call depth for hot paths.
- Confirm consumers need only the shared contract.

Read [references/decorator-guide.md](references/decorator-guide.md) for ordering examples, video context, and sources.
