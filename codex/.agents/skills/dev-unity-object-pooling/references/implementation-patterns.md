# Implementation Patterns

## Contents

1. Typed GameObject pool
2. Correct prewarming
3. Temporary collection pooling
4. Hard-cap behavior
5. Patterns to avoid

## 1. Typed GameObject Pool

The following Unity 2022.3 example keeps the raw pool private, applies spawn state before activation, supplies an overflow destroy callback, and guards self-return.

### `ProjectilePool.cs`

```csharp
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Pool;

public sealed class ProjectilePool : MonoBehaviour
{
    [SerializeField] private PooledProjectile prefab;
    [SerializeField, Min(0)] private int prewarmCount = 16;
    [SerializeField, Min(1)] private int defaultCapacity = 16;
    [SerializeField, Min(1)] private int maxInactive = 64;

    private IObjectPool<PooledProjectile> pool;
    private readonly List<PooledProjectile> prewarmBuffer = new List<PooledProjectile>();

    private void Awake()
    {
        if (prefab == null)
        {
            Debug.LogError("ProjectilePool requires a prefab.", this);
            enabled = false;
            return;
        }

        pool = new ObjectPool<PooledProjectile>(
            CreateProjectile,
            actionOnGet: null,
            actionOnRelease: OnReleaseProjectile,
            actionOnDestroy: OnDestroyProjectile,
            collectionCheck: true,
            defaultCapacity: defaultCapacity,
            maxSize: maxInactive);

        Prewarm(Mathf.Min(prewarmCount, maxInactive));
    }

    public PooledProjectile Spawn(
        Vector3 position,
        Quaternion rotation,
        Vector3 velocity,
        float lifetime)
    {
        if (pool == null)
            throw new InvalidOperationException("ProjectilePool is not initialized.");

        PooledProjectile projectile = pool.Get();
        projectile.Activate(position, rotation, velocity, lifetime);
        return projectile;
    }

    private PooledProjectile CreateProjectile()
    {
        PooledProjectile projectile = Instantiate(prefab, transform);
        projectile.Initialize(pool);
        projectile.gameObject.SetActive(false);
        return projectile;
    }

    private void OnReleaseProjectile(PooledProjectile projectile)
    {
        projectile.ResetForPool();
        projectile.transform.SetParent(transform, false);
    }

    private static void OnDestroyProjectile(PooledProjectile projectile)
    {
        if (projectile != null)
            UnityEngine.Object.Destroy(projectile.gameObject);
    }

    private void Prewarm(int count)
    {
        prewarmBuffer.Clear();

        for (int i = 0; i < count; i++)
            prewarmBuffer.Add(pool.Get());

        for (int i = prewarmBuffer.Count - 1; i >= 0; i--)
            pool.Release(prewarmBuffer[i]);

        prewarmBuffer.Clear();
    }

    private void OnDestroy()
    {
        pool?.Clear();
    }
}
```

### `PooledProjectile.cs`

```csharp
using System;
using UnityEngine;
using UnityEngine.Pool;

[RequireComponent(typeof(Rigidbody))]
public sealed class PooledProjectile : MonoBehaviour
{
    private IObjectPool<PooledProjectile> ownerPool;
    private Rigidbody body;
    private float remainingLifetime;
    private bool isLeased;

    private void Awake()
    {
        body = GetComponent<Rigidbody>();
    }

    public void Initialize(IObjectPool<PooledProjectile> pool)
    {
        ownerPool = pool ?? throw new ArgumentNullException(nameof(pool));
    }

    public void Activate(
        Vector3 position,
        Quaternion rotation,
        Vector3 velocity,
        float lifetime)
    {
        transform.SetPositionAndRotation(position, rotation);
        remainingLifetime = Mathf.Max(0f, lifetime);
        body.velocity = velocity;
        body.angularVelocity = Vector3.zero;
        isLeased = true;
        gameObject.SetActive(true);
    }

    private void Update()
    {
        if (!isLeased)
            return;

        remainingLifetime -= Time.deltaTime;
        if (remainingLifetime <= 0f)
            ReturnToPool();
    }

    private void OnCollisionEnter(Collision collision)
    {
        ReturnToPool();
    }

    public void ReturnToPool()
    {
        if (!isLeased)
            return;

        isLeased = false;
        ownerPool.Release(this);
    }

    public void ResetForPool()
    {
        isLeased = false;
        remainingLifetime = 0f;
        body.velocity = Vector3.zero;
        body.angularVelocity = Vector3.zero;
        gameObject.SetActive(false);
    }
}
```

Adapt the reset contract to the actual projectile. For example, clear trails, ignore-collision pairs, damage owner, penetration state, and particles if the feature mutates them.

The sample keeps active projectiles parented under the pool owner, so destroying the owner destroys active children through normal hierarchy cleanup. If active objects are reparented elsewhere, track and clean them explicitly.

## 2. Correct Prewarming

A reusable helper pattern:

```csharp
private static void Prewarm<T>(IObjectPool<T> pool, List<T> buffer, int count)
    where T : class
{
    buffer.Clear();

    for (int i = 0; i < count; i++)
        buffer.Add(pool.Get());

    for (int i = buffer.Count - 1; i >= 0; i--)
        pool.Release(buffer[i]);

    buffer.Clear();
}
```

Hold all acquired items until the acquisition loop finishes. Otherwise one item can be repeatedly reused.

## 3. Temporary Collection Pooling

Use scoped collection pooling when the collection is temporary and must always be returned:

```csharp
using System.Collections.Generic;
using UnityEngine.Pool;

public static class TargetFilter
{
    public static int CountAlive(IEnumerable<Health> candidates)
    {
        using (ListPool<Health>.Get(out List<Health> alive))
        {
            foreach (Health candidate in candidates)
            {
                if (candidate != null && candidate.IsAlive)
                    alive.Add(candidate);
            }

            return alive.Count;
        }
    }
}
```

Do not return `alive` outside the scope. The list is cleared and returned when the pooled handle is disposed.

For a collection returned to a caller, either transfer explicit ownership and require release or use a normal owned collection. Hidden pooled ownership is error-prone.

## 4. Hard-Cap Behavior

`ObjectPool<T>.maxSize` is not an active cap. When no creation is allowed during gameplay, use an explicit bounded design:

```text
Initialize exactly N slots during loading.
Maintain an available stack or queue.
TryAcquire returns false when no slot is available.
Release validates ownership and returns the slot once.
Never instantiate from TryAcquire.
```

Expose `bool TrySpawn(..., out T instance)` rather than `Get` when exhaustion is an expected gameplay condition.

Choose an exhaustion policy deliberately:

- Reject the new spawn.
- Recycle the oldest active item.
- Recycle the lowest-priority active item.
- Defer the request.
- Expand only in non-critical phases.

Do not silently instantiate when the design promises a hard cap.

## 5. Patterns to Avoid

### Raw pool exposed globally

```csharp
public static IObjectPool<GameObject> Pool;
```

This hides ownership, accepts incompatible objects, and makes cleanup difficult.

### Reset split across all callers

```csharp
GameObject item = pool.Get();
// Every caller remembers a different subset of reset steps.
```

Centralize spawn and release behavior in the pool wrapper and pooled type.

### Release from `OnDisable` without a guard

```csharp
private void OnDisable() => pool.Release(this);
```

`actionOnRelease` commonly disables the object, causing recursion or double release. External disabling may also be intentional.

### Pooling without measurement

Replacing a rare `Instantiate` with a persistent pool can increase memory and code complexity while producing no visible benefit. Measure first or justify the high-frequency use case clearly, then verify after implementation.
