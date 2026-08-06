---
name: unity-csharp-collections-queries
description: "Documentation-grounded guidance for choosing, implementing, reviewing, and optimizing C# collections and data-query techniques in Unity 2022.3.62f2. Use for arrays, lists, dictionaries, sets, queues, stacks, sorted and concurrent containers, read-only views, spans, memory views, array/collection pools, loops, LINQ, iterators, cached indexes, reusable buffers, Unity non-allocating APIs, serialization constraints, and optional Unity.Collections native containers; explain when to use each option, correct usage, benefits, drawbacks, compatibility, scalability, readability, and verification requirements."
---
# Unity C# Collections and Queries

Provide technical evidence for collection and query decisions in projects targeting **Unity 2022.3.62f2**. Supply facts, constraints, and implementation options; let the calling senior agent combine them with architecture, GDD, team, and production context.

## Source-of-truth policy

1. Treat Unity 2022.3 documentation as authoritative for Unity behavior.
2. Treat the installed package version in `Packages/packages-lock.json` as authoritative for package APIs.
3. Treat Microsoft Learn as authoritative for C# and .NET collection/LINQ semantics supported by Unity's selected API Compatibility Level.
4. Do not use current Unity 6 documentation to justify a Unity 2022.3 API unless the same API is verified in the 2022.3 documentation.
5. Open official documentation before making a version-sensitive claim when network tools are available.
6. If official sources conflict, prefer the source closest to the actual runtime: exact package API, Unity 2022.3 manual/API, then Microsoft documentation for the compatible .NET profile.
7. Distinguish documented behavior, measured project behavior, and engineering inference.

Read [references/source-of-truth.md](references/source-of-truth.md) whenever compatibility or API behavior affects the answer.
Read [references/research-summary.md](references/research-summary.md) for the concise multi-source synthesis behind the decision rules.

## Inspect the project first

Before recommending code:

1. Read `ProjectSettings/ProjectVersion.txt` and confirm `2022.3.62f2` or report the mismatch.
2. Read `ProjectSettings/ProjectSettings.asset` for API Compatibility Level and scripting backend when relevant.
3. Read `Packages/manifest.json` and `Packages/packages-lock.json` before recommending optional packages or package APIs.
4. Locate the query and its callers. Identify whether it runs in editor tooling, initialization, loading, event-driven code, a repeated runtime path, a job, or a custom thread.
5. Estimate collection size, call frequency, lifetime, mutation rate, and result reuse.
6. Define required semantics: order, uniqueness, duplicate policy, null policy, failure behavior, determinism, thread access, ownership, and serialization.
7. Check nearby project conventions and existing indexes or caches.

## Load only the relevant reference

- Read [references/managed-collections.md](references/managed-collections.md) to choose managed containers, read-only boundaries, range/memory views, and rented buffers.
- Read [references/query-techniques.md](references/query-techniques.md) to compare loops, LINQ, materialization, iterators, sorting, grouping, and cached indexes.
- Read [references/unity-integration.md](references/unity-integration.md) for Unity serialization, managed allocations, pooling, non-allocating APIs, and profiling.
- Read [references/native-collections.md](references/native-collections.md) only when Jobs, Burst, native memory, or `Unity.Collections` is relevant.

## Decision workflow

For each realistic option, evaluate:

- **Problem fit**: what access pattern or query it directly supports.
- **Correctness semantics**: order, uniqueness, equality, duplicates, nulls, exceptions, mutation, and stale-data behavior.
- **Usage**: minimal correct implementation and ownership model.
- **Benefits**: readability, lookup behavior, allocation control, reuse, or parallel compatibility.
- **Drawbacks**: hidden execution, memory overhead, resizing, invalidation, disposal, synchronization, debugging, or migration cost.
- **Unity compatibility**: language version, API profile, serialization, package availability, Mono/IL2CPP, Jobs/Burst, and platform limitations.
- **Scale dimension**: item count, query frequency, mutation frequency, concurrent readers/writers, content volume, or number of systems sharing the data.
- **Future GDD impact**: new filters, rankings, stable ordering, deterministic replay/networking, designer-authored content, multiple indexes, save compatibility, and live content updates.
- **Verification**: tests, Profiler evidence, GC allocation checks, target-device measurements, and boundary scenarios.

Do not call an option "faster" from syntax alone. Relate performance to the operation, frequency, collection size, memory behavior, backend, and measurements.

## Required output

Return this structure for a meaningful decision:

1. **Context** — source data, location, frequency, size, lifetime, and target platform.
2. **Required semantics** — order, uniqueness, duplicate/null/failure policy, mutation, determinism, and threading.
3. **Compatible technologies** — only options available in the detected Unity/project configuration.
4. **Comparison** — when to use, usage, benefits, drawbacks, effort, and future constraints.
5. **Recommendation** — the simplest justified choice, not a universal rule.
6. **Future impact** — which plausible GDD changes reuse the design and which force redesign.
7. **Migration trigger** — a measurable or concrete condition for reevaluation.
8. **Verification** — exact tests and profiling steps; never claim evidence that was not collected.

When editing code, preserve behavior unless the user requested a behavior change. State any changed duplicate, ordering, null, or exception semantics explicitly.
