---
name: dev-unity-legs-animator
description: Configure, integrate, extend, optimize, and verify FImpossible Legs Animator procedural IK. Use for humanoid, animal, insect, or multi-leg grounding, foot alignment, gluing, 360 movement, hips stabilization, step events, impulses, modules, or runtime control.
---

# Legs Animator Development

Read [references/sources.md](references/sources.md) and the installed manual/readme. The package readme declares `1.0.4.6.1`; exact runtime APIs live under the package-specific Legs Animator root.

## Prerequisites

- Disable model-import `Optimize Game Objects`; procedural bone access otherwise fails.
- Require a normal parented skeleton with hips above leg chains.
- Prefer Unity's Z-forward orientation or add a stable parent transform to correct model orientation.
- Treat `Scale Reference` as a first-class calibration value; many motion thresholds derive from it.

## Setup workflow

1. Add `LegsAnimator` to the character root and assign the hips bone.
2. Add each leg, verify upper/lower/foot bones, side, and opposite-leg pairing. Automatic detection is a starting point, not proof.
3. Refresh foot/IK parameters and inspect gizmos. Keep calibration enabled when source animation omits required bone tracks.
4. Configure ground layers, ray origin, and raycast style. Use `No Raycasting` only for a deliberate flat-ground workflow.
5. Tune foot alignment and hips/body adjustment before gluing. Then configure idle or movement gluing to address stepping and foot sliding.
6. Drive grounded/moving/sliding state from explicit project state, Animator parameters, Rigidbody velocity, or documented `User_` APIs. Use one authority per state.
7. Add modules such as 360 movement or impulses only after the base legs are stable.

## Runtime and integration

- Use `User_` methods for supported runtime control rather than modifying plugin internals.
- Pair step events through the provided receiver interface when detailed foot/raycast data is needed.
- Coordinate with Spine/Tail/other IK systems so they do not fight over hips or leg bones; document update order.
- Use distance/visibility optimization only after verifying smooth re-entry and camera ownership.

## Verification

Test idle, start/stop, rotation in place, acceleration, slopes, stairs, missing ground, jump/land, opposite-leg timing, low/high frame rate, off-camera disable/re-entry, and several characters. Watch for foot sliding, double steps, knee flips, over-stretch, hips popping, and raycast cost.

## Boundaries

- Do not edit shared FImpossible or Legs Animator source.
- Do not enable every motion module before the base rig is calibrated.
- Do not infer good grounding from gizmos without observing animation in Play Mode.
