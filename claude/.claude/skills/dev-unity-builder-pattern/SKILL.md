---
name: dev-unity-builder-pattern
description: Design, implement, review, refactor, and test Builder, Fluent Builder, Director, and Step Builder construction APIs in Unity C#. Use for construction complexity such as telescoping constructors, many optional runtime settings, validated GameObject or component assembly, reusable build recipes, or mandatory build order. Compare it with gameplay architecture, clean-code guidance, factories or prefabs, object pooling, and VContainer when those concerns also matter; use any combination that contributes distinct value. Reject Builder when fixed variants, authored hierarchies, reuse lifecycles, dependency composition, system boundaries, named arguments, object initializers, or direct construction already solve the actual problem more clearly.
---

# Unity Builder Patterns

Use a builder only when it makes construction rules clearer. Do not introduce one from a parameter-count threshold alone.

## Routing and Drawbacks

- Consider this skill whenever the construction contract materially affects the requested design, implementation, or verification.
- Compare it with `dev-unity-gameplay-architecture` when ownership, feature boundaries, lifetime, or the product type also matters. Use either or both according to the concerns present; architecture decisions do not automatically exclude builder guidance.
- Compare it with `dev-unity-clean-code-principles` when broader refactoring, generic type-safety, or pipeline mechanics also matter. Use both when they contribute distinct checks without duplicating the same decision.
- Compare it with `dev-unity-object-pooling` when repeated allocation, `Instantiate`/`Destroy`, reset state, capacity, or reuse also matters. A builder may configure a newly obtained product while a pool manages its reuse lifecycle.
- Compare it with `dev-unity-vcontainer` when registrations, injection, scopes, entry points, or dependency composition also matters. A builder constructs a product while a container composes an object graph; either or both may be useful.
- Prefer a prefab or prefab variant when designers should author a stable hierarchy, and a named factory when callers select among a few fixed variants.
- Account for the cost: builders add types, call surface, mutable construction state, validation paths, and tests. Directors add another indirection; step builders multiply interfaces and make evolution harder.
- Reject or remove the builder when it only relocates assignments, cannot centralize meaningful defaults or validation, leaks state across builds, obscures Unity ownership, or is harder to understand than the direct construction it replaces.

## Workflow

1. Classify the product and its lifecycle.
   - Distinguish a plain C# value, a `ScriptableObject`, a prefab instance, and a runtime-created `GameObject` hierarchy.
   - Identify required and optional inputs, legal defaults, validation rules, order constraints, construction frequency, and ownership.
   - Confirm the project's Unity and C# versions before selecting language features.
2. Apply the alternatives gate.
   - Prefer named or optional arguments for a small stable parameter set.
   - Prefer an object initializer for a simple mutable plain C# object when the project's compiler supports the required accessors.
   - Prefer a named factory for a few fixed variants.
   - Prefer a prefab or prefab variant for authorable component hierarchies.
   - Prefer an object pool when repeated create/destroy cost is the actual problem.
3. Choose the smallest justified builder variant.
   - Use a fluent builder for readable optional configuration and centralized validation.
   - Add a director only when named, reusable construction recipes or a fixed sequence add value.
   - Use a step builder only when compile-time ordering is worth the interface count and maintenance cost.
4. Protect product invariants.
   - Keep temporary construction state in the builder and final invariants in the product or its initialization boundary.
   - Make defaults explicit. Validate required inputs in `Build()` and reject invalid combinations before returning the product.
   - Do not add public mutable setters solely for a builder, and do not inherit a builder from a `MonoBehaviour` product to bypass access control.
5. Respect Unity object rules.
   - Never construct a `MonoBehaviour` with `new`; instantiate a prefab or create a `GameObject` and use `AddComponent<T>()`.
   - Treat `ScriptableObject` assets as shared authored recipes, not per-instance mutable runtime state.
   - Keep Unity object creation and mutation on the Unity main thread.
   - Destroy or otherwise clean up a partially created hierarchy when a build fails.
6. Define reuse explicitly.
   - Prefer a fresh small builder unless measurement justifies reuse.
   - If a builder is cached, reset every field and collection for each build, prevent state leakage, and document that mutable builders are not concurrently reusable.
7. Verify the result.
   - Test defaults, required-value failures, invalid combinations, repeated builds, and no state leakage.
   - For `GameObject` products, verify the exact component set, references, initialization order, cleanup on failure, and interaction with pooling.
   - Compile against the actual Unity project; do not assume modern Microsoft C# examples are supported by an older Unity compiler.

## Detailed Guidance

Read [references/unity-builder-guide.md](references/unity-builder-guide.md) when choosing a variant, implementing or reviewing code, or needing Unity-compatible examples. It contains the evidence-derived decision matrix, pattern sketches, production corrections, tests, and primary documentation links.

## Review Checklist

- Confirm the builder removes real construction complexity rather than moving assignments into another class.
- Keep fluent method names domain-specific and make `Build()` behavior explicit: new product, one-shot product, or reset-after-build.
- Keep directors focused on meaningful recipes; remove pass-through directors.
- Reserve step interfaces for genuinely mandatory order, not ordinary optional configuration.
- Separate construction from lifetime management: builders assemble, factories select, pools reuse, and DI containers compose dependencies.
- Profile allocation-sensitive spawning before caching builders or replacing prefabs and pools.
- Report which claims were compiled, tested in EditMode/PlayMode, or only reviewed statically.
