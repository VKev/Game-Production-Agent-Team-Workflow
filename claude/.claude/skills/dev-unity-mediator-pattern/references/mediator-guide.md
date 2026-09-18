# Mediator Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) describes a controller in the middle of collaborating components and compares this to common MonoBehaviour manager/controller usage. It places Mediator in A tier while warning that the mediator can become huge. A MonoBehaviour is not automatically a Mediator; it must specifically own peer interaction rules.

## Healthy Boundary

A reward-screen mediator may coordinate selection, claim eligibility, animation completion, and navigation among focused view components. It should not own reward calculation, persistence schema, audio implementation, and every global screen transition.

Prefer one mediator per cohesive lifetime boundary. If it becomes a global message hub, compare Observer/event-bus architecture and service location risks instead.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [C# events](https://learn.microsoft.com/en-us/dotnet/csharp/events-overview)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [Unity MonoBehaviour](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.html)
- [Unity event-function execution order](https://docs.unity3d.com/6000.3/Documentation/Manual/ExecutionOrder.html)
- [VContainer documentation](https://vcontainer.hadashikick.jp/)
