---
name: setup-beads
description: Check, install, or repair the official Beads CLI, initialize the intended project only when needed, and install or refresh the project-local integration for every AI client bundle present in the repository (Codex and Claude Code). Use when preparing a copied agent package in a new repository or repairing a missing, stale, or misdirected Beads client setup.
---

# Beads Project Setup

Set up Beads in the target repository without installing unrelated tools, without using global client configuration, and without creating a Git commit. Every client bundle present in the repository gets Beads through Beads' own official recipe, so durable task tracking behaves the same in each client.

## Client scope

Detect the client bundles in the repository and configure each of them:

- `.codex/agents/setup_agents.toml` present → `bd setup codex`.
- `.claude/agents/setup-agents.md` present → `bd setup claude`.

`bd init` creates both clients' starter files on its own; that is expected here and must be preserved, not cleaned up. Never configure Cursor, Gemini, Copilot, Windsurf, or another recipe, and never use a `--global` recipe.

## Workflow

1. Resolve and canonicalize the target repository root. Run every project command from that exact directory.
2. Confirm the root `.gitignore` is already prepared before initialization. When orchestrated by `setup-agents`, `setup-unity-gitignore` must complete first.
3. Resolve `bd` first (`Get-Command bd -ErrorAction SilentlyContinue` on Windows or `command -v bd` on POSIX) and run `bd version` only when an executable resolves:
   - If it succeeds, record the version and do not reinstall or upgrade Beads.
   - If no executable resolves, treat the CLI as missing.
   - If an executable resolves but `bd version` fails, treat the CLI as incorrect. Record its path and error, then repair it with the official installer once without deleting the existing executable manually.
4. If `bd` is missing or incorrect, read [references/sources.md](references/sources.md), confirm the current official install command, and install or repair only from `gastownhall/beads`:
   - Windows PowerShell: `irm https://raw.githubusercontent.com/gastownhall/beads/main/install.ps1 | iex`
   - macOS, Linux, or FreeBSD: `curl -fsSL https://raw.githubusercontent.com/gastownhall/beads/main/scripts/install.sh | bash`
5. Refresh the current process PATH once from the install directory reported by the installer, then run `bd version` again. Stop and report the failure if the current process still cannot use `bd`; do not reinstall or search the filesystem recursively.
6. Run `bd where` with a 60-second cold-start budget and compare canonical paths. Retry it at most once after a relevant non-destructive repair; a timeout is incomplete verification, not success:
   - If it resolves the intended repository, treat Beads initialization as correct and skip `bd init`.
   - If it reports no workspace or resolves outside the intended repository, treat initialization as missing or incorrect and initialize from the exact target root.
   - If a local `.beads/` exists but cannot be opened safely, do not delete it. Run `bd doctor`, follow only non-destructive repair guidance supported by the installed CLI, and stop if the database remains ambiguous.
7. Before running `bd init`, protect pre-existing user content without hiding it from the initializer:
   - Require `.beads/` to be effectively ignored by the root `.gitignore` and absent from `git ls-files`.
   - Require an empty staged-path list.
   - Snapshot `HEAD` existence/SHA.
   - Create a unique temporary directory outside the repository. On Windows use `New-Item -ItemType Directory -Path <exact-path>`; do not use the unsupported `-LiteralPath` parameter for `New-Item`.
   - **Copy** (do not move) every instruction and settings file `bd init` can touch into that directory, and record a hash for each plus which ones did not exist: `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json`, `.codex/config.toml`, `.codex/hooks.json`.
   - Canonicalize each target and confirm it is either absent or a direct descendant of the intended repository root. Stop if any path is a symlink, junction, or reparse point, or escapes the root.
8. Run the exact command `bd init` only when step 6 found initialization missing or incorrect. Pass no flags. The ignored, untracked `.beads/` directory prevents the current Beads auto-stage block from reaching its Git commit.
9. Immediately after `bd init` succeeds or fails, verify the protected files instead of deleting anything:
   - Every pre-existing file still exists, and its content outside Beads' own managed markers (`<!-- BEGIN BEADS INTEGRATION ... -->` / `<!-- END BEADS INTEGRATION -->`, `<!-- BEGIN BEADS CODEX SETUP ... -->` / `<!-- END BEADS CODEX SETUP -->`) is byte-identical to the backup.
   - Pre-existing hooks, permissions, and unrelated keys in `.claude/settings.json` and `.codex/*` survived the merge.
   - If any unmanaged content was replaced, truncated, or reordered, restore that exact file from the backup, report the violation, and stop before client setup.
   - Keep the backup directory until every check in step 12 passes; then delete its files one at a time with exact literal paths and remove the directory only when empty. Never use a recursive delete.
