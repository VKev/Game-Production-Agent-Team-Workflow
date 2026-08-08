# Principles and Tradeoffs

## Contents

1. Quality priority
2. KISS
3. YAGNI
4. DRY
5. SOLID
6. Composition, encapsulation, and dependencies
7. Performance versus clarity
8. Decision matrix

## 1. Quality Priority

Use the principles together, but resolve conflicts in this order:

1. Preserve correctness, invariants, and required behavior.
2. Make ownership, state, lifetime, and dependencies understandable.
3. Prefer the simplest design that fully handles the current requirement.
4. Reduce risky coupling and duplicated knowledge.
5. Add extension points only for credible variation.
6. Optimize measured bottlenecks without spreading complexity.

Treat a principle as evidence for a decision, not as a score. A design can violate the spirit of clean code while technically containing many interfaces, small methods, and patterns.

## 2. KISS

### Apply KISS

Prefer a direct implementation when:

- The behavior is local and stable.
- The dependency has clear ownership.
- There is one known implementation.
- The feature has few states or variants.
- A pattern would add more concepts than it removes.

Simple means focused, explicit, and easy to reason about. It does not mean compressed, procedural at all costs, or free of all abstractions.

### Add structure only when it removes stronger complexity

Accept an additional class, interface, strategy, state, or service when it clearly improves one or more of these:

- Separates responsibilities that change independently.
- Isolates a volatile SDK, platform, storage, network, or engine boundary.
- Makes ownership or lifetime explicit.
- Removes a recurring conditional family.
- Enables a required implementation variation.
- Creates a meaningful test boundary.
- Prevents widespread changes for a known upcoming GDD feature.

### KISS warning signs

- A feature needs several `Manager`, `Controller`, `Service`, `Factory`, and `Repository` types before it performs one action.
- A local component communicates through a global bus despite having an obvious owner.
- Generic frameworks are introduced for one concrete use case.
- Readers must jump through many tiny methods to understand a linear operation.
- Reflection, attributes, dynamic discovery, or code generation replaces straightforward references without a concrete need.

## 3. YAGNI

Implement current requirements, not imagined ones.

### Justify an extension seam with evidence

Leave a seam when at least one condition is true:

- The GDD names a later feature that will use the seam.
- The task explicitly requires multiple implementations or platforms.
- The code already contains repeated variation.
- The dependency is external or volatile.
- Tests need a narrow substitution boundary.
- A stable contract exists while the implementation is expected to change.

A seam can be as small as a cohesive method, data object, event, delegate, serialized reference, or constructor parameter. It does not always require an interface or framework.

### Reject speculative implementation

Do not add:

- Unused enum members or mode flags.
- Empty virtual methods for imagined subclasses.
- Generic base classes with one consumer.
- Factories that only call one constructor or `Instantiate` one prefab.
- Configuration for behavior that has no requirement.
- Compatibility layers for unsupported platforms.
- Public APIs "for later".

## 4. DRY

DRY means keeping one authoritative representation of a decision or piece of knowledge. It does not require eliminating every repeated line.

### Extract when duplication is the same knowledge

Extract or centralize when copies:

- Must change together for the same business or gameplay rule.
- Encode the same formula, threshold, mapping, validation, or invariant.
- Have already drifted or caused inconsistent behavior.
- Repeat across enough call sites that one authoritative implementation reduces risk.

### Keep duplication when similarity is accidental

Keep code separate when copies:

- Belong to different gameplay concepts.
- Have different owners or lifetimes.
- Are likely to evolve for different reasons.
- Would require boolean flags, type checks, callbacks, or a broad generic API to share.
- Are small and clearer in place.

Use the Rule of Three only as a heuristic: repeated code can reveal a stable abstraction after several real examples, but critical duplicated knowledge may deserve extraction immediately. Conversely, three similar blocks can still represent different concepts.

### Avoid hasty abstractions

Before extraction, name the shared concept in domain terms. If the best name is `CommonHelper`, `SharedUtils`, or a long list of unrelated actions, the abstraction is probably not cohesive.

## 5. SOLID

### Single Responsibility Principle

Interpret responsibility as a cohesive reason to change.

Ask:

- Which actor or requirement causes this code to change?
- Does this type mix gameplay rules, input, presentation, persistence, networking, and lifetime management?
- Can the responsibility be named clearly without using "and" repeatedly?

