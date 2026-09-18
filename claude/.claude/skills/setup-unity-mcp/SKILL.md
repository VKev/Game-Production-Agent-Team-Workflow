---
name: setup-unity-mcp
description: Install, repair, configure, and verify the official Unity MCP supplied by com.unity.ai.assistant for the exact Unity 6000.3.21f1 project, and register the official relay for every AI client bundle present in the repository (Codex user-level TOML and Claude Code project .mcp.json) with the same per-tool approval policy. Use during setup-agents when resolving the latest compatible Assistant package, verifying its registry tarball, removing legacy Coplay-owned state, configuring the relay for a client, approving/enabling tools, or generating and comparing the complete official, adapted, and custom tool catalog.
---

# Set up official Unity MCP

This setup supports only Unity `6000.3.21f1`. Read [references/sources.md](references/sources.md) before resolving a new package version. Read [references/project-settings-ai.md](references/project-settings-ai.md) before configuring any page under `Project Settings > AI`. Read the managed `dev-unity-mcp` skill before every live MCP operation.

## Client scope

One Unity Editor, one official relay, one approved connection policy, and one tool catalog serve every client. Register the relay for each client bundle present in the repository, and skip the other:

- `.codex/agents/setup_agents.toml` present → `scripts/upsert_codex_unity_mcp.ps1` (user-level Codex `config.toml`).
- `.claude/agents/setup-agents.md` present → `scripts/upsert_claude_unity_mcp.ps1` (project `.mcp.json` plus `.claude/settings.json`).

Both entries must resolve the same `relay_win.exe`, pass exactly `--mcp`, carry no project selector, and gate `Unity_ManageEditor` behind explicit approval. Unity approves each client separately in **Pending Connections**; several approved clients are supported and several live client PIDs are not an error. Never configure Cursor, Gemini, Grok, VS Code, or another client.

## State model

- `correct`: exact Editor/project, verified pinned package/tarball and AI-page source surface, official relay config for every client bundle in scope with matching approval policy, accepted disclaimer when required, running bridge, approved connection per client, all tools enabled after the final registry change, unrelated AI pages preserved, and exact live catalog equality; skip mutation and verify.
- `missing`: add the missing managed state.
- `repairable`: replace only incorrect setup-owned state while preserving unrelated TOML, tools, analyzers, hooks, credentials, and project content.
- `ambiguous`: wrong Editor, unknown package source, mismatched hash, multiple Editors, duplicate relay servers in one client, unowned legacy files, or catalog drift that does not regenerate cleanly; stop.

## Phase A: Editor closed

1. Canonicalize the Unity project. Require `ProjectSettings/ProjectVersion.txt` to declare exactly `6000.3.21f1`, resolve the installed matching `Unity.exe`, and require no project lock/open Editor.
2. Run `scripts/resolve_official_unity_mcp.ps1`. It queries the official Unity Registry (or a previously verified cache), admits stable/prerelease SemVer, selects the highest exact-patch-compatible Assistant, requires an official HTTPS tarball plus 40-hex SHA1, verifies archive safety and `package/package.json`, and returns an exact manifest version. A hash/identity/compatibility mismatch blocks setup.
3. Extract the verified tarball only to `.agent-temp/unity-mcp-package-cache/<version>/`. Run `scripts/inspect_unity_mcp_settings.py` and save its evidence beside the checkpoint; require the five expected `Project/AI/*` providers, classify only **Unity MCP Server** as configure, and detect the actual public all-tool UI surface instead of assuming an **Enable All** button. Then run `scripts/build_unity_mcp_catalog.py` without live inputs through a verified Python 3 runtime, never an unverified bare `python` from PATH. Write the portable generated snapshot to `dev-unity-mcp/references/generated/official-surface.json` in every skill library this repository carries (`.agents/skills/` and, when the Claude bundle is present, the mirrored `.claude/skills/`), so both clients read the same catalog. Require the exact source-discovered inventory (the verified `2.17.0-pre.1` snapshot contains 20 MCP-native declarations and 14 Assistant-adapted declarations); source schemas remain pending until live registry export.
4. Contribute `com.unity.ai.assistant=<exact-version>` and its verified dependencies to the orchestrator's one package map. Do not mutate the manifest independently. Deduplicate package ids and block disagreement.
5. Run `scripts/remove_legacy_coplay.ps1`. It may remove only DLLs whose exact hashes are owned by the old setup checkpoint. Preserve Better Context analyzers and every unknown file. The shared manifest transaction removes `com.coplaydev.unity-mcp`.
6. Remove no user software and install no `uv`, `uvx`, Python MCP server, HTTP endpoint, Coplay dependency spec, upstream Coplay skill, or custom Roslyn payload.
7. Let `setup-unity-packages` merge the complete graph once without launching Unity. Validate the exact manifest transaction, evidence, archive status, catalog hash, and remaining Phase-B steps. Reuse only a matching checkpoint; package-lock resolution and compilation remain pending for the user-opened Editor.

Do not upsert the relay config until Unity has resolved Assistant and installed the official relay. Do not open an interactive Editor or call live tools in this phase.

## Phase B: one user-opened Editor

