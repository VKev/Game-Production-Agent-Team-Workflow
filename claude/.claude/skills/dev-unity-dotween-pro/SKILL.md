---
name: dev-unity-dotween-pro
description: Design, implement, debug, and verify runtime or visual Unity animation with DOTween and DOTween Pro. Use for tween lifecycles, Sequences, DOTweenAnimation, DOTweenPath, TextMesh Pro character animation, easing, pooling, or performance issues involving DG.Tweening.
---

# DOTween Pro Development

Read [references/sources.md](references/sources.md). Confirm the installed DOTween fingerprints, inspect the project's actual `DOTweenSettings.modules` state, and require `DOTweenSetupRequired() == false` before diagnosing missing modules or writing integration code. A false setup-required result alone does not prove that a module is enabled.

## Choose the animation surface

- Use code tweens for stateful gameplay, reusable components, dynamic targets, and explicit lifetime control.
- Use `DOTweenAnimation` for designer-authored component animation that is naturally configured in the Inspector.
- Use `DOTweenPath` for its supported transform paths; it does not provide every rotation or `RectTransform` path behavior.
- Use a `Sequence` for ordered/overlapping orchestration. Build it once when possible instead of reconstructing it every frame.

## Workflow

1. Identify target ownership, start/end values, time domain, interruption policy, and the event that owns cleanup.
2. Create the tween at a bounded lifecycle point. Store the `Tween`/`Sequence` when later pause, rewind, replacement, or kill is required.
3. Set target/id only when filtered control is needed. Prefer the direct tween reference for local ownership.
4. Define update mode intentionally: scaled time by default; independent update only for UI or systems that must ignore `Time.timeScale`.
5. Decide replacement behavior before replay: restart, complete, rewind, or kill and recreate. Avoid stacking duplicate tweens accidentally.
6. Link cleanup to the owning GameObject or kill in the appropriate disable/destroy path. Account for pooled objects, where disable is not destruction.
7. For Pro visual components, access generated tweens only after `Awake`; use `GetTweens()` or `GetTween()` as documented.

## Performance and correctness

- Do not allocate new tweens in `Update`/`LateUpdate` loops.
- Avoid callbacks that capture large object graphs on frequently created tweens.
- Set capacities only after profiling shows startup resizing matters.
- Keep gameplay state authoritative; animation completion callbacks should not become the only source of critical state when a tween can be killed.
- Use safe mode and logs during integration, then verify behavior under pooling, scene unload, pause, and target destruction.

## Verification

Compile, enter Play Mode, exercise replay/interruption/disable/destroy paths, inspect DOTween warnings, and confirm final state after both completion and early kill. Visual smoothness still requires direct observation.

## Boundaries

- Do not edit Demigiant package files or call private setup APIs.
- Do not mix a separate free DOTween copy with DOTween Pro.
- Do not claim a tween is leak-free without observing its owner lifecycle.
