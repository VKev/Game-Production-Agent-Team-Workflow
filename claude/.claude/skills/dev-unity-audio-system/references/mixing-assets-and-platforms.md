# Mixing, Assets, and Platforms

## Design mixer routing by responsibility

Use an AudioMixer group hierarchy that matches how the product needs to control the mix, not the scene hierarchy. A practical starting point is:

```text
Master
|-- Music
|-- Dialogue
|-- UI
|-- SFX
|   |-- Weapons
|   `-- Impacts
`-- Ambience
```

Keep it smaller when the product does not need separate control. Route every managed definition to an intentional group and define a fallback route for missing data.

- Use snapshots for coherent multi-parameter states such as paused, dialogue focus, underwater, low health, or menu transitions.
- Use ducking only when one category should predictably attenuate another; verify attack, release, and intelligibility by listening.
- Keep exposed parameter names stable because runtime code addresses them by string.
- Convert user-facing normalized volume to the mixer's expected attenuation representation carefully. Clamp mute boundaries and test saved settings at minimum, midpoint, and maximum.
- Do not duplicate global volume changes on both AudioSources and mixer groups without a clear reason.

## Author spatial behavior deliberately

- Use 2D playback for UI and non-positional music unless the design requires otherwise.
- Use mono clips for spatial point sources when stereo width would conflict with positional panning; audition exceptions rather than forcing every clip to mono.
- Set spatial blend, rolloff, min/max distance, spread, Doppler, reverb-zone mix, and spatializer behavior from the sound's role and movement.
- Avoid expensive or distracting Doppler on rapid effects when it adds no perceptual value.
- Verify listener ownership and ensure only the intended active AudioListener contributes to the mix.
- Test distance, occlusion or obstruction integrations, camera transitions, and split-screen or listener changes when applicable.

## Select clip import settings per content type

Use these as starting hypotheses and verify on the target platform:

- **Short, frequently played SFX:** consider Decompress On Load with PCM or ADPCM when memory permits and low playback CPU or latency matters.
- **Medium clips:** consider Compressed In Memory when decompressed memory is excessive and mixer-thread decode cost is acceptable.
- **Long music, ambience, or dialogue:** consider Streaming when its per-clip buffer and streaming CPU are justified.
- **Noisy repeated sounds:** ADPCM can be a useful CPU and size compromise.
- **Smooth or quality-critical material:** audition PCM or Vorbis at appropriate quality; do not select by file size alone.

Unity documents that Streaming clips carry per-clip overhead even when audio data is not loaded. Avoid many simultaneous streaming clips without measurement.

Use Load In Background when deferred readiness is acceptable and a main-thread load stall must be avoided. Check `AudioClip.loadState` and define what happens when playback is requested before loading finishes. Disable Preload Audio Data only when ownership includes an explicit load and unload policy.

Create platform overrides from device evidence. Verify codec availability, memory, CPU, latency, speaker behavior, and headphones separately where they affect the product.

## Treat global audio settings as budgets

- Keep Max Virtual Voices larger than the intended managed voice population and investigate console warnings or lost state.
- Treat Max Real Voices as a platform performance and quality budget, not as a substitute for category policy.
- Change DSP Buffer Size only for a measured latency or stability requirement; smaller buffers can increase CPU pressure.
- Enable Virtualize Effect only after verifying the desired CPU and audible behavior for culled sources.
- Do not raise global limits merely to hide uncontrolled sound creation.

Audio Mixer support and behavior can differ by platform; Unity 6.3 documents that WebGL does not support Audio Mixers. Route WebGL requirements through an explicit fallback rather than assuming desktop mixer behavior.

## Verify the audible product

- Audition quiet and loud scenes, rapid repeated effects, dialogue over music, pause and resume, focus loss, scene changes, and user volume extremes.
- Verify on target speakers and representative headphones when spatial balance or low-frequency content matters.
- Check clipping, pumping, masking, phase issues, discontinuities, delayed first play, stream starvation, and abrupt voice stealing.
- Treat human mix approval as separate from compilation, automated tests, and profiler success.
