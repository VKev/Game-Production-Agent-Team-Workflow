# Unity Strategy Pattern Guide

## Evidence base

The source tutorial, [Clean Code using the Strategy Pattern](https://www.youtube.com/watch?v=QrxiD2dfdG4), was analyzed from its complete English auto-generated captions and targeted frames rather than from captions alone.

Verified tutorial sequence:

- `00:00-01:18`: replaces a spell-selection branch with interchangeable spell behavior and introduces the client/strategy relationship.
- `01:35`: shows `SpellStrategy : ScriptableObject` as the abstract strategy asset.
- `02:28`: shows `ShieldSpellStrategy : SpellStrategy` with prefab and duration configuration.
- `02:49`: shows `Hero` holding a serialized strategy array, subscribing in `OnEnable`, unsubscribing in `OnDisable`, and executing by index.
- `04:37-05:30`: separates complex projectile construction into a Builder while the strategy still chooses spell behavior.
- `06:32-10:33`: adds an orbital strategy with configurable count, radius, duration, and DOTween rotation.
- `11:22-12:19`: demonstrates designer-authored variants by duplicating and reconfiguring ScriptableObject assets, then suggests composed strategies.

Corrections and limits:

- Strategy does not automatically make code clean or satisfy every SOLID principle.
- A switch is not itself evidence that Strategy is warranted.
- The tutorial's strategy array is concise but couples UI ordering to behavior ordering and lacks bounds/null validation.
- ScriptableObject assets are shared objects; runtime mutation needs deliberate state isolation.
- Builder and DOTween solve separate concerns. Their presence does not make them part of Strategy.
- Cooldowns, cancellation, failure reporting, pooling, and robust object ownership are outside the tutorial and must be designed when required.

## Adoption test

Strategy is a strong candidate when all of these are true:

1. There is a real family of at least two substitutable behaviors or algorithms.
2. The caller should depend on a stable capability rather than concrete variants.
3. Selection can change independently from execution.
4. New variants are expected, runtime swapping matters, or designer-authored assets have clear value.
5. The extra types, references, and indirection cost less than repeated branching and coupling.

Keep a direct solution when one or more of these are true:

- there is one implementation and no credible second variant;
- the choice set is closed, tiny, stable, and local;
- variants need incompatible inputs or outputs and do not substitute honestly;
- the strategy context would expose most of the game as a service locator;
- asset proliferation or navigation cost would exceed designer benefit;
- selection and execution are inseparable domain logic;
- a prefab, factory, data table, or component composition already expresses the variation clearly.

## Comparison matrix

| Candidate | Benefit | Main drawback | Prefer when | Reject when |
| --- | --- | --- | --- | --- |
| Direct branch | Minimum indirection and fewest types | Caller changes when cases change | Choices are few, closed, stable, and local | Variants grow independently or require swapping/testing in isolation |
| Strategy | Interchangeable behavior behind one contract | More types, indirection, and communication design | Algorithms or behaviors vary independently from the caller | Implementations do not share an honest contract |
| State | Owns entry, update, exit, and transitions tied to lifecycle state | State-machine structure and transition complexity | Behavior depends on an object's current state and transitions | The caller only selects an algorithm for one operation |
| Command | Represents a request that can be queued, logged, replayed, scheduled, or undone | Command objects and history/queue lifecycle | The action itself must be stored or manipulated | Only the implementation of an immediate operation varies |
| Factory or prefab | Centralizes selection/creation of fixed products or authored hierarchies | Does not describe later behavior substitution | The problem is which product to create | The existing object must swap algorithms or behaviors |
| Builder | Makes complex, ordered, or validated construction readable | Adds a construction API and possible mutable builder state | Creating one product requires many optional or ordered steps | Construction is simple or the real problem is behavior selection |
| VContainer | Composes dependencies and lifetimes explicitly | Container setup and indirection | Strategies are services with composition/lifetime requirements | Serialized references or direct construction are clearer |
| Object pool | Reuses instances and formalizes reset/return lifecycle | Pool ownership and reset correctness | Executing behavior repeatedly creates costly reusable objects | Objects are rare, cheap, or not safely reusable |
| ScriptableObject data only | Designer-friendly shared configuration without polymorphic behavior | Caller still owns behavior branching | Data varies but logic remains identical | Algorithms themselves must be interchangeable |
| `[SerializeReference]` | Inline polymorphic plain C# graphs owned by one host | More fragile authoring, type migration, and Inspector complexity | Strategies should be embedded and not shared as assets | Shared project assets or Unity object references are required |

These approaches and their skills can be combined when each changes a distinct concern. Do not designate a permanent winner or load every adjacent skill.

## Contract shapes

### Plain C# contract

```csharp
public interface IAttackStrategy
{
    AttackResult Execute(in AttackContext context);
}

public readonly struct AttackContext
{
    public AttackContext(Transform origin, Transform target, float power)
    {
        Origin = origin;
        Target = target;
        Power = power;
    }

    public Transform Origin { get; }
    public Transform Target { get; }
    public float Power { get; }
}
```

Use a small context when several stable execution inputs travel together. Use explicit parameters when there are only one or two. Return a result or handle if callers need to react to failure or own cleanup.

### ScriptableObject strategy asset

```csharp
public abstract class AttackStrategy : ScriptableObject
{
    public abstract AttackResult Execute(in AttackContext context);
}

[CreateAssetMenu(menuName = "Combat/Attacks/Projectile")]
public sealed class ProjectileAttackStrategy : AttackStrategy
{
    [SerializeField] private GameObject projectilePrefab;
    [SerializeField, Min(0f)] private float speed = 10f;

    public override AttackResult Execute(in AttackContext context)
    {
        // Use authored configuration plus context inputs.
        // Return ownership or failure explicitly in production code.
    }
}
```

The asset may safely contain immutable authored configuration and Unity object references. Do not store the current target, owner, remaining cooldown, active tween, spawned projectile, or per-cast counter on this shared asset.

### Runtime execution object

When an operation spans time, let the strategy create or configure a separate execution object/handle. That object can own cancellation, tween/coroutine handles, pooled leases, current targets, and completion. The strategy asset remains reusable configuration.

## Interface, abstract asset, or managed reference

Choose an interface when:

- implementers cross unrelated class hierarchies;
- runtime construction and tests matter more than Inspector authoring;
- no shared base state or implementation is required.

Choose an abstract ScriptableObject when:

- variants must be assets assignable in the Inspector;
- designers duplicate and tune configurations;
- Unity object references need direct asset serialization;
- the same configured strategy is shared by several clients.

Choose `[SerializeReference]` when:

- polymorphic plain C# strategies belong to one serialized host;
- sharing between Unity objects is not required;
- the team accepts managed-reference authoring and migration costs.

## Selection design

The selector can be player input, AI policy, difficulty, equipment, environment, or authored configuration. Keep it outside each strategy unless strategy chaining is an explicit requirement.

Prefer:

- a serialized direct reference when only one current strategy exists;
- a dictionary or stable identifier when lookup is data-driven;
- a typed option record binding UI label/icon/cooldown to one strategy;
- explicit validation for missing, duplicate, or incompatible entries.

Be careful with parallel arrays and raw integer indexes. They are simple but make correctness depend on order. If used, bounds-check and validate every element.

## Composition

Compose strategies only when independent axes truly vary, such as target selection plus attack execution. Give each axis its own narrow contract. Avoid deeply nested asset graphs that make runtime behavior hard to trace.

Examples:

- `ITargetStrategy` chooses a target; `IAttackStrategy` acts on it.
- `IMovementStrategy` computes movement; a State object owns enter/exit transitions.
- `IAttackStrategy` asks a Builder to construct a complex projectile.
- A strategy requests a pooled projectile through an explicit collaborator.

## Common failure modes

- **Class and asset sprawl:** many tiny subclasses/assets are harder to search and review than one honest branch.
- **False substitutability:** each implementation needs unrelated context fields or special caller checks.
- **Mutable asset leakage:** one actor changes a shared strategy asset and affects others or persists Editor state.
- **Hidden service locator:** a broad context exposes every manager so strategies can reach anything.
- **Order coupling:** UI button index silently selects a different strategy after list reordering.
- **Lifecycle leaks:** events, tweens, async tasks, spawned objects, or pooled leases outlive their owner.
- **Allocation churn:** new strategies, closures, or execution objects are created in a hot loop without evidence.
- **Pattern stacking:** Strategy, Builder, Factory, DI, pooling, and events are added together before each solves a proven concern.
- **Weak diagnostics:** logs identify only the client, not the selected strategy asset/type and execution result.

## Verification checklist

- Contract tests run against each concrete strategy.
- Selection tests prove the correct strategy is chosen without retesting its internals.
- Invalid configuration returns a clear failure or validation error.
- Shared ScriptableObject use across multiple actors has no mutable-state leakage.
- Asset duplication creates a new configuration variant without unintended code changes.
- Domain reload and serialization preserve references and configuration.
- Event subscriptions, cancellation, tween cleanup, spawned-object ownership, and pool returns are verified when present.
- Direct baseline and strategy version produce equivalent behavior before the refactor expands.
- Performance claims have profiler evidence rather than pattern-based assumptions.

## Primary documentation

- [Unity Learn: Strategy pattern](https://learn.unity.com/tutorial/strategy-pattern?version=6.0)
- [Unity: Use ScriptableObjects as delegate objects](https://unity.com/how-to/scriptableobjects-delegate-objects)
- [Unity 6.3 Scripting API: ScriptableObject](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ScriptableObject.html)
- [Unity Scripting API: SerializeReference](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SerializeReference.html)
- [Unity Learn: State programming pattern](https://learn.unity.com/course/design-patterns/tutorial/develop-a-modular-flexible-codebase-with-the-state-programming-pattern)
- [Microsoft Learn: Interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [Microsoft Learn: Abstract types and interfaces](https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/abstractions-abstract-types-and-interfaces)
