---
name: codegraph-project-setup
description: Check, install, connect, initialize, and verify the official CodeGraph source-code knowledge graph for Codex only. Use when preparing a copied Codex agent package, when the CodeGraph CLI or Codex MCP entry is missing or stale, or when a project needs its local .codegraph index.
---

# CodeGraph Project Setup

Install CodeGraph from its official standalone distribution, connect only Codex to its MCP server, and build the project-local source index. Read [references/sources.md](references/sources.md) before changing installer, client, or initialization behavior.

## Workflow

1. Resolve and canonicalize the exact target project root. Treat the CodeGraph CLI and Codex MCP registration as user-level state shared by projects; treat `.codegraph/` as a per-project index.
2. Before making changes, record whether `HEAD` exists, its SHA, and the staged-path list. Also record the existence and hashes of these exact Claude paths when present: `~/.claude.json`, `~/.claude/settings.json`, `~/.claude/CLAUDE.md`, `<project-root>/.claude/settings.json`, `<project-root>/.claude/settings.local.json`, and `<project-root>/CLAUDE.md`. Do not recursively inspect Claude directories. Stop if the Git index is already non-empty.
3. Confirm the root `.gitignore` effectively ignores `.codegraph/` and that no `.codegraph/` path is tracked. When orchestrated by `setup-agents`, `unity-gitignore-setup` must complete first. Do not initialize CodeGraph until both checks pass.
4. Resolve `codegraph` (`Get-Command codegraph -ErrorAction SilentlyContinue` on Windows or `command -v codegraph` on POSIX) before invoking it:
   - If `codegraph version`, `codegraph install --help`, and `codegraph init --help` succeed and expose the required explicit-target installer and one-step initialization behavior, record the version and do not reinstall or upgrade it.
   - If the executable runs but lacks the required `codex` target, `--location`, `--yes`, or one-step `codegraph init` behavior, treat it as an incompatible installation and repair it once with the official standalone installer. Do not upgrade solely because a newer version exists.
   - If the command is absent or cannot start, install the official standalone release once:
     - Windows PowerShell: `irm https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1 | iex`
     - macOS or Linux: `curl -fsSL https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh | sh`
   - Do not substitute npm, clone the repository, or install Node.js when the official standalone installer works.
5. Resolve `codegraph` again. If the installer succeeded but the current process cannot find it, add only the executable directory reported by the installer to the current process PATH and retry once. Stop if `codegraph version` still fails; never reinstall merely to refresh PATH.
6. Resolve the active Codex home from `CODEX_HOME`, falling back to `~/.codex`. Inspect its existing CodeGraph MCP entry and preserve all unrelated configuration. Treat integration as correct only when the `codegraph` MCP server launches `codegraph` with arguments `serve` and `--mcp`.
7. If the Codex entry is missing or stale, back up the affected Codex configuration and instruction files outside the project, then run exactly:

   `codegraph install --target=codex --location=global --yes`

   Reinspect the resulting Codex entry. This explicit target is mandatory: never use auto-detection, `all`, or another client target.
8. If the official installer cannot update Codex but the CLI itself works, run `codegraph install --print-config codex`, validate the emitted snippet, and merge only that exact CodeGraph MCP entry into the active Codex configuration. Preserve unrelated TOML and instruction content. Do not guess a replacement entry or use this fallback to conceal a CLI, permission, or parsing failure.
9. Check the project index. Initial indexing may legitimately take several minutes in a large Unity project; allow a bounded ten-minute budget, surface progress at least once per minute, and treat a timeout as incomplete rather than successful:
   - If `.codegraph/` is absent, run `codegraph init` with no flags from the exact project root. Current CodeGraph builds the initial graph during this command.
   - If `.codegraph/` exists and `codegraph status <project-root>` is healthy, skip initialization.
   - If status explicitly reports an uninitialized project, run `codegraph init` once from the exact root and recheck.
   - If status reports pending synchronization, run one bounded `codegraph sync <project-root>` and recheck.
   - If the index is corrupt, locked, points at another root, or remains unhealthy, stop and report it. Never delete, rebuild, or replace an existing index automatically.
10. Verify `codegraph version`, `codegraph status <project-root>`, the exact Codex MCP command and arguments, `.codegraph/` ignore/untracked behavior, unchanged known Claude configuration hashes, unchanged `HEAD`, and an empty staged-path list. Report that Codex must restart before the new MCP server becomes available.

## Runtime handoff

CodeGraph is the primary source-code reading and discovery tool once an agent has a known symbol, file, route, or other structural foothold. Its default MCP surface exposes `codegraph_explore`, and its returned source is current, verbatim context unless its response reports pending or stale synchronization. When identifiers are unknown and the request is conceptual or fuzzy, use CocoIndex Code to discover candidate symbols, then return to CodeGraph for their real relationships. CodeGraph does not replace direct reads for Unity YAML, assets, configuration, documentation, unsupported languages, or exact post-edit verification.

CodeGraph does not edit files. After it identifies the exact source symbols and paths, use Serena only for semantic edits and refactors. If CodeGraph is unavailable, uninitialized, incomplete, or explicitly stale, use built-in read/search tools as the fallback; do not use Serena as the ordinary code reader.

## Boundaries

- Configure Codex only. Never configure, modify, or remove Claude, Cursor, Gemini, or another client.
- Never run bare `codegraph install`; always use the explicit Codex-only target command above.
- Never run `codegraph uninstall`, `codegraph uninit`, or delete `.codegraph/` automatically.
- Never overwrite Codex configuration or instruction files wholesale.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion when installer, MCP, index, Git, or client-isolation verification is incomplete.
