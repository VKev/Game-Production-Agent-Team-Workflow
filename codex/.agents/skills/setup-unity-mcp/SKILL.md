---
name: setup-unity-mcp
description: Install, repair, and verify CoplayDev MCP for Unity plus its current official optional dependencies, synchronize its runtime skill into a repository's .agents/skills as dev-unity-mcp, and configure its local HTTP server for Codex only. Use when preparing a copied Codex agent package, when com.coplaydev.unity-mcp or its Roslyn, ProBuilder, Cinemachine, VFX Graph, and glTFast support is missing or stale, when dev-unity-mcp is missing or stale, or when the unityMCP Codex server entry is absent, stale, or points to the wrong endpoint.
---

# Unity MCP Project Setup

Install the official Unity package and the dependency set declared by its current Git source, mirror CoplayDev's current runtime skill into the repository, and configure only Codex to reach its local HTTP MCP server. Read [references/sources.md](references/sources.md) before changing the package source, dependency policy, skill subtree, endpoint, runtime, or Codex configuration.

## Required state

- Unity: `2021.3 LTS` or newer.
- Package id: `com.coplaydev.unity-mcp`.
- Recommended Git dependency: `https://github.com/CoplayDev/unity-mcp.git?path=/MCPForUnity#main`.
- Codex server id: `unityMCP`.
- Default local endpoint: `http://127.0.0.1:8080/mcp`.
- Runtime prerequisite: native `uv`/`uvx` and Python 3.10 or newer.
- Repository skill: `.agents/skills/dev-unity-mcp/SKILL.md`, declaring `name: dev-unity-mcp`.
- Skill source: `CoplayDev/unity-mcp@main`, subtree `unity-mcp-skill/`.
- Local overlay: preserve the verified upstream snapshot while changing only its frontmatter name from `unity-mcp-orchestrator` to `dev-unity-mcp` for the portable package's role-first naming convention.
- Dependency source: the verified current `main` commit's `MCPForUnityEditorWindow.cs` and `RoslynInstaller.cs`, resolved by [scripts/get-unity-mcp-dependency-spec.ps1](scripts/get-unity-mcp-dependency-spec.ps1).
- UPM version policy: pass the official package ids without `@version`, exactly as upstream does, so Unity selects the latest compatible released versions for the project's Editor version.
- Roslyn version policy: run the imported package's official `RoslynInstaller`; its NuGet versions are pinned by the same verified upstream commit. Never replace them with independently guessed “latest” versions.

## Workflow

1. Resolve the exact Unity repository root. Require `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
2. Parse the Unity version and stop when it is older than 2021.3. Parse `Packages/manifest.json` as JSON before editing it. Record `HEAD`, staged paths, and the existing manifest bytes.
3. Classify the package dependency:
   - Correct: the package id resolves from the official CoplayDev Git repository using `?path=/MCPForUnity` on `main` or an explicit stable `v*` tag.
   - Missing: add the recommended Git dependency to the existing `dependencies` object while preserving all unrelated entries and the file's indentation/newline style.
   - Repairable: canonicalize a malformed official CoplayDev URL that clearly intends the same package.
   - Ambiguous: stop before replacing a registry, local-file, fork, beta, or other noncanonical source. Report the existing value and ask whether it is intentional.
4. Never edit `Packages/packages-lock.json` manually. Let Unity resolve it. If the matching Unity Editor is unambiguously available and the project is not already open, a bounded `-batchmode -quit -projectPath <root>` launch may resolve the package without custom scripts. Otherwise ask the user to open the project and wait for package import.
5. After the package imports, install or repair every optional dependency declared by the current official Git source:
   - Run [scripts/get-unity-mcp-dependency-spec.ps1](scripts/get-unity-mcp-dependency-spec.ps1) on every setup pass. Require valid JSON, verified Git blobs, a recorded commit, a valid MCP package version, at least one trusted `com.unity.*` UPM id, and at least one supported Roslyn NuGet entry. Stop if the upstream source shape or trust boundary changed; do not fall back to stale hard-coded versions.
   - Prefer the imported package's **Install All Dependencies** action under **Window > MCP for Unity > Optional Dependencies**. It installs Roslyn through the official installer and batches the current UPM package ids through Unity Package Manager.
   - When a live `unityMCP` connection is already available, the same result may be automated through its current package-management capability plus the official `RoslynInstaller`. Read the synchronized `dev-unity-mcp` skill before forming tool arguments. Pass UPM ids without versions and wait for the asynchronous package operation, compilation, and domain reload to settle.
   - Install missing dependencies and repair Roslyn when the official `IsInstalled()` check fails. Do not reinstall a correct dependency merely to churn its lock entry. If the official current dependency set changes, follow the verified spec; do not preserve a removed item as a setup requirement or silently accept a newly declared non-`com.unity.*` package.
   - If neither the live Unity integration nor an observable Editor action is available, report `pending Unity dependency install`; setup is not ready. Never claim that writing the core package URL installed these dependencies.
   - Verify Roslyn using the imported package's `IsInstalled()` result or the Optional Dependencies status after reload. Verify each UPM id through Unity Package Manager or the resolved package list, and record the actual installed versions. The installed UPM versions may differ across supported Unity releases because “latest compatible” is project-specific.
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
11. Verify:
   - `Packages/manifest.json` remains valid JSON and contains the intended package source.
   - After Unity resolves packages, `Packages/packages-lock.json` contains `com.coplaydev.unity-mcp` and its resolved version.
   - The dependency spec was obtained from the current verified `main` commit; all declared UPM dependencies are resolved at latest-compatible versions, and the official Roslyn check passes with that commit's pinned NuGet set.
   - `uv --version`, `uvx --version`, and Python compatibility checks pass.
   - The repository skill declares `dev-unity-mcp`, every downloaded upstream file was verified before the deterministic name overlay, the installed snapshot matches that transformed result, and the sync result includes the checked commit and subtree SHA.
   - The user-level Codex TOML parses and contains exactly one effective `unityMCP` server.
   - The endpoint is reachable when Unity reports the HTTP server running.
   - `HEAD` and staged paths are unchanged, no secret was added, and no other AI client configuration changed.
12. Report one of three outcomes: ready, restart-ready, or pending Unity import/dependency install/server start. Include the checked upstream commit, MCP package version, each dependency's actual installed version or pending reason, and whether Roslyn passed the official check. A structurally correct config is restart-ready, not live-verified, until Codex restarts and the Unity endpoint is running.

## Boundaries

- Install only `CoplayDev/unity-mcp`; do not substitute a fork, Asset Store package, OpenUPM source, beta branch, or direct server checkout without explicit user direction.
- Do not install `mcpforunityserver` as a persistent standalone tool. The package manages its matching server through uv/uvx.
- Do not sync the runtime skill from a fork, tag, beta branch, `.claude` destination, global skill directory, or package cache. Do not overwrite an unmanaged target folder or remove an unmanaged legacy folder.
- Install only dependency ids returned by the verified official source and accepted by the resolver's trust rules. Do not use registry-wide “latest” tags, preview versions, or independently selected Roslyn versions.
- Do not modify Unity-generated `.csproj` or `.sln` files, create temporary Editor scripts, or hand-edit the package lock.
- Do not bind the HTTP server beyond loopback or weaken its remote security policy.
- Never overwrite the whole Codex TOML, expose secrets, or remove unrelated MCP servers.
- Never configure Claude or another client, and never create `.claude` content.
- Never run `git add`, `git commit`, `git push`, or another command that changes Git history or the index.
