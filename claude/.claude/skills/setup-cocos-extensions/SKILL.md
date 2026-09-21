---
name: setup-cocos-extensions
description: Install, verify, and refresh the project-local Cocos Creator editor extensions this package set vendors — the `dev-tools` quick-dev menu and the `minigame-pack` subpackage packer — into a Cocos Creator 3.x project, and report them as not applicable in a Creator 2.x project. Use when preparing a copied agent package in a Cocos project, when those extensions are missing or stale, or when a mini-game build needs the subpackage step.
---

# Cocos editor extensions

This package set vendors two project-local Cocos Creator extensions so a copied bundle carries everything setup needs, with no network access:

| Extension | Vendored version | What it adds |
|---|---|---|
| `dev-tools` | 1.0.0 | **Dev nhanh** editor menu: cache report, clear `library`+`temp`, clear `build`, clear `profiles`+`local`, clear save game, refresh assets, open the dev page/preview, and the game-design command sheet |
| `minigame-pack` | 1.0.0 | **Build nhanh**: after a mini-game build, merges JSON and demotes a bundle into `subpackages/`, patching `game.json` and `src/settings.json` so the main package stays under the platform ceiling |

The MCP extension is **not** this skill's job: `setup-cocos-mcp` owns `funplay-cocos-mcp`, including its own vendored copy.

## Engine gate — read this before copying anything

Both vendored extensions declare `"editor": ">=3.8.0"` and use the Cocos Creator **3.x** extension format (`package_version: 2`, `contributions.menu` with message handlers, `Editor.Project` / `Editor.Message` APIs). Creator **2.x** uses a different extension system entirely and will not load them.

So:

- **Cocos Creator 3.x project** → install both. This is the normal path.
- **Cocos Creator 2.x project** → report both as `not-applicable` with that reason and install nothing. A 2.x project also needs no MCP extension, so its whole editor-extension phase is a no-op.
- The user may explicitly override for 2.x ("copy them anyway"). Then copy, and mark the result `pending-manual-verification`: state plainly that Creator 2.x is expected to ignore or reject them, and that the menus will not appear.

Never decide the engine version by looking at the folder name. Take it from `setup-cocos-project-preflight`, which reads `package.json` `creator.version` (3.x) or the root `project.json` version (2.x).

## Workflow

1. Run or reuse `setup-cocos-project-preflight`. Use its `project.creator_version` / `creator_major` to apply the engine gate above, and its `project.extensions` list to see what the project already has.
2. Resolve this skill's vendored sources: `<skills-dir>/setup-cocos-extensions/assets/dev-tools` and `.../minigame-pack`. Each carries a `vendor-manifest.json` with its name, version, editor requirement, and a per-file SHA-256.
3. Classify each extension before touching the project:
   - **missing** — no `<project>/extensions/<name>/` → install.
   - **correct** — present, and every file matches the vendored manifest hash → skip.
   - **stale** — present, unmodified, but a different version than the vendored one → replace after backing up.
   - **modified** — present and at least one file differs from its recorded hash → **stop and ask**. Report the exact differing paths. The user may have fixed something locally; never overwrite that silently.
   - **ambiguous** — `package.json` missing or unreadable inside an existing folder → stop and report.
4. Install or replace only what step 3 classified as missing or stale:
   - Back up an existing folder to `.agent-temp/cocos-extension-backups/<name>-<timestamp>/` before replacing it, and report that path.
   - Copy the vendored folder to `<project>/extensions/<name>/`, excluding nothing — the vendored copy already omits `node_modules`, `.git`, and build output.
   - Copy `vendor-manifest.json` along with it so the next run can classify without guessing.
5. Verify after copying: `<project>/extensions/<name>/package.json` parses, its `name` and `version` match the manifest, and every file hash matches. A mismatch here is a failed copy, not a success.
6. Extensions load when the editor reloads them. That is a **user action**: ask the user to restart Cocos Creator or reload extensions, and report the state as `pending editor reload`. Never launch, focus, or automate the editor.
7. Report per extension: state (`skipped` / `created` / `repaired` / `not-applicable` / `blocked`), installed version, vendored version, backup path when one was made, and whether an editor reload is still pending.

## What these extensions do that setup must not do

- `dev-tools` deletes things: `library/`, `temp/`, `build/`, `profiles/`, `local/`, and the save game. Its own menu items are confirm-gated and fail closed. **Setup installs it and stops there** — never invoke a destructive menu item, and never clear a cache "to make the import clean".
- `minigame-pack` rewrites build output (`assets/<bundle>` → `subpackages/<bundle>`, `game.json`, `src/settings.json`). It is only meaningful after a real mini-game build; setup never runs a build to exercise it.

## Boundaries

- Install only the vendored copies in this skill's `assets/`. Do not download these two extensions from anywhere; they are project-local tooling, not published packages.
- Never install them into a Creator 2.x project without an explicit user override, and never claim they work there.
- Never overwrite a locally modified extension. Back up, report the differing files, and let the user decide.
- Never delete `<project>/extensions/` or an unrelated extension, and never "tidy up" extensions this skill does not own.
- Never run an extension's menu commands, clear a cache, delete a save game, or trigger a build from setup.
- Never edit the vendored copies in `assets/` as part of setting up a project; they are package content. Update them deliberately, with their manifest regenerated.
- Do not report success while the editor has not reloaded: the correct state is `pending editor reload`.
