# Pooling and Voice Budgeting

## Keep the concepts separate

Audio pooling and voice budgeting solve different problems:

- **Pooling:** reuse GameObjects and AudioSources to reduce repeated construction, destruction, and related allocations.
- **Active playback cap:** limit how many instances the game permits at once.
- **Real voice limit:** limit how many AudioSources Unity renders audibly at once.
- **Virtual voices:** preserve playback state for sources Unity does not currently render as real voices.

`ObjectPool<T>.maxSize` limits retained inactive items. It does not cap active emitters, total created emitters, or audio voices. Read `dev-unity-object-pooling` before implementing the pool itself.

## Define the audio lease reset

Reset every field that a lease can mutate. At minimum, inspect:

- `Stop`, scheduled playback, clip, time or sample position, loop, play-on-awake, mute, bypass flags, priority, volume, pitch, pan, spatial blend, reverb, Doppler, spread, rolloff, min/max distance, mixer group, listener-ignore flags, and custom curves.
- Transform parent, world position, rotation, follow target, owner, and scene references.
- Playback state, lease flag, handle generation, category membership, concurrency node, timestamps, and completion callbacks.
- Coroutines, fades, async operations, cancellation sources or registrations, subscriptions, and delayed actions.

Apply required request state before activation when `OnEnable` reads it. Stop work and remove budget membership before deactivation and release. Pair every acquire with exactly one release and guard against collision, timeout, explicit stop, scene cleanup, and natural completion racing to return the same emitter.

## Detect completion safely

- Use `AudioSource.isPlaying` only for a simple non-pausable, non-looping, immediately started one-shot contract.
- Do not release on `isPlaying == false` when pause, scheduling, delayed start, or manual seeking exists.
- Track pause separately from completion.
- Keep loops active until explicit stop, owner cancellation, scene cleanup, or a documented loop policy ends them.
- Recheck that the lease generation still matches before a delayed callback or coroutine releases an emitter.
- Remove naturally completed emitters from linked lists, queues, dictionaries, and category counters. Never leave a reusable emitter referenced by an old budget entry.

## Design admission policy

Define policy at the narrowest useful level:

- Global active-emitter ceiling when resident objects or total playback must be bounded.
- Category budgets for music, dialogue, UI, weapons, impacts, footsteps, ambience, or project-specific groups.
- Per-definition maximum instances for spam-prone repeated clips.
- Cooldown or coalescing for events whose repetitions add no useful information.
- Protected categories or instances that ordinary effects cannot steal.

Reject, replace, coalesce, or steal explicitly. Do not silently combine policies.

## Choose a voice to steal

Use a stable scored or ordered policy based on product intent. Candidate inputs include:

- category protection
- authored priority
- whether the sound is looped or critical
- current audibility or listener distance
- age and remaining duration
- whether another instance of the same definition is already playing
- whether the sound is virtual

For repeated impacts, replacing the oldest same-category instance can be reasonable. For dialogue, music, UI, or telegraph sounds, it can be unacceptable. Stop or fade the selected instance, remove it from all active structures, then reuse or release it exactly once.

Remember that Unity priority uses lower numeric values as higher priority. Real-voice selection also depends on audibility. Do not treat authored priority as the only runtime decision.

## Size and prewarm from evidence

- Estimate steady concurrency from event rate and maximum active lifetime, then add measured burst headroom.
- Prewarm distinct emitters during an acceptable loading phase only when first-use creation is visible or prohibited.
- Do not prewarm to pool `maxSize` automatically.
- Track active, inactive, total created, overflow destroyed, rejected, stolen, and peak concurrent counts.
- Compare the same burst before and after pooling for CPU, `GC.Alloc`, frame spikes, and resident memory.

Retain the simpler non-pooled path when construction is rare or the measured benefit does not justify reset and ownership complexity.
