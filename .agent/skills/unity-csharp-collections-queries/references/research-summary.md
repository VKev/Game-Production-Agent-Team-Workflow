# Multi-source Research Summary

## Purpose

Use this summary as the baseline for collection and query decisions in Unity 2022.3.62f2. Read the specialized references for implementation details and edge cases.

## Synthesized rules

1. **Choose by required operations, not habit.** Use arrays for fixed contiguous storage, `List<T>` for ordered dynamic sequences, `Dictionary<TKey,TValue>` for repeated unique-key lookup, `HashSet<T>` for uniqueness and membership, `Queue<T>` for FIFO, and `Stack<T>` for LIFO. Use sorted or concurrent containers only when their ordering or threading semantics are required.

2. **Treat LINQ as a semantic tool, not a universal performance rule.** LINQ can improve clarity in initialization, editor, loading, tests, and infrequent event paths. In repeated runtime paths, compare it with an explicit single-pass loop, a cached index, or a caller-provided destination buffer.

3. **Account for deferred execution.** Many LINQ operators execute when enumerated, not when declared. Re-enumeration can repeat work, observe changed source data, and repeat side effects. Materialize deliberately when a stable snapshot or repeated consumption justifies the allocation.

4. **Distinguish streaming from non-streaming operators.** Filtering and projection can stream; operations such as ordering must consume the source before producing ordered results. Do not infer cost from pipeline length alone.

5. **Separate serialized authoring data from runtime indexes.** Unity directly serializes supported one-dimensional arrays and `List<T>` fields, but not dictionaries, jagged arrays, multidimensional arrays, or nested containers. Keep an Inspector-friendly source list and rebuild runtime dictionaries or sets when repeated lookup needs them.

6. **Control allocation by ownership and frequency.** Reuse owner-local collections with `Clear()`, pass caller-owned result buffers, use Unity list-filling or `NonAlloc` APIs when appropriate, and use collection or array pools only when acquire/use/release ownership is explicit. Retained capacity and buffer overflow behavior must be considered.

7. **Use spans and memory views only when they fit the lifetime.** `Span<T>` and `ReadOnlySpan<T>` are suitable for synchronous, non-owning views over contiguous memory. Use `Memory<T>` or `ReadOnlyMemory<T>` when a view must survive beyond the current stack frame or cross an asynchronous boundary. Verify the project's API Compatibility Level before relying on these APIs.

8. **Keep native collections behind a package and workload gate.** Confirm `com.unity.collections` in `Packages/packages-lock.json`. Use native containers when Jobs, Burst, native memory ownership, or data-parallel work justifies them; otherwise prefer simpler managed collections.

9. **Make correctness semantics explicit.** Define order, duplicates, equality comparer, missing-item behavior, null policy, mutation, determinism, buffer overflow, cache invalidation, thread ownership, and result lifetime before optimizing.

10. **Verify rather than claim.** Compile in the actual Unity project, test Mono/IL2CPP and target platforms when relevant, use representative data, inspect `GC.Alloc`, and profile a development build on the target device before claiming a solution is faster or allocation-free.

## Primary official sources

### Unity 2022.3

- C# compiler and supported language version: https://docs.unity3d.com/2022.3/Documentation/Manual/CSharpCompiler.html
- .NET profile support: https://docs.unity3d.com/2022.3/Documentation/Manual/dotnetProfileSupport.html
- Script serialization: https://docs.unity3d.com/2022.3/Documentation/Manual/script-Serialization.html
- Garbage collection best practices: https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collection-best-practices.html
- Garbage collector and profiling allocations: https://docs.unity3d.com/2022.3/Documentation/Manual/performance-garbage-collector.html
- Collection pools: https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Pool.CollectionPool_2.html
- Component list-filling overloads: https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Component.GetComponents.html
- Physics query APIs: https://docs.unity3d.com/2022.3/Documentation/ScriptReference/Physics.html
- Unity Collections package availability: https://docs.unity3d.com/2022.3/Documentation/Manual/com.unity.collections.html

### Microsoft .NET and C#

- Selecting a collection class: https://learn.microsoft.com/dotnet/standard/collections/selecting-a-collection-class
- LINQ query execution: https://learn.microsoft.com/dotnet/csharp/linq/get-started/introduction-to-linq-queries
- Deferred execution and lazy evaluation: https://learn.microsoft.com/dotnet/standard/linq/deferred-execution-lazy-evaluation
- Intermediate materialization: https://learn.microsoft.com/dotnet/standard/linq/intermediate-materialization
- Multiple enumeration guidance: https://learn.microsoft.com/dotnet/fundamentals/code-analysis/quality-rules/ca1851
- Memory and span usage guidelines: https://learn.microsoft.com/dotnet/standard/memory-and-spans/memory-t-usage-guidelines
- Array pooling: https://learn.microsoft.com/dotnet/api/system.buffers.arraypool-1?view=netstandard-2.1
