# Profiling and Verification

## Define the scenario and budget

Record:

- Unity version, target platform and device, build type, scripting backend, quality, frame pacing, and audio project settings.
- Scene, listener position, mixer snapshot, category volumes, clip set, event rate, expected concurrency, duration, and pause state.
- Target real voices, managed active emitters, CPU, DSP CPU, streaming CPU, memory, `GC.Alloc`, worst-frame behavior, and acceptable audible degradation.

Use a target-device Development Build for authoritative performance conclusions. Use Editor captures for fast diagnosis only.

## Inspect the right evidence

In the Audio Profiler, inspect:

- Total, playing, and paused AudioSources.
- Audio Voices and which sources are virtual.
- Total Audio CPU, DSP CPU, Streaming CPU, and other audio CPU.
- Total Audio Memory, sample memory, streaming file memory, and streaming decode memory.
- Detailed channels and groups, plays, audibility, volume, mixer group, priority, 3D state, distance, loop state, and duration.

Use the CPU Profiler and allocation call stacks to separate audio-engine cost from gameplay request code, builders, collections, logging, `Instantiate`, `Destroy`, and garbage collection. Record pool counters beside profiler captures so fewer allocations are not mistaken for fewer voices.

## Correctness matrix

Verify every applicable row:

| Scenario | Required observation |
|---|---|
| First lease and reused lease | Identical configured behavior with no stale state |
| Rapid overlap | Defined admission, rejection, coalescing, or stealing |
| Natural completion | Removed from active policy and returned exactly once |
| Explicit stop | Playback, fades, callbacks, and budget membership end once |
| Pause and resume | Paused state is not treated as completion |
| Loop | Remains owned until explicit policy ends it |
| Owner destroyed | Sound either completes independently or stops by contract |
| Scene unload or scope disposal | Owned sounds stop and handles become invalid |
| Reused handle or delayed callback | Cannot control or release a later lease |
| Missing or loading clip | Classified failure or documented deferral without pool leak |
| Voice pressure | Protected categories remain audible as designed |
| Application exit or Play Mode stop | No duplicate roots, dangling operations, or errors |

Use Edit Mode tests for pure admission, priority scoring, handle generations, and state transitions. Use Play Mode tests for AudioSource behavior, pooled GameObjects, scene lifetime, pause, scheduling, and mixer integration.

## Compare optimizations fairly

1. Capture the same workload before the change.
2. State one testable hypothesis, such as pooling reduces spawn spikes or a category cap reduces real-voice contention.
3. Change one dominant factor when practical.
4. Match device, build, scene state, event sequence, duration, mixer state, and capture settings.
5. Compare several runs and distributions rather than one favorable frame.
6. Check regressions in audible quality, latency, memory, loading, and code complexity.
7. Keep, revise, or revert from evidence.

Do not attribute lower voice count to pooling unless admission policy also changed. Do not attribute reduced GameObject count to lower DSP CPU without Audio Profiler evidence.

## Required report

```text
Environment:
- Unity and target:
- Build and audio settings:

Scenario and policy:
- Reproduction:
- Categories, caps, and voice-stealing rule:

Architecture:
- Service and lifetime owner:
- Playback paths and handle behavior:
- Pool type and reset contract:

Evidence:
- Correctness tests:
- Audio Profiler:
- CPU, GC, and memory:
- Before and after:

Audible validation:
- Listening conditions:
- Human mix or spatial QA:

Decision:
- Keep, revise, or revert:
- Pending device, listening, or lifecycle checks:
```

Clearly label any recommendation that was not measured or heard as a hypothesis.