1. Require exactly one intended Unity `6000.3.21f1` Editor and an unchanged Phase-A manifest/lock checkpoint. Wait for package resolve, import, and compile. Do not add/upgrade a UPM package.
2. Verify `com.unity.ai.assistant` and the official bridge. Resolve `%USERPROFILE%\.unity\relay\relay_win.exe`; require the file to exist. Run `scripts/wait_unity_mcp_discovery.ps1` for a bounded exact-project/PID/path check before relay calls. After a package import or domain reload, pass `-AfterReload -TimeoutSec 300`: `transient-editor-reload` means keep the same Editor open and retry after compilation settles, while `pending-manual-action` on initial bootstrap is the only missing-discovery state that asks the user to inspect MCP settings. Do not use fixed sleeps, automate the UI, or restart Unity speculatively.
3. Register the relay for each client bundle in scope, one script per client, and never hand-edit these files:
   - Codex: `scripts/upsert_codex_unity_mcp.ps1` against the user-level Codex TOML. It replaces only `mcp_servers.unity_mcp` and the prior managed `mcp_servers.unityMCP`, preserves unrelated content, writes one portable relay entry with `args=["--mcp"]`, and adds the `[mcp_servers.unity_mcp.tools.Unity_ManageEditor]` approval gate.
   - Claude Code: `scripts/upsert_claude_unity_mcp.ps1` against the project root. It writes exactly one `unity_mcp` server into `.mcp.json` with the resolved relay path, removes stale `unity-mcp`/`unityMCP` aliases, enables the server through `enabledMcpjsonServers`, and mirrors the Codex gate as a `permissions.ask` rule on `mcp__unity_mcp__Unity_ManageEditor`. Claude evaluates `ask` before `allow`, so the broad `mcp__unity_mcp__*` allow entry cannot bypass the gate.
   - The Claude script inspects the user-level `~/.claude.json` and reports any duplicate relay server there as `ambiguous`. Duplicates make two servers race for the same relay; resolve them by rerunning with `-PruneUserLevelDuplicates` only after confirming with the user, and never remove an unrelated user-level server.
   - Never add a project path to either entry, and never let the two clients disagree on command, arguments, or approval policy.
4. Ask for one restart of each configured client. Resume at Phase B without repeating Phase A.
5. Apply the `Project Settings > AI` matrix from `references/project-settings-ai.md`: preserve **Assistant**, **Assistant MCP Extensions**, **Gateway**, and **UI**; configure only **Unity MCP Server**. Ask the user to review/accept the first-use MCP disclaimer when present, require the bridge to be running, and approve the intended Codex client under **Pending Connections**. Never accept terms, sign in, click, or navigate through Computer Use. If multiple Editors are discoverable, stop and ask the user to select/close extras; multiple live Codex client PIDs are supported and are not by themselves an error.
6. Export full unfiltered Unity registry metadata with the exact prewritten `assets/unity-commands/export-live-registry.cs`; never regenerate this command ad hoc or add Newtonsoft. Parse its setup-owned JSON file, then capture the client-visible `tools/list` for each configured client, including input/output schemas, and record `initialize` capabilities. If any registered tool is disabled, list the exact names and ask the user to enable those checkboxes under **Unity MCP Server > Tools**. The verified `2.17.0-pre.1` UI has no public **Enable All** control; never use UI automation, reflection, direct `EditorPrefs` rewriting, or a project assembly coupled to the internal settings type. After the user resumes, refresh registry/client discovery and require zero disabled tools. Tool enablement is a Unity-side setting that applies to every approved client at once; still confirm each configured client's own `tools/list` reports the same names.
7. Treat this first registry pass as bootstrap evidence only. After every package/import/custom-tool/domain-reload operation in the enclosing setup workflow, repeat the all-tool export and require `registered = enabled = client-visible` for every configured client; the final pass is authoritative.
8. Run `scripts/build_unity_mcp_catalog.py` with source, final registry, client tools, and capabilities. It must report `complete`; `skill-surface-drift` blocks completion and requires regeneration/refresh/recomparison. Never claim resources/templates/prompts unless advertised live.
9. Smoke-test Editor state, scene/hierarchy, GameObject/component, asset/resource, package info, Console, script SHA/validation, and scene/camera capture. Mutations use a snapshotted temporary target and leave no asset or `.meta`.
10. Verify compile idle and no new setup-induced Error/Exception. Do not request a second Editor restart if Phase A was stable.

## Idempotence and safety

- Skip exact state. Repair only setup-owned drift. Never overwrite unrelated TOML, credentials, hooks, tools, comments, or user content.
- For the pinned source, MCP/gateway connection caps are not entitlement-gated. Add no credit, purchase, seat-assignment, token, or provider-credential workflow. First-use legal disclaimer acceptance can require an already signed-in Unity user; checkpoint it as a manual user action rather than bypassing it.
- Do not configure **Assistant MCP Extensions**, **Gateway**, **Assistant**, or **UI** for the external Codex connection.
- `unity_mcp` is the only managed server id in every client. Exactly one entry per client, no project selector, and no second alias such as `unity-mcp`.
- Keep the per-tool approval gate for `Unity_ManageEditor` in every client: `approval_mode = "approve"` in Codex, `permissions.ask` in Claude Code. Removing the gate is out of scope for setup.
- Protect handwritten `dev-unity-mcp` content. Assistant updates replace only generated references after tarball/live verification.
- Do not report complete until package lock, relay connection, all-tool enablement, full catalog equality for every configured client, compilation, and Console acceptance pass.
- Never use Computer Use, Windows UI automation, simulated mouse/keyboard input, or coordinate-based clicking. Use scripts, CLI, and official MCP operations; checkpoint and ask the user for any unavoidable Unity UI-only action.
