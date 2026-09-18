# Architecture and Playback

## Model the contracts

Keep authored data, one playback request, and live state distinct:

- **Sound definition:** clip or clip set, mixer category, authored priority, base volume and pitch, spatial defaults, loop policy, concurrency policy, and optional cooldown.
- **Play request:** runtime position or follow target, volume and pitch modifiers, delay, caller or owner, and category-specific overrides.
- **Playback state:** leased emitter, state, start or scheduled DSP time, handle generation, budget membership, and completion ownership.

Use a `ScriptableObject` definition when designers need reusable authored assets. Use a serializable embedded definition when the data belongs only to one component and asset indirection would add no value.

Avoid a mutable fluent builder that silently carries options into the next play. If the project keeps a builder for ergonomics, reset every option after `Play` and prevent concurrent reuse. Prefer a readonly request struct or explicit parameters for hot repeated calls.

## Shape the service narrowly

A typical boundary can expose only what the product needs:

```text
PlayOneShot(definition, request)
Play(definition, request) -> AudioHandle
Stop(handle, fade)
Pause(handle)
Resume(handle)
SetCategoryVolume(category, value)
ApplyMixState(state, transition)
```

- Return no handle for disposable SFX unless later control is required.
- Make a handle opaque. Store an emitter slot plus a monotonically increasing generation or another lease token inside the service.
- Reject a handle whose generation no longer matches the active lease.
- Do not expose the raw AudioSource or pool to ordinary gameplay callers.
- Keep global category control separate from instance control.

## Choose ownership and scope

- Use scene ownership for scene-only ambience, local emitters, or prototypes with no cross-scene requirements.
- Use session ownership when audio state should survive scene changes within a run but reset for the next run.
- Use application ownership for genuine global music, user mixer settings, and shared playback infrastructure.
- Align the emitter hierarchy and cleanup with the owning scope. Do not rely on `DontDestroyOnLoad` and a DI root to own the same service simultaneously.

If VContainer is installed:

- Register a plain C# audio service against a narrow interface when possible.
- Register scene components with component-specific APIs and inject them rather than searching globally.
- Use a factory only when runtime parameters or prefab creation require it.
- Dispose the owning scope to stop sounds, invalidate handles, release subscriptions, and clear active leases.
- Read `dev-unity-vcontainer` for installed-version APIs and exact lifetime behavior.

Do not install VContainer solely for audio. Preserve the project's current composition model when it is adequate.

## Select the playback path

- Use a dedicated AudioSource for music, ambience, dialogue, or another sound that needs individual pause, seek, fade, scheduling, or loop control.
- Use a pooled emitter for short positional or independently controlled sounds whose object lifecycle is repeated.
- Use `PlayOneShot` on a stable source when overlapping clips may share its transform and controls and do not need independent handles.
- Use `PlayClipAtPoint` only for infrequent convenience playback; it creates a temporary GameObject and destroys it after playback.
- Use `PlayScheduled` with `AudioSettings.dspTime` for gapless music, beat alignment, or other sample-accurate scheduling. Keep at least two dedicated sources when alternating scheduled clips.

## Define pause, loops, fades, and completion

- Treat pause as a first-class state. Unity reports `AudioSource.isPlaying == false` while paused.
- Define whether each category follows `AudioListener.pause`, ignores it, uses mixer snapshots, or keeps playing.
- Keep UI confirmation audio available during pause only when product intent requires it; use `ignoreListenerPause` deliberately.
- Require explicit ownership and stop behavior for loops. Never wait for a loop to complete naturally.
- Base fades on the intended clock: scaled game time, unscaled time, or DSP time. Cancel or replace an existing fade deterministically.
- Do not infer a reliable end time from `clip.length` alone when pitch, scheduling, streaming, seeking, or pause can change the contract.
- Stop scheduled or active playback and invalidate the lease before returning an emitter.

## Migrate incrementally

1. Characterize current public APIs, serialized data, mixer assets, prefab references, persistence, and callers.
2. Establish a narrow service boundary without changing every authored sound asset at once.
3. Move one playback category or caller group at a time.
4. Preserve asset GUIDs, mixer routes, scene wiring, save keys, and user volume behavior.
5. Remove static `Instance` access only after all callers and lifecycle paths use the new owner.
6. Verify scene transitions, play-mode exit, domain-reload settings, and repeated sessions before deleting compatibility adapters.
