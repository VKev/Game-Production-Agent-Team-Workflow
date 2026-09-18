# Sources

Use the installed Unity version and project assets as the source of truth. Prefer version-matched official Unity documentation for engine behavior.

## Unity 6.3 audio system

- [Audio overview](https://docs.unity3d.com/6000.3/Documentation/Manual/AudioOverview.html): AudioSources, AudioListeners, spatial playback, filters, reverb, and AudioMixer routing.
- [AudioSource component](https://docs.unity3d.com/6000.3/Documentation/Manual/class-AudioSource.html): authored playback, spatial, rolloff, priority, mixer, and bypass settings.
- [AudioSource API](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource.html): runtime playback and control surface.
- [`AudioSource.isPlaying`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource-isPlaying.html): playback-state contract and the paused-state false result.
- [`AudioSource.isVirtual`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource-isVirtual.html): whether Unity has culled a source from real playback.
- [`AudioSource.priority`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource-priority.html): priority range and lower-value higher-priority behavior.
- [`AudioSource.PlayOneShot`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource.PlayOneShot.html): overlapping playback on one source.
- [`AudioSource.PlayClipAtPoint`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource.PlayClipAtPoint.html): temporary positional AudioSource GameObject behavior.
- [`AudioSource.PlayScheduled`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSource.PlayScheduled.html): DSP-timeline scheduling and music stitching.
- [`AudioSettings.dspTime`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioSettings-dspTime.html): audio-system time for precise scheduling.
- [`AudioListener.pause`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioListener-pause.html): global pause behavior and listener-pause exceptions.

## Mixing, assets, and project budgets

- [Audio Mixer](https://docs.unity3d.com/6000.3/Documentation/Manual/AudioMixer.html): group routing, effects, snapshots, ducking, and the WebGL limitation.
- [Audio Mixer overview](https://docs.unity3d.com/6000.3/Documentation/Manual/AudioMixerOverview.html): category hierarchy, signal flow, exposed parameters, and snapshots.
- [Audio project settings](https://docs.unity3d.com/6000.3/Documentation/Manual/class-AudioManager.html): DSP buffer, max virtual voices, max real voices, and virtualized effects.
- [AudioClip importer](https://docs.unity3d.com/6000.3/Documentation/Manual/class-AudioClip.html): load types, compression, streaming overhead, background loading, preload, and platform overrides.
- [`AudioConfiguration.dspBufferSize`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AudioConfiguration-dspBufferSize.html): DSP buffer size and latency relationship.

## Pooling and profiling

- [`ObjectPool<T>`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Pool.ObjectPool_1.html): built-in pool lifecycle, callbacks, capacity, and thread-safety behavior.
- [Audio Profiler module](https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerAudio.html): playing sources, voices, CPU, DSP, streaming, memory, audibility, virtual state, and detailed channel/group inspection.

## Example implementation background

- [Optimize Game Sounds: Pooling Audio Sources in Unity](https://www.youtube.com/watch?v=BgpqoRFCNOs): tutorial that motivated the emitter-pooling and voice-budget review.
- [Unity Audio Pooling example repository](https://github.com/adammyhre/Unity-Audio-Pooling): example `SoundData`, `SoundBuilder`, `SoundEmitter`, and `SoundManager` implementation, including later community-driven queue cleanup and builder-caching guidance.

Treat the tutorial and repository as examples, not as the engine contract or a mandatory project architecture.
