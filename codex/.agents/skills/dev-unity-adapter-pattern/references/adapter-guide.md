# Adapter Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) describes adapting an incompatible third-party physics API to an existing Rigidbody-like client interface and places Adapter in C tier. The intent is sound, but inheriting or pretending to be a Unity native component is a fragile implementation. Prefer a game-owned interface and composition wrapper.

## Semantic Mapping Checklist

- units and scale;
- handedness and coordinate axes;
- local versus world space;
- immediate versus deferred execution;
- result, exception, status-code, and callback errors;
- cancellation and timeout;
- object ownership and disposal;
- main-thread requirements;
- optional provider capabilities.

An adapter that only renames methods while changing these meanings violates substitution.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft Adapter and Facade episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-adapterfaade)
- [Microsoft overview of patterns used in .NET](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/july/discovering-the-design-patterns-you-re-already-using-in-net)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [C# explicit interface implementation](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/interfaces/explicit-interface-implementation)
- [Unity Rigidbody](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Rigidbody.html)
- [Unity coordinate systems](https://docs.unity3d.com/6000.3/Documentation/Manual/QuaternionAndEulerRotationsInUnity.html)
