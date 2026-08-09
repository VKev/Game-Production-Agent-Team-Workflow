---
name: dev-unity-feel
description: Design, implement, extend, profile, and verify game feedback using More Mountains Feel, MMF_Player, MMFeedbacks, springs, shakers, and Nice Vibrations. Use when adding game feel, impact feedback, haptics, camera/UI feedback, or custom MMF_Feedback types.
---

# Feel Development

Read [references/sources.md](references/sources.md) and confirm `Assets/Plugins/Feel/readme.txt`. The registered snapshot is Feel `6.0`; do not write against a different online version without checking installed source.

## Core workflow

1. Start from the gameplay event and intended player information: what happened, to whom, how strong, and whether the feedback may overlap.
2. Put an `MMF_Player` on a dedicated object, add only feedbacks that serve that event, and bind it through a serialized reference or UnityEvent.
3. Trigger `PlayFeedbacks()` from the authoritative event. Use initialization, stop, reset, reverse, and direction APIs only when their lifecycle is actually required.
4. Configure timing, cooldown, chance, repeat, and time scale deliberately. Avoid using random chance for feedback that communicates critical state.
5. For pooled objects, reset/stop persistent feedback state before reuse and rebind transient targets safely.
6. Use shakers/global receivers when several producers intentionally drive one shared effect; otherwise prefer local explicit references.

## Extending Feel

For a reusable custom feedback, inherit from `MMF_Feedback`, give it a `FeedbackPath`, and override only the lifecycle hooks it needs, commonly initialization, play, stop, and reset. Keep the effect reversible when the player supports rewind/reverse, and avoid project-specific service lookups inside a generic feedback.

Third-party feedback code is activated through asmdef version defines. Use integrations only when the corresponding project package already exists. Do not add Cinemachine, Post Processing, VFX Graph, TMP, Input System, URP, or HDRP merely to silence an unused Feel integration.

## Quality and performance

- Layer feedback by causality: immediate confirmation, readable consequence, then ornament.
- Keep screen shake, flashes, time effects, and haptics accessible and bounded; honor reduced-motion or intensity settings where the project has them.
- Avoid heavy instantiation, repeated searches, or unbounded audio/particle overlap in frequent feedbacks.
- Profile high-frequency combat/UI events and test low-end/mobile haptics on device.

## Verification

Compile and observe the actual event in Play Mode. Test overlap, interruption, pooling, pause/time-scale, disabled targets, and scene unload. Report automated correctness, Editor observation, device haptics, and human readability/comfort as separate evidence.

## Boundaries

- Do not modify package source under `Assets/Feel` for project behavior; extend it from project-owned code.
- Do not let feedback become the authority for gameplay outcomes.
- Do not enable every available effect or dependency by default.
