---
name: dev-unity-audio-system
description: Design, implement, review, debug, and profile Unity runtime audio systems using AudioSource, AudioMixer, pooled emitters, voice budgets, 2D or 3D playback, music and loop handles, pause policies, fades, priority, and virtualization. Use for AudioManager or AudioService work, sound effects, audio-source pooling, SoundData or SoundEmitter patterns, mixer groups and snapshots, ducking, voice stealing and concurrency caps, sounds cut off with destroyed objects, overlapping sound spam, paused or looped audio bugs, audio allocations or profiler findings, VContainer integration, or migration away from singleton audio managers.
---

# Unity Audio System Development

Treat runtime audio as three related but distinct concerns:

1. Playback ownership and lifecycle.
2. Real-voice, virtual-voice, and category budgets.
3. Clip, mixer, DSP, streaming, CPU, and memory cost.

Do not claim that pooling AudioSources reduces simultaneous voices. Pooling reduces repeated object creation and destruction; admission, priority, audibility, and Unity's voice settings control concurrency.

Read only the references needed for the task:

- Read [architecture-and-playback.md](references/architecture-and-playback.md) when designing service boundaries, handles, pause, loops, fades, scheduling, or VContainer ownership.
- Read [pooling-and-voice-budgeting.md](references/pooling-and-voice-budgeting.md) when pooling emitters, resetting leases, limiting repeated sounds, or choosing voice-stealing rules.
- Read [mixing-assets-and-platforms.md](references/mixing-assets-and-platforms.md) when working with AudioMixer routing, snapshots, ducking, spatial audio, import settings, streaming, or platform differences.
- Read [profiling-and-verification.md](references/profiling-and-verification.md) when diagnosing performance, validating lifecycle behavior, or reporting results.
- Read [sources.md](references/sources.md) when an exact Unity API, version-sensitive behavior, or source attribution matters.

## Establish the project contract

1. Read the relevant project instructions, GDD, Unity version, target platforms, assembly definitions, and existing audio code and assets.
2. Inventory AudioSources, AudioListeners, AudioMixers, mixer groups, snapshots, clip import settings, persistent roots, service registrations, pool implementations, and audio-related project settings.
3. Define which sounds are SFX, UI, dialogue, ambience, music, or other project-owned categories.
4. Define required behavior for overlap, priority, pause, resume, stop, fade, loops, scene transitions, application focus, and destruction of the originating GameObject.
5. Record current real and virtual voice settings and available Audio Profiler evidence before proposing a performance rewrite.
6. Preserve the established stack when it is sound. Do not install an audio package, VContainer, UniTask, or a second pooling framework during feature work.

## Choose the smallest architecture

- Keep direct AudioSource usage for a few long-lived, scene-owned sounds when centralized management adds no value.
- Use a narrow audio service when gameplay needs reusable emitters, category policy, cross-scene ownership, handles, mixer control, or centralized verification.
- Separate authored sound definitions from per-play requests and live playback state.
- Return an opaque handle only when callers must later stop, pause, resume, fade, retarget, or query a sound. Keep disposable one-shot SFX fire-and-forget.
- Give the service or feature one clear ownership scope. If VContainer is already installed, use `dev-unity-vcontainer` for exact registrations and lifetime behavior.
- Prefer injected dependencies to a new persistent singleton. Preserve an existing singleton only when migration is outside scope or its ownership is already correct.
- Let each leased emitter return through its owning service, pool reference, or release callback. Do not hard-code a global manager lookup inside pooled emitters.

Read [architecture-and-playback.md](references/architecture-and-playback.md) before introducing a new service, handle, or migration.

## Route every play request deliberately

Use this order unless project evidence requires a documented variation:

```text
validate definition and request
-> evaluate category and per-sound admission policy
-> select or steal a voice when required
-> acquire an emitter or choose a simpler playback path
-> reset and configure all mutable AudioSource state
-> assign position, parent, mixer route, and ownership
-> start or schedule playback
-> track the active lease and handle generation
-> stop and return exactly once on completion or cancellation
```

- Use `AudioSource.PlayOneShot` only when shared-source position and controls are acceptable and individual playback ownership is unnecessary.
- Treat `AudioSource.PlayClipAtPoint` as a convenience for infrequent unmanaged sounds, not as a high-frequency pooling solution.
- Use DSP-time scheduling for gapless or rhythm-sensitive music rather than frame-time guesses.
- Keep mutable builder state out of hot paths unless the builder is reused safely and reset after every play. Prefer an immutable or value-like play request when practical.

