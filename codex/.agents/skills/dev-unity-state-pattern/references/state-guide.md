# State Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) calls State and FSMs fundamental for games, notes that transitions and more than ten states become hard to debug without visualization, and places State in A tier. It also loosely includes behavior trees; behavior trees are a different control model and should be compared, not conflated.

## Ownership Choices

- **Plain C# state per actor:** easy mutable state and tests; more allocations/objects.
- **Shared stateless state:** low duplication; all actor data must remain in context.
- **ScriptableObject state asset:** designer-authored configuration; must remain free of per-actor mutable state.
- **Enum/switch:** minimal and visible for small stable machines.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Game Programming Patterns: State](https://gameprogrammingpatterns.com/state.html)
- [Unity State pattern tutorial](https://learn.unity.com/course/design-patterns/tutorial/develop-a-modular-flexible-codebase-with-the-state-programming-pattern)
- [Unity Animator StateMachineBehaviour](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/StateMachineBehaviour.html)
- [Unity event-function execution order](https://docs.unity3d.com/6000.3/Documentation/Manual/ExecutionOrder.html)
- [Unity ScriptableObject manual](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html)
