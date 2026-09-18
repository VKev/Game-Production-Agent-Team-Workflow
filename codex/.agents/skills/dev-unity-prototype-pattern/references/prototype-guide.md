# Prototype Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) identifies two ideas: objects clone themselves and configured prototypes live in a registry. It equates Unity prefabs with practical prototypes and places Prototype in S tier specifically for Unity. This is a useful analogy, not proof that all prefab instantiation needs custom Prototype architecture.

## Copy Matrix

| Field kind | Typical clone policy |
|---|---|
| Primitive/value object | Copy value |
| Immutable asset reference | Share reference |
| Mutable managed collection | Create and populate a new collection |
| Runtime entity ID | Generate a new ID |
| Owner/target/context | Clear, then initialize explicitly |
| Delegate/subscription/cancellation | Clear and rebind |
| Cache derived from configuration | Rebuild or invalidate |

Unity serialization coverage is not a complete deep-copy specification. Validate the actual object graph.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Game Programming Patterns: Prototype](https://gameprogrammingpatterns.com/prototype.html)
- [Unity Object.Instantiate](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Object.Instantiate.html)
- [Unity Prefabs manual](https://docs.unity3d.com/6000.3/Documentation/Manual/Prefabs.html)
- [Unity ScriptableObject manual](https://docs.unity3d.com/6000.3/Documentation/Manual/class-ScriptableObject.html)
- [Unity serialization rules](https://docs.unity3d.com/6000.3/Documentation/Manual/script-Serialization.html)
- [.NET ICloneable](https://learn.microsoft.com/en-us/dotnet/api/system.icloneable?view=netstandard-2.1)
- [.NET MemberwiseClone](https://learn.microsoft.com/en-us/dotnet/api/system.object.memberwiseclone?view=netstandard-2.1)
