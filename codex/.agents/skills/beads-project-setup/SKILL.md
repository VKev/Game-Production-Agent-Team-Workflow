---
name: beads-project-setup
description: Check, install, or repair the official Beads CLI, initialize the intended project only when needed, and install or refresh only the project-local Codex integration. Use when preparing a copied Codex agent package in a new repository or repairing a missing, stale, or misdirected Beads/Codex setup.
---

# Beads Project Setup

Set up Beads in the target repository without installing unrelated tools, using global Codex configuration, retaining generated Claude integration, or creating a Git commit.

## Workflow

1. Resolve and canonicalize the target repository root. Run every project command from that exact directory.
2. Confirm the root `.gitignore` is already prepared before initialization. When orchestrated by `setup-agents`, `unity-gitignore-setup` must complete first.
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
7. Before running `bd init`:
   - Require `.beads/` to be effectively ignored by the root `.gitignore` and absent from `git ls-files`.
   - Require an empty staged-path list.
   - Snapshot `HEAD` existence/SHA.
   - Canonicalize `.claude/` and `CLAUDE.md` and confirm that both targets are either absent or direct children of the intended repository root.
   - Create a unique temporary directory outside the repository. On Windows use `New-Item -ItemType Directory -Path <exact-path>`; do not use the unsupported `-LiteralPath` parameter for `New-Item`.
   - Move any pre-existing `.claude/` and `CLAUDE.md` into that temporary directory before initialization. Record which paths did not exist. This isolates user content so every Claude path created during `bd init` is known to belong to the current run.
8. Run the exact command `bd init` only when step 6 found initialization missing or incorrect. Pass no flags. The ignored, untracked `.beads/` directory prevents the current Beads auto-stage block from reaching its Git commit.
9. In a guaranteed cleanup path after either success or failure of step 8:
   - Re-resolve each current Claude path and verify it remains inside the exact project root. Stop before deletion if any path is a symlink, junction, reparse point, or escapes the root.
   - Delete generated files one file at a time with exact literal paths, then delete generated directories deepest-first only when empty. On Windows, use `[System.IO.Directory]::Delete(<exact-path>, $false)` for each verified empty directory. Never use a recursive delete.
   - Restore the isolated pre-existing `.claude/` and `CLAUDE.md` to their original exact paths.
   - Verify restored content and absence states, then remove the temporary directory only when it is empty. If cleanup or restoration is incomplete, keep the backup and report its path.
10. Check `bd setup codex --check` and the required Codex files before changing the integration:
   - If the check passes and all required files exist, skip `bd setup codex`.
   - If the check fails or files are missing, stale, or incorrect, run `bd setup codex`, then run the check again.
11. Verify with:
   - `bd where`
   - `bd setup codex --check`
   - `bd doctor`
   - Confirm `.agents/skills/beads/SKILL.md`, `AGENTS.md`, `.codex/config.toml`, and `.codex/hooks.json` exist.
12. Confirm no new Claude integration remains, all pre-existing Claude content is unchanged, `HEAD` is unchanged or still absent, and the staged-path list remains empty.
13. Report whether installation, initialization, cleanup, and Codex integration were skipped, created, or repaired; include the installed version, resolved Beads workspace, files created or updated, Git status, confirmation that no commit or staging occurred, and whether Codex must restart.

## Boundaries

- Treat invocation for project setup as authorization to install the official Beads CLI and create project-local Beads/Codex files.
- Never install from a fork, mirror, or unverified third-party package.
- Never run `bd init` again when `bd where` already resolves the intended workspace.
- Never use `bd setup codex --global`.
- Never run `bd setup claude` or another non-Codex setup command.
- Preserve `.claude/` and `CLAUDE.md` content that predates setup; remove only current-init artifacts or restore the pre-init snapshot.
- Never use `Remove-Item -Recurse`, a recursive filesystem scan, a wildcard, or an unresolved variable to clean Claude artifacts. Enumerate only the two exact project-local targets and their descendants after path and reparse-point checks.
- Never run `git add`, `git commit`, or `git push`. Git repository creation is owned by `setup-agents` and is limited to `git init`.
- Never rewrite Git history automatically if Beads changes `HEAD`; stop and report the violation.
- Do not overwrite or edit the portable `codex/` package as part of target-project initialization.
- Do not delete, replace, or reset an existing `.beads/` database to force setup to pass.
- Do not hide command failures, incomplete verification, or unexpected Git changes.
- Use `try`/`catch` and `$?` for PowerShell command failures. Read `$LASTEXITCODE` only after a native command was confirmed to start; a missing command, stale exit code, or timeout is never success.
- Allow at most one normal invocation and one retry after a relevant repair. Give diagnostics and verification commands 60 seconds and the official installer 180 seconds; stop and report when a budget expires.
