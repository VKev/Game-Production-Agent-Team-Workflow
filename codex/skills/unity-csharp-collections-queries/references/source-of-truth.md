# Source of Truth: Unity 2022.3.62f2

## Contents

- [Version lock](#version-lock)
- [Source priority](#source-priority)
- [Unity 2022.3 sources](#unity-20223-sources)
- [Unity Collections 2.1.4 sources](#unity-collections-214-sources)
- [Microsoft C# and .NET sources](#microsoft-c-and-net-sources)
- [Claim discipline](#claim-discipline)

## Version lock

Target Unity editor: **2022.3.62f2 LTS**.

Unity documentation is published at the `2022.3` family level rather than a separate page set for every patch release. Use URLs containing `/2022.3/` for engine/manual claims. Confirm exact project version from `ProjectSettings/ProjectVersion.txt`.

Unity 2022.3 uses the Roslyn compiler with C# 9.0, with documented unsupported features. It supports .NET Standard 2.1 or .NET Framework 4.8 compatibility profiles. Do not assume APIs or syntax from newer Unity or newer .NET versions are available.

The Unity Collections package is optional. Unity's 2022.3 package page lists `com.unity.collections` 2.1.4 as released for Unity 2022.3. Still inspect the project's package lock; use the exact installed package documentation when it differs.

## Source priority

Use sources in this order:

1. Exact installed package API documentation.
2. Unity 2022.3 Manual or Scripting API.
3. Microsoft Learn for C# language and BCL behavior available in the selected Unity .NET profile.
4. Project profiling and tests for project-specific performance.
5. Engineering inference, clearly labeled as inference.

Never treat blogs, forum answers, benchmarks from another Unity version, or generated code as source-of-truth evidence.

## Unity 2022.3 sources

- **U1 — C# compiler and unsupported features**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/CSharpCompiler.html

- **U2 — .NET Standard 2.1 and .NET Framework 4.8 profile support**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/dotnetProfileSupport.html

- **U3 — Script serialization rules**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/script-Serialization.html

- **U4 — Garbage collector overview**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collector.html

- **U5 — Garbage collection best practices**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html

- **U6 — Common Profiler markers, including GC.Alloc interpretation**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/profiler-markers.html

- **U7 — CPU Usage Profiler module**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/ProfilerCPU.html

- **U8 — Generic collection pooling**  
  https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.CollectionPool_2.html

- **U9 — List-returning overload for component queries**  
  https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Component.GetComponents.html

- **U10 — Physics query API family and non-allocating variants**  
  https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Physics.html

- **U11 — Job System overview**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/JobSystem.html

- **U12 — NativeContainer/thread-safe types and allocators**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/JobSystemNativeContainer.html

- **U13 — Collections package availability for Unity 2022.3**  
  https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.collections.html

## Unity Collections 2.1.4 sources

Use these only after confirming `com.unity.collections` is installed and its version is compatible.

- **UC1 — Collection type catalog**  
  https://docs.unity3d.com/Packages/com.unity.collections@2.1/manual/collection-types.html

- **UC2 — NativeList API**  
  https://docs.unity3d.com/Packages/com.unity.collections@2.1/api/Unity.Collections.NativeList-1.html

- **UC3 — NativeHashMap API**  
  https://docs.unity3d.com/Packages/com.unity.collections@2.1/api/Unity.Collections.NativeHashMap-2.html

- **UC4 — NativeParallelHashMap API**  
  https://docs.unity3d.com/Packages/com.unity.collections@2.1/api/Unity.Collections.NativeParallelHashMap-2.html

## Microsoft C# and .NET sources

Use Microsoft sources for managed collection and LINQ semantics after confirming Unity's API Compatibility Level.

- **M1 — Selecting a collection class**  
  https://learn.microsoft.com/dotnet/standard/collections/selecting-a-collection-class

- **M2 — Commonly used collection types**  
  https://learn.microsoft.com/dotnet/standard/collections/commonly-used-collection-types

- **M3 — LINQ query execution: immediate, deferred, streaming, non-streaming**  
  https://learn.microsoft.com/dotnet/csharp/linq/get-started/introduction-to-linq-queries

- **M4 — Standard query operators**  
  https://learn.microsoft.com/dotnet/csharp/linq/standard-query-operators/

- **M5 — Comparison and sorting behavior**  
  https://learn.microsoft.com/dotnet/standard/collections/comparisons-and-sorts-within-collections

- **M6 — Dictionary API**  
  https://learn.microsoft.com/dotnet/api/system.collections.generic.dictionary-2

- **M7 — HashSet API and set semantics**  
  https://learn.microsoft.com/dotnet/api/system.collections.generic.hashset-1

- **M8 — SortedList API and tradeoffs**  
  https://learn.microsoft.com/dotnet/api/system.collections.generic.sortedlist-2

- **M9 — SortedDictionary API and tradeoffs**  
  https://learn.microsoft.com/dotnet/api/system.collections.generic.sorteddictionary-2

- **M10 — Thread-safe managed collections**  
  https://learn.microsoft.com/dotnet/standard/collections/thread-safe/

- **M11 — ReadOnlyCollection live-wrapper behavior**  
  https://learn.microsoft.com/dotnet/api/system.collections.objectmodel.readonlycollection-1?view=netframework-4.8.1

- **M12 — ArraySegment as a non-copying array range view**  
  https://learn.microsoft.com/dotnet/api/system.arraysegment-1?view=netstandard-2.1

- **M13 — Span API for contiguous memory regions**  
  https://learn.microsoft.com/dotnet/api/system.span-1?view=netstandard-2.1

- **M14 — Memory and Span ownership/lifetime guidance**  
  https://learn.microsoft.com/dotnet/standard/memory-and-spans/memory-t-usage-guidelines

- **M15 — ArrayPool reusable array buffers**  
  https://learn.microsoft.com/dotnet/api/system.buffers.arraypool-1?view=netstandard-2.1

- **M16 — Deferred execution and lazy evaluation**  
  https://learn.microsoft.com/dotnet/standard/linq/deferred-execution-lazy-evaluation

- **M17 — Intermediate materialization**  
  https://learn.microsoft.com/dotnet/standard/linq/intermediate-materialization

- **M18 — Possible multiple enumeration of `IEnumerable<T>`**  
  https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca1851

- **M19 — Memory-related and span types**  
  https://learn.microsoft.com/dotnet/standard/memory-and-spans/

## Claim discipline

For each important claim, record its basis internally:

- `documented`: directly supported by an official source;
- `observed`: measured or reproduced in the user's project;
- `inferred`: a reasoned consequence that official docs do not state directly.

Examples:

- "Unity directly serializes arrays and `List<T>`, but not dictionaries" is documented by U3.
- "This query allocates 96 bytes per frame" must be observed in the user's Profiler/build.
- "A second index will probably be needed when the GDD adds lookup by rarity" is an inference from the future requirement.

When a source page is newer but remains under the `2022.3` or `com.unity.collections@2.1` path, treat the version path as the compatibility target and avoid importing claims about APIs not present in that path.
