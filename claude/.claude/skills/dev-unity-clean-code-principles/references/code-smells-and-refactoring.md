# Code Smells and Safe Refactoring

## Contents

1. Refactoring contract
2. Safe workflow
3. General smells
4. Unity-specific smells
5. Refactoring operations
6. Stop conditions

## 1. Refactoring Contract

Refactoring changes internal structure while preserving externally observable behavior. A cleanup that changes gameplay, public contracts, serialized data, timing, ordering, or side effects is not purely a refactor and must be treated as a behavior change.

Use smells as investigation prompts. Do not refactor solely because a metric or pattern name appears.

## 2. Safe Workflow

1. Read the callers, tests, prefabs, scenes, and serialized usages.
2. Identify the exact maintenance problem and desired outcome.
3. Establish a baseline through tests, compilation, focused playtesting, or captured profiler data.
4. Make one coherent change at a time.
5. Recompile and verify after each risky boundary change.
6. Inspect the diff for accidental API, serialization, formatting, or behavior changes.
7. Remove obsolete comments and dead code only after usage is confirmed.
8. Compare performance when the refactor targets performance.

Do not combine broad renaming, architecture replacement, formatting, behavior changes, and optimization in one opaque patch.

## 3. General Smells

| Smell | Investigate | Possible response | Do not do reflexively |
|---|---|---|---|
| Long method | Mixed decisions, deep nesting, many side effects | Extract named decisions or cohesive operations | Split by line count |
| Large class | Multiple owners or reasons to change | Extract a real responsibility | One class per method |
| Duplicated code | Same knowledge or accidental similarity | Centralize authoritative rule | Generic helper with flags |
| Deep nesting | Terminal cases and mixed abstraction levels | Guard clauses, named predicates | Many tiny forwarding methods |
| Long parameter list | Missing concept or unstable API | Parameter object or cohesive dependency | Options object for every call |
| Boolean parameter | Hidden modes at call site | Named methods, enum, strategy | New hierarchy for one flag |
| Switch growth | Stable closed cases or growing variants | Keep switch or introduce strategy/state | Polymorphism for trivial cases |
| Primitive obsession | Domain invariant hidden in raw values | Value object, enum, named type | Wrapper with no behavior or clarity |
| Feature envy | Behavior uses another owner's state | Move behavior to actual owner | Break useful orchestration apart |
| Data clumps | Values always travel and validate together | Cohesive data type | Bag-of-properties DTO everywhere |
| Message chain | Caller knows too much structure | Encapsulate navigation or capability | Hide all collaboration behind globals |
| Dead code | No valid references or requirement | Delete after verification | Keep "for later" |
| Comments explaining mechanics | Code is unclear | Rename or restructure | Add more narration |
| Excessive inheritance | Subtypes disable or contradict base behavior | Composition/delegation | Add another base layer |
| Excessive coupling | Type touches many unrelated systems | Narrow dependencies, facade, split responsibility | Global event bus for everything |

## 4. Unity-Specific Smells

### God MonoBehaviour

Symptoms:

- Reads input, moves physics, updates UI, saves data, plays audio, spawns effects, and owns game flow.
- Contains many unrelated serialized references.
- Changes for many different feature requests.

Response:

- Keep engine callbacks and composition in the component.
- Extract only coherent rules, policies, or collaborators.
- Preserve local direct calls where ownership remains clear.

### Manager soup

Symptoms:

- Many globally accessible `*Manager`, `*Service`, and `*Controller` classes with overlapping ownership.
- Features communicate through globals despite stable local relationships.

Response:

- Rename by domain responsibility.
- Define an owner and lifetime.
- Replace global access with explicit references where practical.
- Merge or remove abstractions that do not form independent responsibilities.

### Hidden scene lookup

Symptoms:

- `Find*`, tags, or singleton access supplies required dependencies at arbitrary call sites.
- Failures occur only at runtime when scene composition changes.

Response:

- Wire stable dependencies through the Inspector or composition root.
- Validate required references early.
- Keep dynamic lookup only where dynamic discovery is the real requirement.

### Lifecycle mismatch

Symptoms:

- Subscriptions outlive objects.
- Coroutines or async continuations mutate disabled, destroyed, or reused objects.
- State survives scene reload or pooled reuse unexpectedly.

Response:

- Define enable, object, scene, application, or lease lifetime.
- Pair start/stop operations and reset state.

### Serialized/runtime state mixture

Symptoms:

- Inspector-authored defaults are overwritten as mutable runtime state.
- Cached or derived values are serialized.
- ScriptableObject assets hold session state unintentionally.

Response:

- Separate immutable/authored configuration from runtime state.
- Clone or instantiate runtime state only when necessary.
- Avoid serializing duplicate derived data.

### Event overuse

Symptoms:

- A direct local action travels through several event channels.
- Ordering is implicit and debugging requires tracing many listeners.

Response:

- Restore direct method calls for owned local behavior.
- Keep events for independent observers or genuine decoupling boundaries.

### Premature optimization architecture

Symptoms:

- Pooling, Jobs, Burst, custom allocators, caches, or non-alloc APIs appear without a workload or profile.
- Optimization logic dominates simple gameplay behavior.

Response:

- Establish a baseline.
- Keep the clear implementation when the benefit is insignificant.
- Isolate justified optimization behind a cohesive API.

## 5. Refactoring Operations

Choose the smallest operation that addresses the identified problem:

- Rename type, member, parameter, or local.
- Extract or inline method.
- Extract or inline class.
- Introduce guard clause.
- Replace magic value with named constant, enum, or configuration.
- Encapsulate field or state transition.
- Introduce a cohesive parameter object.
- Move method to the actual owner.
- Replace inheritance with composition.
- Replace repeated conditional family with strategy or state.
- Replace hidden lookup with explicit dependency.
- Reduce visibility.
- Remove dead code or unused abstraction.
- Split authored configuration from runtime state.
- Pair lifecycle acquisition and cleanup.

After each operation, check whether the code became easier to understand at the call site and in the owner. Undo abstractions that merely move complexity.

## 6. Stop Conditions

Stop refactoring when:

- The identified problem is resolved.
- The next change is preference-only or outside task scope.
- Additional abstraction has no current consumer.
- Verification becomes weaker rather than stronger.
- The diff grows across unrelated features.
- Readability or locality decreases.
- Performance improvement is too small or unverified relative to complexity.

Leave a concise follow-up note only for a concrete deferred issue; do not build the deferred solution.
