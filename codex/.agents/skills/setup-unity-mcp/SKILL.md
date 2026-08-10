---
name: setup-unity-mcp
description: Install, repair, and verify CoplayDev MCP for Unity plus its current official optional dependencies, synchronize its runtime skill into a repository's .agents/skills as dev-unity-mcp, and configure its local HTTP server for Codex only. Use when preparing a copied Codex agent package, when com.coplaydev.unity-mcp or its Roslyn, ProBuilder, Cinemachine, VFX Graph, and glTFast support is missing or stale, when dev-unity-mcp is missing or stale, or when the unityMCP Codex server entry is absent, stale, or points to the wrong endpoint.
---

# Unity MCP Project Setup

Install the official Unity package and the dependency set declared by its current Git source, mirror CoplayDev's current runtime skill into the repository, and configure only Codex to reach its local HTTP MCP server. Read [references/sources.md](references/sources.md) before changing the package source, dependency policy, skill subtree, endpoint, runtime, or Codex configuration.

## Required state

- Unity: `2021.3 LTS` or newer.
- Package id: `com.coplaydev.unity-mcp`.
- Recommended Git dependency: `https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#<verified-current-main-commit>`. Resolve `main` on each setup run, verify the fetched blobs, then pin that immutable revision.
- Codex server id: `unityMCP`.
- Default local endpoint: `http://127.0.0.1:8080/mcp`.
- Runtime prerequisite: native `uv`/`uvx` and Python 3.10 or newer.
- Repository skill: `.agents/skills/dev-unity-mcp/SKILL.md`, declaring `name: dev-unity-mcp`.
- Skill source: `CoplayDev/unity-mcp@main`, subtree `unity-mcp-skill/`.
- Local overlay: preserve the verified upstream snapshot while changing only its frontmatter name from `unity-mcp-orchestrator` to `dev-unity-mcp` for the portable package's role-first naming convention.
- Dependency source: the verified current `main` commit's `MCPForUnityEditorWindow.cs` and `RoslynInstaller.cs`, resolved by [scripts/get-unity-mcp-dependency-spec.ps1](scripts/get-unity-mcp-dependency-spec.ps1).
- UPM version policy: during `setup-agents`, resolve every official `com.unity.*` id to the highest stable version compatible with the project's exact Unity patch and declare its exact version before interactive Unity opens. The upstream unversioned batch remains a standalone/live fallback only when no orchestrated pre-resolution is in progress.
- Roslyn version policy: run the imported package's official `RoslynInstaller`; its NuGet versions are pinned by the same verified upstream commit. Never replace them with independently guessed “latest” versions.

## Setup-agents phase contract

When `setup-agents` invokes this skill, split it into two resumable passes:

- **Editor-closed preparation:** require that the exact project is not open in Unity. Complete project/version inspection, resolve and pin the current core revision, verify the current dependency spec, resolve each official UPM id to an exact patch-compatible stable version, contribute all specs to the orchestrator's single manifest merge, check uv, synchronize the runtime skill, and register Codex only. The orchestrator may resolve and compile the completed cross-skill manifest through the owned hidden stabilization pass only after every setup skill has contributed its specs. Do not install Roslyn, import an archive, run tests, or open an interactive Editor.
- **Live pass:** resume only with the exact project open in the single Editor instance selected by `setup-agents`. Verify the already-resolved core package and official UPM dependency set. Do not submit another UPM add/update request. Run the official Roslyn installer, start or verify the loopback server, and gather the narrow readiness evidence required for later setup skills. Wait through Unity-controlled compilation and domain reload when they block progress, but defer the broad project compilation/console/test pass to the orchestrator's final step.

Do not repeat a correct preparation mutation on resume. Reinspect its result and continue from the first pending live-owned state.

## Workflow

1. Resolve the exact Unity repository root. Require `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
2. Parse the Unity version and stop when it is older than 2021.3. Parse `Packages/manifest.json` as JSON before editing it. Record `HEAD`, staged paths, and the existing manifest bytes.
3. Classify the package dependency:
   - Correct: the package id resolves from the official CoplayDev Git repository using `?path=/MCPForUnity` at the verified current `main` commit or an independently verified explicit stable `v*` tag.
   - Missing: during standalone setup add the verified immutable dependency while preserving all unrelated entries and the file's indentation/newline style; during `setup-agents`, contribute it to the orchestrator's single manifest merge.
   - Repairable: canonicalize a malformed official CoplayDev URL that clearly intends the same package, or replace a mutable official `#main` declaration with the exact commit just verified during the current run.
   - Ambiguous: stop before replacing a registry, local-file, fork, beta, or other noncanonical source. Report the existing value and ask whether it is intentional.
