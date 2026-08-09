# Pooled State Reset Contracts

## Contents

1. Reset strategy
2. Universal state
3. Physics
4. Particles, trails, audio, and rendering
5. Animation and AI
6. Gameplay and UI
7. Events, coroutines, and async work
8. Release-safety rules

## 1. Reset Strategy

Treat a lease as a state transition:

```text
Inactive in pool -> configured -> active lease -> stopped/reset -> inactive in pool
```

Prefer explicit methods such as:

```text
InitializePoolOwner(...)  // once after construction
Activate(spawn context)   // each Get
ResetForPool()             // each Release
ReturnToPool()             // idempotent public return path
```

Keep one-time initialization separate from per-lease reset. Do not repeat expensive `GetComponent` or immutable setup on every spawn.

Configure state before `SetActive(true)` when `OnEnable` depends on owner, target, position, health, or other spawn data. Deactivate after stopping callbacks and work on release.

## 2. Universal State

Reset only fields the object owns or mutates, including as applicable:

- Position, rotation, scale, and parent.
- Active state.
- Owner, instigator, target, team, layer, tag, or collision mask if changed.
- Lifetime, delay, cooldown, progress, counters, and flags.
- Cached hit results and temporary buffers.
- Runtime references to scene objects or assets.
- Material property blocks, renderer enabled flags, and per-instance visual values.
- Child object active states when gameplay changes them.

Do not assume disabling a GameObject resets fields. It only changes active lifecycle.

## 3. Physics

For `Rigidbody` in Unity 2022.3, inspect and reset mutated values such as:

- `velocity`.
- `angularVelocity`.
- Position and rotation, preferably before activation.
- `isKinematic`, gravity, constraints, interpolation, collision detection mode, and mass only if the lease changes them.
- Sleeping or wake state when it affects behavior.

For colliders and joints:

- Restore enabled state.
- Restore trigger state, material, connected body, break settings, or joint targets only if mutated.
- Prevent callbacks from returning the item twice after the first collision.

For pooled enemies using `NavMeshAgent`:

- Stop movement and reset or clear the path.
- Restore speed, acceleration, stopping distance, avoidance, and update flags only if modified.
- Place the agent on valid NavMesh before enabling movement.
- Verify reuse after death, ragdoll, warp, and scene transitions.

## 4. Particles, Trails, Audio, and Rendering

### Particle systems

- Stop emission and playback.
- Clear old particles when visual state must not carry over.
- Reset custom parameters changed per lease.
- Use the stopped callback or explicit duration to return once.
- Avoid both callback and timer returning the same effect without a lease guard.

### Trail renderers and line renderers

- Clear previous trail or points before reuse.
- Reset width, gradient, position count, and enabled state only when changed.

### Audio sources

- Stop playback.
- Reset time, clip, loop, pitch, volume, spatial settings, output mixer, and callbacks only when the lease changes them.
- Do not retain an owner or target reference after release.

### Renderers and materials

- Clear or restore `MaterialPropertyBlock` values.
- Avoid accidentally instantiating materials through `renderer.material` during reset.
- Restore enabled state and per-instance visual state.

## 5. Animation and AI

### Animator

Reset parameters and state that must not carry over. `Animator.Rebind` can be expensive; use it only when required and measured. A targeted reset of known parameters and transitions is often clearer.

### Ragdoll

- Restore bone transforms if required by the feature.
- Reset rigidbody velocity and kinematic state.
- Restore collider state.
- Return Animator and ragdoll ownership to the intended mode.
- Verify repeated death and respawn cycles, not only the first use.

### AI

- Clear current target, path, aggro, blackboard/runtime state, pending actions, and timers.
- Unsubscribe from perception or global events.
- Stop behavior coroutines or async tasks.
- Restore health and state-machine entry state.

## 6. Gameplay and UI

### Projectiles

- Reset velocity, angular velocity, lifetime, damage, owner, hit flags, penetration count, and ignored colliders.
- Clear trails and impact state.
- Guarantee only one terminal path releases the projectile.

### Enemies

- Reset health, status effects, loot state, target, AI state, animation, ragdoll, pathing, and event subscriptions.
- Verify no old wave, spawner, or player reference remains.

### Damage numbers and pooled UI

- Reset text, sprite, color, alpha, scale, anchored position, sorting, tween progress, CanvasGroup state, and listener bindings.
- Stop tweens or animations before release.
- Remove dynamic button listeners owned by the lease.

### General gameplay state

- Reset status effects, buffs, debuffs, damage multipliers, ownership, score contribution, and callbacks.
- Clear collections rather than replacing them when they are owned reusable buffers.

## 7. Events, Coroutines, and Async Work

On release:

- Unsubscribe lease-scoped C# events.
- Remove lease-scoped `UnityEvent` listeners added from code.
- Stop running coroutines owned by the item, or design them to observe lease generation/cancellation.
- Cancel UniTask/Task work with a lease-specific cancellation source.
- Prevent a late async continuation from mutating or returning an item after it has been leased again.
- Dispose lease-specific cancellation sources and create new ones on the next lease.
- Clear delegates and callbacks that capture prior owners.

When async work can outlive a lease, use a generation number or cancellation token so stale completions are ignored.

## 8. Release-Safety Rules

- Make `ReturnToPool` idempotent through a private leased/releasing flag.
- Set the guard before calling `Release` to prevent re-entrant collision, disable, or callback paths.
- Do not expose the raw pool to every consumer.
- Do not call `Release` from both `OnDisable` and explicit despawn unless the paths are coordinated.
- Do not call `Destroy` on pooled items during normal gameplay.
- In Editor, keep collection checks enabled while developing, but also enforce logical guards because player builds cannot rely on that check.
- After release, treat all external references to the object as invalid until a new lease is explicitly returned.
