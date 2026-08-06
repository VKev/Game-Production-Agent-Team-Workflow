# GPU and rendering profiling

## Table of contents

1. Identify CPU versus GPU pressure
2. Choose the right tool
3. Frame Debugger
4. Rendering cost categories
5. Mobile rendering checks
6. Validation rules

## 1. Identify CPU versus GPU pressure

Do not diagnose a GPU bottleneck from low FPS alone. Compare:

- Main-thread frame time.
- Render-thread frame time.
- GPU frame time when supported.
- Presentation and frame-pacing waits.
- Resolution or render-scale sensitivity.

Useful experiments:

- Reduce resolution or render scale without changing simulation. A large improvement suggests fill-rate, bandwidth, or GPU shading pressure.
- Temporarily reduce expensive shadows, post-processing, transparency, or shader features one category at a time.
- Capture the same camera and content state.

A CPU-side rendering bottleneck can have many batches, state changes, culling work, material setup, or script-driven renderer changes even when GPU time is acceptable. A GPU bottleneck can remain with low draw-call count if each pass is expensive.

## 2. Choose the right tool

Use:

- **CPU Profiler:** main-thread and render-thread submission cost.
- **GPU Profiler:** GPU time by rendering category when the platform and graphics API support it.
- **Frame Debugger:** ordered render events, passes, targets, batching breaks, and visual state. It is not a complete GPU timing tool.
- **Rendering Profiler module/statistics:** batches, SetPass calls, triangles, vertices, render textures, and related counters.
- **RenderDoc/platform tools:** shader, pipeline, texture, bandwidth, occupancy, and GPU-event details unavailable in Unity's built-in profiler.
- **SRP-specific debug tools:** URP/HDRP render graph, rendering debugger, overdraw, light, shadow, or material diagnostics when supported by the installed pipeline version.

Check Unity's GPU Profiler support matrix. Some platform/graphics-API combinations require external tools, and Graphics Jobs can affect GPU profiling support.

## 3. Frame Debugger

Use Frame Debugger to answer:

- Which render events build the frame?
- Why is an object rendered multiple times?
- Which pass, shadow map, post effect, or camera causes an event?
- Did batching or instancing occur?
- Which render target and shader pass are active?
- Where does the visual result become incorrect?

Do not equate one Frame Debugger event with a fixed amount of time. Verify expensive-looking passes with GPU or CPU timing.

Common batching breaks include different materials, shader keywords, lightmaps, render states, property blocks, transparency ordering, incompatible mesh attributes, and pipeline-specific constraints. Inspect the actual reason instead of forcing one batching technique universally.

## 4. Rendering cost categories

### CPU and render-thread cost

Investigate:

- Excessive renderer count or cameras.
- High batch/SetPass count.
- Per-renderer material instantiation.
- Frequent shader keyword or material-property changes.
- Expensive culling, animation skinning, particle updates, or UI mesh rebuilds.
- Dynamic shadows, reflection probes, and multiple light interactions.
- Script calls that repeatedly change renderer state.

### GPU cost

Investigate:

- Resolution and render scale.
- Overdraw from transparent particles, UI, foliage, and full-screen effects.
- Shader instruction, texture-sampling, branch, precision, and bandwidth cost.
- Shadow-map count, resolution, cascades, and casters.
- Number and type of lights affecting pixels.
- Post-processing passes and intermediate render targets.
- MSAA, HDR, depth/opaque textures, and pipeline features.
- Large textures, high anisotropy, render-target formats, and memory bandwidth.
- Vertex count, skinning, tessellation, or displacement when vertex-limited.

Use GPU captures to identify the dominant category. Do not optimize triangle count when the application is fill-rate bound, or reduce draw calls when a single full-screen shader dominates.

## 5. Mobile rendering checks

On mobile, prioritize:

- Fill rate and transparent overdraw.
- Resolution/render scale.
- Tile-memory and bandwidth pressure.
- Full-screen blits and render-target switches.
- Shader precision and texture sampling.
- Real-time shadows and additional lights.
- Particle screen coverage.
- UI overdraw and multiple canvases.
- Thermal throttling during sustained rendering.

Test on the lowest supported GPU tier and the shipping graphics API. Desktop Game view is not a substitute for mobile GPU measurement.

## 6. Validation rules

After a rendering change:

- Compare the same camera path at the same resolution and quality.
- Inspect CPU main/render threads and GPU time; confirm cost did not merely move.
- Compare visual output, lighting, shadows, transparency, and post-processing.
- Check all relevant render pipelines and quality tiers.
- Check shader variant/build impact when changing keywords or features.
- Check memory when adding atlases, duplicated textures, render targets, or precomputed data.
- Retest sustained mobile performance and thermals.

Keep visual degradation only when it is explicitly allowed by the quality target and provides measured value.
