# Profiling workflow

## Table of contents

1. Performance contract
2. Frame-time budgets
3. Reproducible scenarios
4. Capture preparation
5. Target-device capture
6. Controlled comparison
7. Mobile and thermal testing
8. Regression gates

## 1. Performance contract

Define performance as a testable contract rather than “make it faster.” Record:

- Target device model or hardware tier.
- Operating system and power mode.
- Target frame rate and acceptable frame-time percentiles.
- Resolution, render scale, quality level, graphics API, and orientation.
- Scene, camera path, player input sequence, enemy/projectile/UI counts, and test duration.
- Cold-start, cold-cache, warm-cache, or steady-state condition.
- Memory ceiling and loading-time limit when relevant.
- Build type, scripting backend, and profiler connection method.

Use a worst-representative gameplay scenario, not an artificial empty scene, unless the purpose is to measure subsystem overhead in isolation.

## 2. Frame-time budgets

Use the mathematical frame budget as the upper bound for the whole frame:

| Target | Whole-frame budget |
|---|---:|
| 120 FPS | 8.33 ms |
| 90 FPS | 11.11 ms |
| 60 FPS | 16.67 ms |
| 45 FPS | 22.22 ms |
| 30 FPS | 33.33 ms |
| 20 FPS | 50.00 ms |

Do not allocate the entire budget to gameplay code. Rendering, engine work, operating-system scheduling, audio, networking, and safety margin also consume time.

For unstable performance, define at least:

- Median frame time.
- A high percentile such as P95 or P99 when capture tooling supports it.
- Number of frames over budget.
- Worst representative spike after excluding known capture artifacts.

## 3. Reproducible scenarios

Prefer deterministic or scripted scenarios:

1. Load the same scene and save state.
2. Set the same quality, resolution, camera, and frame-pacing settings.
3. Spawn the same content counts.
4. Follow the same camera or input path.
5. Warm up for a fixed period if measuring steady state.
6. Capture for a fixed period that includes the problem.
7. Repeat enough times to see run-to-run variance.

Keep separate scenarios for:

- Startup and first-use initialization.
- Steady gameplay.
- Maximum combat density.
- Scene transition or asset streaming.
- Menu/UI stress.
- Long-session memory retention.

## 4. Capture preparation

Before capture:

- Close unrelated applications when practical.
- Disable verbose logging and debug overlays that are not part of the shipped workload.
- Disable Script Debugging for more representative Player timing unless debugging requires it.
- Record VSync and `Application.targetFrameRate` settings.
- Use only relevant Profiler modules to reduce capture overhead.
- Start without Deep Profiling.
- Enable allocation call stacks only when chasing `GC.Alloc` or another targeted marker.
- Verify the Player is attached to the intended Profiler session.
- Confirm that the issue still occurs with profiling enabled.

Capture enough frames to include normal variance and the spike, but avoid unnecessarily huge captures that make analysis and overhead worse.

## 5. Target-device capture

Treat a Development Build on the target platform as the source of truth for runtime timing. The Unity Editor shares resources with the game and can allocate or behave differently.

For Android:

- Use `Build & Run` or connect through the Profiler target selector.
- Record device model, chipset, OS, battery state, temperature, and refresh rate.
- Keep screen brightness and power mode stable where possible.
- Test the same graphics API used by the shipping configuration.

For GPU analysis, check whether Unity's GPU Profiler supports the target graphics API. Use platform tools such as RenderDoc, Android GPU Inspector, Xcode GPU tools, or vendor tools when Unity cannot provide reliable GPU timing.

## 6. Controlled comparison

Use this comparison protocol:

1. Save the baseline capture and configuration.
2. Make one targeted change.
3. Rebuild with the same build settings.
4. Repeat the same warmup and capture sequence.
5. Compare multiple frames or scans with Profile Analyzer when available.
6. Compare total frame time and the targeted marker, not only one local method.
7. Check whether cost moved to another thread or subsystem.
8. Check memory, quality, correctness, and loading tradeoffs.
9. Repeat if variance overlaps the claimed improvement.

Do not compare:

- Editor baseline against Player result.
- Cool-device baseline against thermally throttled result.
- Different resolutions, quality levels, scenes, or cameras.
- Cold-cache load against warm-cache load unless cache behavior is the subject.
- Mono against IL2CPP without explicitly treating backend as an experimental variable.

## 7. Mobile and thermal testing

Mobile performance changes with temperature and power policy. For a stable conclusion:

- Capture a cold-start run separately from a sustained-load run.
- Run the representative workload long enough to expose thermal throttling.
- Record battery saver, charging state, refresh rate, and foreground/background conditions.
- Test low-memory behavior and application pause/resume when memory is a concern.
- Measure on the lowest supported hardware tier, not only a desktop simulation or flagship device.
- Treat emulator timing as functional evidence, not authoritative device performance evidence.

## 8. Regression gates

Create a gate only after the workload is stable and repeatable. Useful gates include:

- Frame time under a stated percentile limit.
- Maximum count of over-budget frames during a fixed scenario.
- Zero or bounded steady-state `GC.Alloc` for a hot path.
- Memory returning near baseline after repeated scene or feature cycles.
- Loading time below a fixed threshold under defined cache conditions.
- Draw/pass or physics-query counts within an expected range.

Use the Unity Performance Testing package only after checking that its installed version supports the project. Keep automated performance tests on controlled hardware or interpret noisy shared-runner results cautiously.
