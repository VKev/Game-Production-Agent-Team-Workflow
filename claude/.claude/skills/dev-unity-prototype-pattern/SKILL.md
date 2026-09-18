---
name: dev-unity-prototype-pattern
description: Design, implement, review, refactor, and test Prototype pattern solutions in Unity C#. Use for cloning configured exemplars, prefab-as-prototype workflows, runtime prototype registries, `Object.Instantiate`, ScriptableObject runtime copies, deep versus shallow copy, clone initialization, and decisions among Prototype, a prefab reference, Factory Method, Builder, object pooling, Memento, or save/load snapshots.
---

# Unity Prototype Pattern

Use Prototype when construction should clone a configured exemplar and the exemplar owns or defines its copy semantics.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and possible combinations for every relevant option. Use any justified combination or none; do not rank skills as primary/supporting.

Compare prefabs, `Object.Instantiate`, ScriptableObject definitions, a runtime prototype registry, Factory Method, Builder, pooling, Memento, and serialization.

## Define the Copy Contract

1. Identify the source prototype and who owns it.
2. Classify every field as copied value, shared immutable reference, deep-copied mutable object, reset runtime state, or forbidden reference.
3. Decide whether the clone is a Unity object, plain C# object, asset, or hierarchy.
4. Define post-clone initialization and failure behavior.

Benefit: reuse a fully configured exemplar without reconstructing it field by field. Drawbacks: hidden shallow copies, shared mutable references, stale event/delegate state, clone cost, and registry/version complexity.

Reject Prototype when direct construction is simple, a prefab already expresses the complete authored template, or pooled reuse—not cloning—is the actual concern.

## Respect Unity Semantics

- `Object.Instantiate` clones Unity objects and prefab hierarchies; it does not define safe domain-copy semantics for arbitrary managed graphs.
- Cloned references to shared assets can remain shared intentionally.
- Runtime mutable lists, dictionaries, delegates, subscriptions, cancellation state, and ownership references require explicit handling.
- A runtime `Instantiate` copy of a ScriptableObject is not a saved project asset.
- Never mutate the prototype to hold one clone’s runtime state.
- Treat `ICloneable` cautiously because its contract does not specify deep or shallow copy.

Prefer named APIs such as `CloneForRuntime`, `CreateSnapshot`, or `InstantiateFromPrototype` when copy intent matters.

## Distinguish Neighboring Patterns

- Prototype creates a new clone; pooling returns a previously used instance and requires reset.
- Memento captures state for restoration; it need not create a functioning duplicate.
- Builder constructs step by step; Factory Method selects construction policy.
- ScriptableObject flyweights share immutable data instead of copying it.

## Verify

- Mutate every mutable clone field and confirm the prototype and sibling clones stay correct.
- Confirm intended asset references remain shared.
- Test nested hierarchies, disabled children, required components, events, and runtime IDs.
- Measure clone cost at expected scale and compare pooling if churn is high.
- Test registry lookup, missing keys, duplicate identity, and prototype replacement.

Read [references/prototype-guide.md](references/prototype-guide.md) for copy rules, video context, and sources.
