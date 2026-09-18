# Sources and Research Notes

Research date: 2026-07-28.

## Table of contents

- Primary Unity sources
- Primary Microsoft sources
- Primary UniTask sources
- Public agent-skill references

Use version-matched project documentation as the source of truth. The URLs below are included for traceability; re-check current documentation before upgrading packages or using APIs added after the project's Unity version.

## Primary Unity sources

### Coroutines and timing

- Unity 6.3 Coroutines manual:
  https://docs.unity3d.com/6000.3/Documentation/Manual/Coroutines.html
- Unity 6.3 `MonoBehaviour` API, including `destroyCancellationToken`:
  https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.html
- Unity 6.3 `Application.exitCancellationToken`:
  https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Application-exitCancellationToken.html
- Unity 6.3 `AsyncOperation`:
  https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AsyncOperation.html
- Unity 6.3 `WaitForSecondsRealtime`:
  https://docs.unity3d.com/6000.3/Documentation/ScriptReference/WaitForSecondsRealtime.html
- Unity 6.3 `WaitUntil`:
  https://docs.unity3d.com/6000.3/Documentation/ScriptReference/WaitUntil.html
- Unity 6.3 `WaitForEndOfFrame`:
  https://docs.unity3d.com/6000.3/Documentation/ScriptReference/WaitForEndOfFrame.html

Key findings:

- Coroutines spread work across frames but do not create threads.
- Coroutine iterator state is heap-allocated; nested coroutines add state objects.
- Deactivating a GameObject stops its attached coroutines, while disabling only the `MonoBehaviour` does not.
- `WaitForSeconds` uses scaled time and resumes on an eligible frame rather than at an exact wall-clock instant.
- Unity 6.3 exposes destroy and application-exit cancellation tokens.

### Version, platform, jobs, tests, and profiling

- Unity 6.3 C# compiler support:
  https://docs.unity3d.com/6000.3/Documentation/Manual/CSharpCompiler.html
- Unity 6.3 .NET profile support:
  https://docs.unity3d.com/6000.3/Documentation/Manual/dotnetProfileSupport.html
- Unity 6.3 WebGL technical limitations:
  https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-technical-overview.html
- Unity 6.3 Job System:
  https://docs.unity3d.com/6000.3/Documentation/Manual/JobSystem.html
- Unity 6.3 Test Framework:
  https://docs.unity3d.com/6000.3/Documentation/Manual/com.unity.test-framework.html
- Unity 6.3 CPU Usage Profiler:
  https://docs.unity3d.com/6000.3/Documentation/Manual/ProfilerCPU.html
- Unity 6.3 Await support, documenting introduction in Unity 6.3:
  https://docs.unity3d.com/6000.3/Documentation/Manual/AwaitSupport.html

Key findings:

- Unity 6.3 uses Roslyn and documents its supported and unsupported C# features; treat the version-matched compiler page as authoritative instead of hard-coding a language-version assumption.
- Unity 6.3 supports .NET Standard 2.1 or the .NET Framework compatibility profile.
- Unity 6.3 WebGL does not support the normal managed threading model.
- CPU-heavy parallel work belongs in Jobs/Burst when the workload fits.
- Unity native `Awaitable` support starts in Unity 6.3, so it must not be used in Unity 6.3 code.

## Primary Microsoft sources

- Task-based Asynchronous Pattern:
  https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/task-based-asynchronous-pattern-tap
- C# async return types:
  https://learn.microsoft.com/en-us/dotnet/csharp/asynchronous-programming/async-return-types
- Cancel non-cancelable async operations:
  https://learn.microsoft.com/en-us/dotnet/standard/asynchronous-programming-patterns/cancel-non-cancelable-async-operations

Key findings:

- `Task`/`Task<T>` are the standard observable async contracts.
- `async void` should be restricted primarily to event handlers because callers cannot await it or catch its exceptions normally.
- Cancellation is cooperative and represented through `CancellationToken`.
- Canceling a wait does not necessarily cancel the underlying operation.

## Primary UniTask sources

- Official Cysharp UniTask repository and README:
  https://github.com/Cysharp/UniTask
- Official latest release page:
  https://github.com/Cysharp/UniTask/releases/latest
- UniTask extension source, including `Forget` exception-handler overloads:
  https://raw.githubusercontent.com/Cysharp/UniTask/master/src/UniTask/Assets/Plugins/UniTask/Runtime/UniTaskExtensions.cs

As of the research date, the official latest release page resolves to version 2.5.11.

Key findings:

- UniTask is a PlayerLoop-oriented, struct-based Unity async integration.
- UniTask generally cannot be awaited twice unless a reusable/cached mechanism is selected.
- `NextFrame` guarantees a later frame; `Yield` can resume later in the same frame depending on timing.
- Directly awaiting a Unity `AsyncOperation` and converting it with `WithCancellation`/`ToUniTask` can use different continuation timing.
- `LoadSceneAsync.ToUniTask` can change ordering relative to scene startup.
- On Unity 6.3, true end-of-frame UniTask waiting requires a `MonoBehaviour` runner.
- Immediate cancellation costs more than PlayerLoop polling.
- External timeout does not automatically stop the underlying operation.
- UniTask's thread-pool operations do not work as a general WebGL solution.
- `UniTask.ToCoroutine` bridges UniTask into Unity's coroutine-based test runner.

## Public agent-skill references

These were reviewed for skill organization and scope, not treated as technical authority:

- `unity-csharp-scripting`:
  https://raw.githubusercontent.com/gamedev-skills/awesome-gamedev-agent-skills/main/skills/unity/unity-csharp-scripting/SKILL.md
- `performance-optimization`:
  https://raw.githubusercontent.com/gamedev-skills/awesome-gamedev-agent-skills/main/skills/disciplines/performance-optimization/SKILL.md

The public Unity scripting skill includes basic coroutine guidance but does not cover structured Task/UniTask/Awaitable selection, cancellation ownership, PlayerLoop timing, single-consumption semantics, timeout behavior, or migration verification. The performance skill contributes the profile-first rule. This custom skill fills those gaps for the exact Unity 6.3 and installed-package surface.
