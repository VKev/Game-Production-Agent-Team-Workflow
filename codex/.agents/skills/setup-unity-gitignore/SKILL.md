---
name: setup-unity-gitignore
description: Add, verify, or repair a Unity project .gitignore from bundled official Unity and project-local AI templates without overwriting existing rules. Use when preparing a copied Codex agent package, when Unity-generated files are not ignored, or when .codex, .agents, .agent-temp, .beads, .better-context, .cocoindex_code, .codegraph, .vscode, other local AI state, and Markdown files must stay out of Git.
---

# Unity Gitignore Setup

Use [assets/Unity.gitignore](assets/Unity.gitignore) as the Unity baseline and [assets/AI.gitignore](assets/AI.gitignore) for project-local AI and Markdown exclusions. The Unity asset is a downloaded copy of GitHub's official community template; see [references/sources.md](references/sources.md) when refreshing or auditing its provenance.

## Workflow

1. Resolve the target repository root and confirm it is a Unity project by locating `Assets/` and `ProjectSettings/`.
2. Inspect the existing root `.gitignore`, Git status, and already-tracked files before changing anything.
3. Check effective behavior before editing:
   - If every required Unity, AI, and Markdown probe is ignored, leave `.gitignore` unchanged.
   - If `.gitignore` does not exist, create it by combining `assets/Unity.gitignore` and `assets/AI.gitignore`, with one blank line between them.
   - If `.gitignore` exists but is incomplete or ineffective, preserve all existing content and append only the required patterns that are missing or overridden.
4. Treat a later negation such as `!/.codex/` as an incorrect setup. Append the required ignore pattern after that negation so the final effective result matches the bundled templates.
5. Do not remove, reorder, reformat, or replace existing rules. Keep unrelated user rules exactly as authored.
6. Do not untrack files automatically. Report any already-tracked file that now matches an ignore rule; `.gitignore` affects only untracked files.
7. Run this workflow before `bd init` or any other agent initializer that may create or stage generated integration files.

## Required checks

Use `git check-ignore --no-index -v` from the repository root. At minimum, confirm these paths are ignored:

- `Library/__codex_gitignore_probe__`
- `Temp/__codex_gitignore_probe__`
- `Obj/__codex_gitignore_probe__`
- `Build/__codex_gitignore_probe__`
- `Logs/__codex_gitignore_probe__`
- `UserSettings/__codex_gitignore_probe__`
- `.vs/__codex_gitignore_probe__`
- `.codex/config.toml`
- `.agents/skills/example/SKILL.md`
- `.beads/config.yaml`
- `.claude/settings.json`
- `.cocoindex_code/settings.yml`
- `.codegraph/codegraph.db`
- `.better-context/manifest.json`
- `.ctx-summaries.json`
- `.serena/project.yml`
- `.agent-temp/probe.txt`
- `.art-temp/probe.txt`
- `.vscode/settings.json`
- `README.md`
- `Assets/README.md.meta`

Also compare the active, non-comment patterns in both bundled assets with the target file. Accept an existing equivalent rule when the effective check proves the same path is ignored; do not add cosmetic duplicates.

Finish with `git diff --check` and report whether `.gitignore` was created, repaired, or already correct.

## Boundaries

- Never run `git rm --cached` or another untracking command.
- Never overwrite an existing `.gitignore` wholesale.
- Never modify global Git excludes.
- Keep `*.md` and `*.md.meta`: this package intentionally ignores all Markdown files, including README, design documents, generated agent instructions, and Unity `.meta` files for Markdown assets.
- Ignoring another AI tool's local folder does not authorize installing or configuring that tool.
