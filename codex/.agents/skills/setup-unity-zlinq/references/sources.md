# Sources

- [NuGetForUnity official repository](https://github.com/GlitchEnzo/NuGetForUnity): package ID, tagged Git installation, editor UI, restore behavior, configuration placement, and public installer source.
- [NuGetForUnity releases](https://github.com/GlitchEnzo/NuGetForUnity/releases): stable release discovery and release notes.
- [NuGetForUnity tagged package manifest](https://raw.githubusercontent.com/GlitchEnzo/NuGetForUnity/v4.5.0/src/NuGetForUnity/package.json): current verified snapshot metadata; the checker reads the manifest at the dynamically resolved tag.
- [ZLinq official repository and Unity section](https://github.com/Cysharp/ZLinq#unity): required two-step ZLinq installation, core usage, Unity hierarchy queries, Native Collections support, DropInGenerator constraint, limitations, and benchmarks.
- [ZLinq releases](https://github.com/Cysharp/ZLinq/releases): stable release discovery and release notes.
- [ZLinq on NuGet.org](https://www.nuget.org/packages/ZLinq): official core package versions and framework assets.
- [NuGet V3 flat-container resource](https://api.nuget.org/v3-flatcontainer/zlinq/index.json): independently enumerates published ZLinq versions for the setup checker.
- [ZLinq Unity package manifest](https://raw.githubusercontent.com/Cysharp/ZLinq/main/src/ZLinq.Unity/Assets/ZLinq.Unity/package.json): package ID and Unity floor; the checker validates the tagged copy.
- [ZLinq Unity video supplied by the user](https://www.youtube.com/watch?v=gX5nD2LeAvQ): “ZLinq Revolutionizes Unity Game Development With ZERO ALLOCATIONS” by git-amend, used as a secondary workflow illustration. Prefer the repositories above for exact current installation behavior.
- [Unity project dependency manifest](https://docs.unity3d.com/ja/2022.3/Manual/upm-dependencies.html): supports resolving NuGetForUnity as a project dependency before interactive setup.
- [Unity Git dependencies](https://docs.unity3d.com/ja/2022.3/Manual/upm-git.html): official revision and `?path=` syntax used for the checker-verified NuGetForUnity tag and the later ZLinq.Unity tag.

The 2026-08-09 verified snapshot is NuGetForUnity `4.5.0`, core ZLinq `1.5.6`, and ZLinq.Unity `1.5.6`. Treat it as evidence, not a permanent latest-version pin.

During orchestrated setup, NuGetForUnity alone is declared and resolved while the Editor is closed. Core ZLinq is then installed from NuGet in the live phase, and only after `ZLinq.dll` verifies is ZLinq.Unity added. Predeclaring the bridge would allow it to compile before its core assembly exists.
