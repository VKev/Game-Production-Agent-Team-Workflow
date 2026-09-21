---
name: setup-cocos-gitignore
description: Add, verify, or repair a Cocos Creator project .gitignore from bundled Cocos and project-local AI templates without overwriting existing rules, for both the Creator 3.x and Creator 2.x layouts. Use when preparing a copied agent package in a Cocos repository, when library/temp/build/local/profiles are not ignored, or when .codex, .claude, .agents, .beads, .better-context, .ctxignore, .ctx.json, codegraph.json, .cocoindex_code, .codegraph, .mcp.json, .vscode, other local AI state, and Markdown files must stay out of Git.
---

# Cocos Gitignore Setup

Use [assets/Cocos.gitignore](assets/Cocos.gitignore) for the engine's regenerable state and [assets/AI.gitignore](assets/AI.gitignore) for project-local AI and Markdown exclusions. The merge algorithm, probe loop, and boundaries are identical to `setup-unity-gitignore`; only the engine template differs. `assets/AI.gitignore` is shared policy and must stay byte-identical to the copy in `setup-unity-gitignore`.

One template covers **both Creator lines**. The regenerable directories are nearly the same (`library/`, `temp/`, `local/`, `build/`); the differences are that `profiles/` exists only on 3.x, that editor extensions live in `extensions/` on 3.x and `packages/` on 2.x, and that `build-templates/` is a 3.x concept. Ignoring a path the project does not have is harmless, so the template is not split per line — but the **probe list below is**, because probing for a directory the line does not have proves nothing.

## Workflow

1. Resolve the target repository root and confirm it is a Cocos Creator project, and record which line it is:
   - **Creator 3.x** — `assets/` plus a `package.json` declaring `creator.version`.
   - **Creator 2.x** — `assets/` plus a root `project.json` declaring a `2.x` `version` (usually alongside `"engine": "cocos-creator-js"` and a `packages` key).

   Take the line from `setup-cocos-project-preflight` when it has already run. A repository with neither marker is not a Cocos project — say so and stop rather than writing a Cocos template into it.
2. Inspect the existing root `.gitignore`, Git status, and already-tracked files before changing anything.
3. Check effective behavior before editing:
   - If every required Cocos, AI, and Markdown probe is ignored and every required authored path is visible, leave `.gitignore` unchanged.
   - If `.gitignore` does not exist, create it by combining `assets/Cocos.gitignore` and `assets/AI.gitignore`, with one blank line between them.
   - If `.gitignore` exists but is incomplete or ineffective, preserve all existing content and append only the required patterns that are missing or overridden.
4. Treat a later negation such as `!/.codex/` as an incorrect setup. Append the required ignore pattern after that negation so the final effective result matches the bundled templates.
5. Keep the authored paths visible to Git. If an existing broad rule hides `*.meta`, `/settings/`, `/build-templates/`, `/packages/`, or `package-lock.json`, append the narrow negations required to expose them again — ignoring a `.meta` file is the single most destructive mistake available in a Cocos repository, because the uuid lives there and a regenerated uuid breaks every scene and prefab reference silently. In a 2.x project `/packages/` holds the project's own editor extensions and is authored source; only `packages/*/node_modules/` is ignored.
6. Do not remove, reorder, reformat, or replace existing rules. Keep unrelated user rules exactly as authored.
7. Do not untrack files automatically. Report any already-tracked file that now matches an ignore rule; `.gitignore` affects only untracked files.
8. Run this workflow before `bd init` or any other agent initializer that may create or stage generated integration files.

## Required checks

Use `git check-ignore --no-index -v` from the repository root. At minimum, confirm these paths are ignored:

- `library/__codex_gitignore_probe__`
- `temp/__codex_gitignore_probe__`
- `build/__codex_gitignore_probe__`
- `local/__codex_gitignore_probe__`
- `.dev-tools-trash/library-0/probe.txt` (the staging directory the `dev-tools` extension renames a cleared cache into)
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

Then add the probes for the detected line only:

**Creator 3.x**

- `profiles/__codex_gitignore_probe__`
- `extensions/funplay-cocos-mcp/node_modules/probe.js`

**Creator 2.x**

- `packages/dev-tools/node_modules/probe.js`

(`profiles/` is also ignored by the template in a 2.x project, but the directory does not exist there, so it is not evidence either way.)

And confirm these authored paths remain **visible**:

- `assets/scripts/Example.ts.meta` (3.x) or `assets/scripts/Example.js.meta` (2.x)
- `settings/v2/packages/project.json` (3.x) or `settings/project.json` (2.x)
- `package-lock.json`
- 3.x only: `build-templates/web-mobile/index.html`
- 2.x only: `packages/dev-tools/main.js` and `packages/dev-tools/package.json` — the project's own editor extensions are authored source, and a broad `packages/` rule silently deletes them from the repository's history going forward

Also compare the active, non-comment patterns in both bundled assets with the target file. Accept an existing equivalent rule when the effective check proves the same path is ignored; do not add cosmetic duplicates.

## Boundaries

- Treat invocation as authorization to create or extend the target `.gitignore` only.
- Never ignore `*.meta`, `/settings/`, `/build-templates/`, `/packages/`, or `package-lock.json`, and never "clean up" an existing negation that keeps them visible.
- Never delete `library/` or `temp/` as part of this skill, even though they are ignored; removing them forces a full re-import that this skill has no business triggering.
- Never overwrite an existing `.gitignore` wholesale, reorder it, or drop unrelated user rules.
- Never run `git add`, `git commit`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion while any required probe is unignored or any authored path is hidden.
