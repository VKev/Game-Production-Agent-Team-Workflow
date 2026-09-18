# Sources and Research Notes

Use the project's installed Unity/package versions as the final compatibility authority.

## Unity PlayerLoop and initialization

- PlayerLoop API and customization example: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/LowLevel.PlayerLoop.html
- Current loop: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/LowLevel.PlayerLoop.GetCurrentPlayerLoop.html
- Default loop: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/LowLevel.PlayerLoop.GetDefaultPlayerLoop.html
- Install a loop: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/LowLevel.PlayerLoop.SetPlayerLoop.html
- PlayerLoopSystem structure: https://docs.unity3d.com/6000.3/Documentation/ScriptReference/LowLevel.PlayerLoopSystem.html
- Runtime initialization phases and nondeterministic order within a phase: https://docs.unity3d.com/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html
- Domain Reload and runtime-static reset: https://docs.unity3d.com/Manual/domain-reloading.html
- Assembly reload events: https://docs.unity3d.com/ScriptReference/AssemblyReloadEvents.html

## Performance and time

- Custom update manager tradeoffs and profiling requirement: https://docs.unity3d.com/Manual/events-per-frame-optimization.html
- Update/execution-order overview: https://docs.unity3d.com/Manual/managing-update-order.html
- Unscaled delta time: https://docs.unity3d.com/ScriptReference/Time-unscaledDeltaTime.html

## Package coexistence

- UniTask PlayerLoop timing, nondeterministic initialization, and Entities reset warning: https://github.com/Cysharp/UniTask#playerloop

## Managed cleanup

- .NET dispose pattern and finalizer tradeoffs: https://learn.microsoft.com/en-us/dotnet/standard/design-guidelines/dispose-pattern
- Using objects that implement IDisposable: https://learn.microsoft.com/en-us/dotnet/standard/garbage-collection/using-objects

## Video-derived case study

- Video, “The Unity HACK that the PROS know”: https://www.youtube.com/watch?v=ilvmOQtl57c
- Upload-era timer implementation: https://github.com/adammyhre/Unity-Improved-Timers/commit/9431a1783a8fb6b84901efad231749a0558d0de6
- Later allocation/disposal improvement: https://github.com/adammyhre/Unity-Improved-Timers/commit/e96847c
- Later removal-loop correction: https://github.com/adammyhre/Unity-Improved-Timers/commit/b0d6f2f

The video is a useful demonstration of PlayerLoop insertion, duplicate installation with disabled Domain Reload, and pure C# timers. Treat its code as a case study: later creator commits corrected mutation/allocation behavior, while production designs still need explicit clock, state, validation, package-coexistence, Editor/runtime separation, and build-verification policies.
