# Unity Stats and Modifiers Guide

## Contents

- [Evidence base](#evidence-base)
- [What the broker chain is](#what-the-broker-chain-is)
- [Production corrections](#production-corrections)
- [Model comparison](#model-comparison)
- [Stat vocabulary](#stat-vocabulary)
- [Deterministic math](#deterministic-math)
- [Stacking and source identity](#stacking-and-source-identity)
- [Lifetime and expiry](#lifetime-and-expiry)
- [Implementation shapes](#implementation-shapes)
- [Events and broker queries](#events-and-broker-queries)
- [ScriptableObject authoring](#scriptableobject-authoring)
- [Notifications and UI](#notifications-and-ui)
- [Persistence](#persistence)
- [Performance and collections](#performance-and-collections)
- [Failure modes](#failure-modes)
- [Verification matrix](#verification-matrix)
- [Primary documentation](#primary-documentation)

## Evidence base

The tutorial [EASY Stats and Modifiers in Unity | Broker Chain Pattern](https://www.youtube.com/watch?v=gYYfrtq6MrA) was analyzed from its complete English auto-generated captions and targeted code/diagram frames.

Verified sequence:

- `00:00-00:32`: describes a broker chain as a mediator combined with ideas from Chain of Responsibility.
- `00:35-01:19`: demonstrates additive, multiplicative, positive, and negative timed modifiers with UI icons.
- `01:20-02:03`: diagrams `Entity -> Stats -> StatsMediator -> StatModifier`, with ScriptableObject base stats.
- `02:19-03:43`: creates a stat façade, mutable query object, modifier collection, and mediator.
- `03:46-04:35`: uses `EventHandler<Query>` and registers each modifier's `Handle` method into the query event.
- `04:44-07:57`: gives modifiers timers, mark/removal state, an `OnDispose` event, mediator ticking, linked-list traversal, and cleanup.
- `08:02-08:50`: computes each public stat by starting a query with the base value and returning the mutated result.
- `08:52-09:35`: implements a basic modifier with a stat type and `Func<int,int>` operation.
- `09:40-12:54`: applies modifiers through pickups and the Visitor pattern; the speaker explicitly treats Visitor and pooling as separate options.
- `12:56-14:57`: wires per-entity stats, sends `Time.deltaTime` to the mediator, and demonstrates stacking/expiry.
- `15:00-15:51`: sketches equipment modifiers and marks the exact instance for removal on unequip.

One requested frame at `09:35` failed with a YouTube HTTP 403, so the final assignment inside `Handle` is caption-supported rather than visually verified. The surrounding class, constructor, method signature, and type check were frame-verified.

## What the broker chain is

The demonstrated system is best understood as a brokered modifier pipeline:

1. `Stats` owns base data and asks the mediator to evaluate an effective value.
2. `StatsMediator` owns active modifier registrations and their lifetimes.
3. A mutable `Query` carries stat identity and current value.
4. Every registered handler sees the same query synchronously.
5. Matching modifiers mutate the query value in registration order.

This differs from a classic Chain of Responsibility that often stops once one handler accepts a request or explicitly forwards it. Here, all matching modifiers usually contribute. The event is an implementation mechanism, not a requirement.

## Production corrections

The tutorial is a useful compact demonstration, but production code should address these gaps:

- Registration order silently defines add/multiply order.
- A multicast event duplicates membership already stored in the linked list.
- One handler exception prevents later handlers from running.
- `IDisposable` should be idempotent; cleanup events must not fire repeatedly.
- `Func<int,int>` closures are not durable, inspectable, or naturally serializable modifier definitions.
- `0` or `-1` as permanent-duration sentinels are easy to misuse.
- Linked lists allocate nodes and are not automatically faster than contiguous collections.
- Recomputing on every property read is O(active modifiers); UI polling can multiply that cost.
- Per-modifier frame ticking and a second cleanup pass may be unnecessary at small scale and expensive at large scale.
- ScriptableObject base data is shared; per-entity runtime values and active effects must not live in it.
- Pickup Visitor code, pooling, icons, audio, and equipment integration are separate concerns.

## Model comparison

| Model | Benefit | Main drawback | Prefer when | Reject when |
| --- | --- | --- | --- | --- |
| Direct fields/formula | Smallest surface and easiest debugging | Caller owns every rule | Stats are few and fixed | Independent effects, stacking, or lifetimes are real requirements |
| Direct ordered list | Explicit order, one source of membership truth | O(n) evaluation on each read | Modifier counts are modest and deterministic evaluation matters | Reads dominate and changes are rare enough to justify caching |
| Broker/event query | Late-bound registration and loose knowledge of concrete modifier types | Hidden order, synchronous exception coupling, duplicate bookkeeping | Other independent handlers must attach/detach through an event contract | The mediator already owns and can directly iterate every modifier |
| Cached dirty values | Very cheap repeated reads | Correct invalidation and derived-stat dependencies are harder | UI/gameplay reads are frequent and modifier changes are relatively rare | Modifiers depend on continuous runtime context or reads are sparse |
| Mutation-time accumulation | Cheap reads and simple flat adds | Removing/reordering nonlinear operations requires recomputation or inverse math | All operations have safe reversible aggregation | Multipliers, overrides, clamps, dependencies, or conditional effects exist |
| ScriptableObject definitions | Designer-friendly shared authored data | Shared mutable-state and asset-sprawl risks | Effects need Inspector tuning, icons, tags, or reuse | Runtime-only logic is simpler and no asset workflow is needed |
| Strategy operations | Interchangeable complex formulas | More types and indirection | Formula behavior genuinely varies beyond structured operations | An enum/phase/magnitude record fully describes the effect |
| Central tick/expiry queue | Scales timing ownership and avoids many MonoBehaviour updates | Scheduler complexity and time-source policy | Timed effects are numerous or centrally coordinated | Modifier counts are small and a local update is clear |

These models and their skills can be combined when each owns a distinct concern. Do not assign permanent primary/supporting ranks.

## Stat vocabulary

Define terms in the project instead of using `current` ambiguously:

- **Base stat:** authored or progression-derived starting value before temporary modifiers.
- **Effective stat:** base value after all applicable modifiers and final bounds.
- **Current resource:** mutable amount such as current HP or mana; this is not automatically a modifier.
- **Maximum resource:** often an effective stat that can itself be modified.
- **Derived stat:** calculated from other stats, such as attack power from strength and weapon damage.
- **Modifier definition:** stable data describing an effect type, magnitude, tags, stack policy, and optional asset presentation.
- **Active modifier instance:** owner-specific runtime registration with source identity, remaining duration, sequence, and stacks.
- **Source:** item, ability, aura, pickup, talent, environment, or server grant that owns the active instance.

When maximum HP changes, define whether current HP preserves its absolute value, preserves its percentage, gains the delta, or clamps only. There is no universal answer.

## Deterministic math

Choose and document an explicit pipeline. One common example is:

1. start from base;
2. apply flat additions;
3. apply percentages of base;
4. apply additive percentage subtotal;
5. apply multiplicative factors;
6. apply overrides or selection rules;
7. apply min/max constraints;
8. clamp to final domain;
9. round once.

This is an example, not a universal formula. The design decides whether `+20%` means 20% of base, current subtotal, or another source.

Use values that expose ordering in tests. Starting from `10`:

- multiply by `2`, then add `-10` gives `10`;
- add `-10`, then multiply by `2` gives `0`.

If event registration order decides between those results, the gameplay rule is hidden. Prefer an explicit phase/priority sort or aggregate each phase separately.

Define tie-breakers:

- numeric priority;
- insertion sequence;
- stable effect ID;
- source ID;
- explicit authored order.

Never sort by Unity object instance ID for durable gameplay semantics.

## Stacking and source identity

Common stack policies:

- **Independent:** every application is a separate instance.
- **Unique by effect:** a second application is rejected or replaces the existing instance.
- **Unique by source:** each source may own one instance.
- **Refresh:** preserve magnitude/stacks and reset remaining duration.
- **Extend:** add duration up to an optional cap.
- **Stack magnitude:** increase stack count or magnitude, often with a maximum.
- **Replace strongest:** keep the strongest magnitude and define duration behavior.
- **Replace newest:** replace old instance and sequence.

Define equality around stable effect and source IDs. Do not rely only on asset names, list indexes, delegate identity, or floating-point magnitude.

Registration should return a handle that targets the exact active instance. Unequipping one sword must not remove another sword's modifier merely because their definitions match.

## Lifetime and expiry

Define:

- scaled, unscaled, fixed-step, server, turn, or manual time;
- whether pause freezes duration;
- whether `remaining == 0` applies on the current evaluation or expires first;
- behavior for a delta larger than remaining duration;
- refresh/extend behavior;
- scene unload, death, disable, respawn, and owner-destruction policy;
- permanent effects as an explicit duration mode.

Keep removal idempotent:

```csharp
public sealed class ModifierHandle : IDisposable
{
    private Action remove;

    public ModifierHandle(Action remove)
    {
        this.remove = remove;
    }

    public void Dispose()
    {
        Action action = remove;
        if (action == null)
            return;

        remove = null;
        action();
    }
}
```

This handle owns deregistration; the modifier definition can remain plain data. Production code should validate null actions and decide thread policy.

Defer removals encountered during evaluation or ticking, or iterate nodes using a stored `next` reference before removal. Do not mutate a standard collection through `foreach`.

## Implementation shapes

### Structured runtime instance

```csharp
public enum ModifierPhase
{
    Flat,
    PercentOfBase,
    Multiply,
    Override,
    Clamp
}

public sealed class ActiveModifier
{
    public string EffectId;
    public string SourceId;
    public StatId Stat;
    public ModifierPhase Phase;
    public int Priority;
    public long Sequence;
    public float Magnitude;
    public float RemainingSeconds;
}
```

Use project-specific stable ID types rather than strings when available. Separate permanent duration from a float sentinel.

### Direct evaluator

```csharp
public float Evaluate(StatId stat, float baseValue)
{
    float value = baseValue;

    foreach (ActiveModifier modifier in orderedModifiers)
    {
        if (modifier.Stat != stat)
            continue;

        value = Apply(value, baseValue, modifier);
    }

    return FinalizeValue(stat, value);
}
```

This direct loop is often clearer than an internal event because the same owner already stores every modifier. Keep `Apply` pure when possible.

### Broker query

If late-bound handlers are required, a query should carry explicit inputs and result state:

```csharp
public sealed class StatQuery : EventArgs
{
    public StatQuery(StatId stat, float baseValue)
    {
        Stat = stat;
        BaseValue = baseValue;
        Value = baseValue;
    }

    public StatId Stat { get; }
    public float BaseValue { get; }
    public float Value { get; set; }
}
```

Document registration order, exception policy, reentrancy, and allowed mutation. If handlers need phases, the mediator may need separate events or an ordered registry; at that point a direct pipeline is often simpler.

### Cached values

Mark affected stats dirty on:

- modifier add/remove/refresh/stack change;
- base stat change;
- relevant dependency change;
- clock/context change for conditional effects.

Recompute lazily on read or eagerly at mutation boundaries. Publish one coherent changed event after recomputation.

## Events and broker queries

C# multicast delegates invoke handlers synchronously in invocation-list order. If a handler throws and the exception is not caught, later handlers are not invoked. Mutable query state therefore makes both order and exception policy part of gameplay correctness.

When using events:

- subscribe and unsubscribe the exact same delegate;
- prevent duplicate registration unless duplicate application is intentional;
- keep one authoritative membership store;
- decide whether handlers may register/remove handlers during dispatch;
- define reentrancy behavior if evaluating a stat requests another stat;
- guard dependency cycles between derived stats;
- avoid exposing the event publicly when only the mediator should publish queries.

Do not use `IDisposable` as a vague synonym for “expired.” Use it for an idempotent registration/cleanup contract and keep expiry state explicit.

## ScriptableObject authoring

Good asset contents:

- base stat tables;
- modifier definition IDs and display metadata;
- operation phase, magnitude, tags, stack policy, duration mode;
- icons, localization keys, and prefab/audio references when presentation owns them.

Keep outside shared assets:

- current HP/mana;
- active stacks and source IDs;
- remaining duration;
- owner or target scene references;
- linked-list nodes, handles, delegates, timers, and subscriptions.

Duplicate assets create new definitions, not automatically new runtime instances. Validate unique IDs and ranges in editor tooling or tests.

## Notifications and UI

Prefer a change record that identifies:

- stat ID;
- old and new effective value;
- reason/source when useful;
- whether a full refresh is required.

Avoid having UI recompute every stat every frame when changes are discrete. Conversely, do not emit an event after every internal phase; observers should see a coherent final value.

Buff icons need their own presentation identity and lifetime. The stat core should not own animation, sound, tooltip, or hierarchy details unless the project explicitly combines those responsibilities.

## Persistence

Persist only when required. Use stable data such as:

- effect definition ID;
- source ID;
- stacks;
- remaining duration or expiry timestamp;
- versioned custom payload when necessary.

Do not serialize delegates, lambdas, event subscriptions, collection nodes, transient handles, or raw Unity scene references. On load, validate definitions, rebuild registrations, restore deterministic sequence/priority, and decide offline-time progression.

## Performance and collections

Measure representative counts and access patterns.

- A simple `List<T>` is often cache-friendly and sufficient for dozens of effects.
- `LinkedList<T>.Remove(node)` is O(1) when the exact node is retained, but each node is a separate object and value-based search is O(n).
- A dictionary helps exact source/effect lookup but does not define evaluation order.
- Recompute-on-read costs O(applicable modifiers) per read.
- Cached values trade read cost for invalidation complexity.
- Per-frame ticking costs O(timed modifiers); an expiry queue may help when most effects are idle.
- Delegate invocation and closures add indirection and may allocate during registration or modifier construction.

Use `dev-unity-csharp-collections-queries` for detailed collection/allocation decisions, `dev-unity-player-loop-systems` for centralized timing ownership, and `dev-unity-performance-profiling` before claiming a faster design.

## Failure modes

- Accidental add/multiply ordering through subscription sequence.
- Two identical item effects cannot be removed independently.
- Repeated `Dispose` fires cleanup multiple times.
- A shared ScriptableObject stores one player's remaining duration.
- Permanent duration uses an undocumented negative sentinel.
- UI polling triggers many complete evaluations per frame.
- One handler exception silently skips later modifiers.
- Modifier application mutates the collection being enumerated.
- Derived stats form a recursive cycle.
- Float rounding differs between preview, gameplay, and saved state.
- Current resource behavior is undefined when maximum changes.
- A modifier delegate captures a destroyed scene object.
- Save data stores transient runtime types instead of stable definitions.
- Visitor, pooling, DI, Strategy, or events are added even though a direct operation would work.

## Verification matrix

### Numerical

- Every phase in isolation.
- Mixed phases with order-sensitive values.
- Negative, zero, very large, NaN, infinity, overflow, rounding, and clamp boundaries.
- Derived-stat dependency and cycle policy.

### Stacking

- Same effect/same source.
- Same effect/different source.
- Refresh, extend, replace, strongest, independent, and max-stack behavior.
- Stable tie-break after save/load or deterministic replay when required.

### Lifetime

- Immediate, zero, permanent, manual, timed, and owner-scoped effects.
- Exact expiry frame and large delta.
- Pause/time-scale behavior.
- Repeated handle disposal.
- Disable, death, scene unload, and respawn.

### Integration

- Equipment removes only its own registration.
- Pickups apply once even with repeated trigger messages.
- UI receives one coherent result and icon cleanup remains separate.
- Shared assets do not leak runtime state across entities.
- Save/load rebuilds valid registrations when persistence is in scope.

### Robustness and performance

- Handler exception and reentrancy policy.
- Mutation during dispatch/tick.
- Representative modifier counts and read/tick frequency.
- Allocation profile for registration, evaluation, expiry, and notification.

## Primary documentation

- [Microsoft Learn: C# delegate invocation order and exception behavior](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/delegates)
- [Microsoft Learn: Subscribe to and unsubscribe from events](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events)
- [Microsoft Learn: Implement a Dispose method](https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/implementing-dispose)
- [Microsoft Learn: LinkedList<T>](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.linkedlist-1)
- [Unity 6.3 Scripting API: ScriptableObject](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ScriptableObject.html)
- [Unity 6.3 Scripting API: Time.deltaTime](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Time-deltaTime.html)
- [Unity Test Framework manual](https://docs.unity3d.com/Packages/com.unity.test-framework@1.1/manual/index.html)
