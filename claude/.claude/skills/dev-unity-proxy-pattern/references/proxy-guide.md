# Proxy Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) proposes a Unity Gaming Services proxy for caching/optimization and a mock service for development, placing Proxy in S tier. Caching is a classic proxy policy. A non-forwarding mock is more precisely a test double, though it can implement the same contract and be selected at composition time.

## Policy Matrix

| Policy | Required contract decisions |
|---|---|
| Lazy | initialization failure, concurrent first access, unload |
| Cache | key, freshness, invalidation, memory bound |
| Retry | idempotency, backoff, attempt cap, cancellation |
| Rate limit | queue/drop/reject behavior, fairness, feedback |
| Protection | identity, authorization failure, audit |
| Remote | serialization, latency, timeout, partial failure |

Do not claim transparency when these differences materially affect callers.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [.NET DispatchProxy](https://learn.microsoft.com/en-us/dotnet/api/system.reflection.dispatchproxy?view=netstandard-2.1)
- [Unity scripting restrictions](https://docs.unity3d.com/6000.3/Documentation/Manual/ScriptingRestrictions.html)
- [Unity managed code stripping](https://docs.unity3d.com/6000.3/Documentation/Manual/ManagedCodeStripping.html)
- [UnityWebRequest](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Networking.UnityWebRequest.html)
- [C# interfaces](https://learn.microsoft.com/en-us/dotnet/csharp/fundamentals/types/interfaces)
- [VContainer documentation](https://vcontainer.hadashikick.jp/)
