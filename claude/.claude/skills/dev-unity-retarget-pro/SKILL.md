---
name: dev-unity-retarget-pro
description: Configure, preview, bake, run, and debug KINEMATION Retarget Pro animation retargeting. Use for rig assets, bone-chain mapping, retarget profiles/features, Generic character baking, realtime DynamicRetargeter workflows, FPS weapon/arms retargeting, or FBX export.
---

# Retarget Pro Development

Read [references/sources.md](references/sources.md) and inspect the installed `RetargetPro.Runtime`/Editor assemblies before acting. The registered archive is fingerprinted but has no trustworthy embedded version, so online docs may describe a newer major release.

## Workflow

1. Confirm source and target import rigs, skeleton roots, scale, orientation, and reference poses. Preserve original models/clips.
2. Create/verify a Rig Asset for each skeleton and map coherent bone chains. Exclude twist/helper bones when they should not form independent chains.
3. Create a `RetargetProfile` with source/target characters, rigs, and source/target poses. Use separate profiles when animation families need different pose corrections.
4. Add only required features:
   - Basic/direct retargeting for ordinary chain transfer.
   - IK feature for end-effector alignment; arm/leg chains must end at the hand/foot target.
   - Root/pelvis or transform features for controlled translation/orientation.
   - FPS/weapon features when the animation includes a coordinated item rig.
5. Preview across several representative clips and inspect feet, hands, pelvis/root, weapon alignment, and extreme poses.
6. Bake to new clips/assets; never overwrite the source animation. Verify curves, root motion, loop settings, events, and avatar/rig compatibility after baking.

## Realtime retargeting

Use `DynamicRetargeter` when a live source pose must drive a target. The target needs an Animator as required by the installed workflow; keep its controller state intentional. Prefer fewer, larger chains where quality allows because each chain/feature can add animation jobs. Profile with multiple characters.

Current public documentation states that input may be Humanoid or Generic while the target/output workflow is Generic and Humanoid baking is not supported. Confirm this against the installed window/source before enforcing it because the archive is unversioned.

## Verification

Test reference-pose matching, several clip categories, mirrored/weapon poses, root motion, looping, runtime start/stop, and target scaling. Compare preview and baked output. Confirm generated assets remain project-owned and compile/build without Editor references.

## Boundaries

- Do not modify source FBX files or package code to force a mapping.
- Do not bake over original clips.
- Do not assume current V5 marketplace behavior matches the installed unversioned snapshot.
