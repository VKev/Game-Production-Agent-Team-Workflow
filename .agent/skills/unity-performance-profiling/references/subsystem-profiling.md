# Subsystem profiling

## Table of contents

1. Physics
2. UI
3. Loading and streaming
4. Animation
5. Audio
6. Navigation and AI
7. Cross-subsystem checks

## 1. Physics

Use the Physics or Physics 2D Profiler modules and CPU Timeline to inspect simulation cost, contact counts, active bodies, queries, and fixed-step behavior.

Check:

- Number of `FixedUpdate` and physics steps in long frames.
- `Time.fixedDeltaTime` and maximum allowed timestep.
- Active rigidbodies, sleeping behavior, collision-detection mode, constraints, and interpolation.
- Collider count, shape complexity, scale, layers, and collision matrix.
- Trigger/contact callbacks and script work performed inside them.
- Raycast, cast, overlap, and `NavMesh.SamplePosition` frequency and maximum distance.
- Repeated synchronization caused by transform changes or auto-sync settings.
- Ragdolls and physics objects left active outside relevance range.

Prefer reducing query count, narrowing layer masks, reusing buffers, simplifying shapes, or distributing work only when measurements show the relevant cost. Non-allocating queries remove managed allocation but do not make the physics query itself free; handle buffer truncation explicitly.

## 2. UI

Use UI and UI Details Profiler modules, CPU Timeline, Frame Debugger, and overdraw tools.

Check:

- Canvas rebuild and batch rebuild frequency.
- Layout-system recalculation and nested layout groups.
- Text generation, dynamic font atlases, and frequent string changes.
- GraphicRaycaster cost and number of raycast targets.
- Large canvases invalidated by a small frequently changing element.
- Animator usage on UI, masking, clipping, and transparency overdraw.
- Creation/destruction of list items versus virtualization or pooling.
- Multiple cameras and render modes.

Separate static and frequently changing UI only when the rebuild evidence justifies more canvases. Additional canvases can also increase batching and management cost.

## 3. Loading and streaming

Profile cold and warm paths separately. Inspect:

- Asset I/O, decompression, deserialization, dependency loading, and activation.
- Main-thread spikes during `Instantiate`, scene activation, shader creation, or texture upload.
- Addressables/AssetBundle handle ownership and cache behavior.
- Synchronous API calls and `WaitForCompletion` usage.
- Large batches of initialization in `Awake`, `OnEnable`, or `Start`.
- First-use shader, animation, audio, pool, or static-constructor work.
- Async operations that are asynchronous only for part of the pipeline.

Stage work across frames only when latency and correctness allow it. Do not hide total loading cost behind an animation without measuring user-visible latency and memory peaks.

## 4. Animation

Check:

- Animator count and enabled state.
- Skinned-mesh count, bones, blend shapes, update mode, and visibility behavior.
- Animator Controller layer/state complexity and parameter writes.
- Root-motion and IK callbacks.
- Animation events and StateMachineBehaviour script work.
- Culling mode and off-screen characters.
- Ragdoll/Animator overlap during transitions.

Measure both CPU animation evaluation and GPU skinning/vertex cost when applicable.

## 5. Audio

Use the Audio Profiler and memory tools to inspect:

- Voice count, virtual voices, DSP load, and mixer effects.
- Clip load type, decompression, streaming, channels, and sample rate.
- Repeated `PlayOneShot`, source creation, and spatialization cost.
- Large decompressed clips retained in memory.
- Audio thread underruns or main-thread loading spikes.

Do not lower quality globally without identifying which clips or effects dominate.

## 6. Navigation and AI

Check:

- Path recalculation frequency and simultaneous requests.
- Agent count, avoidance quality, obstacle carving, and NavMesh updates.
- Expensive sensor queries, line-of-sight checks, and broad scans.
- State-machine update frequency for distant or inactive agents.
- Allocation from query result construction.
- Main-thread-only engine API boundaries before considering Jobs.

Use spatial indexes, update staggering, cached data, or reduced frequency only when gameplay responsiveness remains correct.

## 7. Cross-subsystem checks

A subsystem marker can contain project code. Expand it before assuming the engine is the root cause. For example:

- Physics callbacks can execute expensive combat logic.
- UI rebuilds can be triggered by per-frame string updates.
- Loading spikes can be caused by user initialization code after an asset completes.
- Animation events can trigger spawning or physics work.
- Job completion stalls can be caused by immediate data consumption on the main thread.

Always trace from the long frame to the project-owned cause and then verify the total frame after the change.
