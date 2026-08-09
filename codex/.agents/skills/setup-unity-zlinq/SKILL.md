---
name: setup-unity-zlinq
description: Idempotently install, update, repair, and verify NuGetForUnity, the ZLinq NuGet package, and the ZLinq.Unity UPM package in the required order. Use during setup-agents bootstrap when a Unity 2021.3+ project is missing ZLinq, has a partial or stale installation, needs NuGet restore, or contains conflicting package sources or versions.
---

# Unity ZLinq Setup

Read [references/sources.md](references/sources.md) completely before installing or repairing anything. Use `assets/NuGet.config` only for a fresh project with no existing NuGetForUnity configuration.

## Required state

The setup is `correct` only when all three layers verify:

1. Official `com.github-glitchenzo.nugetforunity` is installed at the independently verified latest stable release.
2. `ZLinq` is explicitly installed from NuGet at the independently verified latest stable version.
3. Official `com.cysharp.zlinq` (`ZLinq.Unity`) is installed from the matching stable Git tag.

Classify a missing layer independently. Treat a fork, local/embed source, dirty Git source, disabled or unknown NuGet source, newer installed version, version disagreement, or unrecognized configuration ownership as `ambiguous`; do not replace or downgrade it.

## Workflow

### 1. Resolve and preserve project state

1. Canonicalize the Unity project root and require `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
2. Require Unity `2021.3` or newer because that is the `ZLinq.Unity` package floor. If older, stop before installing any of the three layers.
3. Record Git `HEAD` and the staged-path list. Require an empty staged list and preserve both throughout setup.
4. Inspect `Packages/manifest.json`, `Packages/packages-lock.json`, `Assets/NuGet.config`, `Packages/nuget-packages/NuGet.config`, and every discovered `packages.config`. Do not assume the default placement.
5. Require the effective `.gitignore` to ignore only generated NuGet payloads at `Packages/nuget-packages/InstalledPackages/` and `Packages/nuget-packages/package.json`. Keep `NuGet.config` and `packages.config` visible to Git so a fresh checkout can restore the dependency declaration.

### 2. Resolve a coherent stable release set

Run `scripts/check_zlinq_sources.ps1` and require `Status=verified-stable`. It must verify:

- the latest non-draft, non-prerelease NuGetForUnity release, its official Git tag, and tagged package manifest;
- the latest non-draft, non-prerelease ZLinq release, its official Git tag, and tagged `ZLinq.Unity` manifest;
- the same ZLinq version exists as the newest stable `ZLinq` package on NuGet.org.

If these sources disagree or are unavailable, report `release verification pending`; do not guess a tag or install a partially verified version. The verified 2026-08-09 snapshot was NuGetForUnity `4.5.0` and ZLinq/ZLinq.Unity `1.5.6`, but always use the script result rather than permanently pinning those numbers in the workflow.

### 3. Establish NuGet configuration without overwriting user state

- If either supported `NuGet.config` exists, preserve its placement, package sources, credentials references, and settings. Require an enabled `https://api.nuget.org/v3/index.json` source before installing ZLinq; otherwise stop as `ambiguous`.
- If no NuGetForUnity configuration exists, create `Packages/nuget-packages/` and copy `assets/NuGet.config` there byte-for-byte before NuGetForUnity is loaded. This selects `InPackagesFolder`, keeps declarations separate from downloaded payloads, and uses only NuGet.org.
- Never copy the template over an existing file, add credentials, move an existing configuration, ignore `packages.config`, or delete an installed package directory as repair.

### 4. Install NuGetForUnity first

Use the live Unity Editor and `UnityEditor.PackageManager.Client`; never edit Unity's manifest or lock file directly.

1. Inspect the installed package through `Client.List`.
2. If absent, install the verified tagged URL returned by the checker: `https://github.com/GlitchEnzo/NuGetForUnity.git?path=/src/NuGetForUnity#<tag>`.
3. If older and sourced from the official repository or matching OpenUPM package, update to that verified URL. If already correct, skip mutation.
4. Wait for Package Manager resolution, domain reload, and compilation. Verify package ID, version, official source/revision, `NuGetForUnity` editor assembly, and public installer API before proceeding.

### 5. Install ZLinq from NuGet second

Use NuGetForUnity's public API from the verified installed version. For the current API shape, construct `NugetForUnity.Models.NugetPackageIdentifier("ZLinq", version)`, set `IsManuallyInstalled = true`, and call `NugetForUnity.NugetPackageInstaller.InstallIdentifier(...)`. If the live execution compiler cannot reference the non-auto-referenced editor assembly, reflection may bind only those exact public types, constructor, property, and method after confirming their signatures. Never call private or internal APIs.

- If public signatures changed in a future NuGetForUnity release, stop with `installer API verification pending`; do not edit `packages.config` to simulate installation.
- Require the call to return true, wait for asset refresh and compilation, then inspect `InstalledPackagesManager.InstalledPackages` and the active `packages.config`.
- Require an explicit `ZLinq` entry at the verified version and an installed `ZLinq.dll` selected for Unity's compatible .NET Standard profile.
- Do not install `ZLinq.DropInGenerator`; it is optional, changes compilation behavior per assembly, and requires a separate explicit decision.

### 6. Install ZLinq.Unity third

After core `ZLinq.dll` verifies, install the checker-provided tagged URL through `Client.Add`:

`https://github.com/Cysharp/ZLinq.git?path=src/ZLinq.Unity/Assets/ZLinq.Unity#<tag>`

Wait for resolution, domain reload, and compilation. If `com.cysharp.zlinq` is already installed at the same official version, skip. Update only a recognized older official source. Treat a different major/source, newer version, or core/Unity version mismatch as `ambiguous`.

### 7. Verify and report

Require all of the following before reporting success:

- NuGetForUnity, core ZLinq, and ZLinq.Unity versions and sources match the verified release set.
- `ZLinq.dll`, the `ZLinq.Unity` assembly, active `NuGet.config`, and explicit `packages.config` entry exist.
- The actual Unity project completes package resolution and compilation with no new package-attributable errors.
- A compile probe in a temporary execution context can resolve `using ZLinq;` and enumerate an array through `AsValueEnumerable()`; do not add probe code to product folders.
- Git `HEAD` and the empty staged list are unchanged. Report newly created untracked configuration declarations so the user can review them.

Report each layer as `skipped`, `created`, `repaired`, `pending`, or `blocked`, including version, source, config placement, restore state, assembly evidence, compilation evidence, and restart/reload requirements.

## Boundaries

- Never reverse the installation order: NuGetForUnity, then core ZLinq, then ZLinq.Unity.
- Never edit `Packages/manifest.json`, `Packages/packages-lock.json`, or `packages.config` manually to claim an install.
- Never overwrite NuGet configuration, persist credentials, use prereleases, downgrade a newer installation, or silently replace a fork/local package.
- Never install DropInGenerator, Unity Collections, or another optional package solely because ZLinq supports it.
- Never stage, commit, push, or modify another AI client during project setup.
