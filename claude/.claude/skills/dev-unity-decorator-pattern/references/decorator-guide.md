# Decorator Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) demonstrates nested stat decorators for equipment, dislikes the recursive wrapper stack, and places Decorator in D tier. That critique is relevant for data-heavy stat calculation, where an explicit modifier collection may be clearer. It does not invalidate Decorator for per-object cross-cutting behavior behind a stable contract.

## Order Example

For damage, `Clamp(Critical(Base))` and `Critical(Clamp(Base))` can produce different results. Treat wrapper order as part of the contract, validate it, and surface it in diagnostics. If order is primarily data, prefer an explicit ordered pipeline.

## Distinctions

- Decorator preserves the contract and adds behavior.
- Proxy preserves the contract and controls access to another subject.
- Adapter changes the interface.
- Strategy replaces one algorithm rather than stacking wrappers.
- Ordinary MonoBehaviour composition does not require nested same-contract forwarding.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft Decorator pattern episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-decorator)
- [Microsoft overview of patterns used in .NET](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/july/discovering-the-design-patterns-you-re-already-using-in-net)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [Unity components introduction](https://docs.unity3d.com/6000.3/Documentation/Manual/UsingComponents.html)
- [Unity serialization rules](https://docs.unity3d.com/6000.3/Documentation/Manual/script-Serialization.html)