## Make lifecycle explicit

- Distinguish `Playing`, `Paused`, `Stopping`, `Stopped`, `Scheduled`, and `Released` when the feature supports those states.
- Do not use `AudioSource.isPlaying == false` as a universal completion signal. It is also false while paused, and loops do not complete naturally.
- Give looped and long-lived sounds an explicit owner and stop path.
- Invalidate stale handles when an emitter is returned and reused. A handle from an earlier lease must never control a later sound.
- Define time-scale and application-pause behavior per category. Do not assume `Time.timeScale == 0` implements the desired audio pause policy.
- Cancel fades, coroutines, async work, scheduled playback, callbacks, and subscriptions before release.

## Separate pooling from voice budgeting

- Use `dev-unity-object-pooling` for generic `UnityEngine.Pool` selection, sizing, prewarming, ownership, double-release protection, and reset contracts.
- Pool only when measured or clearly repeated construction and destruction justify the lifecycle complexity.
- Treat pool capacity, retained inactive count, active playback cap, and Unity real-voice limit as different values.
- Define budgets by category and, when needed, by individual sound definition. Protect music, UI, or dialogue according to the product's priorities.
- Remove naturally completed or explicitly stopped emitters from every active-budget structure before reuse.
- Choose voice stealing from explicit evidence such as category, authored priority, audibility or distance, age, and loop protection. Do not always steal the oldest sound without considering product intent.

Read [pooling-and-voice-budgeting.md](references/pooling-and-voice-budgeting.md) before implementing emitter reuse or admission policy.

## Route, mix, and import intentionally

- Route categories through named AudioMixer groups rather than treating source volume as the complete mix.
- Use snapshots and ducking for coherent mix states such as pause, focus loss, dialogue, underwater, or low-health effects.
- Choose 2D or 3D behavior, rolloff, distance, spread, Doppler, reverb, and spatial blend from the sound's role.
- Select clip load type, compression format, quality, sample rate, background loading, and preload policy from clip length, repetition, latency, memory, CPU, and target platform.
- Use platform overrides only after auditioning and measuring the target build. Do not copy one import preset across music, dialogue, ambience, and rapid SFX.

Read [mixing-assets-and-platforms.md](references/mixing-assets-and-platforms.md) for the decision rules.

## Verify before reporting success

1. Compile the actual Unity project and clear relevant Console errors and warnings.
2. Exercise fresh and reused emitters, rapid overlap, natural completion, explicit stop, pause and resume, loops, fades, scene unload, owner destruction, and application exit or Play Mode stop.
3. Verify category caps, per-sound caps, priority behavior, protected sounds, voice stealing, stale-handle rejection, and exact-once release.
4. Inspect Audio Profiler source, voice, CPU, DSP, streaming, memory, audibility, virtual, and play-count evidence where performance matters.
5. Compare the same scenario before and after an optimization. Treat Editor captures as preliminary and target-device Development Build evidence as authoritative when the result matters.
6. Treat automated behavior tests, profiler evidence, listening quality, spatial perception, and human mix approval as separate verification layers.
7. Report Unity version, target platform, architecture and ownership, mixer and voice policy, pool evidence, tests, profiler results, and any unperformed listening or device validation.

Read [profiling-and-verification.md](references/profiling-and-verification.md) for the detailed matrix.

## Related skills

- Use `dev-unity-project-context` before navigating or editing a real project.
- Use `dev-unity-object-pooling` for generic pool mechanics and reset contracts.
- Use `dev-unity-vcontainer` for exact dependency registration, scopes, and disposal.
- Use `dev-unity-async-coroutines-unitask` for nontrivial fades, cancellation, scheduling coordination, or async ownership.
- Use `dev-unity-performance-profiling` for broader CPU, memory, GC, loading, or target-device investigations.
- Use `dev-unity-assets-addressables` when audio clip loading or release uses Addressables handles.
- Use `dev-unity-gameplay-architecture` when audio ownership requires changing module boundaries or dependency direction.

## Hard boundaries

- Do not rewrite a working audio system merely to match a tutorial pattern.
- Do not claim a performance gain from fewer GameObjects without profiling voices, CPU, GC, and memory separately.
- Do not increase global real voices, pool size, or prewarm count as an unmeasured fix.
- Do not let pooled emitters retain clips, owners, transforms, mixer routes, handles, callbacks, coroutines, or budget nodes from an earlier lease.
- Do not let paused audio be interpreted as completed.
- Do not hide unverified listening quality, spatial behavior, platform behavior, or Editor/player differences.
