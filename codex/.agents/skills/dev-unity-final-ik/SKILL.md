---
name: dev-unity-final-ik
description: Design, configure, integrate, debug, and verify character inverse kinematics with RootMotion Final IK. Use for Aim IK, LookAt IK, limb, CCD, FABRIK, Biped IK, Full Body Biped IK, VRIK, Grounder, Interaction System, rotation limits, or solver execution order.
---

# Final IK Development

Read [references/sources.md](references/sources.md), confirm `FinalIK ReadMe.rtf`, and inspect installed solver source for exact APIs. The registered snapshot declares Final IK `2.5`.

## Select the solver intentionally

- `LimbIK`/trigonometric IK: one arm or leg with a conventional three-bone chain.
- `CCDIK`: simple flexible chains where iterative bending is acceptable.
- `FABRIK`: longer chains and reach constraints; use `FABRIKRoot` for connected chains.
- `AimIK`/`LookAtIK`: aiming or gaze orientation.
- `BipedIK`: multiple biped effectors with lighter coordination.
- `FullBodyBipedIK`: coordinated full-body effectors and interaction-style offsets.
- `VRIK`: VR body solving from tracked targets.

Choose the smallest solver that satisfies the chain and interaction requirements.

## Workflow

1. Validate hierarchy, bone orientation, scale, Animator/avatar, and the package demo closest to the use case.
2. Add and configure the solver while the character is in a valid reference pose. Assign every required root, chain, target, bend goal, and weight explicitly.
3. Keep animation as the base pose unless the design is fully procedural. Apply IK after Animator evaluation and coordinate multiple solvers with `IKExecutionOrder` when order matters.
4. Blend solver and effector weights; do not enable/disable whole systems abruptly unless that discontinuity is intended.
5. Add rotation limits only where joint constraints are necessary and tune them against representative animations.
6. Use Grounder or Interaction System only when their additional ownership and callbacks are needed; do not combine overlapping correction systems without an execution-order plan.

## Runtime and performance

- Cache solver/component references; avoid hierarchy searches in hot paths.
- Disable or reduce solver work by observed relevance/LOD when the API supports it, while preserving pose transitions.
- For VRIK calibration, separate calibration data from transient tracker state and test reacquisition.
- Profile several simultaneous characters; one correct rig is not scale evidence.

## Verification

Test reference pose, animation transitions, target loss, weight zero/one, extreme reach, root motion, uneven ground, mirrored directions, and pooled/disabled characters. Observe Scene gizmos and Play Mode motion; compilation alone cannot prove stable IK.

## Boundaries

- Do not edit RootMotion package source or demo assets for project logic.
- Do not stack solvers that write the same bones without a documented order.
- Do not hide a bad rig/reference pose with extreme solver weights.
