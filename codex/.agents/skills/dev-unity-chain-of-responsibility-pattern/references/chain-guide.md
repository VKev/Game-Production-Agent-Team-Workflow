# Chain of Responsibility Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) presents both common variants: every handler performs work and forwards, or the first capable handler stops propagation. It uses ordered AI investigation checks and places the pattern in C tier because other game patterns may fit similar behavior.

## Production Contract

Prefer an explicit result over `bool`:

```csharp
public enum Handling
{
    Continue,
    Handled,
    Stop,
    Error
}
```

Document whether `Handled` also stops, whether transformed context is visible downstream, and whether errors abort or accumulate.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft ASP.NET Core middleware pipeline](https://learn.microsoft.com/en-us/aspnet/core/fundamentals/middleware/?view=aspnetcore-9.0)
- [C# delegates](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/delegates/)
- [C# enum types](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/builtin-types/enum)
- [Unity Profiler overview](https://docs.unity3d.com/6000.3/Documentation/Manual/Profiler.html)
