# Sources of truth

Use project-local package documentation when it differs from these version-pinned references. Prefer official Unity documentation over community optimization lists.

## Unity 6.3 profiler and capture workflow

- Unity Profiler overview: https://docs.unity3d.com/6000.3/Documentation/Manual/Profiler.html
- Profiler window: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerWindow.html
- Profiling an application / target Player workflow: https://docs.unity3d.com/6000.3/Documentation/Manual/profiler-profiling-applications.html
- CPU Usage module: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerCPU.html
- GPU Usage module and platform limitations: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerGPU.html
- Rendering module: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerRendering.html
- Physics module: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerPhysics.html
- UI modules: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerUI.html
- Frame Debugger: https://docs.unity3d.com/6000.3/Documentation/Manual/FrameDebugger.html

Distilled guidance:

- Profile the target platform for authoritative results.
- Use Editor captures for faster iteration, not final device conclusions.
- Limit active modules and avoid Deep Profiling unless targeted detail justifies its overhead.
- Use Timeline for thread interaction and Hierarchy for ranked sample cost.

## Memory and garbage collection

- Memory Profiler module: https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerMemory.html
- Memory Profiler package for Unity 6.3: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.memoryprofiler.html
- Garbage collection best practices: https://docs.unity3d.com/6000.3/Documentation/Manual/performance-garbage-collection-best-practices.html
- Incremental GC: https://docs.unity3d.com/6000.3/Documentation/Manual/performance-incremental-garbage-collection.html
- Disabling GC warnings: https://docs.unity3d.com/6000.3/Documentation/Manual/performance-disabling-garbage-collection.html

Distilled guidance:

- Separate allocation rate, collection cost, retained memory, reserved memory, native memory, and graphics memory.
- Use allocation call stacks for hot allocations and snapshots/reference paths for retention or leaks.
- Do not use GC disabling or manual collection as a general optimization.

## Instrumentation and comparison

- `ProfilerMarker`: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Unity.Profiling.ProfilerMarker.html
- `ProfilerMarker.Begin`: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Unity.Profiling.ProfilerMarker.Begin.html
- `ProfilerRecorder`: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Unity.Profiling.ProfilerRecorder.html
- Profile Analyzer package: https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.performance.profile-analyzer.html
- Performance Testing package: https://docs.unity3d.com/Packages/com.unity.test-framework.performance@latest

Distilled guidance:

- Add stable custom markers around meaningful phases.
- Use multi-frame analysis and matched before/after captures.
- Verify package versions from the project before using package-specific APIs.

## Official long-form guidance

- Unity best practices hub: https://unity.com/how-to#optimization
- Unity profiling ebook landing page: https://unity.com/resources/ultimate-guide-to-profiling-unity-games

Use long-form guides for investigation ideas, then verify exact APIs and version behavior in the Unity 6.3 manuals and installed package docs.

## Community skill references reviewed for scope only

- `unity-performance` community skill, reviewed only for general workflow structure: https://github.com/Nice-Wolf-Studio/unity-claude-skills
- `awesome-gamedev-agent-skills`, used only as a structural reference for portable Skill organization: https://github.com/gamedev-skills/awesome-gamedev-agent-skills

Verify every version-sensitive API against Unity 6.3 documentation and the exact installed package before use.
