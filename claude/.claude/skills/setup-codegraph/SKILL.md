---
name: setup-codegraph
description: Check, install, connect, initialize, and verify the official CodeGraph source-code knowledge graph for every AI client bundle present in the repository (Codex user-level TOML and Claude Code project .mcp.json), with project-owned Unity code indexed and registered vendor source excluded. Use when preparing a copied agent package, when the CodeGraph CLI or a client MCP entry is missing or stale, or when a project needs its local .codegraph index.
---

# CodeGraph Project Setup

Install CodeGraph from its official standalone distribution, connect each client bundle present in this repository to its MCP server, and build the one project-local source index. Read [references/sources.md](references/sources.md) before changing installer, client, or initialization behavior.

## Client scope

Configure only the client bundles present in the repository, and configure every one of them:

- `.codex/agents/setup_agents.toml` present → `codegraph install --target=codex --location=global --yes`.
- `.claude/agents/setup-agents.md` present → `codegraph install --target=claude --location=local --yes`.

The CLI's known targets are `claude`, `cursor`, `codex`, `opencode`, `hermes`, `gemini`, `antigravity`, and `kiro`; never use auto-detection, `all`, or a target outside the detected scope. The installed release supports `--location=local` for Claude Code but **not** for Codex, which it skips with an explicit message — that asymmetry is upstream behavior, not a setup failure, and Codex therefore stays user-level.

`.codegraph/` and root `codegraph.json` are one shared, client-neutral index and policy. Both clients read the same graph; never create a second index, a second policy file, or a per-client exclude list.

## Workflow

1. Resolve and canonicalize the exact target project root. Treat the CodeGraph CLI as user-level state shared by projects; treat `.codegraph/` and `codegraph.json` as per-project, client-neutral state.
2. Before making changes, record whether `HEAD` exists, its SHA, and the staged-path list. Also record existence and hashes of every client file this skill can touch: the active Codex `config.toml`, `<project-root>/.mcp.json`, `<project-root>/.claude/settings.json`, `<project-root>/.claude/CLAUDE.md`, and the user-level `~/.claude.json`, `~/.claude/settings.json`, `~/.claude/CLAUDE.md` which must stay byte-identical because the Claude registration is project-local. Do not recursively inspect client directories. Stop if the Git index is already non-empty.
3. Confirm the root `.gitignore` effectively ignores `.codegraph/`, root `codegraph.json`, `/.mcp.json`, and `/.claude/`, and that none of them is tracked. When orchestrated by `setup-agents`, `setup-unity-gitignore` must complete first. Do not initialize CodeGraph until these checks pass.
4. Resolve `codegraph` (`Get-Command codegraph -ErrorAction SilentlyContinue` on Windows or `command -v codegraph` on POSIX) before invoking it:
   - If `codegraph version`, `codegraph install --help`, and `codegraph init --help` succeed and expose the required explicit-target installer, `--location`, `--yes`, one-step initialization, and project `codegraph.json` `exclude` behavior, record the version and do not reinstall or upgrade it.
   - If the executable runs but lacks a required target, `--location`, `--yes`, one-step `codegraph init`, or project exclusion behavior, treat it as an incompatible installation and repair it once with the official standalone installer. Do not upgrade solely because a newer version exists.
   - If the command is absent or cannot start, install the official standalone release once:
     - Windows PowerShell: `irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex`
     - macOS or Linux: `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh`
   - Do not substitute npm, clone the repository, or install Node.js when the official standalone installer works.
5. Resolve `codegraph` again. If the installer succeeded but the current process cannot find it, add only the executable directory reported by the installer to the current process PATH and retry once. Stop if `codegraph version` still fails; never reinstall merely to refresh PATH.
6. Codex, when its bundle is present: resolve the active Codex home from `CODEX_HOME`, falling back to `~/.codex`. Inspect its existing CodeGraph MCP entry and preserve all unrelated configuration. Treat integration as correct only when the `codegraph` MCP server launches `codegraph` with arguments `serve` and `--mcp`.
7. If the Codex entry is missing or stale, back up the affected Codex configuration and instruction files outside the project, then run exactly:

   `codegraph install --target=codex --location=global --yes`

   Reinspect the resulting Codex entry.
