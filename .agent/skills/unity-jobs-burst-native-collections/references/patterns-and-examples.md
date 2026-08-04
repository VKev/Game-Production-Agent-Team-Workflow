# Patterns and examples

These examples target common Unity 2022.3 APIs. Verify installed Burst and Collections versions before copying them.

## 1. Burst parallel calculation with exclusive output

```csharp
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;

[BurstCompile]
public struct DistanceJob : IJobParallelFor
{
    [ReadOnly] public NativeArray<float3> Points;
    public float3 Origin;
    [WriteOnly] public NativeArray<float> DistancesSq;

    public void Execute(int index)
    {
        float3 delta = Points[index] - Origin;
        DistancesSq[index] = math.lengthsq(delta);
    }
}
```

Scheduling:

```csharp
JobHandle handle = new DistanceJob
{
    Points = points,
    Origin = origin,
    DistancesSq = distancesSq
}.Schedule(points.Length, 64);

// Perform unrelated main-thread work here.
handle.Complete();
```

Tune batch size only after profiling representative counts.

## 2. Dependency chain

```csharp
JobHandle integrateHandle = integrateJob.Schedule(count, 64, inputDependency);
JobHandle boundsHandle = boundsJob.Schedule(integrateHandle);

// Complete the final handle when both stages are required.
boundsHandle.Complete();
```

Pass the first handle into the second rather than completing between stages. Completion of the final dependent handle completes the chain.

## 3. Persistent native owner

```csharp
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;
using UnityEngine;

public sealed class NativeSimulationOwner : MonoBehaviour
{
    private NativeArray<float3> positions;
    private NativeArray<float3> velocities;
    private JobHandle simulationHandle;
    private bool isScheduled;

    private void Awake()
    {
        const int capacity = 1024;
        positions = new NativeArray<float3>(capacity, Allocator.Persistent);
        velocities = new NativeArray<float3>(capacity, Allocator.Persistent);
    }

    private void Update()
    {
        CompleteIfScheduled();

        // Gather or update native inputs here before scheduling.
        simulationHandle = new IntegrateJob
        {
            Positions = positions,
            Velocities = velocities,
            DeltaTime = Time.deltaTime
        }.Schedule(positions.Length, 64);

        isScheduled = true;
    }

    private void LateUpdate()
    {
        CompleteIfScheduled();
        // Scatter results to Unity objects only after completion.
    }

    private void OnDestroy()
    {
        CompleteIfScheduled();

        if (positions.IsCreated)
            positions.Dispose();

        if (velocities.IsCreated)
            velocities.Dispose();
    }

    private void CompleteIfScheduled()
    {
        if (!isScheduled)
            return;

        simulationHandle.Complete();
        isScheduled = false;
    }
}
```

This pattern demonstrates ownership, not ideal overlap for every feature. Schedule earlier or use cross-frame buffering when the latency contract permits.

A compatible job:

```csharp
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;
using Unity.Mathematics;

[BurstCompile]
public struct IntegrateJob : IJobParallelFor
{
    public NativeArray<float3> Positions;
    [ReadOnly] public NativeArray<float3> Velocities;
    public float DeltaTime;

    public void Execute(int index)
    {
        Positions[index] += Velocities[index] * DeltaTime;
    }
}
```

## 4. Parallel append with preallocated capacity

```csharp
using Unity.Burst;
using Unity.Collections;
using Unity.Jobs;

[BurstCompile]
public struct CollectPositiveIndicesJob : IJobParallelFor
{
    [ReadOnly] public NativeArray<float> Values;
    public NativeList<int>.ParallelWriter Output;

    public void Execute(int index)
    {
        if (Values[index] > 0f)
            Output.AddNoResize(index);
    }
}
```

Usage:

```csharp
var output = new NativeList<int>(values.Length, Allocator.TempJob);
var handle = new CollectPositiveIndicesJob
{
    Values = values,
    Output = output.AsParallelWriter()
}.Schedule(values.Length, 64);

handle.Complete();

// Output order is not guaranteed. Sort if stable order is required.
output.Sort();
output.Dispose();
```

Capacity must be at least the maximum possible append count. For smaller expected output, use a bounded policy or a two-pass count/write design rather than hoping capacity is enough.

## 5. Scheduled disposal

When temporary input is no longer needed after a job:

```csharp
JobHandle workHandle = workJob.Schedule();
JobHandle disposeHandle = temporaryInput.Dispose(workHandle);

// Preserve or complete disposeHandle before teardown if required.
```

Do not schedule disposal if main-thread code still needs the collection result.

## 6. Deterministic variable output

Use a two-pass pattern:

1. Parallel pass writes one count or inclusion flag per input index.
2. Compute deterministic prefix offsets.
3. Allocate or ensure final capacity.
4. Parallel pass writes each input into its assigned stable range.

This is more complex than `ParallelWriter`, so use it only when deterministic order or exact sizing matters.

## 7. Gather and scatter without per-frame allocation

Maintain persistent arrays sized to a known maximum or grow them on the main thread outside scheduled access. Each frame:

```text
complete previous access if required
copy current managed values into existing native input range
schedule over activeCount, not full capacity
complete when needed
apply only activeCount outputs
```

Do not process unused capacity merely because the buffer is larger.
