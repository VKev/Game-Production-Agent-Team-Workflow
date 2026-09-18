# Composite Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) relates Composite to Unity hierarchies and multiple MonoBehaviours, then places it in A tier. Unity encourages GameObject/component composition, but the GoF Composite specifically requires a common operation across leaves and containers in a part-whole tree.

## Modeling Questions

- Is the hierarchy authored, runtime-generated, or both?
- Does parenting mean ownership, transform inheritance, presentation grouping, or all three?
- Are repeated/shared children allowed? If yes, this may be a graph rather than a tree.
- Does a composite aggregate results, broadcast commands, short-circuit, or collect failures?
- Can children mutate during traversal?

Do not let scene hierarchy convenience silently decide domain semantics.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft overview of patterns used in .NET](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/july/discovering-the-design-patterns-you-re-already-using-in-net)
- [Unity Transform component](https://docs.unity3d.com/6000.3/Documentation/Manual/class-Transform.html)
- [Unity GetComponentsInChildren](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Component.GetComponentsInChildren.html)
- [Unity Prefabs manual](https://docs.unity3d.com/6000.3/Documentation/Manual/Prefabs.html)
- [C# IEnumerable](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ienumerable-1?view=netstandard-2.1)
