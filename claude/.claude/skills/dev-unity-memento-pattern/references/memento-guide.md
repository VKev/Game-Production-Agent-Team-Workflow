# Memento Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) describes an originator creating a snapshot, a Memento holding it, and a caretaker storing snapshots without inspecting them. It links the pattern to save/load organization and places it in A tier. The same shape helps undo and rollback, but durable persistence adds requirements beyond Memento.

## Snapshot Categories

- **Undo snapshot:** short-lived, local, often optimized for one operation.
- **Rollback checkpoint:** frequent, deterministic, memory-bounded, sensitive to simulation identity.
- **Save snapshot:** durable, versioned, validated, atomic, and portable across sessions/builds.

Do not use one serialization format by default for all three.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft Command and Memento episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-commandmemento)
- [Unity serialization rules](https://docs.unity3d.com/6000.3/Documentation/Manual/script-Serialization.html)
- [Unity JsonUtility](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/JsonUtility.html)
- [Unity Editor Undo](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Undo.html)
- [.NET immutable collections](https://learn.microsoft.com/en-us/dotnet/api/system.collections.immutable?view=netstandard-2.1)