8. If the official installer cannot update Codex but the CLI itself works, run `codegraph install --print-config codex`, validate the emitted snippet, and merge only that exact CodeGraph MCP entry into the active Codex configuration. Preserve unrelated TOML and instruction content. Do not guess a replacement entry or use this fallback to conceal a CLI, permission, or parsing failure.
9. Claude Code, when its bundle is present: back up `<project-root>/.mcp.json`, `<project-root>/.claude/settings.json`, and `<project-root>/.claude/CLAUDE.md` outside the project, then run exactly:

   `codegraph install --target=claude --location=local --yes`

   Verify what it actually wrote instead of assuming, because this one command touches three files:
   - `<project-root>/.mcp.json` gains a `codegraph` server (`"type": "stdio"`, `"command": "codegraph"`, `"args": ["serve", "--mcp"]`), merged next to unrelated servers.
   - `<project-root>/.claude/settings.json` gains a `UserPromptSubmit` hook running `codegraph prompt-hook` and an auto-allow permission entry `mcp__codegraph__*`. Beads' `SessionStart` hook and every unrelated handler must survive; if any is missing afterwards, restore from the backup and report the violation.
   - `<project-root>/.claude/CLAUDE.md` gains the marker-managed CodeGraph routing block (`<!-- CODEGRAPH_START -->` … `<!-- CODEGRAPH_END -->`). Preserve handwritten content outside the markers.
   Pass `--no-permissions` only when the user explicitly does not want the auto-allow list; record that choice in the report.
10. Add `codegraph` to `enabledMcpjsonServers` in `.claude/settings.json` so a copied project bundle works without a manual approval prompt. Confirm the user-level Claude files recorded in step 2 are still byte-identical: a project-local install must never reach `~/.claude.json`.
11. If the Claude installer fails but the CLI works, merge the equivalent `.mcp.json` entry by hand from `codegraph install --print-config claude` (adjusting only the file it targets, never its command or arguments) and report the fallback. Do not hand-write the hook or the managed block; report them as pending instead.
12. Parse or create root `codegraph.json`, preserving every unrelated key, then merge these exact gitignore-style entries into its `exclude` array:

    `.agent-temp/`, `Assets/Plugins/Demigiant/`, `Assets/Plugins/Sirenix/`, `Assets/Plugins/RootMotion/`, `Assets/Plugins/Feel/`, `Assets/Plugins/FImpossible Creations/`, `Assets/Plugins/KINEMATION/`, `Assets/Plugins/Technie/`, `Assets/Plugins/Roslyn/`, and `Packages/nuget-packages/InstalledPackages/`.

    Stop on invalid JSON, duplicate keys, a non-array `exclude`, or a CLI version that does not support project `exclude` configuration. Never replace this list or broaden it to `Assets/Plugins/` or `Packages/`; project-owned plugin and embedded-package code must remain indexable. Validate that `.agent-temp/` and each exact vendor/generated probe are excluded and `Assets/Plugins/Game/Probe.cs` remains eligible.
13. Check the project index once, for all clients together. Initial indexing may legitimately take several minutes in a large Unity project; allow a bounded ten-minute budget, surface progress at least once per minute, and treat a timeout as incomplete rather than successful:
    - When orchestrated by `setup-agents` and live Unity package imports are still pending, defer a missing initial index until the single post-import refresh; installation, policy, and MCP registration may still be `restart-ready`.
    - Otherwise, if `.codegraph/` is absent, run `codegraph init` with no flags from the exact project root. Current CodeGraph builds the initial graph during this command.
    - If `.codegraph/` exists and `codegraph status <project-root>` is healthy, skip initialization.
    - If status explicitly reports an uninitialized project, run `codegraph init` once from the exact root and recheck.
    - If status reports pending synchronization, or the exclude policy changed and old vendor nodes may remain, run one bounded `codegraph sync <project-root>` and recheck.
    - If the index is corrupt, locked, points at another root, or remains unhealthy, stop and report it. Never delete, rebuild, or replace an existing index automatically.
14. Verify `codegraph version`, `codegraph status <project-root>` when indexing was due, exact vendor exclusion and project-code eligibility, each configured client's exact MCP command and arguments, `.codegraph/`, `codegraph.json`, `.mcp.json`, and `.claude/` ignore/untracked behavior, unchanged user-level Claude hashes, unchanged `HEAD`, and an empty staged-path list. Report which clients must restart before the new MCP server becomes available.

## Runtime handoff

After setup, `dev-unity-project-context` owns CodeGraph, CocoIndex Code, direct-read, and Serena routing. This setup skill owns only installation, indexing, client registration, and their verification.

## Boundaries

- Configure only the client bundles detected in the client scope. Never configure, modify, or remove Cursor, Gemini, opencode, Hermes, Kiro, Antigravity, or another client.
- Never run bare `codegraph install`; always pass the explicit target and location documented above.
- Never install Claude Code globally (`--target=claude --location=global`) from a project bundle; it would write `~/.claude.json` and leak this project's tooling into every other repository.
- Never run `codegraph uninstall`, `codegraph uninit`, or delete `.codegraph/` automatically.
- Never overwrite client configuration or instruction files wholesale, and never remove another tool's hook or permission entry while merging CodeGraph's.
- Never fork the index or the exclusion policy per client; one `.codegraph/` and one `codegraph.json` serve every client.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion when installer, MCP, index, Git, or client-scope verification is incomplete.
