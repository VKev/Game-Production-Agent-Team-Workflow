---
name: dev-unity-factory-method-pattern
description: Design, implement, review, refactor, and test Factory Method solutions in Unity C#. Use for abstract or overridable creation methods, runtime product variants behind a shared contract, prefab spawning with product-specific initialization, creator subclasses, `GetProduct` APIs, and decisions among a direct constructor, prefab, simple factory, Factory Method, Abstract Factory, Builder, Prototype, object pooling, or VContainer.
---

# Unity Factory Method Pattern

Use Factory Method when clients should depend on a product contract while creator variants decide which concrete product to construct.

## Compare Before Selecting

For every relevant approach or skill, state its benefit, drawback, prerequisite, rejection condition, and clean combinations. Use any justified combination or no specialist skill; do not assign primary/supporting ranks.

Compare direct construction, a prefab reference, a switch-based simple factory, Factory Method, Abstract Factory, Builder, Prototype, pooling, ScriptableObject catalogs, and VContainer.

## Establish the Need

1. Identify the product contract and every concrete product.
2. Identify what construction actually varies: type, prefab, dependencies, initialization, or ownership.
3. Confirm new products or creator policies are expected often enough to justify more types.
4. Reject Factory Method when one constructor, one prefab, or a small stable switch is clearer.

Benefit: isolate product construction and keep callers on a stable contract. Drawbacks: creator subclasses, Inspector reference wiring, indirect control flow, and possible class proliferation.

## Design the Contract

- Keep the product interface about product behavior, not factory mechanics.
- Make the creation method return the contract and document ownership.
- Pass per-spawn context explicitly; do not read hidden global state.
- Validate prefab and required-component compatibility before runtime use.
- Prefer the expected component authored on the prefab over unconditional `AddComponent`.
- Keep construction synchronous unless asset loading genuinely makes it asynchronous.

A factory may instantiate a prefab or borrow from a pool. Pooling owns reuse and reset; Factory Method owns product selection and construction policy. Combine them only when both concerns matter.

## Choose the Smallest Shape

- Use a direct constructor or prefab for one fixed product.
- Use a simple factory for a small closed set selected by data.
- Use Factory Method when creator subclasses or overridable construction are the required extension point.
- Use Abstract Factory when a selected family must create several compatible product kinds.
- Use Builder when one product has many optional or ordered construction inputs.
- Use Prototype when cloning configured exemplars is the actual requirement.
- Use VContainer when dependency composition and lifetime, rather than product selection, is the problem.

Avoid static factory access unless process-wide lifetime is real and teardown/test replacement are explicit.

## Verify

- Test every creator/product pairing and invalid prefab configuration.
- Confirm callers never branch on concrete product type after creation.
- Confirm initialization happens exactly once with complete spawn context.
- Test pooled and non-pooled ownership, scene teardown, and failed creation.
- Add a new product in a test branch and inspect how many existing files must change.

Read [references/factory-method-guide.md](references/factory-method-guide.md) for video context, Unity corrections, examples, and sources.
