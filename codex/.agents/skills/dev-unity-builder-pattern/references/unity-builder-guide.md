# Unity Builder Pattern Guide

## Contents

- [Evidence base](#evidence-base)
- [Selection matrix](#selection-matrix)
- [Production design rules](#production-design-rules)
- [Unity-compatible pattern sketches](#unity-compatible-pattern-sketches)
- [Validation matrix](#validation-matrix)
- [Primary documentation](#primary-documentation)

## Evidence base

This guide was synthesized on 2026-08-11 from the YouTube tutorial [When, Why, and How to use Builder and Fluent Builder Programming Patterns](https://www.youtube.com/watch?v=Wud_ooJKdzU) and the primary documentation linked below.

The video exposed English auto-generated captions. Spoken claims came from those captions; visual code claims were checked with targeted frames rather than a broad video scrape:

- `00:48-01:14`: long parameter lists and telescoping constructors are presented as builder smells.
- `01:14-01:43`: a fluent builder stores pending values, returns itself from configuration methods, and finishes with `Build()`.
- `01:30`: the frame shows overloaded `Enemy` constructors beside an `EnemyBuilder.WithName(...)` method returning `this`.
- `01:44-01:59`: the tutorial correctly routes `MonoBehaviour` construction through `GameObject` plus `AddComponent`.
- `03:08-03:39`: a builder is extended toward component and strategy assembly.
- `03:48-06:05`: a dictionary-heavy lobby request is wrapped by a fluent builder to make the call site easier to read.
- `05:58`: the frame directly compares the short fluent chain with the nested dictionary/object construction it replaces.
- `06:20-08:28`: a director calls builder steps in sequence for runtime enemy component assembly.
- `07:55`: the frame shows `EnemyDirector.Construct(...)`, an `EnemyBuilder`, component addition, and builder reset after `Build()`.
- `08:30-10:31`: a step builder returns a different interface at each stage so only the final interface exposes `Build()`.
- `09:50`: the frame verifies the interface-return chain and the builder implementing all step contracts.
- `10:18-10:31`: the tutorial notes that many step interfaces can become overwhelming.
- `10:36-11:29`: it suggests caching the director and builder for reuse.

Treat auto-caption spellings of APIs and identifiers as provisional. Verify symbols in source or official documentation.

### Production corrections

- Treat “more than four constructor parameters” as a review prompt, not a rule. Parameter cohesion, optionality, invariants, and call-site clarity matter more than the count.
- A builder improves construction readability and validation; it does not inherently reduce allocations. Creating a `GameObject`, adding components, dictionaries, or products still allocates.
- Do not subclass a `MonoBehaviour` product just to reach private setters. Prefer a product-owned `Initialize(...)` boundary, a plain configuration value, a nested builder for plain C# products, or assembly-scoped collaboration.
- A cached mutable builder must reset all scalar fields, collections, references, and partially built Unity objects. Reuse is unsafe when builds can overlap or re-enter.
- Repeated enemy or effect spawning is a pooling decision. Unity documents pooling as a way to reduce repetitive create/destroy CPU cost.
- A step builder provides compile-time ordering but can create an interface explosion. Use runtime validation when ordering is not truly part of the API contract.
- Unity 6.3 documents which C# features its compiler supports and excludes. Verify `init`, `required`, and other version-sensitive syntax against that exact compiler page and the project's successful compilation before adopting an example.

## Selection matrix

| Construction need | Prefer | Avoid a builder when |
|---|---|---|
| A few stable optional arguments | Named or optional arguments | Names and defaults already make the call clear |
| Simple plain C# data with accessible members | Object initializer | No cross-field validation or hidden construction exists |
| A few named, fixed variants | Static factory or factory object | There is no stepwise configuration |
| Authored Unity component hierarchy | Prefab or prefab variant | The hierarchy should remain visible and editable in Unity |
| Shared authored configuration | `ScriptableObject` recipe plus factory/builder | The asset itself is being mistaken for per-instance state |
| Many optional values with domain defaults | Fluent builder | It only duplicates setters without validation or clarity |
| Repeatable ordered assembly recipe | Builder plus director | The director merely forwards one call |
| Mandatory compile-time sequence | Step builder | Runtime validation is sufficient or steps change often |
| High-frequency spawn/despawn | Pool, optionally configured by a builder | Builder reuse is proposed as a substitute for pooling |

## Production design rules

### Separate responsibilities

- Product: own valid runtime state and invariant enforcement.
- Builder: collect construction inputs and create one valid product.
- Director: name and execute reusable build recipes.
- Factory: select a concrete product or construction strategy in one operation.
- Pool: own reuse and release of product instances.
- DI container: compose services and lifetimes; do not disguise a service locator as a builder.

### Make state semantics explicit

Choose one contract and document it:

1. Fresh builder: instantiate, configure, build, discard.
2. Resetting builder: `Build()` returns a product and resets all pending state.
3. One-shot builder: reject configuration or a second `Build()` after completion.

Do not let `Build()` sometimes reuse a product and sometimes create a new one. If pooling is involved, name the operation to reflect acquisition, such as `GetConfigured()`.

### Keep defaults and validation together

- Use defaults that are valid and unsurprising.
- Validate required inputs before mutating Unity scene state when possible.
- Validate cross-field combinations in one place.
- Reject duplicate dictionary keys or component conflicts deliberately.
- Return a fully usable product or fail; do not leak a half-configured product.

### Respect Unity lifecycle and serialization

- Instantiate a prefab when the component graph is authored content.
- Use `new GameObject(...).AddComponent<T>()` only when a code-authored hierarchy is intentional.
- Do not rely on C# constructors for serialized `MonoBehaviour` state or Unity event ordering.
- Treat `ScriptableObject` recipes as shared references; copy mutable per-instance values into runtime state.
- Account for `Awake` and `OnEnable` running during instantiation or component addition. If consumers require configuration before enable-time work, use an inactive prefab/root, a controlled initialization phase, or a factory-specific lifecycle.
- Pair frequent runtime construction with `UnityEngine.Pool.ObjectPool<T>` or a project pool when profiling shows create/destroy cost.

## Unity-compatible pattern sketches

These sketches avoid `init` and `required` so they remain compatible with Unity 6.3 defaults. Adapt naming, namespaces, error handling, and assembly boundaries to the project.

### Plain C# fluent builder

```csharp
using System;

public sealed class EnemySpec
{
    public string Name { get; }
    public int Health { get; }
    public float Speed { get; }

    public EnemySpec(string name, int health, float speed)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));
        if (health <= 0)
            throw new ArgumentOutOfRangeException(nameof(health));
        if (speed < 0f)
            throw new ArgumentOutOfRangeException(nameof(speed));

        Name = name;
        Health = health;
        Speed = speed;
    }
}

public sealed class EnemySpecBuilder
{
    private string _name = "Enemy";
    private int _health = 100;
    private float _speed = 3f;

    public EnemySpecBuilder WithName(string value)
    {
        _name = value;
        return this;
    }

    public EnemySpecBuilder WithHealth(int value)
    {
        _health = value;
        return this;
    }

    public EnemySpecBuilder WithSpeed(float value)
    {
        _speed = value;
        return this;
    }

    public EnemySpec Build() => new EnemySpec(_name, _health, _speed);
}
```

Keep validation in the product constructor even if `Build()` also reports friendlier domain errors. This prevents other construction paths from bypassing invariants.

### Prefab-backed `MonoBehaviour` builder

```csharp
using System;
using UnityEngine;

public sealed class Enemy : MonoBehaviour
{
    public void Initialize(EnemyDefinition definition, IWeaponStrategy weapon)
    {
        // Copy validated per-instance state. Do not retain mutable shared state accidentally.
    }
}

public sealed class EnemyBuilder
{
    private readonly Enemy _prefab;
    private EnemyDefinition _definition;
    private IWeaponStrategy _weapon;

    public EnemyBuilder(Enemy prefab) => _prefab = prefab;

    public EnemyBuilder From(EnemyDefinition definition)
    {
        _definition = definition;
        return this;
    }

    public EnemyBuilder WithWeapon(IWeaponStrategy weapon)
    {
        _weapon = weapon;
        return this;
    }

    public Enemy Build(Transform parent = null)
    {
        if (_definition == null)
            throw new InvalidOperationException("Enemy definition is required.");

        var enemy = UnityEngine.Object.Instantiate(_prefab, parent);
        try
        {
            enemy.Initialize(_definition, _weapon);
            return enemy;
        }
        catch
        {
            UnityEngine.Object.Destroy(enemy.gameObject);
            throw;
        }
    }
}
```

Prefer a prefab when artists or designers own the hierarchy. If a pool owns instances, configure the object after `Get()` and reset it before `Release()` instead of instantiating here.

### Director for a meaningful recipe

```csharp
public sealed class EnemyDirector
{
    public Enemy BuildBoss(EnemyBuilder builder, EnemyDefinition definition)
    {
        return builder
            .From(definition)
            .WithWeapon(definition.BossWeapon)
            .Build();
    }
}
```

Keep the director only if names such as `BuildBoss`, `BuildTutorialEnemy`, or `BuildNetworkReplica` capture reusable domain recipes. Otherwise call the builder directly.

### Step builder for a hard sequence

```csharp
using System;

public interface IEnemyDefinitionStep
{
    IEnemyWeaponStep From(EnemyDefinition definition);
}

public interface IEnemyWeaponStep
{
    IEnemyFinalStep WithWeapon(IWeaponStrategy weapon);
}

public interface IEnemyFinalStep
{
    Enemy Build();
}

public sealed class OrderedEnemyBuilder :
    IEnemyDefinitionStep,
    IEnemyWeaponStep,
    IEnemyFinalStep
{
    private EnemyDefinition _definition;
    private IWeaponStrategy _weapon;

    public IEnemyWeaponStep From(EnemyDefinition definition)
    {
        _definition = definition;
        return this;
    }

    public IEnemyFinalStep WithWeapon(IWeaponStrategy weapon)
    {
        _weapon = weapon;
        return this;
    }

    public Enemy Build()
    {
        // Instantiate or obtain the product, then initialize it.
        throw new NotImplementedException();
    }
}
```

Do not add a separate interface for every optional choice. Step interfaces are for required transitions that should be impossible to skip at compile time.

## Validation matrix

| Area | Minimum verification |
|---|---|
| Defaults | Build with no optional calls and assert every default |
| Required inputs | Omit each required input and assert a clear failure |
| Cross-field rules | Exercise every invalid combination and boundary |
| Fluent API | Verify each method returns the intended next type or builder instance |
| Reuse | Build twice with different inputs and prove no state leaks |
| Collections | Verify duplicate handling and that a prior build does not share mutable pending data |
| Unity components | Assert exact required components, references, values, and no unintended duplicates |
| Lifecycle | Verify `Awake`/`OnEnable` ordering is compatible with initialization |
| Failure cleanup | Force a mid-build exception and assert no orphan hierarchy remains |
| Pool integration | Verify reset on release and configuration on acquire |
| Performance | Profile representative spawn load; do not infer savings from fewer source lines |

Use EditMode tests for plain builders and structural validation. Use PlayMode tests for lifecycle, activation, pooling, and runtime component behavior.

## Primary documentation

- [Unity 6.3 MonoBehaviour](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.html): a `MonoBehaviour` exists as a `GameObject` component and can be instantiated with `GameObject.AddComponent`.
- [Unity 6.3 GameObject.AddComponent](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/GameObject.AddComponent.html): supported component-addition APIs.
- [Unity 6.3 Prefabs](https://docs.unity3d.com/6000.3/Documentation/Manual/Prefabs.html): reusable authored `GameObject` templates, variants, and runtime instantiation.
- [Unity 6.3 ScriptableObject](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html): shared asset-backed data and memory behavior.
- [Unity 6.3 ObjectPool<T>](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.html): reuse for repetitive create/destroy workloads; Unity's implementation is not thread-safe.
- [Unity 6.3 C# compiler](https://docs.unity3d.com/6000.3/Documentation/Manual/CSharpCompiler.html): authoritative supported and unsupported language features for this Editor line.
- [Microsoft C# named and optional arguments](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/named-and-optional-arguments): simpler alternative for selected constructor or method parameters.
- [Microsoft C# object and collection initializers](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/classes-and-structs/object-and-collection-initializers): initializer semantics and modern required/init alternatives where supported.
- [Microsoft C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces): interface contracts used by step builders.
- [Microsoft C# `required`](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/required): C# 11 feature; verify compiler support before use.
