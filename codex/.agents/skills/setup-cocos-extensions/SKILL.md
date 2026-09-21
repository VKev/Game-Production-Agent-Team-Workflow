---
name: setup-cocos-extensions
description: Install, verify, and refresh the project-local Cocos Creator editor extensions this package set vendors — the `dev-tools` quick-dev menu and the `minigame-pack` subpackage packer — choosing the Creator 3.x build (into `extensions/`) or the Creator 2.x build (into `packages/`) from the project's engine line. Use when preparing a copied agent package in a Cocos project, when those extensions are missing or stale, or when a mini-game build needs the subpackage step.
---

# Cocos editor extensions

This package set vendors both engine lines of two project-local Cocos Creator extensions, so a copied bundle carries everything setup needs with no network access:

| Vendored folder | Engine line | Installs into | What it adds |
|---|---|---|---|
| `dev-tools` | Creator 3.x | `<project>/extensions/dev-tools/` | **Dev nhanh** menu: cache report, clear `library`+`temp`, clear `build`, clear `profiles`+`local`, clear save game, refresh assets, open the dev page/preview, game-design command sheet |
| `dev-tools-2x` | Creator 2.x | `<project>/packages/dev-tools/` | the same menu, minus the two items that depend on a 3.x project's `preview-template/dev-tools.html` |
| `minigame-pack` | Creator 3.x | `<project>/extensions/minigame-pack/` | **Build nhanh**: after a mini-game build, demotes a merged-JSON bundle into `subpackages/`, patching `game.json` and `src/settings.json` |
| `minigame-pack-2x` | Creator 2.x | `<project>/packages/minigame-pack/` | the same packing, against the 2.x build layout (`src/settings.js`, `settings.subpackages`) and hooked to the `builder:build-finished` IPC event |

The MCP extension is **not** this skill's job: `setup-cocos-mcp` owns `funplay-cocos-mcp`, and that one is **Creator 3.x only** — there is no 2.x build of it and none is planned.

## Engine routing — read this before copying anything

The two lines are not interchangeable. Creator 3.x loads extensions from `extensions/` with `package_version: 2`, `contributions.menu`, and `Editor.Message`; Creator 2.x loads them from `packages/` with a `main-menu` map, `module.exports.messages`, and `Editor.assetdb` / `Editor.Ipc`. Each vendored folder declares which line it is:

```json
{ "engine_line": "cocos-creator-2x", "install_dir": "packages", "editor_requirement": ">=2.4.0 <3.0.0" }
```

Route on the project's **major line**, never on a folder name:

- **Creator 3.x project** → install `dev-tools` and `minigame-pack` into `extensions/`.
- **Creator 2.x project** → install `dev-tools-2x` and `minigame-pack-2x` into `packages/`, each under its **unprefixed** name (`packages/dev-tools/`, `packages/minigame-pack/`). The `-2x` suffix names the vendored source folder, not the installed one; Creator 2.x resolves a package by the `name` in its `package.json`.
- Never install a line's build into the other line's project, and never install both lines into one project.

Take the version from `setup-cocos-project-preflight`, which reads `package.json` `creator.version` (3.x) or the root `project.json` `version` (2.x).

## What the 2.x build does not carry

Say these plainly rather than letting the user discover them:

- **No "Mở bảng Dev" menu item.** It opens `preview-template/dev-tools.html`, which belongs to a specific 3.x game project, not to the extension.
- **"Xoá save game" is narrower.** Without that page it can only clear storage in the Editor's own Electron session (Game view / internal preview window). The external browser's `localStorage` belongs to the browser's origin; the dialog says so and tells the user to clear it with `localStorage.clear()` rather than implying it was cleared.
- **No `profiles/`.** Creator 2.x keeps machine-local config in `local/` only, so the clear-config item covers one directory.
- **The post-build hook is best-effort.** Creator 2.x has no `contributions.builder`; the 2.x build listens for the `builder:build-finished` IPC event, whose payload shape varies across 2.4.x patches. It resolves the build directory defensively and logs plainly when it cannot. The manual **"Đóng gói lại thư mục build mini-game…"** menu item is the guaranteed path and always exists.

