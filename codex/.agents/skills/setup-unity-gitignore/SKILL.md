---
name: setup-unity-gitignore
description: Add, verify, or repair a Unity project .gitignore from bundled official Unity and project-local AI templates without overwriting existing rules. Use when preparing a copied Codex agent package, when Unity-generated files are not ignored, or when .codex, .agents, .agent-temp, .beads, .better-context, .cocoindex_code, .codegraph, .vscode, other local AI state, and Markdown files must stay out of Git.
---

# Unity Gitignore Setup

Use [assets/Unity.gitignore](assets/Unity.gitignore) as the Unity baseline plus generated NuGetForUnity payload policy, and [assets/AI.gitignore](assets/AI.gitignore) for project-local AI and Markdown exclusions. The Unity asset starts from GitHub's official community template and carries two documented project-specific NuGetForUnity rules; see [references/sources.md](references/sources.md) when refreshing or auditing its provenance.

## Workflow

1. Resolve the target repository root and confirm it is a Unity project by locating `Assets/` and `ProjectSettings/`.
2. Inspect the existing root `.gitignore`, Git status, and already-tracked files before changing anything.
3. Check effective behavior before editing:
   - If every required Unity, AI, and Markdown probe is ignored, leave `.gitignore` unchanged.
   - If `.gitignore` does not exist, create it by combining `assets/Unity.gitignore` and `assets/AI.gitignore`, with one blank line between them.
   - If `.gitignore` exists but is incomplete or ineffective, preserve all existing content and append only the required patterns that are missing or overridden.
4. Treat a later negation such as `!/.codex/` as an incorrect setup. Append the required ignore pattern after that negation so the final effective result matches the bundled templates.
5. Keep `Packages/nuget-packages/NuGet.config` and every `packages.config` visible to Git. If an existing broad rule ignores either declaration, append only the narrow parent/file negations required to expose them while keeping `InstalledPackages/` and generated `package.json` ignored.
6. Do not remove, reorder, reformat, or replace existing rules. Keep unrelated user rules exactly as authored.
7. Do not untrack files automatically. Report any already-tracked file that now matches an ignore rule; `.gitignore` affects only untracked files.
8. Run this workflow before `bd init` or any other agent initializer that may create or stage generated integration files.

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
- `Packages/nuget-packages/InstalledPackages/__codex_gitignore_probe__.dll`
- `Packages/nuget-packages/package.json`
- `README.md`
- `Assets/README.md.meta`

Also compare the active, non-comment patterns in both bundled assets with the target file. Accept an existing equivalent rule when the effective check proves the same path is ignored; do not add cosmetic duplicates.

Also require both declaration probes to remain visible to Git:

- `Packages/nuget-packages/NuGet.config`
- `Packages/nuget-packages/packages.config`

Run `git check-ignore --no-index -v` for each declaration and require no matching ignore rule. If either is ignored, setup is incorrect until a narrow effective negation exposes it. Do not create the declaration merely to test ignore behavior.

Finish with `git diff --check` and report whether `.gitignore` was created, repaired, or already correct.

## Boundaries

- Never run `git rm --cached` or another untracking command.
- Never overwrite an existing `.gitignore` wholesale.
- Never modify global Git excludes.
- Keep `*.md` and `*.md.meta`: this package intentionally ignores all Markdown files, including README, design documents, generated agent instructions, and Unity `.meta` files for Markdown assets.
- Ignore only NuGetForUnity's downloaded/generated payloads. Do not ignore its restore declarations (`NuGet.config` and `packages.config`).
- Ignoring another AI tool's local folder does not authorize installing or configuring that tool.