4. Never edit `Packages/packages-lock.json` manually. During `setup-agents`, the orchestrator merges all validated cross-skill specs once and invokes `setup-unity-packages/scripts/stabilize_unity_package_graph.ps1`; do not launch a separate batch process from this skill. When this skill runs standalone, a bounded `-batchmode -quit -projectPath <root>` launch may resolve the package only if the matching Editor is unambiguous and the project is not already open. Otherwise ask the user to open the project and wait for package import.
5. Resolve the official dependency spec during preparation, then pre-resolve or verify every declared optional dependency:
   - Run [scripts/get-unity-mcp-dependency-spec.ps1](scripts/get-unity-mcp-dependency-spec.ps1) on every setup pass. Require valid JSON, verified Git blobs, a recorded commit, a valid MCP package version, at least one trusted `com.unity.*` UPM id, and at least one supported Roslyn NuGet entry. Revalidate it when the live pass resumes after a long or uncertain pause. Stop if the upstream source shape or trust boundary changed; do not fall back to stale hard-coded versions.
   - During `setup-agents`, pass the verified `com.unity.*` ids to `<project-root>/.agents/skills/setup-unity-packages/scripts/resolve_unity_registry_packages.ps1`. Require its `verified-compatible-set` JSON, exact matching Unity executable, stable versions only, exact `unity`/`unityRelease` compatibility, and a source of either the official registry or the matching installed-Editor catalog. Contribute each returned `package_id@version` to the single Phase-A manifest merge. Stop on a source, version, or identity conflict; never fall back to a lexical version choice or an unversioned live install.
   - The imported package's **Install All Dependencies** action is the standalone fallback. It installs Roslyn through the official installer and submits current UPM ids together with `UnityEditor.PackageManager.Client.AddAndRemove`, matching CoplayDev's implementation. Do not use this action in the orchestrated live pass because those UPM ids must already be stable.
   - In standalone live automation, submit the complete missing UPM-id array in one `Client.AddAndRemove(ids, Array.Empty<string>())` request, with ids unversioned exactly as upstream declares, then poll that single request until completion. Do not loop over `manage_packages add_package`; that creates one resolve/reload wave per dependency. Persist the request before calling it and verify the package list after reconnecting instead of retrying an interrupted response blindly.
   - Invoke the official `RoslynInstaller` only after the UPM graph is resolved and, during orchestration, matches the Phase-A checkpoint. After its install request and domain reload, re-resolve the imported assembly/type before evaluating `IsInstalled()`. If the first post-reload check is false while Unity is still compiling or refreshing, wait until idle and retry the check once; do not reinstall Roslyn during that transient window.
   - Install missing dependencies and repair Roslyn when the official `IsInstalled()` check fails. Do not reinstall a correct dependency merely to churn its lock entry. If the official current dependency set changes, follow the verified spec; do not preserve a removed item as a setup requirement or silently accept a newly declared non-`com.unity.*` package.
   - In an orchestrated live pass, any missing or stale manifest-declarable UPM id means Phase A is incomplete. Stop before changing it in the interactive process and report the exact mismatch; do not create a planned Editor restart. If neither the standalone live integration nor an observable Editor action is available, report `pending Unity dependency install`.
   - Verify Roslyn using the imported package's `IsInstalled()` result or the Optional Dependencies status after reload. Verify each UPM id through Unity Package Manager or the resolved package list, record the actual installed versions, and require them to match the Phase-A checkpoint during orchestration. Versions may differ across supported Unity patches because compatibility is project-specific.
6. Resolve `uv` and `uvx` before invoking either. Reuse the working installation established by `setup-serena`; when this skill runs alone and uv is missing, use the official installer from [references/sources.md](references/sources.md) once. Require Python 3.10 or newer.
7. Synchronize the official runtime skill before configuring Codex:
   - Run [scripts/sync-unity-mcp-skill.ps1](scripts/sync-unity-mcp-skill.ps1) with the exact project root.
   - The script must check the current `main` commit and `unity-mcp-skill/` subtree on every setup run, verify every downloaded upstream Git blob, apply only the deterministic name overlay, and target `<project-root>/.agents/skills/dev-unity-mcp`.
   - Treat `current` and `adopted` as correct, `created`, `updated`, and `migrated` as successful changes, and `update-unverified` as a non-destructive network warning only when a valid existing skill remains available.
   - If the target exists without the ownership marker, adopt it only when it declares `dev-unity-mcp` and contains no file outside the transformed official snapshot. Stop on an unmanaged conflict.
   - Migrate the old `.agents/skills/unity-mcp-skill` destination only when its marker proves this setup owns it or it exactly matches the current official upstream snapshot. Never remove an unmanaged legacy folder.
   - Never copy the repository's `.claude` directory. The source subtree is read from GitHub, while the destination is the Codex repository scope documented by OpenAI.
