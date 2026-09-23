---
name: dev-cocos-build-minigame
description: Build and ship a Cocos Creator 3.8 project to mini-game platforms and web — platform ids, the CLI build invocation and its environment trap, build-templates injection, package-size ceilings, subpackage versus merged-JSON bundle layout, and verifying a build actually boots. Use when producing, configuring, or debugging a build, or when deciding whether something is "done".
---

# Cocos builds and mini-game packaging

**The build is the gate.** Editor preview runs the currently open scene with editor tooling attached; the build runs the start scene through the bundler. Everything that only fails in a build — tree-shaken modules, missing bundles, wrong platform branches — passes preview cleanly.

## Building

- Close the editor first when building from the CLI: the project is locked while it is open.
- On the CLI, the Cocos binary must not inherit Electron's node mode. Clear it explicitly (`env -u ELECTRON_RUN_AS_NODE …` on macOS/Linux; unset the variable in the environment on Windows) or the executable runs as plain Node and the build fails obscurely.
- The invocation is `--project <path> --build "platform=<id>;debug=…;sourceMaps=…;buildPath=project://build"`.
- Platform ids matter literally: Douyin/TikTok is **`bytedance-mini-game`**, not `bytedance`. A wrong id produces only "The build options verification failed". The platform must also be enabled in **Preferences → Labs** before it appears.
- `web-mobile` is the fastest verification target and worth building even when the ship target is a mini-game.

`build-templates/<platform>/` is authored source injected into the build output. It is not `build/`, it belongs in version control, and it is where SDK stubs, `index.html` overrides, and platform config live.

## Package layout on mini-game platforms

Hard ceilings: **main package ≤ 4 MB**, subpackages ≤ 20 MB.

Cocos allows only one compression type per bundle, which forces a choice:

| Option | Effect | Cost |
|---|---|---|
| `subpackage` | keeps the main package under the ceiling | thousands of individual JSON files |
| `merge_all_json` | one packed JSON, far fewer files | the merged payload lands in the main package |

A project that needs both builds with `merge_all_json` and then moves the heavy bundle into a subpackage as a post-build step: relocate `assets/<bundle>/` to `subpackages/<bundle>/`, rename the entry script as the platform expects, and patch both the platform manifest (`game.json` `subpackages`) and the engine settings (`src/settings.json` `assets.subpackages`). Keep that step in a checked-in tool, not in someone's memory.

## Verifying a build

A build that compiles is not a build that runs. Verify in this order:

1. The output exists and the package size is under the ceiling, measured from real file sizes.
2. Serve/launch the build and watch the **boot chain** in the log: startup component → bundle loads in the project's documented order → start scene load → first screen. A missing link is a stop, not a warning.
3. Compare against the documented expected log sequence rather than "it looked fine".
4. For a mini-game, load it in the platform's devtools/simulator, not only in a browser.

Expect benign differences: a visible size that differs from the design resolution with `fitWidth` is normal; a missing bundle callback is not.

## Before shipping

- Type gate clean (`npx tsc --noEmit`), project's static checkers clean, and the project's own test scripts green.
- Every new side-effecting module imported from bootstrap (otherwise it is in preview and gone from the build).
- Platform branches verified against the real platform constant, not a ported 2.x name.
- Package size, boot chain, and one full gameplay loop confirmed on the build.

## Boundaries

- Never call a change done because preview worked.
- Never edit files under `build/`; change the source or `build-templates/` and rebuild.
- Never hand-patch `game.json` or `src/settings.json` in a build output as a lasting fix — put it in the post-build tool.
- Never build while the editor is importing assets or has the project open for a CLI build.
- Never report a package size from `du -sh` against a hard platform ceiling.
- Never change the platform id, compression type, or bundle layout without rebuilding and re-verifying the boot chain.


## Traps paid for on a real ship

- **An empty `engine.json` ships everything.** If
  `settings/v2/packages/engine.json` holds only `{__version__}`, no module config
  exists and 3.8 bundles the lot — including Bullet 3D physics in a 2D game. The
  runtime tell is `[PHYSICS]: register bullet` plus a 4.7–10 s `Init SubSystem`
  while wasm loads. Declaring `includeModules` with only what the game uses took
  one project's main package from **5.80 MB to 2.84 MB** (`cocos-js` 4.81 → 2.3 MB).
  Audit usage by grep, do not guess. **Preview cannot verify this** — it runs a
  prebuilt engine bundle from `scripting/engine/bin/.cache`, so you must build.
- **The builder does not create subpackages.** Building with `merge_dep` puts
  everything in the main package. Relocating is a *post-build* step and needs all
  three of: move `assets/<bundle>/` → `subpackages/<bundle>/`; rename the entry
  `index.js` → **`game.js`**; patch **both** manifests (`game.json` `subpackages`
  and `src/settings.json` `assets.subpackages`). `internal` and `main` must stay
  under `assets/` because `main` holds the preloaded start scene. Keep this in a
  checked-in tool — done by hand once, it was nearly lost and nearly shipped an
  over-ceiling package.
- **Build through the running editor** instead of closing it for a CLI build:
  `Editor.Message.request('builder', 'command-build', { platform, debug,
  buildPath, outputName })`. It takes an **object**; the CLI-style string throws
  `Cannot create property 'platform' on string`. There is no `builder - build`
  message. After moving or editing `.ts` outside the editor, `refresh_assets`
  first or the build fails with `ModuleNotFoundError` against the old path.
- **Measure real bytes, excluding `subpackages/`** — `du -sh` reports something
  else and the platform ceiling is unforgiving. Zip with a tool that writes
  forward slashes and keeps `game.json` at the archive root; PowerShell's
  `Compress-Archive` writes backslash entry names, which is outside the ZIP spec
  and platforms reject it.
- **Serve verification builds with `Cache-Control: no-store`**, or the browser
  keeps the previous build's `assets/main/index.js` and a fixed bug still looks
  broken.

Full write-up: `dev-cocos-migrate-2x-to-3x/references/ship.md` §5.
