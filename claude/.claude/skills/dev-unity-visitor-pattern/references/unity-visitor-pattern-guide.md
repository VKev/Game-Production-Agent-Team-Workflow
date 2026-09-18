# Unity Visitor Pattern Guide

## Contents

1. [Evidence and scope](#evidence-and-scope)
2. [What the tutorial builds](#what-the-tutorial-builds)
3. [Correct C# dispatch model](#correct-c-dispatch-model)
4. [Selection matrix](#selection-matrix)
5. [Classic typed Visitor](#classic-typed-visitor)
6. [Traversal and aggregate ownership](#traversal-and-aggregate-ownership)
7. [Results, state, and unsupported combinations](#results-state-and-unsupported-combinations)
8. [Unity component and ScriptableObject boundaries](#unity-component-and-scriptableobject-boundaries)
9. [Reflective Visitor](#reflective-visitor)
10. [Unity object null and destruction](#unity-object-null-and-destruction)
11. [Related skills and patterns](#related-skills-and-patterns)
12. [Testing and verification](#testing-and-verification)
13. [Failure modes](#failure-modes)
14. [Primary sources](#primary-sources)

## Evidence and scope

The source tutorial is [Visitor: How I Mastered the Toughest Programming Pattern](https://www.youtube.com/watch?v=Q2gQs6gIzCM). Analysis used YouTube's automatic English captions and targeted visual frames; it did not use Whisper or another transcription service.

The following claims were visually checked against frames:

| Timestamp | Visual evidence |
|---|---|
| 1:49 | `IVisitable.Accept(IVisitor)` and `HealthComponent.Accept` calling `visitor.Visit(this)` |
| 2:27 | `IVisitor` overloads for health and mana plus a `PowerUp : ScriptableObject, IVisitor` |
| 3:45 | `Hero` collecting visitable components and forwarding `Accept` to each child |
| 7:52 | reflective lookup with `GetType().GetMethod("Visit", new[] { o.GetType() })` and `MethodInfo.Invoke` |
| 10:57 | the null-coalescing demonstration using `DestroyImmediate` and `??=` |
| 12:17 | `GetOrAdd<T>` using `GetComponent<T>()`, Unity truthiness, and `AddComponent<T>()` |

Automatic captions repeatedly misheard identifiers such as `IVisitable` and `UnityEngine.Object`. Use the frames and official APIs for those names. The skill treats the null-coalescing segment as a related Unity safety lesson, not as part of Visitor itself.

## What the tutorial builds

### Classic example

The tutorial models a power-up operation over heterogeneous player components:

- `IVisitable` declares `Accept(IVisitor visitor)`.
- `HealthComponent` and `ManaComponent` are MonoBehaviour elements.
- Each concrete component implements `Accept` by calling the matching overloaded `Visit(this)` method.
- `IVisitor` declares one overload per concrete component type.
- `PowerUp` is a ScriptableObject concrete visitor with health and mana bonus data.
- `Hero` stores visitable components and forwards a visitor to every component.
- A pickup trigger retrieves an `IVisitable`, passes the power-up visitor, and removes the pickup.

The resulting call path is:

```text
Pickup collision
  -> Hero.Accept(powerUp)
      -> HealthComponent.Accept(powerUp)
          -> powerUp.Visit(HealthComponent)
      -> ManaComponent.Accept(powerUp)
          -> powerUp.Visit(ManaComponent)
```

This combines at least three concerns:

- Visitor selects an operation by concrete element type.
- Composite/Iterator-like traversal forwards the operation to child components.
- Pickup collision and destruction own delivery and lifecycle.

Do not collapse those concerns into one pattern decision. A project may need the traversal without Visitor, or Visitor without a pickup.

### The tutorial's “intrusive” variant

The video later replaces public mutable component properties with public methods such as `AddHealth` and `AddMana`. The visitor calls those methods rather than mutating fields directly.

Treat “intrusive Visitor” here as tutorial terminology, not a universally standardized variant name. The practical change is encapsulation:

- Benefit: components retain invariants, clamping, events, and validation behind domain verbs.
- Cost: the element API now exposes operations needed by visitors.
- Reject direct external mutation even when it shortens the demo; it lets visitors bypass element rules.

### Reflective variant

The video changes the interface to one `Visit(object)` entry point, looks up a more specific `Visit` overload from the runtime argument type, and invokes it through reflection. A `Visit(object)` method acts as the default/no-op route.

This shrinks the interface but trades away compile-time coverage. Missing handlers become runtime behavior, and the reflective implementation introduces lookup, invocation, exception, AOT, stripping, and test obligations.

## Correct C# dispatch model

Visitor is often described as double dispatch, but the phrase can hide how C# actually selects methods.

Given:

```csharp
IGameElement element = new HealthComponent();
IGameVisitor visitor = new RestoreVisitor();
element.Accept(visitor);
```

the steps are:

1. Runtime interface dispatch selects `HealthComponent.Accept` from the runtime type of `element`.
2. Inside `HealthComponent.Accept`, the expression `this` has compile-time type `HealthComponent`.
3. C# overload resolution therefore selects `IGameVisitor.Visit(HealthComponent)` at compile time.
4. Runtime interface dispatch selects `RestoreVisitor`'s implementation of that already-selected interface method.

The second dispatch is not arbitrary runtime argument overloading. This direct call is different:

```csharp
IGameElement element = new HealthComponent();
visitor.Visit(element); // Only an overload compatible with IGameElement can be selected.
```

Classic Visitor uses the element's concrete `Accept` implementation to reintroduce the concrete compile-time type. Adding a subclass without its own correctly typed `Accept` can silently route to a base-element overload.

## Selection matrix

Choose from the requested outcome and expected change axes.

| Approach | Benefit | Drawback or complexity | Prefer when | Reject when |
|---|---|---|---|---|
| Direct method or capability interface | Minimal types and obvious ownership | Operation remains on the element API | Behavior naturally belongs to the component | Many unrelated cross-cutting operations would pollute every element |
| Classic typed Visitor | Compile-time handler coverage; new operations can be grouped externally | New element types force changes across visitor contracts and implementations | Element family is stable and operations grow | Element/plugin types change frequently |
| Type-pattern `switch` | Local, readable runtime type handling | Central branch must change for new cases | Family is small and handling is local | Many operations duplicate the same type switch |
| Strategy | Cleanly swaps one algorithm behind a stable contract | Does not dispatch by element type; adds strategy lifetime/configuration | Algorithm choice is the variation axis | The problem is heterogeneous element handling |
| Command | Encapsulates an action; supports queueing, logging, and undo | Receiver dispatch and history add machinery | Actions need scheduling or reversal | Only immediate type-specific processing is needed |
| Event/Observer | Decoupled broadcast to zero or more listeners | Ordering, lifetime, reentrancy, and exception policy become implicit | Independent listeners react to facts | Exactly one type-specific operation must run deterministically |
| Data table or ScriptableObject definition | Designer-authored values and fewer behavior classes | Complex behavior may become an interpreter or giant enum switch | Variation is data rather than code | Each element needs materially different behavior |
| Reflective Visitor | Small source interface and runtime discovery | Runtime failures, overhead, stripping/AOT risk, weak discoverability | Runtime-extensible types are a verified requirement | A closed type family can use typed calls |
| Type-to-delegate registry | Explicit runtime extension without repeated reflection | Registration, missing keys, variance, and lifetime still need policy | Plugins register handlers at a composition root | Compile-time closed coverage is more valuable |
| Element-owned polymorphism | New element types carry their own behavior | New operations may require edits across the hierarchy | Types vary more often than operations | Operations are numerous and cross-cutting |

A classic Visitor is strongest when the element rows are stable and operation columns grow. It is weakest when rows grow frequently because every operation must learn the new row.

## Classic typed Visitor

### Minimal side-effect form

```csharp
public interface IGameElement
{
    void Accept(IGameVisitor visitor);
}

public interface IGameVisitor
{
    void Visit(HealthComponent health);
    void Visit(ManaComponent mana);
}

public sealed class HealthComponent : MonoBehaviour, IGameElement
{
    [SerializeField] private int currentHealth = 100;

    public void RestoreHealth(int amount)
    {
        if (amount <= 0)
            return;

        currentHealth += amount;
    }

    public void Accept(IGameVisitor visitor)
    {
        if (visitor == null)
            throw new ArgumentNullException(nameof(visitor));

        visitor.Visit(this);
    }
}

public sealed class RestoreVisitor : IGameVisitor
{
    private readonly int healthAmount;
    private readonly int manaAmount;

    public RestoreVisitor(int healthAmount, int manaAmount)
    {
        this.healthAmount = healthAmount;
        this.manaAmount = manaAmount;
    }

    public void Visit(HealthComponent health) => health.RestoreHealth(healthAmount);
    public void Visit(ManaComponent mana) => mana.RestoreMana(manaAmount);
}
```

Adjust null-guard syntax to the Unity project's supported .NET/C# profile. The important constraint is that the contract does not accept a null visitor silently unless that is an explicit policy.

### Encapsulation rule

Visitors may know concrete element types, but they should not automatically receive unrestricted mutation access. Prefer:

- read-only properties for queries;
- domain methods for mutations;
- result values for calculations;
- an explicit context containing services required by the operation.

Avoid making fields public solely because the visitor needs them. That reverses the pattern's organizational benefit by weakening every element invariant.

## Traversal and aggregate ownership

Visitor chooses type-specific behavior. It does not inherently decide which objects are visited.

An aggregate may own traversal:

```csharp
public sealed class CharacterElements : IGameElement
{
    private readonly IReadOnlyList<IGameElement> children;

    public CharacterElements(IReadOnlyList<IGameElement> children)
    {
        this.children = children;
    }

    public void Accept(IGameVisitor visitor)
    {
        foreach (IGameElement child in children)
            child.Accept(visitor);
    }
}
```

Before using this shape, decide:

- Does the aggregate itself have a `Visit(CharacterElements)` overload?
- Is traversal depth-first, breadth-first, hierarchy order, or explicit authored order?
- Are duplicate references visited once or once per occurrence?
- Can a visitor mutate the child collection while traversing?
- Does one exception stop the traversal?
- Can nested calls re-enter the same aggregate?

If traversal is reusable across many operations, Composite or Iterator may be the real abstraction. If there are only two known components on one GameObject, direct calls can be clearer than maintaining `List<IVisitable>`.

## Results, state, and unsupported combinations

### Returning a result

Use a result-bearing visitor when processing is a query or transformation:

```csharp
public interface IGameVisitor<out TResult>
{
    TResult Visit(HealthComponent health);
    TResult Visit(ManaComponent mana);
}

public interface IGameElement
{
    TResult Accept<TResult>(IGameVisitor<TResult> visitor);
}
```

Each concrete element returns `visitor.Visit(this)`. Define whether a result is one value, an aggregate, an error type, or a mutable context accumulated across traversal.

### Stateful visitor

A visitor can accumulate totals or produce a report. Scope that state to one operation unless reuse is explicitly safe. Reusing one mutable visitor across entities, tests, scenes, or concurrent jobs can leak results.

For ScriptableObject-authored parameters, split the roles:

```text
PowerUpDefinition asset (shared immutable values)
  -> creates or configures
PowerUpApplication visitor/context (per application state)
  -> visits
Runtime components (entity-owned state)
```

### Unsupported combinations

Classic Visitor intentionally makes the element-operation matrix explicit. Choose one policy:

- Require every overload and gain compile-time coverage.
- Provide an abstract base visitor with intentional virtual no-op defaults.
- Return a supported/unsupported result.
- Throw a documented domain exception.
- Split element capabilities so visitors only target meaningful subsets.

Do not silently add default no-op handling just to reduce compile errors. Missing behavior then becomes difficult to observe in content-heavy Unity projects.

## Unity component and ScriptableObject boundaries

### Components

Keep scene discovery separate from Visitor dispatch. `GetComponent`, serialized references, VContainer composition, or a hierarchy binder may assemble the element set; Visitor should not become a service locator.

If the GameObject already has stable capability components, direct interfaces can be enough:

```csharp
public interface IHealable
{
    void RestoreHealth(int amount);
}
```

A power-up can call `IHealable` and `IManaReceiver` directly. This is simpler when the power-up knows the capabilities it needs and no external operation matrix is growing.

### ScriptableObjects

ScriptableObjects live independently of GameObjects and are naturally shared as assets. They work well for authored power-up definitions, but sharing is also the danger:

- Keep definition fields immutable at runtime.
- Do not store current target, elapsed duration, visit count, or per-entity state on a shared asset.
- If the visitor itself must be stateful, create a plain C# runtime visitor from the asset.
- Verify domain reload and test isolation when assets are modified in EditMode.

### Pickups

Pickup collision, Visitor application, feedback, and object lifetime are separate:

1. Validate the receiver and power-up definition.
2. Apply the operation atomically or define partial application.
3. Emit gameplay/UI/audio feedback only after the result is known.
4. Return the pickup to a pool or destroy it according to its lifecycle owner.

Use `dev-unity-object-pooling` only when reuse/reset behavior is in scope. Pooling does not justify Visitor.

## Reflective Visitor

The tutorial's reflective form roughly performs:

```csharp
MethodInfo method = GetType().GetMethod("Visit", new[] { element.GetType() });
method?.Invoke(this, new object[] { element });
```

### Costs and edge cases

- `GetMethod(string, Type[])` searches for a public method matching the requested parameter types.
- Runtime-type lookup can select or miss base/interface handlers according to binder rules; define and test exact, assignable, ambiguous, and fallback behavior explicitly.
- Repeated `Type[]` and `object[]` creation can allocate.
- `MethodInfo.Invoke` validates and boxes arguments as needed.
- An exception thrown by the handler surfaces through `TargetInvocationException`.
- Renaming `Visit` or changing signatures may fail only at runtime.
- Default no-op handling can hide missing coverage.
- Reflection-based references may not be visible to Unity's static linker analysis.
- Editor/Mono success does not establish IL2CPP Player correctness.

### If reflection is genuinely required

1. Specify handler visibility, inheritance, exact versus assignable matching, ambiguity, and precedence.
2. Discover and validate handlers at startup or build time, not on the first gameplay hit.
3. Cache resolved delegates by concrete element type when measurement shows lookup is material.
4. Preserve reflective entry points with the narrowest suitable `[Preserve]` or `link.xml` rules.
5. Report missing and ambiguous handlers loudly in development builds.
6. Unwrap or log the inner exception without erasing its stack context.
7. Test an actual IL2CPP Player at the project's active managed stripping level.

Prefer source-generated or explicit registration when runtime extension is needed but reflection's failure surface is unacceptable. Prefer classic typed Visitor when the family is closed.

## Unity object null and destruction

The video's final segment demonstrates a Unity-specific issue, not a Visitor rule.

`UnityEngine.Object` wraps a native object and overloads equality/truth checks. A destroyed native object can leave a managed wrapper that compares equal to null through Unity semantics while not being a C# null reference. C# `??` and `??=` cannot be overloaded, so they do not honor Unity's destroyed-object semantics.

Use:

```csharp
T component = gameObject.GetComponent<T>();
if (!component)
    component = gameObject.AddComponent<T>();
return component;
```

for a Unity-aware `GetOrAdd<T>` helper when adding the component is truly the desired ownership rule. Also consider:

- `TryGetComponent` when absence is valid and adding would be surprising.
- `[RequireComponent]` when the dependency must exist for a MonoBehaviour.
- serialized references or VContainer when composition should be explicit.

The visual demo uses `DestroyImmediate`. Unity documents it for editor code; runtime gameplay should use delayed `Object.Destroy`. Never copy the immediate-destruction call from the tutorial into pickup gameplay.

## Related skills and patterns

Compare skills by material concern, not rank:

| Skill | What it changes | Use together when | Do not load merely because |
|---|---|---|---|
| `dev-unity-stats-modifiers` | Stat phases, stacking, duration, source identity, removal | A visitor delivers a real stat modifier across heterogeneous targets | The tutorial happens to use health and mana numbers |
| `dev-unity-strategy-pattern` | Interchangeable algorithms behind one stable contract | A visitor delegates its per-element calculation to selectable strategies | Both are behavioral patterns |
| `dev-unity-gameplay-architecture` | Ownership, boundaries, state, communication, traversal | The element set or lifetime owner is still undecided | Visitor already has clear local ownership |
| `dev-unity-object-pooling` | Reuse, reset, collection checks, capacity | Pickup lifecycle must be pooled | A pickup exists in the example |
| `dev-unity-vcontainer` | Composition, registrations, lifetimes, factories | Visitors or traversal services require explicit composition | Dependency injection is not otherwise required |
| `dev-unity-performance-profiling` | Evidence and regression measurements | Reflection, allocation, or traversal scale is a claimed problem | Direct Visitor is assumed slow without evidence |
| `dev-unity-clean-code-principles` | Readability and maintainability review | The matrix is becoming hard to understand | Every pattern task automatically needs a second pattern lens |
| `dev-ponytail` | Minimum viable abstraction check | A direct call or switch may replace Visitor | Simplicity has already been established by evidence |

Related patterns:

- Composite owns tree/aggregate shape and recursive traversal.
- Iterator exposes traversal without exposing collection representation.
- Strategy swaps one algorithm; Visitor selects behavior by element type.
- Command packages an action and may support history, queueing, or undo.
- Observer broadcasts facts to listeners and has different lifetime/order semantics.
- State changes behavior with state transitions; it is not element-operation dispatch.

## Testing and verification

### EditMode matrix

For each element and visitor pair, verify:

- correct overload selected;
- wrong overload not selected;
- invocation count;
- result or side effect;
- unsupported policy;
- null visitor policy;
- visitor reuse/state reset;
- exception behavior.

Use test doubles that record which strongly typed overload ran. A single happy-path power-up test does not establish coverage of the matrix.

### Traversal tests

Verify:

- stable documented order;
- zero children;
- duplicate child references;
- nested aggregates;
- disabled or destroyed Unity components;
- collection mutation during a visit;
- exception or cancellation halfway through;
- whether the aggregate itself is visited.

### PlayMode tests

Use PlayMode only where Unity lifecycle is material:

- physics trigger delivery;
- delayed destruction at the end of the frame;
- pooled pickup reset;
- scene-loaded references;
- ScriptableObject sharing across instantiated entities.

### Reflective build tests

Editor tests are insufficient. Build and run the actual target backend, especially IL2CPP, with the project's managed stripping level. Exercise every reflective handler from a clean Player build.

### Performance checks

Profile before optimizing. Measure:

- number of elements visited per frame or event;
- direct interface Visitor versus type switch where it matters;
- reflection lookup and invocation separately;
- allocations from arrays, boxing, closures, and result aggregation;
- caching memory and initialization cost;
- whether the operation's real work dominates dispatch.

## Failure modes

### Visitor used for a single trivial operation

Symptom: multiple interfaces and classes replace two obvious calls.

Correction: use direct domain methods or a small type-pattern switch.

### Element family changes frequently

Symptom: every new component causes edits across many visitors.

Correction: move behavior to elements, split capability interfaces, or use a data-driven/runtime registration model if extension is real.

### Shared ScriptableObject stores traversal state

Symptom: one character's pickup affects another or tests depend on order.

Correction: keep the asset as definition data and create per-application runtime state.

### Visitor bypasses invariants

Symptom: fields become public and visitors mutate them directly.

Correction: expose narrow domain methods or a controlled context.

### Aggregate and Visitor responsibilities blur

Symptom: every visitor rediscovers components or scene children differently.

Correction: assign traversal to one aggregate/iterator owner and keep visitors focused on operations.

### Reflective default hides omissions

Symptom: a new element silently receives no behavior.

Correction: validate coverage at startup/build time or return to compile-time typed Visitor.

### Reflection works in Editor but fails in Player

Symptom: handlers are missing after IL2CPP/stripping.

Correction: use explicit typed references, preserve the narrow required members, and add actual Player-build tests.

### Null-coalescing used with destroyed Unity objects

Symptom: `??=` does not replace a destroyed component wrapper.

Correction: use Unity's overloaded boolean/equality semantics and avoid `DestroyImmediate` in gameplay.

## Primary sources

- [Video: Visitor: How I Mastered the Toughest Programming Pattern](https://www.youtube.com/watch?v=Q2gQs6gIzCM)
- [Microsoft: double dispatch and Visitor tradeoffs](https://learn.microsoft.com/en-us/archive/msdn-magazine/2011/june/msdn-magazine-working-programmer-multiparadigmatic-net-part-8-dynamic-programming)
- [Microsoft: ExpressionVisitor](https://learn.microsoft.com/en-us/dotnet/api/system.linq.expressions.expressionvisitor)
- [Microsoft: C# pattern matching](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/functional/pattern-matching)
- [Microsoft: Type.GetMethod](https://learn.microsoft.com/en-us/dotnet/api/system.type.getmethod)
- [Microsoft: MethodBase.Invoke](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.methodbase.invoke)
- [Microsoft: null-coalescing operators](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/null-coalescing-operator)
- [Unity 6.3: UnityEngine.Object](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.html)
- [Unity 6.3: Object.DestroyImmediate](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.DestroyImmediate.html)
- [Unity 6.3: ScriptableObject](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ScriptableObject.html)
- [Unity 6.3: managed code stripping](https://docs.unity3d.com/6000.3/Documentation/Manual/ManagedCodeStripping.html)
- [Unity 6.3: SerializeReference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SerializeReference.html)
- [Unity Test Framework 1.1](https://docs.unity3d.com/Packages/com.unity.test-framework@1.1/manual/index.html)
