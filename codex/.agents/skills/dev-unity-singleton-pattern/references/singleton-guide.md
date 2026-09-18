# Singleton Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) emphasizes Singleton convenience for managers and services, argues that abuse and oversized responsibilities cause many failures, and places it in A tier. It also treats dependency injection as similarly convenient access. Production design must still distinguish global access, one-instance enforcement, and scoped dependency resolution.

## Common Unity Failures

| Failure | Cause | Correction |
|---|---|---|
| Two instances after additive load | Each scene authored a manager | Move composition to one bootstrap or enforce a documented scene contract |
| Stale listeners after Play Mode restart | Static event survives without Domain Reload | Reset statics at subsystem registration and unsubscribe symmetrically |
| Accessor returns destroyed object | Unity object lifetime differs from CLR reference lifetime | Clear state during teardown and reject access while shutting down |
| Tests affect one another | Global mutable instance persists | Inject a scoped service or provide explicit test composition |
| Random initialization failures | Consumers race `Awake` order | Bootstrap deterministically and expose readiness explicitly |

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Game Programming Patterns: Singleton](https://gameprogrammingpatterns.com/singleton.html)
- [Microsoft Singleton pattern episode](https://learn.microsoft.com/en-us/shows/visual-studio-toolbox/design-patterns-singleton)
- [Unity Domain Reloading](https://docs.unity3d.com/6000.3/Documentation/Manual/DomainReloading.html)
- [Unity DontDestroyOnLoad](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.DontDestroyOnLoad.html)
- [Unity RuntimeInitializeOnLoadMethod](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html)
- [Unity event-function execution order](https://docs.unity3d.com/6000.3/Documentation/Manual/ExecutionOrder.html)
- [VContainer documentation](https://vcontainer.hadashikick.jp/)
