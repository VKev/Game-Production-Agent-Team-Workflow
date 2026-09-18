---
name: dev-unity-bridge-pattern
description: Design, implement, review, refactor, and test Bridge pattern solutions in Unity C#. Use when an abstraction and its implementation are two independent variation axes, when subclass combinations are multiplying, for platform/render/input/storage backends behind gameplay abstractions, and when deciding among Bridge, Strategy, Adapter, Factory, prefab composition, ScriptableObject policy, or VContainer composition.
---

# Unity Bridge Pattern

Use Bridge when two dimensions must evolve independently and the abstraction should delegate implementation-specific work through a stable contract.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for all material candidates. Use any justified combination or none; do not assign skill ranks.

Compare direct composition, Strategy, Adapter, Bridge, Factory, ScriptableObject policy, prefab variants, and VContainer.

## Prove Two Axes Exist

1. Name the abstraction variants.
2. Name the implementation variants.
3. Show the subclass Cartesian product that would otherwise emerge.
4. Confirm each axis changes independently in real requirements.

Benefit: avoid multiplying subclasses and swap implementations without rewriting abstractions. Drawbacks: more interfaces, delegation, construction wiring, cross-axis capability negotiation, and debugging indirection.

Reject Bridge when only one axis varies, a single injected Strategy expresses the need, or direct component composition is already clear.

## Design the Bridge

- Keep the abstraction responsible for domain policy.
- Keep the implementation interface focused on platform/mechanism operations.
- Inject the implementation explicitly at composition time.
- Avoid implementation back-references that recreate tight coupling.
- Decide whether implementations are stateful, shared, scene-bound, or disposable.
- Represent optional capabilities honestly; do not fill the bridge with unsupported no-ops.

The video’s warrior-plus-weapon example is ordinary composition or Strategy unless warrior abstractions and weapon implementations truly form independently extensible hierarchies.

## Combine Deliberately

Use a Factory to select a bridge implementation, Adapter to make a legacy provider satisfy the implementation interface, and VContainer to own composition/lifetime. These patterns can combine without being ranked, but remove any layer that does not change the solution.

## Verify

- Run every supported abstraction/implementation combination.
- Test missing and unsupported capabilities.
- Swap implementations without changing abstraction code.
- Test lifetime, disposal, scene transition, and asynchronous provider failure.
- Add one variant on each axis and compare the actual change surface.

Read [references/bridge-guide.md](references/bridge-guide.md) for decision examples and sources.
