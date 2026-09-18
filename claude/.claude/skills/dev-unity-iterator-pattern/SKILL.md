---
name: dev-unity-iterator-pattern
description: Design, implement, review, optimize, and test Iterator pattern solutions in Unity C#. Use for generic IEnumerable and IEnumerator contracts, `yield return`, custom traversal of trees/graphs/grids, hiding collection storage, lazy traversal, allocation or boxing review, mutation during enumeration, and decisions among direct `foreach`, a collection/query API, custom Iterator, Composite traversal, Visitor, or Jobs/Native Collections.
---

# Unity Iterator Pattern

Use Iterator when callers need a stable traversal contract without knowing the underlying collection or traversal algorithm.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for all relevant options. Use any justified combination or none; do not assign ranks.

Compare direct `foreach`, an exposed collection, LINQ/ZLinq, `yield return`, a custom enumerator, Composite traversal, Visitor, and Jobs/Native Collections.

## Start With C# Built-ins

1. Define traversal order and whether results are lazy.
2. Define mutation, snapshot, invalidation, and reentrancy behavior.
3. Determine whether one traversal or several named traversals are required.
4. Measure allocations only if the traversal is hot.

Benefit: hide storage and provide reusable traversal. Drawbacks: iterator state, deferred exceptions, invalidation, boxing/allocation, hidden cost, and complex graph/cycle handling.

Reject a custom Iterator class when built-in collection enumeration or a simple iterator block communicates the traversal.

## Unity Guardrails

- Do not confuse a coroutine’s `IEnumerator` scheduling contract with collection iteration.
- Do not touch UnityEngine objects from worker threads merely because traversal is pure C#.
- Define whether inactive/destroyed Unity objects are skipped, yielded as null-like references, or treated as errors.
- For trees/graphs, define depth-first/breadth-first order and cycle handling.
- Avoid yielding mutable internal collections that clients can modify unexpectedly.
- Use struct enumerators or pooled traversal buffers only after profiling confirms value.

Use `dev-unity-csharp-collections-queries` for collection/query selection and `dev-unity-jobs-burst-native-collections` when traversal must run in jobs.

## Verify

- Test empty, single, deep, wide, cyclic, and malformed structures.
- Test multiple concurrent enumerators and early termination.
- Test mutation before and during enumeration.
- Test destroyed/inactive Unity objects.
- Measure allocations and frame time in the actual call form, including interface boxing.

Read [references/iterator-guide.md](references/iterator-guide.md) for C# mechanics and sources.
