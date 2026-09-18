# Iterator Research Guide

## Video Context

The [ranking video](https://www.youtube.com/watch?v=0A0-nkB1fxQ) notes that languages already provide iterators for lists/stacks and sees custom iterators as useful mainly for trees or graphs, placing Iterator in D tier. In C#, `IEnumerable<T>`, `IEnumerator<T>`, and iterator blocks already embody the pattern; a new class is rarely required.

## Traversal Contract Questions

- pre-order, post-order, breadth-first, or domain-defined;
- stable snapshot versus live view;
- allocation and deferred execution;
- concurrent enumerators;
- cycle detection;
- mutation invalidation;
- thread and Unity-object access.

Name multiple traversals explicitly instead of hiding major cost/order changes behind one `GetEnumerator`.

## Sources

- [Original GoF catalog publisher page](https://www.informit.com/store/design-patterns-elements-of-reusable-object-oriented-9780201633610)
- [Microsoft overview of patterns used in .NET](https://learn.microsoft.com/en-us/archive/msdn-magazine/2005/july/discovering-the-design-patterns-you-re-already-using-in-net)
- [.NET IEnumerable](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ienumerable-1?view=netstandard-2.1)
- [.NET IEnumerator](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.ienumerator-1?view=netstandard-2.1)
- [C# yield statement](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/statements/yield)
- [Unity coroutines](https://docs.unity3d.com/6000.3/Documentation/Manual/Coroutines.html)
- [Unity Job System overview](https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystemOverview.html)
