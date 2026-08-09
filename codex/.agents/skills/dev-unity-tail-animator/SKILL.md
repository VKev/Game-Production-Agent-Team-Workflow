---
name: dev-unity-tail-animator
description: Configure, integrate, extend, optimize, and verify FImpossible Tail Animator V2 procedural chain motion. Use for tails, tentacles, capes, 2D chains, collisions, CCD IK, waving, wind, runtime skinning, user APIs, update ordering, or chain performance.
---

# Tail Animator Development

Read [references/sources.md](references/sources.md) and the installed manual/readme. The readme declares `2.0.7.4.1`.

## Setup workflow

1. Add `TailAnimator2`, assign the start bone, and verify the automatically traversed chain. Assign the end bone when branching chooses the wrong path.
2. Use the single-bone offset option only for a deliberate one-segment setup.
3. Match update behavior to the Animator. Enable Animate Physics synchronization only when the Animator uses that update mode.
4. Tune the three base controls first: influence/amount, slithery bend behavior, and spring/curl balance. Bone density materially changes the response.
5. Add stretch/angle limits, smoothing, motion influence, and reaction speed only after the base chain is stable.
6. Add optional waving, wind, collision, partial blend, IK, or deflection one at a time and retest.

## Lifecycle and performance

- Fixed simulation rate can stabilize cost across very high frame rates; interpolation may be needed to avoid visible jitter.
- Prewarm can suppress startup settling.
- `Detach Children` can improve performance substantially but cannot be used when keyframed animation must keep the original parent chain.
- Use mesh visibility/distance optimization only after testing re-entry.
- Prefer selective collision lists over broad world collision for accuracy and cost. Configure per-segment collider data with gizmos.
- Use documented `User_` methods for runtime chain changes; inspect the included generator demos for skinning/dynamic segments.

## Integration

When attached to an animated Spine Animator chain, set the correct anchor and update the child after the parent. Avoid multiple procedural systems writing the same transform chain.

## Verification

Test idle/movement impulses, teleports, low/high FPS, pause, collision entry/exit, IK target loss, pooled disable/re-enable, visibility/distance transitions, and chained systems. Watch for stretching, jitter, tunneling, unstable startup, and one-frame lag.

## Boundaries

- Do not edit package/shared source.
- Do not enable `Detach Children` on keyframed chains.
- Do not use dense runtime collision/skinning without profiling target hardware.
