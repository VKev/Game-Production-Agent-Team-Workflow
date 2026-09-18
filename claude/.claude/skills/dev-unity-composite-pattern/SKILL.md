---
name: dev-unity-composite-pattern
description: Design, implement, review, refactor, and test Composite pattern solutions in Unity C#. Use for part-whole trees where leaves and groups share an operation, logical gameplay trees, nested abilities/objectives/widgets, uniform traversal and aggregation, Composite versus Transform hierarchy decisions, and comparisons with plain collections, prefab/component composition, Iterator, Visitor, or gameplay hierarchy architecture.
---

# Unity Composite Pattern

Use Composite when clients must treat individual leaves and nested groups through one component contract.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for every relevant approach. Use any justified set or none; never force primary/supporting ranks.

Compare a direct object, a list/tree data structure, Unity Transform hierarchy, component composition, Composite, Iterator, Visitor, and gameplay hierarchy architecture.

## Prove Uniformity

1. Define the operation shared by leaves and composites.
2. Define child ownership and whether the structure is a tree or graph.
3. Define aggregation, order, failure, disabled-node, and empty-group semantics.
4. Confirm clients genuinely benefit from treating one item and a group uniformly.

Benefit: uniform recursive operations and replaceable part-whole structures. Drawbacks: broad lowest-common-denominator contracts, recursive cost, hidden hierarchy behavior, cycle risk, mutation during traversal, and ambiguous ownership.

Reject Composite when a plain list/tree with explicit traversal is clearer or when leaves and groups do not share meaningful behavior.

## Separate Logical and Scene Trees

- A Transform hierarchy is a scene graph, not automatically a GoF Composite.
- Multiple MonoBehaviours are component composition, not automatically Composite.
- Keep logical ownership explicit even if it mirrors GameObject parenting.
- Prevent cycles if one parent owns each child.
- Define whether reparenting changes domain ownership.
- Avoid a root “boss” MonoBehaviour that accumulates unrelated responsibilities.

Choose transparent composites only when exposing child management through the shared contract is safe. Otherwise keep `Add` and `Remove` on composites only.

## Traverse Safely

Use Iterator when traversal order/storage should be abstracted. Use Visitor when many operations must be added across a stable node family. Define mutation rules: snapshot children, reject mutation, or defer changes while traversing.

## Verify

- Test leaf, empty group, one level, deep nesting, and wide trees.
- Test ordering, disabled children, partial failure, and mutation during traversal.
- Prove cycle prevention and single-parent ownership.
- Profile recursion and allocation at expected depth/width.
- Confirm scene parenting changes cannot silently corrupt logical ownership.

Read [references/composite-guide.md](references/composite-guide.md) for hierarchy distinctions and sources.
