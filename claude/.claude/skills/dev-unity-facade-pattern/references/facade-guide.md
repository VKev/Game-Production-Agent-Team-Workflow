# Facade Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) uses save/load/new-game methods over a complex save subsystem and places Facade in S tier. The benefit is a small client-facing contract; safe save implementation still requires snapshot, versioning, atomic-write, and recovery rules owned by the persistence subsystem.

## Boundary Example

A scene-transition facade can expose one request object and progress/result contract while internal services coordinate fade, save, unload, load, activation, and input gating. The facade should not itself become the owner of all those concerns.

## Distinctions

- Facade simplifies a subsystem for clients.
- Mediator coordinates collaborators that otherwise reference one another.
- Adapter translates an existing interface.
- Proxy controls or delays access through the subject contract.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft Adapter and Facade episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-adapterfaade)
- [Microsoft overview of patterns used in .NET](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/july/discovering-the-design-patterns-you-re-already-using-in-net)
- [Unity SceneManager.LoadSceneAsync](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SceneManagement.SceneManager.LoadSceneAsync.html)
- [Unity AsyncOperation](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AsyncOperation.html)
- [Unity JsonUtility](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/JsonUtility.html)
