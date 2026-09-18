---
name: setup-cocos-gitignore
description: Add, verify, or repair a Cocos Creator project .gitignore from bundled Cocos and project-local AI templates without overwriting existing rules. Use when preparing a copied agent package in a Cocos repository, when library/temp/build/profiles are not ignored, or when .codex, .claude, .agents, .beads, .better-context, .ctxignore, .ctx.json, codegraph.json, .cocoindex_code, .codegraph, .mcp.json, .vscode, other local AI state, and Markdown files must stay out of Git.
---

# Cocos Gitignore Setup

Use [assets/Cocos.gitignore](assets/Cocos.gitignore) for the engine's regenerable state and [assets/AI.gitignore](assets/AI.gitignore) for project-local AI and Markdown exclusions. The merge algorithm, probe loop, and boundaries are identical to `setup-unity-gitignore`; only the engine template differs. `assets/AI.gitignore` is shared policy and must stay byte-identical to the copy in `setup-unity-gitignore`.

## Workflow

1. Resolve the target repository root and confirm it is a Cocos Creator project by locating `assets/` and a `package.json` that declares `creator.version`.
2. Inspect the existing root `.gitignore`, Git status, and already-tracked files before changing anything.
3. Check effective behavior before editing:
   - If every required Cocos, AI, and Markdown probe is ignored and every required authored path is visible, leave `.gitignore` unchanged.
   - If `.gitignore` does not exist, create it by combining `assets/Cocos.gitignore` and `assets/AI.gitignore`, with one blank line between them.
   - If `.gitignore` exists but is incomplete or ineffective, preserve all existing content and append only the required patterns that are missing or overridden.
4. Treat a later negation such as `!/.codex/` as an incorrect setup. Append the required ignore pattern after that negation so the final effective result matches the bundled templates.
5. Keep the authored paths visible to Git. If an existing broad rule hides `*.meta`, `/settings/`, `/build-templates/`, or `package-lock.json`, append the narrow negations required to expose them again — ignoring a `.meta` file is the single most destructive mistake available in a Cocos repository, because the uuid lives there and a regenerated uuid breaks every scene and prefab reference silently.
6. Do not remove, reorder, reformat, or replace existing rules. Keep unrelated user rules exactly as authored.
7. Do not untrack files automatically. Report any already-tracked file that now matches an ignore rule; `.gitignore` affects only untracked files.
8. Run this workflow before `bd init` or any other agent initializer that may create or stage generated integration files.

## Required checks

Use `git check-ignore --no-index -v` from the repository root. At minimum, confirm these paths are ignored:

- `library/__codex_gitignore_probe__`
- `temp/__codex_gitignore_probe__`
- `build/__codex_gitignore_probe__`
- `local/__codex_gitignore_probe__`
- `profiles/__codex_gitignore_probe__`
- `extensions/funplay-cocos-mcp/node_modules/probe.js`
- `.codex/config.toml`
- `.claude/settings.json`
- `.agents/skills/example/SKILL.md`
- `.beads/config.yaml`
- `.cocoindex_code/settings.yml`
- `.codegraph/codegraph.db`
- `.better-context/manifest.json`
- `.ctxignore`
- `.ctx.json`
- `.ctx-summaries.json`
- `codegraph.json`
- `.mcp.json`
- `.serena/project.yml`
- `.agent-temp/probe.txt`
- `.vscode/settings.json`
- `README.md`

And confirm these authored paths remain **visible**:

- `assets/scripts/Example.ts.meta`
- `settings/v2/packages/project.json`
- `build-templates/web-mobile/index.html`
- `package-lock.json`

Also compare the active, non-comment patterns in both bundled assets with the target file. Accept an existing equivalent rule when the effective check proves the same path is ignored; do not add cosmetic duplicates.

## Boundaries

- Treat invocation as authorization to create or extend the target `.gitignore` only.
- Never ignore `*.meta`, `/settings/`, `/build-templates/`, or `package-lock.json`, and never "clean up" an existing negation that keeps them visible.
- Never delete `library/` or `temp/` as part of this skill, even though they are ignored; removing them forces a full re-import that this skill has no business triggering.
- Never overwrite an existing `.gitignore` wholesale, reorder it, or drop unrelated user rules.
- Never run `git add`, `git commit`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion while any required probe is unignored or any authored path is hidden.