## Workflow

1. Run or reuse `setup-cocos-project-preflight`. Use its `project.creator_version` / `creator_major` to select the line, and its existing-extension list to see what the project already has.
2. Resolve this skill's vendored sources for the selected line: `<skills-dir>/setup-cocos-extensions/assets/<folder>`. Each carries a `vendor-manifest.json` with its name, version, engine line, install directory, editor requirement, and a per-file SHA-256.
3. Classify each extension before touching the project, against `<project>/<install_dir>/<name>/`:
   - **missing** — no such folder → install.
   - **correct** — present, and every file matches the vendored manifest hash → skip.
   - **stale** — present, unmodified, but a different version than the vendored one → replace after backing up.
   - **wrong-line** — present, but its `package.json` is the other line's format (`contributions` in a 2.x project, or `main-menu` in a 3.x project) → report it, back it up, and replace it with the correct line's build.
   - **modified** — present and at least one file differs from its recorded hash → **stop and ask**. Report the exact differing paths. The user may have fixed something locally; never overwrite that silently.
   - **ambiguous** — `package.json` missing or unreadable inside an existing folder → stop and report.
4. Install or replace only what step 3 classified as missing, stale, or wrong-line:
   - Back up an existing folder to `.agent-temp/cocos-extension-backups/<name>-<timestamp>/` before replacing it, and report that path.
   - Copy the vendored folder to `<project>/<install_dir>/<name>/`, dropping the `-2x` suffix from the destination name.
   - Copy `vendor-manifest.json` along with it so the next run can classify without guessing.
5. Verify after copying: the installed `package.json` parses, its `name` and `version` match the manifest, every file hash matches, and the manifest's `engine_line` matches the project's line. A mismatch here is a failed copy, not a success.
6. Confirm the 2.x menu contract when installing the 2.x line: every `main-menu` entry's `message` is `"<package-name>:<key>"` and `<key>` exists in the module's `messages`. A mismatch leaves a menu item that does nothing, with no error anywhere. Each 2.x build ships a `test.js` that checks exactly this — running `node <installed>/test.js` is the cheapest proof the copy is intact, and it needs no editor.
7. Extensions load when the editor reloads them. That is a **user action**: ask the user to restart Cocos Creator, and report the state as `pending editor reload`. Never launch, focus, or automate the editor.
8. Report per extension: state (`skipped` / `created` / `repaired` / `blocked`), engine line, install path, installed version, vendored version, backup path when one was made, test result when run, and whether an editor reload is still pending.

## What these extensions do that setup must not do

- `dev-tools` deletes things: `library/`, `temp/`, `build/`, `local/` (plus `profiles/` on 3.x), and the save game. Its own menu items are confirm-gated and fail closed. **Setup installs it and stops there** — never invoke a destructive menu item, and never clear a cache "to make the import clean".
- `dev-tools` renames a cleared directory into `.dev-tools-trash/` in the project root before deleting it in the background. Confirm `setup-cocos-gitignore` ignores that path; do not create or clean it here.
- `minigame-pack` rewrites build output. It is only meaningful after a real mini-game build; setup never runs a build to exercise it.

## Boundaries

- Install only the vendored copies in this skill's `assets/`. Do not download these extensions from anywhere; they are project-local tooling, not published packages.
- Never install the 3.x build into a 2.x project or the reverse, and never install both lines side by side.
- Never claim the MCP extension works on Creator 2.x; that line has no MCP extension at all.
- Never overwrite a locally modified extension. Back up, report the differing files, and let the user decide.
- Never delete `<project>/extensions/`, `<project>/packages/`, or an unrelated extension, and never "tidy up" extensions this skill does not own.
- Never run an extension's menu commands, clear a cache, delete a save game, or trigger a build from setup. Running a vendored `test.js` is allowed — it works on a fake project under the OS temp directory and never touches the real one.
- Never edit the vendored copies in `assets/` as part of setting up a project; they are package content. Update them deliberately, with their manifest regenerated.
- Do not report success while the editor has not reloaded: the correct state is `pending editor reload`.
