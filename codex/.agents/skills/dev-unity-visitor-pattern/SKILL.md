---
name: dev-unity-visitor-pattern
description: Design, implement, review, refactor, debug, and test Visitor and double-dispatch designs in Unity C#. Use when a task involves IVisitor, IVisitable, Accept, or Visit contracts; operations across a stable heterogeneous element or component family; power-ups or effects visiting multiple capabilities; AST, graph, scene, or composite traversal; export, validation, serialization, or tooling over concrete node types; reflective or acyclic Visitor variants; or deciding between Visitor and direct calls, interfaces, type-pattern switches, Strategy, Command, Composite, events, or data-driven approaches.
---

# Unity Visitor Pattern

Use Visitor only after establishing that its variation tradeoff fits the requested outcome. Read [references/unity-visitor-pattern-guide.md](references/unity-visitor-pattern-guide.md) before designing or changing a Visitor implementation, reviewing a reflective variant, or relying on the tutorial-derived Unity null guidance.

## Start with the decision

1. Identify the element family, the operations, the owner of traversal, and the required result or side effect.
2. Predict which axis changes more often:
   - Favor Visitor when concrete element types are stable and new cross-cutting operations are expected.
   - Reject Visitor when element types change frequently, only one simple operation exists, or a direct capability call is clearer.
3. Compare every materially relevant approach and skill. For each, state its benefit, drawback or added complexity, prerequisites, and rejection condition.
4. Use any justified combination, sequence, or no specialist skill. Do not assign primary/supporting ranks or load skills only for shared keywords.

At minimum compare Visitor with a direct method/interface, a C# type-pattern `switch`, and moving the behavior onto the element. Add Strategy, Command, Composite/Iterator, events, data-driven lookup, VContainer, pooling, stats/modifiers, performance profiling, or another domain skill only when its separate concern changes the design or acceptance checks.

## Choose a shape deliberately

- Use classic typed Visitor for compile-time coverage across a stable closed element family.
- Add a result type when the operation computes a value instead of only causing side effects.
- Keep traversal separate from the operation. A parent forwarding a visitor to children is Composite/Iterator behavior layered with Visitor.
- Prefer capability interfaces or domain verbs when the operation naturally belongs to the component and does not need double dispatch.
- Prefer a local type-pattern `switch` for a small, local, frequently changing family when its explicit branch is easier to maintain.
- Treat reflection, `dynamic`, registries keyed by `Type`, and default no-op handling as different runtime-dispatch designs, not free reductions in Visitor complexity.
- Use reflection only when runtime extensibility is an actual requirement and its AOT, stripping, exception, lookup, allocation, and Player-build verification costs are accepted.

## Define the classic contract

Keep the typed handoff explicit:

```csharp
public interface IGameElement
{
    void Accept(IGameVisitor visitor);
}

public interface IGameVisitor
{
    void Visit(HealthComponent health);
    void Visit(ManaComponent mana);
}

public sealed class HealthComponent : MonoBehaviour, IGameElement
{
    public void Accept(IGameVisitor visitor) => visitor.Visit(this);
}
```

Understand the dispatch correctly: runtime interface or virtual dispatch selects the concrete element's `Accept`; inside that concrete method, C# overload resolution selects `Visit(HealthComponent)` from the compile-time type of `this`; runtime interface dispatch then selects the concrete visitor implementation. Passing an element through a base-typed variable directly to overloaded `Visit` does not reproduce this behavior.

## Preserve Unity boundaries

- Keep Visitor contracts and traversal testable as plain C# where Unity APIs are not required.
- Keep MonoBehaviours responsible for scene lifecycle and component-facing domain operations.
- Treat a ScriptableObject visitor as shared authored definition data. Keep it immutable during play unless shared runtime state is explicitly intended; place per-application counters, targets, and temporary state in a runtime context or visitor instance.
- Expose narrow domain methods such as `RestoreHealth` instead of public mutable fields solely for visitor access.
- Define visit ordering, duplicate visits, nested traversal, reentrancy, unsupported elements, exception propagation, cancellation, and partial-application behavior.
- Do not use `DestroyImmediate` in gameplay code. Use Unity's delayed `Destroy` at runtime.
- Do not use `?.`, `??`, or `??=` to test a `UnityEngine.Object` that can be destroyed. Use Unity's overloaded truth/equality semantics, and keep any `GetOrAdd` helper explicit.

## Control evolution pressure

Before implementation, write down:

- the complete element set and who owns additions;
- the complete operation set and who owns additions;
- whether every visitor must handle every element;
- whether unsupported combinations fail at compile time, throw, return a result, or intentionally no-op;
- whether traversal visits the aggregate itself, its children, or both;
- whether a visitor is reusable, stateful for one traversal, or authored as shared data;
- whether behavior must survive IL2CPP and managed stripping.

When a new element would require editing many visitors, reconsider the model instead of hiding the change behind reflection. Capability interfaces, a data table, a type-pattern switch, or behavior owned by the element can be the safer design.

## Verify behavior

Test at the smallest useful layer:

1. Prove that each concrete element dispatches to the matching overload exactly once.
2. Prove each visitor's result or side effect for every supported element.
3. Prove traversal order, duplicate policy, nested aggregates, and empty collections.
4. Prove unsupported-element, exception, cancellation, and partial-update policies.
5. Prove ScriptableObject assets do not leak unintended mutable state between entities or tests.
6. For reflective dispatch, test derived types, missing/default handlers, method exceptions, cached lookup, IL2CPP Player builds, and the active stripping level.
7. For Unity object helpers, test true C# null, live objects, destroyed/fake-null objects, missing components, and repeated calls.
8. Run EditMode tests for pure dispatch and PlayMode tests only for lifecycle, physics-trigger, destruction, or scene behavior that requires the Player loop.

## Coordinate related skills

- Use `dev-unity-stats-modifiers` when the actual outcome is deterministic stat math, stacking, expiry, or source removal; use this skill too only if heterogeneous components genuinely need Visitor dispatch.
- Use `dev-unity-strategy-pattern` when interchangeable algorithms are the variation axis; it does not provide double dispatch.
- Use `dev-unity-gameplay-architecture` when ownership, lifetime, module boundaries, or traversal ownership remain undecided.
- Use `dev-unity-object-pooling` for reusable pickup instances, not to decide Visitor semantics.
- Use `dev-unity-vcontainer` for composition and lifetimes, not as a substitute for element-operation dispatch.
- Use `dev-unity-performance-profiling` before claiming Visitor, reflection, caching, or a type switch is faster.
- Use `dev-unity-clean-code-principles` or `dev-ponytail` as simplicity checks when abstraction cost is in doubt.

Let each skill contribute only its distinct concern. Re-evaluate after design: a pattern-selection skill may be finished while a domain, package, testing, or performance skill governs the remaining work.
