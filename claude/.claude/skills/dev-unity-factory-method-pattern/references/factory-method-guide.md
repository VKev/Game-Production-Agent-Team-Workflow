# Factory Method Research Guide

## Video Context

The analyzed [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) describes factories as separating product creation and initialization from products, using warrior and wizard factories, and notes that factories can retrieve pooled instances. Its final board places Factory Method in B tier. Treat that placement as the presenter’s opinion, not architecture precedence.

## Production Corrections

- A factory object is not automatically Factory Method. The defining extension point is an overridable or polymorphic creation method; a centralized switch is a simple factory.
- Product-specific presentation on spawn can remain product behavior instead of being pulled into the factory indiscriminately.
- `Instantiate`, Addressables loading, dependency resolution, and pool borrowing have different ownership and failure contracts.
- A Factory Method hierarchy is expensive when product selection is just stable data. A ScriptableObject catalog or prefab reference may be clearer.
- Factories should not become service locators. Declare dependencies and lifetime explicitly.

## Unity Example Shape

```csharp
public interface IProjectile
{
    void Launch(in ProjectileSpawn spawn);
}

public abstract class ProjectileFactory : MonoBehaviour
{
    public abstract IProjectile Create(in ProjectileSpawn spawn);
}
```

Keep the example conceptual. Choose a concrete factory, data-driven factory, or pool adapter only after comparing change frequency and ownership.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Unity factory pattern tutorial](https://learn.unity.com/tutorial/how-to-use-the-factory-pattern-for-object-creation-at-runtime?version=6.0)
- [Unity design-pattern examples](https://github.com/Unity-Technologies/game-programming-patterns-demo)
- [Microsoft Factory patterns episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-factories)
- [Unity Object.Instantiate](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.Instantiate.html)
- [Unity ObjectPool](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.html)
- [C# abstract keyword](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/abstract)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
