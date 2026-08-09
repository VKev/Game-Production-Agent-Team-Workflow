---
name: dev-unity-cinemachine
description: Design, implement, migrate, review, and debug Unity camera systems that use Cinemachine. Use for Cinemachine Brain, CinemachineCamera or VirtualCamera, priorities, blends, follow and look-at targets, damping, orbit or FreeLook rigs, input axes, confiners, impulses, target groups, splines or dollies, Timeline cameras, camera shake, update timing, or Cinemachine 2-to-3 migration.
---

# Unity Cinemachine

Read [references/sources.md](references/sources.md) before making a version-sensitive claim. Treat the installed `com.unity.cinemachine` package and its bundled documentation as the exact API source.

## Establish the installed generation

Before designing or editing:

1. Read `Packages/manifest.json` and `Packages/packages-lock.json`, then confirm the resolved package through Unity Package Manager when the Editor is available.
2. Record the package version, source, Unity Editor version, render pipeline, input solution, target update method, and whether Timeline controls the output camera.
3. Search project code, scenes, prefabs, and assembly definitions for existing Cinemachine types and ownership. Do not infer a generation from an online example.
4. Load `dev-unity-mcp` for live hierarchy, Inspector, package, console, compilation, or camera-state work. Load `dev-unity-project-context` for project-owned source discovery and editing.

The major generations are not source-compatible:

| Installed generation | Namespace and central camera type | Rule |
|---|---|---|
| Cinemachine 2.x | `Cinemachine`, commonly `CinemachineVirtualCamera` | Use the installed 2.x API and documentation. Do not translate examples to 3.x names during an ordinary feature or bug fix. |
| Cinemachine 3.x | `Unity.Cinemachine`, `CinemachineCamera` | Use the 3.x component model and the exact installed minor-version API. |

Treat a 2.x-to-3.x upgrade as a migration: inventory cameras and extensions, read Unity's upgrade guide, preserve serialized behavior, compile, and visually compare every important shot and transition. Never mix the two APIs casually or perform the major upgrade as incidental cleanup.

## Design camera ownership

- Normally place one `CinemachineBrain` on each real Unity Camera that renders an independent view. The Brain selects the active Cinemachine camera and performs the blend.
- Let gameplay own camera intent and stable target transforms; let Cinemachine components own framing, motion, damping, collision, and blending. Avoid a gameplay script and the Brain both writing the same output Camera transform.
- Model camera modes as purposeful cameras or state, not as scattered priority writes. Define which system may activate a camera, how ties resolve, and how control returns after Timeline, cutscenes, death, pause, or scene changes.
- Keep `Follow` and look-at targets stable. If the visual target moves through animation or physics, use a dedicated tracking transform when that prevents hierarchy or pivot coupling.
- For split-screen or multiple displays, define one output Camera/Brain and a non-overlapping Cinemachine-camera set per view.

## Choose motion and transitions deliberately

1. Match target and Brain update timing to the source of motion. Smart Update is a strong default, not proof that timing is correct; verify physics, animation, interpolation, time scale, and camera jitter together.
2. Use damping for intentional response, not to hide unstable target motion. Check acceleration, reversal, teleport, respawn, and target replacement.
3. Give priorities and activation events explicit meaning. A higher-priority eligible camera wins; Timeline can override ordinary priority selection while it controls the Brain.
4. Author default and custom blends around gameplay semantics. Decide which transitions are cuts, which blend, their duration/style, and whether custom blends are required for particular camera pairs.
5. Configure input through the API and input package supported by the installed generation. Ensure only one path drives each axis and verify mouse, gamepad, rebinding, pause, and UI focus.
6. Add Confiner, Collider/Deoccluder, Impulse, Target Group, Spline/Dolly, or procedural extensions only for a concrete camera requirement. Each adds lifecycle, tuning, and verification cost.

## Implementation rules

- Preserve serialized fields and existing shot composition unless the task explicitly changes them.
- Prefer package-supported components and public APIs over writing directly to internal Cinemachine state.
- Centralize gameplay camera requests behind the project's existing camera coordinator when one exists; do not introduce a second global owner.
- Cache stable references used repeatedly. Define failure behavior for destroyed, unloaded, or temporarily missing targets.
- Keep camera shake readable and bounded. Use Impulse when installed and appropriate; coordinate it with Feel or other feedback systems so effects do not double-trigger.
- Do not assume a package installation, migration, or Inspector assignment succeeded from a file edit. Observe the actual component and compilation state.

## Verification

Verify the actual project, not only isolated code:

- package resolution, exact generation, compilation, and no new Cinemachine-attributable console errors;
- active-camera selection, priority ties, cuts, custom blends, and return from Timeline/cutscenes;
- follow/look-at framing at rest, acceleration, reversal, teleport, target loss, scene load, pause, and time-scale changes;
- jitter and update order with physics and animation targets;
- input ownership and sensitivity across supported devices;
- confiner boundaries, occlusion/collision recovery, impulse amplitude, and multiplayer/split-screen isolation when applicable;
- screenshots or play-mode observation for composition and transitions, plus human visual QA for comfort and readability.

Report automated, Editor, visual, and human-playtest evidence separately. A clean compile does not prove that a camera composition or blend feels correct.
