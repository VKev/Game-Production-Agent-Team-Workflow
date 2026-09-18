# Template Method Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) describes a fixed algorithm skeleton with overridable steps, relates it to Unity lifecycle and StateMachineBehaviour callbacks, and places Template Method in B tier. The strongest use case is a framework/library extension point whose order and invariants must remain controlled.

## Safer Shape

```csharp
public void Execute()
{
    Prepare();
    RunRequiredStep();
    Complete();
}

protected abstract void RunRequiredStep();
protected virtual void Prepare() { }
protected virtual void Complete() { }
```

Keep `Execute` non-virtual when subclasses must not reorder the algorithm. If steps need runtime replacement or arbitrary composition, Strategy/delegates fit better.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft Template Method episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-template-method)
- [Microsoft overview of patterns used in .NET](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/july/discovering-the-design-patterns-you-re-already-using-in-net)
- [C# abstract keyword](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/abstract)
- [C# virtual keyword](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/virtual)
- [C# sealed keyword](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/sealed)
- [Unity event-function execution order](https://docs.unity3d.com/6000.3/Documentation/Manual/ExecutionOrder.html)
- [Unity StateMachineBehaviour](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/StateMachineBehaviour.html)