10. Configure each client bundle detected in the client scope, one at a time:
    - Codex: run `bd setup codex --check`. If the check passes and `AGENTS.md`, `.codex/config.toml`, and `.codex/hooks.json` carry current content, skip; otherwise run `bd setup codex` once and re-check.
    - Claude Code: run `bd setup claude --check`. If the check passes and `CLAUDE.md` plus `.claude/settings.json` carry current content, skip; otherwise run `bd setup claude` once and re-check.
    - `bd setup claude` merges its `SessionStart` hook into an existing `.claude/settings.json`; never hand-write, reorder, or duplicate that hook, and never point a Claude hook at `bd codex-hook`.
11. Mirror Beads' generated agent skill so Claude's own skill discovery finds it when the Claude bundle is present: copy `.agents/skills/beads/` to `.claude/skills/beads/` (contents only, no deletions outside that folder). Refresh it whenever `bd setup codex` regenerates the source skill.
12. Verify with:
    - `bd where`
    - `bd setup codex --check` and `bd setup claude --check`, for each configured bundle
    - `bd doctor`
    - Confirm the expected files exist per client: `.agents/skills/beads/SKILL.md`, `AGENTS.md`, `.codex/config.toml`, `.codex/hooks.json` (Codex); `CLAUDE.md`, `.claude/settings.json`, `.claude/skills/beads/SKILL.md` (Claude Code).
13. Confirm all pre-existing client content outside Beads' managed markers is unchanged, `HEAD` is unchanged or still absent, and the staged-path list remains empty.
14. Report whether installation, initialization, content protection, and each client integration were skipped, created, or repaired; include the installed version, resolved Beads workspace, files created or updated per client, Git status, confirmation that no commit or staging occurred, and which clients must restart.

## Known client asymmetry

The installed Beads release gives the two clients different hook coverage, and setup must report that instead of faking parity:

- Codex receives four native hooks in `.codex/hooks.json` — `SessionStart`, `UserPromptSubmit`, `PreCompact`, `PostCompact` — all calling `bd codex-hook <event>`.
- The Claude recipe installs one `SessionStart` hook calling `bd prime --hook-json`, plus the managed `CLAUDE.md` guidance block.
- There is no `bd claude-hook` command. Do not invent additional Claude hooks, do not call `bd codex-hook` from a Claude hook, and do not copy Codex's compaction hooks into `.claude/settings.json`. Report the gap as an upstream limitation; Beads' own guidance already tells agents to run `bd prime` after compaction or clearing.

Both clients read the same `.beads/` workspace, so issues, dependencies, and claims are shared whichever client is active.

## Boundaries

- Treat invocation for project setup as authorization to install the official Beads CLI and create project-local Beads, Codex, and Claude integration files.
- Never install from a fork, mirror, or unverified third-party package.
- Never run `bd init` again when `bd where` already resolves the intended workspace.
- Never use a `--global` recipe (`bd setup codex --global`, `bd setup claude --global`) or a recipe outside the detected client scope.
- Never delete client integration files that `bd init` or `bd setup <recipe>` created; this package set wants them. Restore from the step-7 backup only to repair unmanaged content that an initializer overwrote.
- Never use `Remove-Item -Recurse`, a recursive filesystem scan, a wildcard, or an unresolved variable while handling backups or generated files. Enumerate exact literal paths only.
- Never run `git add`, `git commit`, or `git push`. Git repository creation is owned by `setup-agents` and is limited to `git init`.
- Never rewrite Git history automatically if Beads changes `HEAD`; stop and report the violation.
- Do not overwrite or edit the portable `codex/` or `claude/` package as part of target-project initialization.
- Do not delete, replace, or reset an existing `.beads/` database to force setup to pass.
- Do not hide command failures, incomplete verification, or unexpected Git changes.
- Use `try`/`catch` and `$?` for PowerShell command failures. Read `$LASTEXITCODE` only after a native command was confirmed to start; a missing command, stale exit code, or timeout is never success.
- Allow at most one normal invocation and one retry after a relevant repair. Give diagnostics and verification commands 60 seconds and the official installer 180 seconds; stop and report when a budget expires.
