# Instrumentation and regression verification

## Table of contents

1. Profiler markers
2. ProfilerRecorder
3. Capture naming and metadata
4. Profile Analyzer
5. Automated performance tests
6. Performance report
7. Review checklist

## 1. Profiler markers

Add `ProfilerMarker` around meaningful project phases when built-in samples are too broad. Use stable names such as:

```text
Combat.AcquireTargets
Combat.ResolveHits
AI.Sense
AI.Decide
Inventory.RebuildIndex
World.StreamChunk
```

Rules:

- Store markers in static readonly fields.
- Use `Auto()` or balanced `Begin()`/`End()`.
- Avoid constructing names or metadata strings in the measured path.
- Keep marker scope large enough to be actionable and small enough to isolate responsibility.
- Do not add thousands of per-entity markers when one phase marker and counters are sufficient.
- Keep instrumentation source-controlled when it provides ongoing diagnostic value.

`ProfilerMarker.Begin`/`End` are thread-safe and can be used around jobified code, but use Burst-compatible instrumentation only after checking the installed versions and compilation behavior.

## 2. ProfilerRecorder

Use `ProfilerRecorder` when code or tests must collect an existing marker/counter over time, for example frame time, GC allocated bytes, draw calls, or a custom marker.

Rules:

- Verify the marker category, name, and unit in the target Unity version.
- Start and dispose the recorder explicitly.
- Use a bounded capacity.
- Avoid calling allocation-producing conversion APIs every frame.
- Keep recorder overhead out of the benchmark result or measure it separately.
- Do not ship a debug overlay by default if it changes the workload being measured.

## 3. Capture naming and metadata

Use names that preserve comparison context:

```text
<feature>-<device>-<platform>-<backend>-<quality>-<scenario>-<baseline|change>-<date>
```

Store alongside the capture:

- Commit or changelist.
- Unity and package versions.
- Device/OS/GPU.
- Build settings and graphics API.
- Resolution, quality, VSync, frame cap.
- Warmup and capture duration.
- Scenario seed/input path/content counts.
- Known capture anomalies.

Without this metadata, future comparisons can be misleading.

## 4. Profile Analyzer

Use Profile Analyzer to:

- Aggregate a representative range rather than a single frame.
- Compare two scans captured with matching conditions.
- Sort by median, mean, maximum, total time, or count depending on the question.
- Inspect frame distributions and outliers.
- Verify whether a local marker improvement changes total frame behavior.

Exclude initialization frames only when the performance contract excludes initialization. Never silently remove bad frames to improve the result.

## 5. Automated performance tests

Use automated performance tests for stable, repeatable code paths after manual profiling identifies the important metric.

Good candidates:

- Pure algorithm throughput.
- Allocation-free hot-path verification.
- Fixed-count simulation work.
- Scene load or spawn benchmark on dedicated hardware.
- Regression comparison for a previously fixed bottleneck.

Avoid treating noisy shared CI hardware as exact target-device evidence. Record environment metadata and use adequate warmup and measurement iterations. Check the installed `com.unity.test-framework.performance` version before using package-specific APIs.

## 6. Performance report

For each accepted optimization, record:

- Problem and user-visible symptom.
- Performance contract and device.
- Baseline captures and evidence.
- Root-cause hypothesis.
- Change and affected files.
- Before/after metric distribution.
- Correctness, visual, memory, and loading checks.
- Complexity and maintenance tradeoff.
- Rejected alternatives and why.
- Remaining bottleneck.

Keep raw captures or screenshots when the repository has a defined performance-evidence location. Do not add large binary captures to source control without project policy.

## 7. Review checklist

Before declaring success:

- [ ] Same target device and scenario were used.
- [ ] The dominant bottleneck was identified before editing.
- [ ] The expected metric improved beyond normal variance.
- [ ] Total frame or memory behavior improved, not only one local sample.
- [ ] No cost shifted to a more constrained thread or subsystem.
- [ ] Correctness and visual output still pass.
- [ ] Long-session and thermal behavior were checked when relevant.
- [ ] The change remains readable and owned by the correct feature.
- [ ] The report states measured facts separately from hypotheses.
