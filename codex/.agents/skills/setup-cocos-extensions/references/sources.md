# Sources and provenance

Both extensions are **project-local tooling**, not published packages. They are
vendored into `assets/` from a working Cocos Creator 3.8.8 project on 2026-09-21
and carry a `vendor-manifest.json` with their identity, version, editor
requirement, and a per-file SHA-256.

| Extension | Version | `editor` requirement | Files |
|---|---|---|---|
| `dev-tools` | 1.0.0 | `>=3.8.0` | 5 |
| `minigame-pack` | 1.0.0 | `>=3.8.0` | 5 |

There is no upstream registry, repository, or release feed for either one: the
vendored copy is the source of truth. Update them by replacing the folder under
`assets/` and regenerating `vendor-manifest.json` (identity, version, and the
per-file hashes) in the same change.

## Why the 3.x gate is not a preference

Both declare `"package_version": 2` and contribute through `contributions.menu`
entries whose handlers are resolved as Cocos Creator 3.x editor messages, and
their code uses `Editor.Project` / `Editor.Message` plus Electron APIs in the 3.x
extension host. Cocos Creator 2.x loads extensions from `packages/` with a
different manifest and a different API surface, so a 2.x editor does not run
these — it ignores or rejects them. The `"editor": ">=3.8.0"` field states the
same constraint declaratively.

`minigame-pack` is additionally tied to the 3.x mini-game build layout: it
rewrites `assets/<bundle>` into `subpackages/<bundle>` and patches `game.json`
`subpackages` plus `src/settings.json` `assets.subpackages`. Those files do not
exist in a Creator 2.x build.

## What each one touches

`dev-tools`
- Reads: `library/`, `temp/`, `build/`, `profiles/`, `local/` sizes for its cache
  report; the preview server port (Cocos default 7456).
- Deletes, each behind a confirmation that fails closed when it cannot ask:
  `library/`+`temp/`, `build/` (separately, on purpose), `profiles/`+`local/`, and
  the save game in the preview origin's `localStorage`.
- Opens: the dev page served by the preview server, the project directory.
- Ships its own `test.js` (51 tests) that stubs `Editor` and `electron` and runs
  every file operation against a fake project in the OS temp directory.

`minigame-pack`
- Runs after a mini-game build, on the build output only.
- Merges JSON, relocates a bundle to `subpackages/`, renames the entry script as
  the platform expects, and patches the platform manifest and engine settings.
- Never touches `assets/` source.
