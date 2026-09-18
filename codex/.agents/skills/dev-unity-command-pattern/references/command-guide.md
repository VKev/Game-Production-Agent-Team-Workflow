# Command Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) turns worker collect/carry/build calls into queued command objects and highlights delay, stacks, undo, and input rebinding. It places Command in A tier and loosely compares coroutines. The durable command contract—not merely delayed execution—is the key distinction.

## Undo Choices

- **Inverse command:** compact, but only correct if no intervening state invalidates the inverse.
- **Memento:** restores exact prior state, but can consume substantial memory and needs stable identity/versioning.
- **Rebuild from event log:** powerful for deterministic domains, but every state transition and random input must be reproducible.

Choose deliberately per command; “Undo” is not one universal method.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Game Programming Patterns: Command](https://gameprogrammingpatterns.com/command.html)
- [Unity Command pattern tutorial for 6000.3](https://learn.unity.com/tutorial/command-pattern-2019?version=6000.3)
- [Unity Command pattern advanced tutorial](https://learn.unity.com/tutorial/use-the-command-pattern-for-flexible-and-extensible-game-systems?version=6.0)
- [Microsoft Command and Memento episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-commandmemento)
- [C# delegates](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/delegates/)
- [Unity coroutines](https://docs.unity3d.com/6000.3/Documentation/Manual/Coroutines.html)
