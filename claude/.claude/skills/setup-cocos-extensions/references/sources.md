# Sources and provenance

All four vendored folders are **project-local tooling**, not published packages.
There is no upstream registry, repository, or release feed for any of them: the
vendored copy is the source of truth. Each carries a `vendor-manifest.json` with
its identity, version, engine line, install directory, editor requirement, and a
per-file SHA-256.

| Folder | Engine line | Version | `editor_requirement` | Installs into | Files |
|---|---|---|---|---|---|
| `dev-tools` | Creator 3.x | 1.0.0 | `>=3.8.0` | `extensions/` | 5 |
| `minigame-pack` | Creator 3.x | 1.0.0 | `>=3.8.0` | `extensions/` | 5 |
| `dev-tools-2x` | Creator 2.x | 1.0.0 | `>=2.4.0 <3.0.0` | `packages/` | 5 |
| `minigame-pack-2x` | Creator 2.x | 1.0.0 | `>=2.4.0 <3.0.0` | `packages/` | 5 |

The 3.x folders were vendored from a working Cocos Creator 3.8.8 project on
2026-09-21. The 2.x folders were ported in-repo from them on the same date;
update either line by editing the folder and regenerating its manifest in the
same change.

## Why there are two lines instead of one portable extension

The two extension systems share no loading contract:

| | Creator 3.x | Creator 2.x |
|---|---|---|
| Install dir | `extensions/<name>/` | `packages/<name>/` |
| Manifest | `package_version: 2`, `contributions.menu` | `main-menu` map |
| Entry | `main: browser.js` | `main: main.js` |
| Handlers | `module.exports.methods` | `module.exports.messages` |
| Handler key | `cacheReport` | `'cache-report'` (package prefix stripped) |
| Asset refresh | `Editor.Message.request('asset-db', …)` | `Editor.assetdb.refresh(url, cb)` |
| Build hook | `contributions.builder` → `onAfterBuild` | IPC `builder:build-finished` |

A 2.x editor does not load a 3.x extension, and the reverse is equally true. The
`editor_requirement` field states the constraint declaratively; `engine_line` and
`install_dir` are what `setup-cocos-extensions` actually routes on.

The pure-Node layers (`cache.js`, `pack.js`) carry the logic that is worth
sharing, and they are engine-independent by construction — no `Editor` import, a
`require.main` entry point, and their own tests. They are duplicated per line
rather than shared, because each vendored folder must stay self-contained enough
to copy into a project on its own.

### Two substantive differences, not just glue

**Engine settings.** 3.x writes `src/settings.json` (plain JSON) and keeps the
subpackage list at `settings.assets.subpackages`. 2.x writes `src/settings.js`,
a JS file assigning `window._CCSettings = {...};`, and keeps the list at
`settings.subpackages`. `minigame-pack-2x/pack.js` detects both shapes, parses
the JS wrapper (JSON first, then a `vm` sandbox for a non-JSON object literal),
and **refuses clearly** when it recognizes neither — a silent partial patch
produces a build that runs on the dev machine and fails only on the real
platform. It reads settings *before* moving any directory, so a refusal cannot
leave a half-packed build.

**Node version.** Creator 2.4 embeds a much older Electron/Node than 3.8.
`fs.promises.rm` only exists from Node 14.14, so `dev-tools-2x/cache.js` falls
back through `fs.rmSync` and `fs.rmdirSync({recursive:true})` to manual
recursion. Carrying the 3.x call straight over leaves the trash directory never
emptied on a 2.x editor.

Creator 2.4.x also moved parts of its own API surface between patch releases, so
the 2.x builds resolve `Editor.Project.path` / `Editor.projectInfo.path` /
`Editor.projectPath`, the dialog call, and the quit call through fallback chains.
A menu item that dies silently is worse than one log line saying why.

## What each one touches

`dev-tools` (both lines)
- Reads: cache directory sizes; the preview server port (Cocos default 7456).
- Deletes, each behind a confirmation that fails closed when it cannot ask:
  `library/`+`temp/`, `build/` (separately, on purpose), machine-local config
  (`profiles/`+`local/` on 3.x, `local/` on 2.x), and preview `localStorage`.
  Deletion is a `rename` into `.dev-tools-trash/` first, emptied in the
  background or on the next load.
- A whitelist (`CLEARABLE`) is the only thing it will delete; `assets/`,
  `settings/`, and `packages/` are refused and collected into `errors`.
- Ships its own `test.js` that stubs `Editor` and `electron` and runs every file
  operation against a fake project in the OS temp directory.

`minigame-pack` (both lines)
- Runs after a mini-game build, on the build output only. Never touches
  `assets/` source.
- Relocates a bundle to `subpackages/`, renames the entry script as the platform
  expects, patches the platform manifest and engine settings, and pins
  `deviceOrientation` to `portrait` — after the subpackage patch, never before.
- Platform ids are literal: Douyin/TikTok is `bytedance-mini-game`, not
  `bytedance`.

## Verifying a vendored copy without an editor

Both 2.x folders ship a self-contained `test.js`:

```
node <installed>/test.js
```

It needs no Cocos project and no editor. Besides the file operations, it checks
the 2.x menu contract in both directions — every `main-menu` message has a
handler in `messages`, and every handler has a menu item — which is the failure
mode that otherwise shows up as a menu item that silently does nothing.
