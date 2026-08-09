# Unity Clean-Code Examples

## Contents

1. Direct dependency versus interface
2. DRY versus accidental similarity
3. Cohesive MonoBehaviour extraction
4. Simple switch versus State pattern
5. Guard clauses without fragmentation
6. Readability versus hot-path optimization

## 1. Direct Dependency Versus Interface

Use a direct serialized reference when the relationship is local, stable, and owned by the prefab.

```csharp
public sealed class GunController : MonoBehaviour
{
    [SerializeField] private AmmoStore ammoStore;

    public bool TryShoot()
    {
        if (!ammoStore.TryConsume(1))
            return false;

        FireProjectile();
        return true;
    }

    private void FireProjectile()
    {
        // Spawn or lease the projectile.
    }
}
```

Do not add `IAmmoStore`, a service locator, and a DI container merely because a dependency exists.

Introduce an interface when the boundary is genuinely variable or volatile, such as local versus server receipt validation:

```csharp
public interface IReceiptValidator
{
    UniTask<ReceiptValidationResult> ValidateAsync(
        string receipt,
        CancellationToken cancellationToken);
}
```

The interface isolates a capability and an external boundary; it is not a mirror created for every class.

## 2. DRY Versus Accidental Similarity

Extract a shared damage rule when all callers must change together:

```csharp
public static class DamageRules
{
    public static float ApplyCriticalMultiplier(float damage, bool isCritical)
    {
        return isCritical ? damage * 2f : damage;
    }
}
```

Do not combine two similar damping formulas if player movement and camera movement have different owners, tuning needs, and future reasons to change. A generic `ApplyDamping(value, factor, mode, useUnscaledTime)` can be less maintainable than two small domain-specific methods.

## 3. Cohesive MonoBehaviour Extraction

A large component is not automatically wrong. Extract when responsibilities are independent.

Before:

```csharp
public sealed class ZombieController : MonoBehaviour
{
    // Navigation, health rules, UI, loot, audio, save state, and ragdoll.
}
```

A reasonable boundary might be:

- `ZombieController`: engine callbacks and feature coordination.
- `ZombieHealth`: cohesive health and death state.
- `ZombieNavigation`: NavMesh integration.
- `ZombieDeathPresentation`: ragdoll, audio, and visual response if those concerns are substantial.
- Plain C# damage calculation only if it benefits testing or reuse.

Do not create a class for every private method. Keep closely related operations together.

## 4. Simple Switch Versus State Pattern

Keep a small stable state flow simple:

```csharp
private void UpdateState()
{
    switch (state)
    {
        case EnemyState.Chasing:
            UpdateChase();
            break;

        case EnemyState.Attacking:
            UpdateAttack();
            break;
    }
}
```

Move toward State objects when each state gains substantial independent data, enter/exit behavior, transition rules, tests, or expected variants. Do not introduce the pattern only to remove a two-case switch.

## 5. Guard Clauses Without Fragmentation

Prefer a visible main path:

```csharp
public bool TryReload()
{
    if (isReloading)
        return false;

    if (ammoInMagazine >= magazineCapacity)
        return false;

    if (reserveAmmo <= 0)
        return false;

    StartReload();
    return true;
}
```

Do not extract every condition into a separate file or class. Extract a named query only when it expresses a reusable or non-obvious domain rule.

## 6. Readability Versus Hot-Path Optimization

A readable LINQ query during one-time initialization can be appropriate. A query allocating every frame across thousands of enemies may deserve replacement after profiling.

Keep the optimized loop clear:

```csharp
private readonly List<Target> visibleTargets = new List<Target>();

private void CollectVisibleTargets(IReadOnlyList<Target> candidates)
{
    visibleTargets.Clear();

    for (int i = 0; i < candidates.Count; i++)
    {
        Target candidate = candidates[i];
        if (candidate.IsVisible)
            visibleTargets.Add(candidate);
    }
}
```

Document the measured hot-path reason if the less expressive form is retained. Do not spread non-alloc patterns into cold code where they reduce clarity without meaningful value.