8. Configure only the user-level Codex file at `~/.codex/config.toml`:
   - Parse the current TOML and create a timestamped sibling backup before a change.
   - Treat `[mcp_servers.unityMCP]` with `url = "http://127.0.0.1:8080/mcp"` as correct.
   - Also preserve a working official stdio configuration when its `mcpforunityserver` version matches the resolved Unity package; do not convert transports merely for consistency.
   - When missing or incorrect, upsert only the `mcp_servers.unityMCP` table with the HTTP URL above and preserve every unrelated key, server, profile, hook, comment, and credential reference.
   - Do not add the obsolete `features.rmcp_client` flag; current Codex supports streamable HTTP MCP directly.
9. Do not use **Configure All Detected Clients**. If the Unity setup window needs a first-run action, select Codex only and use **Configure Selected**. Never select or configure Claude, Cursor, VS Code, or another client.
10. When Unity is open, use **Window > MCP for Unity** to confirm HTTP Local, port 8080, and server status. Recommend **Auto-Start on Editor Load** for future sessions, but do not claim it is enabled unless its state was actually observed.
11. Verify. During an orchestrated live pass, perform the narrow dependency/source/server checks as soon as they are needed, then contribute the compilation and console evidence to `setup-agents` one consolidated final pass:
   - `Packages/manifest.json` remains valid JSON and contains the intended package source.
   - After Unity resolves packages, `Packages/packages-lock.json` contains `com.coplaydev.unity-mcp` and its resolved version.
   - The dependency spec was obtained from the current verified `main` commit; all declared UPM dependencies are resolved at latest-compatible versions, and the official Roslyn check passes with that commit's pinned NuGet set.
   - `uv --version`, `uvx --version`, and Python compatibility checks pass.
   - The repository skill declares `dev-unity-mcp`, every downloaded upstream file was verified before the deterministic name overlay, the installed snapshot matches that transformed result, and the sync result includes the checked commit and subtree SHA.
   - The user-level Codex TOML parses and contains exactly one effective `unityMCP` server.
   - The endpoint is reachable when Unity reports the HTTP server running.
   - `HEAD` and staged paths are unchanged, no secret was added, and no other AI client configuration changed.
12. Report one of four outcomes: ready, restart-ready, `pending (editor-ready)`, or pending Unity import/dependency install/server start. Include the checked upstream commit, MCP package version, each dependency's actual installed version or pending reason, and whether Roslyn passed the official check. A structurally correct config is restart-ready, not live-verified, until Codex restarts and the Unity endpoint is running.

## Boundaries

- Install only `CoplayDev/unity-mcp`; do not substitute a fork, Asset Store package, OpenUPM source, beta branch, or direct server checkout without explicit user direction.
- Do not install `mcpforunityserver` as a persistent standalone tool. The package manages its matching server through uv/uvx.
- Do not sync the runtime skill from a fork, tag, beta branch, `.claude` destination, global skill directory, or package cache. Do not overwrite an unmanaged target folder or remove an unmanaged legacy folder.
- Install only dependency ids returned by the verified official source and accepted by the resolver's trust rules. Do not use registry-wide “latest” tags, preview versions, or independently selected Roslyn versions.
- Do not modify Unity-generated `.csproj` or `.sln` files, create temporary Editor scripts, or hand-edit the package lock.
- During `setup-agents`, do not launch a skill-local Unity process in preparation; only the orchestrator's owned hidden stabilization may run after the complete manifest merge. Never open a second Editor or mutate a manifest-declarable UPM package in the live pass.
- Do not bind the HTTP server beyond loopback or weaken its remote security policy.
- Never overwrite the whole Codex TOML, expose secrets, or remove unrelated MCP servers.
- Never configure Claude or another client, and never create `.claude` content.
- Never run `git add`, `git commit`, `git push`, or another command that changes Git history or the index.
