# Memory profiling

## Table of contents

1. Separate memory questions
2. Built-in Memory module
3. Memory Profiler snapshots
4. Leak investigation
5. Asset and graphics memory
6. Managed memory and GC
7. Memory validation

## 1. Separate memory questions

Identify the actual symptom:

- Peak memory exceeds a platform limit.
- Memory grows across repeated gameplay cycles.
- Managed allocations cause GC spikes.
- Native objects remain alive after scene unload.
- Textures, meshes, audio, or render targets consume too much memory.
- Addressables or AssetBundles remain loaded.
- The operating system terminates the app under memory pressure.
- Fragmentation or reserved pools are much larger than used memory.

Use different tools for allocation rate, retained memory, and total process memory.

## 2. Built-in Memory module

Use the built-in Profiler Memory module for frame-level trends and high-level counters such as:

- Total/system used memory.
- Texture and mesh memory.
- Material and object counts.
- GC used memory.
- GC allocated in frame.

Treat Editor memory as inflated and structurally different. For example, Editor tooling and read/write asset copies can change reported memory. Use a target-device Player for authoritative limits.

The built-in detailed sample is useful for a point-in-time view, but the Memory Profiler package provides deeper snapshot comparison and reference analysis.

## 3. Memory Profiler snapshots

Use the package snapshot workflow:

1. Reproduce the target state on a Player when possible.
2. Force no arbitrary cleanup unless the shipped workflow performs it.
3. Capture baseline snapshot A.
4. Execute a repeatable cycle several times: load/unload scene, enter/leave combat, open/close UI, spawn/despawn content, or download/release assets.
5. Return to the same logical state.
6. Capture snapshot B.
7. Compare object counts, retained size, native allocations, managed heap, graphics resources, and reference chains.
8. Repeat after the proposed fix.

Snapshots are intrusive and can pause the application. Use them for ownership and retention analysis, not frame-time measurement.

## 4. Leak investigation

For each growing type:

- Find the owner and expected lifetime.
- Inspect managed and native reference paths.
- Check static fields, event subscriptions, singletons, caches, and persistent services.
- Check coroutines, tasks, callbacks, and cancellation sources retaining scene objects.
- Check undisposed NativeContainers, jobs, streams, and graphics resources.
- Check instantiated materials, meshes, textures, render textures, and compute buffers.
- Check pooled objects that are never returned or pools that survive longer than intended.
- Check Addressables handles, AssetBundle references, scenes, and instances that were not released through the matching API.
- Check `DontDestroyOnLoad` ownership and duplicate persistent managers.

Do not use `Resources.UnloadUnusedAssets` as a substitute for fixing live references. It can unload only assets that are no longer referenced and can itself be expensive.

## 5. Asset and graphics memory

Inspect:

- Texture dimensions, format, mipmaps, read/write state, streaming, and platform overrides.
- Mesh vertex/index format, read/write state, compression, skinning data, and duplicates.
- Audio load type, compression, sample rate, channels, and decompression behavior.
- RenderTexture lifetime, dimensions, format, MSAA, depth, and temporary release.
- Material instances created through renderer `.material` access.
- Shader variants and pipeline caches when relevant.
- Duplicate assets across Addressable groups or AssetBundles.
- Asset references in scenes, prefabs, ScriptableObjects, static caches, and pools.

An optimization that lowers runtime memory can increase download size, CPU decompression, loading time, or visual loss. Measure the relevant tradeoff.

## 6. Managed memory and GC

Distinguish:

- **Allocation rate:** new managed bytes created over time.
- **Used heap:** live managed objects.
- **Reserved heap:** memory held by the runtime for future allocations.
- **Collection cost:** CPU time spent finding unreachable objects.

A reserved heap that stays high after objects die is not automatically a leak. A leak requires retained objects or resources that should have become unreachable or disposed.

Use CPU allocation call stacks to remove hot allocations. Use snapshots to find retained objects. Use long-session device tests to confirm the process remains within the operating-system limit.

## 7. Memory validation

After a fix:

- Repeat the exact same lifecycle cycles.
- Compare snapshot object counts and retained size.
- Check peak process memory on target hardware.
- Check steady-state allocation rate and collection spikes.
- Check pause/resume, scene reload, low-memory callbacks, and application shutdown when relevant.
- Verify that unloading does not break later reuse or produce missing assets.
- Verify that pooling or caching has not traded GC pressure for excessive persistent memory.

Report both the memory saved and any loading, CPU, storage, or complexity cost introduced.
