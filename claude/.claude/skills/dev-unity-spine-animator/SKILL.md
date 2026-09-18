---
name: dev-unity-spine-animator
description: Configure, integrate, tune, and verify FImpossible Spine Animator procedural skeleton motion. Use for creature spine chains, Animator blending, reversed hierarchies, correction offsets, smoothing, angle limits, update ordering, or combining spine motion with Tail Animator.
---

# Spine Animator Development

The product name is **Spine Animator**; the setup archive is named `SpinalAnimator.unitypackage`. Read [references/sources.md](references/sources.md) and the installed four-page manual before configuration.

## Workflow

1. Add `FSpineAnimator` to the creature's main movement transform.
2. Assign the pelvis/start bone and last spine or neck/end bone, then build the chain. Verify every selected transform in Scene gizmos.
3. Set `Last Bone Leading` when the hierarchy/motion direction is reversed. Do not compensate for a wrong chain with extreme offsets.
4. Use Auto/Precise correction as a starting point and inspect orientation. If animation omits position or rotation tracks, enable the corresponding not-animated correction only for affected bones.
5. Keep Animator connection enabled when procedural motion should layer over keyframed animation; disable only for a deliberately standalone chain.
6. Tune position/rotation smoothing, angle limits, limit smoothing, straightening, and return speed gradually against several clips.
7. Correct unusual bone pivots with pivot/manual offsets after hierarchy and source pose are verified.

## Combining systems

When a child/tail chain depends on spine output, define the correct anchor and queue the child system after the parent spine update. Ensure Legs, Final IK, Tail, and Spine components do not write the same bones without a documented order.

## Verification

Test idle, locomotion, sharp turns, acceleration, jump/land, attacks, reversed direction, low/high frame rate, disabled/re-enabled Animator, and chained Tail/Spine components. Watch for drift, flipped rotations, snapping, cumulative offsets, and one-frame lag.

## Boundaries

- Do not edit FImpossible shared or Spine Animator source.
- Do not rely on the old image-only manual for exact current field names when installed source differs.
- Do not use smoothing to conceal an invalid skeleton orientation.
