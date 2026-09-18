# Bridge Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) calls a warrior delegating to one-handed sword, two-handed sword, or shield a Bridge and places it in S tier. Delegation alone is not sufficient: Bridge is most useful when both the abstraction hierarchy and implementation hierarchy vary independently.

## Example Decision

An input abstraction with game-specific actions and an implementation axis for keyboard, gamepad, replay, and network input can justify Bridge when both action-layer abstractions and device backends evolve. If only the backend algorithm swaps, Strategy is simpler. If an old provider merely has a mismatched API, Adapter is the precise pattern.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Unity design-pattern guidance and examples](https://github.com/Unity-Technologies/game-programming-patterns-demo)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [C# polymorphism](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/object-oriented/polymorphism)
- [Unity ScriptableObject manual](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html)
- [VContainer documentation](https://vcontainer.hadashikick.jp/)