Do not split a cohesive Unity component into one class per method. A component can own several closely related operations for one gameplay responsibility.

### Open-Closed Principle

Prefer extension without modifying stable code when variation is real. Common Unity mechanisms include composition, strategies, data-driven configuration, prefab variants, ScriptableObjects, delegates, and events.

Do not prebuild a plug-in system for one fixed behavior. Modification of simple local code is often cheaper and clearer than a premature extension framework.

### Liskov Substitution Principle

Use inheritance only when every subtype can safely stand in for the base type.

Check that subtypes:

- Preserve documented behavior and invariants.
- Do not reject valid inputs accepted by the base contract.
- Do not silently weaken expected outputs or side effects.
- Do not require callers to detect the concrete subtype.
- Do not inherit engine lifecycle behavior that is invalid for them.

Prefer composition when subclasses mostly disable, override, or work around base behavior.

### Interface Segregation Principle

Define interfaces around consumer capabilities, not around entire implementations.

Good reasons for an interface:

- Multiple real implementations exist.
- A volatile platform or SDK boundary must be isolated.
- A consumer needs only a narrow capability.
- A test double provides meaningful value.
- Dependency direction should point from stable gameplay rules toward an abstraction.

Weak reasons:

- Every class "should" have an interface.
- An interface might be useful someday.
- The interface mirrors every public member of one concrete class.

### Dependency Inversion Principle

Keep stable high-level gameplay decisions independent from volatile low-level details when the boundary matters.

Prefer explicit dependencies through serialized references, constructors for plain C# objects, method parameters, or a composition root. Avoid hidden global lookups.

Do not confuse dependency inversion with mandatory dependency-injection frameworks. A direct reference is appropriate for a stable, local, clearly owned dependency.

## 6. Composition, Encapsulation, and Dependencies

### Prefer composition over inheritance

Use Unity's component model to combine behavior. Choose inheritance only for a genuine substitutable type hierarchy with shared invariants, not merely for code reuse.

### Encapsulate state transitions

Prevent unrelated callers from setting fields into invalid combinations. Expose operations that communicate intent, such as `TakeDamage`, `StartReload`, or `TryPurchase`, instead of broad writable state.

### Keep dependencies explicit

A type should reveal what it needs to function. Prefer:

- Serialized component references for scene/prefab composition.
- Constructor parameters for plain C# objects.
- Method parameters for operation-specific collaborators.
- Narrow services for genuinely shared long-lived capabilities.

Avoid service locators, `Find*` calls, or mutable static state as invisible dependency injection unless project architecture explicitly standardizes them and the tradeoff is accepted.

### Respect information boundaries

Tell an object what outcome to perform rather than retrieving its internal state and making all decisions elsewhere, when the object genuinely owns that behavior. Do not force behavior into data objects that should remain passive configuration or DTOs.

## 7. Performance Versus Clarity

Follow this order:

1. Make the behavior correct.
2. Make the ownership and intent clear.
3. Identify a relevant hot path or capture a profile.
4. Optimize the bottleneck.
5. Encapsulate unavoidable complexity behind a clear API.
6. Compare before and after.
7. Revert when the gain does not justify the complexity.

Allow a more complex implementation when the performance benefit is substantial, repeatable, and relevant to the target device. Document the reason and evidence near the decision, not every low-level statement.

Do not assume that LINQ, virtual calls, allocations, pooling, caching, jobs, or data-oriented code are always good or bad. Evaluate frequency, scale, lifetime, platform, and measured cost.

## 8. Decision Matrix

| Situation | Prefer | Avoid by default |
|---|---|---|
| One stable local dependency | Direct explicit reference | Interface plus DI framework |
| One simple algorithm | Direct method | Strategy hierarchy |
| A few simple stable states | Enum and readable switch | State-object framework |
| Repeated behavior with real variants | Strategy or composition | Expanding conditional chains |
| Shared authored configuration | ScriptableObject or serialized data | Mutable global runtime state |
| Same gameplay rule copied in many places | One authoritative function or object | Copy-and-edit |
| Similar syntax with different meaning | Keep separate | Forced generic helper |
| Volatile SDK/platform integration | Adapter/interface boundary | SDK calls throughout gameplay code |
| Small linear method | Keep local and readable | Fragmentation into trivial helpers |
| Deep conditional with named sub-decisions | Guard clauses and focused helpers | Dense nested logic |
| Measured hot path | Focused optimization and profiling | Project-wide premature optimization |
