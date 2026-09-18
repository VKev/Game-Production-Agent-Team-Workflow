# Abstract Factory Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) expands warriors and wizards across human, elf, and orc families, then suggests platform or accessibility UI families. It warns about class growth and places Abstract Factory in C tier. The examples are useful; the tier is subjective.

## Production Corrections

- “Several factories” is not enough. Products must form families with a compatibility invariant.
- A family asset of direct references can be an effective Unity implementation without a class per product/family combination.
- Abstract Factory is asymmetric: adding families is localized; adding product kinds touches every factory.
- Runtime theme switching also requires ownership rules for already-created objects.
- Do not hide Addressables failures, pooling reset, or DI lifetime behind a synchronous creation signature.

## Decision Test

Use a two-dimensional table. If rows are families, columns are product kinds, and most cells are meaningful and must stay compatible, the pattern may fit. Sparse tables and optional products usually indicate a catalog, feature flags, or composition instead.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft Factory patterns episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-factories)
- [Unity factory pattern tutorial](https://learn.unity.com/tutorial/how-to-use-the-factory-pattern-for-object-creation-at-runtime?version=6.0)
- [Unity design-pattern examples](https://github.com/Unity-Technologies/game-programming-patterns-demo)
- [Unity ScriptableObject manual](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html)
- [Unity Prefabs manual](https://docs.unity3d.com/6000.3/Documentation/Manual/Prefabs.html)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [C# polymorphism](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/polymorphism)
