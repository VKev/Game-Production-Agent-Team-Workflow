---
name: dev-unity-strategy-pattern
description: Design, implement, review, refactor, and test Strategy pattern implementations in Unity C#. Use for genuinely interchangeable algorithms or behaviors, runtime or Inspector-driven behavior selection, ScriptableObject strategy assets, pluggable ability or AI variants, strategy composition, and decisions between Strategy, a direct branch, State, Command, Factory, Builder, VContainer, pooling, or plain composition. Compare every materially relevant skill by benefit, drawback, prerequisites, overlap, and rejection condition; use any useful combination or no specialist skill. Do not use merely because a small stable switch or if statement exists.
---

# Unity Strategy Pattern

Use Strategy to make a family of behaviors interchangeable behind a stable, meaningful contract. Treat the pattern as an optional design tool, not a cleanliness requirement.

Read [references/unity-strategy-guide.md](references/unity-strategy-guide.md) when choosing an implementation shape, comparing adjacent patterns, handling ScriptableObject state, or reviewing a nontrivial implementation.

## Start with a comparative decision

Before adopting Strategy:

1. State the variation that must be interchangeable and who selects it.
2. Compare all materially relevant approaches and available skills. For each, record its benefit, drawback or added complexity, prerequisites, overlap or conflict, and rejection condition.
3. Do not rank skills into fixed primary and supporting roles. Use one, several, a sequence for different phases, or none when that best fits the task.
4. State Strategy's concrete benefit, its largest cost, and the evidence that would make a direct solution preferable.
5. Reject Strategy if the contract is speculative, only one meaningful implementation exists, variants do not substitute cleanly, or a small stable branch is clearer.

Do not infer that every `switch` should become Strategy. Branching is often the honest representation of a closed, stable choice.

## Route by the actual problem

- Use this skill when the outcome is interchangeable behavior or algorithm selection.
- Compare `dev-unity-gameplay-architecture` when boundaries, ownership, dependency direction, or state-machine structure are undecided.
- Compare `dev-unity-builder-pattern` when a selected strategy must assemble a complex product; Builder owns construction steps, not behavior selection.
- Compare `dev-unity-vcontainer` when dependency composition or lifetime registration materially affects how strategies are supplied.
- Compare `dev-unity-object-pooling` when executed behavior repeatedly creates and reuses runtime instances.
- Compare `dev-unity-performance-profiling` before choosing an optimization mechanism for an unknown or disputed cost.
- Compare package skills such as DOTween, Feel, Final IK, or Cinemachine only when the installed package materially owns part of the behavior.
- Use `dev-unity-clean-code-principles` or `dev-ponytail` only when their broader review or simplicity lens changes the result.

Several of these skills may be useful together. Do not load one merely because it shares a class, API, or keyword with the task.

## Choose the representation deliberately

### Keep direct code

Prefer a direct call, conditional, enum, or switch when choices are few, stable, local, and unlikely to be authored or replaced independently. This is the baseline to beat.

### Plain C# interface

Use an interface when unrelated runtime types need the same capability, dependencies can be supplied explicitly, and Inspector asset authoring is unnecessary. Keep the contract narrow and semantic.

### Abstract base class

Use an abstract class when implementations share real state or protected behavior. Do not introduce inheritance only to share a method signature.

### ScriptableObject strategy

Use an abstract `ScriptableObject` base when designers need reusable project assets, Inspector-authored variants, or shared configuration. Treat the asset as shared authored configuration by default, not as per-cast or per-actor mutable state.

### Managed-reference strategy

Consider `[SerializeReference]` for inline polymorphic plain C# objects that belong to one host and do not need to be shared as assets. Accept the extra serialization and Inspector complexity only when it materially helps.

## Design the contract

1. Name the capability, not the current implementation: `IAttackStrategy`, not `IFireballStrategy`.
2. Pass a narrow request or context containing only execution-time inputs and required collaborators.
3. Return an explicit result or handle when the caller must observe failure, cancellation, spawned objects, or cleanup.
4. Keep selection, execution, cooldown, ownership, and presentation responsibilities distinct unless the feature proves they belong together.
5. Avoid a context object that becomes a service locator. If every strategy needs unrelated branches over a large context, the abstraction is not stable.

## Keep Unity state and lifetimes safe

- Do not store actor-specific, cast-specific, cooldown, target, tween, coroutine, or spawned-object state in a shared ScriptableObject asset.
- Put mutable execution state in the caller, an execution object, a pooled instance, or an explicit context/handle.
- Validate required asset references and configuration with `OnValidate` or tests where appropriate.
- Prefer serialized references or stable identifiers over parallel UI and strategy arrays coupled only by index.
- Make event subscription and unsubscription symmetric, using the exact same delegate instance.
- Define ownership and cleanup for instantiated objects, coroutines, async work, tweens, and pooled leases.
- Avoid per-frame strategy allocations unless profiling proves they are acceptable.

## Implement in small steps

1. Preserve current behavior with a focused characterization test or observable baseline.
2. Extract the smallest stable contract from at least two concrete variants.
3. Move one variant at a time behind the contract.
4. Keep the caller responsible for selecting a strategy unless selection itself is a separate proven policy.
5. Add ScriptableObject assets only when asset authoring is part of the requirement.
6. Add composition, factories, builders, DI, pooling, or package integrations only when their separate benefits justify their costs.
7. Re-evaluate the selected skills and abstractions after the first complete path works.

## Verify

- Compile the actual Unity project and audit relevant Console output.
- Test every concrete strategy against the shared contract, including invalid or missing configuration.
- Test selection behavior independently from strategy behavior.
- Verify multiple users of the same ScriptableObject do not leak mutable state across actors, scenes, or Play Mode sessions.
- Verify cancellation, cleanup, pooling return, tween kill, and event unsubscription when those lifetimes exist.
- Verify Inspector assignment, asset duplication, prefab references, and serialization after reload when assets are part of the design.
- Profile only when performance is a requirement or claim; compare against the direct baseline.

## Report the decision

Summarize:

- the variation and selector;
- approaches and skills considered, including benefits and drawbacks;
- chosen combination or reason for using no specialist skill;
- Strategy's benefit and added complexity;
- rejection or rollback condition;
- state and lifetime ownership;
- verification performed and still pending.
