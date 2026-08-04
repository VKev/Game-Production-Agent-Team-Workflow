# Native Collections and allocators

## Table of contents

1. Collection selection
2. Parallel writers and ordering
3. Capacity
4. Allocator selection
5. Ownership and disposal
6. Safe versus unsafe collections
7. Common mistakes

## 1. Collection selection

| Type | Use for | Key cautions |
|---|---|---|
| `NativeArray<T>` | Fixed-size indexed input/output | Length fixed; copies share native allocation |
| `NativeSlice<T>` | View into part/stride of native array data | Lifetime belongs to source allocation |
| `NativeList<T>` | Resizable contiguous list | Parallel writer cannot safely grow capacity |
| `NativeReference<T>` | One unmanaged value shared through native memory | Still requires dependency and disposal |
| `NativeQueue<T>` | FIFO work/results | Use supported parallel writer for concurrent enqueue |
| `NativeStream` | Per-thread variable-length output streams | Requires reader/writer protocol and disposal |
| `NativeHashMap<TKey,TValue>` | Unique key lookup with lower single-thread overhead | Not for arbitrary concurrent writes |
| `NativeParallelHashMap<TKey,TValue>` | Unique-key map with parallel writer support | Pre-size; insertion order is not deterministic |
| `NativeParallelMultiHashMap<TKey,TValue>` | Multiple values per key with parallel writes | Enumeration/order is not deterministic |
| `NativeHashSet<T>` | Unique values without parallel writes | Capacity and disposal required |
| `NativeParallelHashSet<T>` | Unique values with parallel writer support | Concurrency does not guarantee order |
| `NativeBitArray` | Compact flags | Bit-level access and dependency rules still apply |
| `FixedList*Bytes<T>` | Small fixed-capacity inline list in an unmanaged struct | Capacity depends on element size |
| `FixedString*Bytes` | Burst-compatible bounded UTF-8 text | Fixed byte capacity; avoid for high-volume logging |

Use `Unsafe*` variants only when safety overhead is measured, the code is isolated, ownership is proven, and tests cover misuse. Native safety checks are valuable development diagnostics.

## 2. Parallel writers and ordering

A `ParallelWriter` makes a supported concurrent write operation safe. It does not make every collection method available, and it does not guarantee deterministic insertion order.

Examples:

- `NativeList<T>.ParallelWriter.AddNoResize` requires sufficient capacity before scheduling.
- `NativeParallelHashMap<TKey,TValue>.ParallelWriter.TryAdd` can reject duplicate keys; define duplicate policy.
- Per-thread scheduling order can change between runs.

When output order matters:

- Write by exclusive input index into a fixed array.
- Write per-thread/per-range output and merge deterministically.
- Produce flags/counts, compute offsets, then write into stable ranges.
- Sort by a deterministic key after parallel production.
- Use `NativeStream` when its per-thread structure fits the problem, then perform an explicit deterministic merge if required.

## 3. Capacity

Capacity planning is part of correctness:

- Estimate maximum concurrent output for the tested workload.
- Add justified headroom, not arbitrary unbounded growth.
- Pre-size lists, queues, maps, and sets before parallel writes.
- Check `TryAdd` or capacity-related failure paths.
- Decide whether overflow drops data, resizes on the main thread next frame, uses a fallback buffer, or fails loudly in development.

Do not resize a collection on the main thread while a job owns it.

For persistent collections, monitor high-water capacity. Reusing an oversized buffer can retain excessive native memory; shrinking every frame can recreate allocation cost. Choose a policy based on memory budget and workload variance.

## 4. Allocator selection

Use the allocator rules supported by the installed Collections version. For Unity 2022.3 guidance:

- **`Allocator.Temp`:** shortest-lived allocation, normally confined to the current main-thread scope/frame. Do not use it as a general job field allocation.
- **`Allocator.TempJob`:** short job allocation. Dispose within the documented short lifetime; Unity warns when it survives too long.
- **`Allocator.Persistent`:** long-lived allocation for recurring systems or work spanning many frames. Allocation is more expensive and ownership must be explicit.

Use persistent buffers when repeated allocation/disposal is measured or clearly frequent and the owner lifetime is stable. Do not choose `Persistent` merely to silence a TempJob warning.

If using `AllocatorManager`, custom allocators, rewindable allocators, or package-specific allocators, verify exact Collections version and lifecycle rules first.

## 5. Ownership and disposal

For every allocation, write down:

- Creator.
- Sole disposal owner.
- Allocator.
- Expected lifetime.
- Jobs that can access it.
- Handle that proves last use.
- Scene/application teardown behavior.

Patterns:

### Main-thread disposal after completion

```csharp
handle.Complete();
if (values.IsCreated)
    values.Dispose();
```

### Scheduled disposal

```csharp
JobHandle disposeHandle = temporary.Dispose(lastUseHandle);
```

Use scheduled disposal only when no main-thread code needs the data afterward and preserve the returned dependency if later lifetime logic requires it.

Use `try/finally` for local temporary allocations when exceptions can occur before scheduling. Use `OnDestroy`, explicit `Shutdown`, or service disposal for persistent allocations, completing outstanding work first.

A NativeContainer is a struct. Copies generally reference the same native allocation and safety handle. Disposing one invalidates other copies. Avoid casual copies across owners.

## 6. Safe versus unsafe collections

Safe `Native*` collections add job and disposal safety checks. Keep these checks during development.

Use unsafe containers or pointers only when all are true:

- Profiling proves safety overhead is material.
- Access ranges and lifetime can be proven locally.
- The code is isolated behind a small API.
- Burst and target-player tests exist.
- Invalid input cannot escape into arbitrary memory access.
- The team accepts the debugging and crash risk.

Do not use unsafe types as a shortcut around dependencies or main-thread ownership.

## 7. Common mistakes

- Allocating and disposing a NativeArray every frame without measuring reuse.
- Keeping TempJob allocations beyond their allowed lifetime.
- Losing the last `JobHandle` that accesses an allocation.
- Calling `Dispose()` before a job completes.
- Copying a NativeContainer into multiple services and assuming each owns separate memory.
- Using a non-parallel collection writer from `IJobParallelFor`.
- Failing to pre-size `NativeList.ParallelWriter` output.
- Depending on map/set iteration order.
- Storing managed references inside native element structs.
- Clearing a persistent buffer while a job still reads it.
- Retaining excessive capacity after rare spikes without checking the memory budget.
