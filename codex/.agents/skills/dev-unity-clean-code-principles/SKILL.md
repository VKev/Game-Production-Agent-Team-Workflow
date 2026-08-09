---
name: dev-unity-clean-code-principles
description: Version-aware clean-code guidance for Unity C# that balances KISS, YAGNI, DRY, SOLID, readability, maintainability, correctness, and measured performance. Use when designing, implementing, reviewing, simplifying, or refactoring Unity scripts; naming types and members; reducing duplication, nesting, coupling, side effects, or over-abstraction; deciding whether an interface, pattern, helper, service, inheritance hierarchy, or optimization is justified; or performing a post-implementation cleanup. Preserve existing project conventions and behavior, respect Unity lifecycle and serialization constraints, and verify changes through compilation, tests, focused playtesting, and profiling when relevant.
---

# Unity Clean Code Principles

## Goal

Produce the simplest Unity C# design that fully satisfies the current requirement, communicates intent clearly, fits the existing project, and remains safe to change. Treat clean-code principles as decision tools rather than quotas or mandatory patterns.

## Workflow

1. **Inspect the project before judging the code.**
   - Read the applicable `AGENTS.md` files, GDD, task requirements, nearby scripts, tests, assembly definitions, and project conventions.
   - Confirm the Unity version, C# language support, installed packages, and relevant platform constraints.
   - Prefer the repository's established style unless it creates a concrete correctness or maintenance problem.

2. **Identify the work mode.**
   - For new code, choose the smallest complete design.
   - For a review, distinguish defects from preferences and speculative improvements.
   - For a refactor, preserve observable behavior and serialized data unless the task explicitly changes them.
   - For post-implementation cleanup, keep changes local and avoid expanding feature scope.

3. **Apply this priority order.**
   1. Correctness and required behavior.
   2. Clear ownership and lifecycle.
   3. Readability and explicit intent.
   4. Simplicity and cohesion.
   5. Appropriate reuse and dependency boundaries.
   6. Extensibility supported by actual requirements or the GDD.
   7. Performance supported by measurement or an obvious high-frequency cost.

4. **Choose principles independently.**
   - Apply KISS first to avoid unnecessary structure.
   - Apply YAGNI to reject speculative behavior and unused extension points.
   - Apply DRY only to duplicated knowledge, not merely similar-looking code.
   - Apply SOLID only where it reduces a real change, ownership, substitution, consumer, or dependency problem.
   - Prefer composition over inheritance unless a stable substitutable relationship genuinely exists.

5. **Implement or refactor in small coherent steps.**
   - Keep each change understandable and reversible.
   - Use names that reveal intent and units.
   - Keep dependencies explicit.
   - Keep related logic together; do not fragment code solely to make methods or classes shorter.
   - Remove dead code, unused abstractions, obsolete comments, and accidental complexity when safe.

6. **Verify before claiming improvement.**
   - Compile and inspect Console errors and warnings.
   - Run relevant Edit Mode and Play Mode tests.
   - Playtest the exact changed behavior.
   - Check prefab, scene, and serialized-field compatibility after structural or naming changes.
   - Check subscriptions, cancellation, disposal, pooling, and object lifetime where relevant.

7. **Evaluate optimization only after correctness.**
   - Inspect GC allocation, CPU cost, physics cost, rendering cost, and other relevant hotspots.
   - Use `dev-unity-performance-profiling` for nontrivial performance claims.
   - Keep an optimization only when its measured or well-established value justifies its complexity.
   - Prefer the cleaner version when the performance gain is minor or unverified.

## Non-Negotiable Rules

- Do not create an interface merely because SOLID is mentioned.
- Do not introduce a design pattern without identifying the concrete problem it solves.
- Do not extract shared code when the duplication represents different knowledge or can evolve for different reasons.
- Do not implement anticipated variants that are absent from the task or GDD.
- Do not enforce arbitrary limits for method length, class length, parameter count, or inheritance depth as universal rules.
- Do not replace readable direct code with clever, compressed, reflection-heavy, or overly generic code without a demonstrated benefit.
- Do not hide required dependencies behind global state, scene searches, or unexplained service locators.
- Do not change public APIs, serialized fields, prefab wiring, save formats, or behavior during a cleanup without explicitly accounting for migration and compatibility.
- Do not mix broad architecture replacement into a focused feature or bug-fix task.
- Do not label code "cleaner" unless the change improves a specific quality such as intent, cohesion, coupling, testability, ownership, or change safety.

## Principle Summary

Use [principles-and-tradeoffs.md](references/principles-and-tradeoffs.md) for the full decision rules.

- **KISS:** Prefer the least complex complete solution, not necessarily the fewest lines.
- **YAGNI:** Implement current requirements; leave only justified extension seams.
- **DRY:** Remove duplicated decisions and knowledge; tolerate harmless local similarity.
- **SRP:** Keep one cohesive responsibility or reason to change, not one method per class.
- **OCP:** Add variation points only when variation is real or strongly supported.
- **LSP:** Preserve the promises and invariants of base contracts.
- **ISP:** Give consumers the smallest capability they actually need.
- **DIP:** Isolate volatile or external details from stable gameplay rules; allow direct dependencies for stable local ownership.

## Unity Boundaries

Use [unity-specific-guidance.md](references/unity-specific-guidance.md) before changing component boundaries, lifecycle code, serialized data, events, or hot paths.

- Keep engine callbacks and `GameObject` lifetime integration in `MonoBehaviour`.
- Move pure gameplay rules to plain C# only when that improves clarity, reuse, or testing.
- Use `ScriptableObject` for suitable shared authored data or asset-based behavior, not as a default replacement for every runtime object.
- Prefer explicit serialized references for stable scene or prefab relationships.
- Pair every subscription, lease, handle, task, coroutine, and native resource with a clear owner and release path.
- Preserve Inspector usability and serialized data when renaming or reorganizing fields.

## Readability and Refactoring

- Read [readability-and-style.md](references/readability-and-style.md) for naming, methods, conditions, comments, visibility, and formatting.
- Read [code-smells-and-refactoring.md](references/code-smells-and-refactoring.md) before broad cleanup or behavior-preserving refactoring.
- Read [examples.md](references/examples.md) when choosing between direct code and an abstraction.
- Read [review-and-verification.md](references/review-and-verification.md) before finalizing a review or refactor.
- Read [sources.md](references/sources.md) when validating version-sensitive Unity guidance against primary documentation.

## Related Skill Boundaries

Compose this skill with more specific skills instead of duplicating their work:

- Use `dev-unity-gameplay-architecture` for cross-system architecture and pattern selection.
- Use `dev-unity-csharp-collections-queries` for collections, loops, LINQ, buffers, and query costs.
- Use `dev-unity-object-pooling` for pool ownership, sizing, and reset contracts.
- Use `dev-unity-async-coroutines-unitask` for asynchronous lifetime, cancellation, and exception ownership.
- Use `dev-unity-assets-addressables` for asset-handle and content ownership.
- Use `dev-unity-performance-profiling` for measured optimization.
- Use `dev-unity-jobs-burst-native-collections` only for justified data-parallel workloads.

## Completion Report

Report only meaningful decisions and evidence. Include:

- What was simplified or clarified.
- Which abstraction was added, retained, removed, or deliberately avoided, and why.
- Any compatibility or lifecycle concern addressed.
- How correctness was verified.
- Any optimization kept or rejected and the supporting evidence.

Do not dump every checklist item unless the user requests a formal review.
