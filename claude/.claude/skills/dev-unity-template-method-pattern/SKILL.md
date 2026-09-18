---
name: dev-unity-template-method-pattern
description: Design, implement, review, refactor, and test Template Method pattern solutions in Unity C#. Use when a base class or framework must fix algorithm order while subclasses override selected steps, for non-virtual orchestration with protected hooks, reusable import/build/ability pipelines, Unity callback or StateMachineBehaviour comparisons, fragile-base-class review, and decisions among Template Method, composition, Strategy, delegates, Builder, or direct duplication.
---

# Unity Template Method Pattern

Use Template Method when one algorithm skeleton must remain fixed while subclasses customize selected steps.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and valid combinations for all relevant candidates. Use any justified combination or none; do not assign ranks.

Compare direct code, composition, delegates, Strategy, Template Method, Builder, and framework callbacks.

## Prove the Skeleton Is Stable

1. Write the invariant algorithm order.
2. Mark required abstract steps and optional virtual hooks.
3. State which invariants subclasses must not bypass.
4. Confirm inheritance is the intended extension mechanism for external or repeated implementations.

Benefit: reuse orchestration and protect step order. Drawbacks: inheritance coupling, fragile base classes, hidden control flow, subclass preconditions, versioning constraints, and combinatorial overrides.

Reject Template Method when steps vary independently at runtime, when composition/Strategy is clearer, or when the skeleton is still changing frequently.

## Design Safe Hooks

- Make the public template operation non-virtual when order must be fixed.
- Keep hooks protected and narrow.
- Use abstract hooks only for mandatory variation; use virtual no-op hooks sparingly.
- Do not call overridable members from constructors.
- Document call order, reentrancy, error, cancellation, and cleanup guarantees.
- Put invariant cleanup in `finally` where appropriate.
- Avoid requiring subclasses to call `base` merely to preserve correctness.
- Version the base carefully; new abstract members break every subclass.

Unity lifecycle callbacks demonstrate framework inversion and fixed engine order, but an application class merely declaring `Awake`/`Start` is not automatically a Template Method implementation.

## Verify

- Record and assert hook order for every subclass.
- Test optional hooks, exceptions, cancellation, and cleanup.
- Test a subclass that intentionally misbehaves; ensure invariants remain protected.
- Add a new optional step and inspect compatibility.
- Compare a composition-based version if subclass combinations are growing.

Read [references/template-method-guide.md](references/template-method-guide.md) for hook design and sources.
