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

## Setup-agents phase contract

When orchestrated by `setup-agents`:

- **Editor-closed preparation:** require the exact target project to be closed. Inspect state, verify the coherent release set, preserve or create the allowed NuGet configuration, and contribute the exact verified NuGetForUnity tagged Git dependency to the orchestrator's single manifest merge. The orchestrator's later hidden stabilization pass must resolve and compile NuGetForUnity before interactive Unity opens. Do not install core ZLinq, declare ZLinq.Unity, import assets, or run tests. ZLinq.Unity deliberately remains out of the Phase-A manifest because it must not compile before core `ZLinq.dll` exists.
- **Live pass:** use the one already-open target Editor. Verify the pre-resolved NuGetForUnity layer, then execute sections 5–6 in strict order: install core ZLinq first and only then add ZLinq.Unity. Wait for asset refresh, Unity compilation, and domain reload only when they block the next layer. Do not run Unity Test Runner or the `AsValueEnumerable()` probe after each layer; contribute that probe and broad compilation evidence to the orchestrator's consolidated final pass.

On resume, preserve a correct preparation result and continue from the first missing live layer.

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

### 4. Resolve NuGetForUnity first

Use only the exact tagged URL returned by the source checker:

`https://github.com/GlitchEnzo/NuGetForUnity.git?path=/src/NuGetForUnity#<tag>`

1. During `setup-agents` Phase A, contribute that URL under `com.github-glitchenzo.nugetforunity` to the single validated manifest merge. Do not write the lock file. The orchestrator's owned hidden Unity pass resolves it with the rest of the UPM graph.
2. During the orchestrated live pass, inspect the resolved package and require the checkpointed package ID, version, official source/revision, `NuGetForUnity` editor assembly, and public installer API. If it is missing or stale, report Phase A incomplete; do not update it in the user-opened Editor.
3. When this skill runs standalone, inspect with `Client.List`; if absent or an older recognized official/OpenUPM install, add the verified tagged URL through `Client.Add`, wait for resolution/domain reload/compilation, then perform the same verification. If already correct, skip mutation.
4. Treat this as a dependency gate, not a separate broad test pass. Never claim that the manifest declaration alone is installed; require the resolved package/assembly evidence.

### 5. Install ZLinq from NuGet second

Use NuGetForUnity's public API from the verified installed version. For the current API shape, construct `NugetForUnity.Models.NugetPackageIdentifier("ZLinq", version)`, set `IsManuallyInstalled = true`, and call `NugetForUnity.NugetPackageInstaller.InstallIdentifier(...)`. If the live execution compiler cannot reference the non-auto-referenced editor assembly, reflection may bind only those exact public types, constructor, property, and method after confirming their signatures. Never call private or internal APIs.

- If public signatures changed in a future NuGetForUnity release, stop with `installer API verification pending`; do not edit `packages.config` to simulate installation.
- Require the call to return true, wait for the asset refresh and Unity-controlled compilation needed before the next layer, then inspect `InstalledPackagesManager.InstalledPackages` and the active `packages.config`. Do not run a separate project test pass here.
- Require an explicit `ZLinq` entry at the verified version and an installed `ZLinq.dll` selected for Unity's compatible .NET Standard profile.
- Do not install `ZLinq.DropInGenerator`; it is optional, changes compilation behavior per assembly, and requires a separate explicit decision.

### 6. Install ZLinq.Unity third

After core `ZLinq.dll` verifies, install the checker-provided tagged URL through `Client.Add`:

`https://github.com/Cysharp/ZLinq.git?path=src/ZLinq.Unity/Assets/ZLinq.Unity#<tag>`

Wait for resolution, domain reload, and Unity-controlled compilation to settle. If `com.cysharp.zlinq` is already installed at the same official version, skip. Update only a recognized older official source. Treat a different major/source, newer version, or core/Unity version mismatch as `ambiguous`.

### 7. Verify and report

Require all of the following before reporting success. Under `setup-agents`, collect the broad compilation and deferred compile-probe evidence in its single final pass:

- NuGetForUnity, core ZLinq, and ZLinq.Unity versions and sources match the verified release set.
- `ZLinq.dll`, the `ZLinq.Unity` assembly, active `NuGet.config`, and explicit `packages.config` entry exist.
- The actual Unity project completes package resolution and compilation with no new package-attributable errors.
- A compile probe in a temporary execution context can resolve `using ZLinq;` and enumerate an array through `AsValueEnumerable()`; do not add probe code to product folders.
- Git `HEAD` and the empty staged list are unchanged. Report newly created untracked configuration declarations so the user can review them.

Report each layer as `skipped`, `created`, `repaired`, `pending`, or `blocked`, including version, source, config placement, restore state, assembly evidence, compilation evidence, and restart/reload requirements.

## Boundaries

- Never reverse the installation order: NuGetForUnity, then core ZLinq, then ZLinq.Unity.
- Never edit `Packages/packages-lock.json` or `packages.config` manually to claim an install. During `setup-agents`, the only permitted manifest contribution from this skill is the exact checker-verified NuGetForUnity tagged Git dependency merged by the orchestrator in Phase A; never predeclare ZLinq.Unity.
- Never overwrite NuGet configuration, persist credentials, use prereleases, downgrade a newer installation, or silently replace a fork/local package.
- Never install DropInGenerator, Unity Collections, or another optional package solely because ZLinq supports it.
- During `setup-agents`, do not launch a skill-local Unity process in preparation; only the orchestrator's owned hidden stabilization may run after the complete manifest merge. Never open a second Editor, update NuGetForUnity in the live pass, or run the deferred compile probe before all Unity package operations finish.
- Never stage, commit, push, or modify another AI client during project setup.
