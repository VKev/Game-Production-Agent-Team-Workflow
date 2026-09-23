---
name: dev-cocos-assets-bundles
description: Load, organize, and debug Cocos Creator 3.8 assets — the folder-to-bundle contract and loadBundle order, resources.load and the SpriteFrame sub-asset path, uuid/.meta identity, asset refresh timing, library re-import behavior, and release of loaded assets. Use when adding or moving assets, changing a bundle, loading anything at runtime, or diagnosing a frozen boot with no error.
---

# Cocos assets, bundles, and loading

## The bundle contract

A folder under `assets/` becomes an asset bundle when its sibling `.meta` sets `userData.isBundle`, and the bundle's **name** comes from `userData.bundleName` — which is not required to match the folder name. Code loads by bundle name:

```ts
assetManager.loadBundle('script', (err, bundle) => { /* ... */ });
```

Three consequences worth internalizing:

1. Renaming a folder, or editing `bundleName`, changes a runtime contract. `loadBundle` with an unknown name **never calls its callback** — the boot chain stops, the screen holds, and nothing is logged.
2. Bundle load order is part of the boot design; a bundle that loads assets from another bundle depends on that one being loaded first.
3. The project map's root section lists the verified folder → bundle mapping. Read it before touching any folder under `assets/`.

Mini-game platforms add hard limits: the main package must stay under 4 MB on Douyin/WeChat, with subpackages up to 20 MB. Which bundle is a subpackage is build configuration, not code — see `dev-cocos-build-minigame`.

## Loading at runtime

```ts
// WRONG on 3.x — always fails
resources.load('ui/icon', SpriteFrame, cb);
// RIGHT — a SpriteFrame is a sub-asset of the image
resources.load('ui/icon/spriteFrame', SpriteFrame, cb);
```

- `resources.load` only sees assets under a `resources` bundle folder; everything else loads through its own bundle.
- Sub-assets use the `@sub` uuid form in serialized data (`<uuid>@f9941` is the `spriteFrame` of an image). Sub-uuids are derived from the sub-asset name and are reconstructed deterministically on re-import.
- Prefer a directly wired `@property` over a runtime path load when the asset is known at author time: a path is a string the compiler cannot check, a property is verified wiring.
- Release what you load (`assetManager.releaseAsset`, bundle release) when a screen closes; mini-game memory budgets are small and leaked atlases are the usual cause of a crash on low-end devices.

## Identity, `.meta`, and refresh timing

- Every asset has a sibling `.meta` holding its `uuid`. That uuid is the only thing scenes, prefabs, and animations reference.
- After creating or editing a `.ts` file, **refresh assets and wait** before running any tool that resolves uuids; until the import finishes, the `.meta` has no uuid to resolve.
- After deleting `library/`, every `.meta` temporarily shows `"importer": "*"` and images show empty `subMetas`. This looks catastrophic and is normal. Diagnose with file counts over time rather than reacting:
  - count files in `library/` twice ~10 s apart — still growing means the import is running;
  - count metas still marked `"importer": "*"`;
  - while the import runs, do not delete `.meta` files, do not hand-edit an importer field, and do not build or run gates.
- Parent uuids survive a re-import, so sub-uuid references resolve again once it completes.

## Organizing assets

- Keep authored assets under the bundle that owns them; moving a file between bundles changes how it must be loaded.
- Images intended for atlases must be untrimmed when the code expects original offsets; pre-cropping shifts every anchor that depends on the original size.
- Keep the `resources` bundle small and deliberate: everything in it ships resolvable by path, which is what makes it the usual subpackage candidate.
- `build-templates/` is authored source injected into builds. It is not `build/`, and it must stay in version control.

## Boundaries

- Never ignore, delete, or hand-edit a `.meta` file.
- Never rename an asset folder without checking `bundleName` and every `loadBundle` call site.
- Never delete `library/` or `temp/` casually; it forces a multi-minute re-import and blocks every gate meanwhile.
- Never conclude "the asset is missing" from a path search; check the uuid through the project map or an MCP asset query.
- Never size a mini-game package with `du -sh`: block rounding inflates the number against a hard 4 MB ceiling.
- Never load by path when the asset can be wired as a property, unless the set is genuinely dynamic.


## Traps paid for on a real port

- **A static import from `main` into another bundle is fatal at boot.** Any
  `assets/<folder>` with `isBundle: true` is its own bundle; everything else is
  `main`. `main` holds the start scene and loads first, so SystemJS cannot resolve
  the other bundle's `chunks:///` specifier — it falls back to
  `<script src="chunks:///...">`, the browser refuses the scheme, and the game
  boots to an empty scene with only a CORS error to show for it. **Preview is
  fine**; only the build breaks. The reverse direction (game/framework → main) is
  safe. Guard it with a checker that reports every cross-bundle edge and marks the
  fatal ones; `fatal: 0` before every build.
- **Import type decides whether a Sprite can reference anything.** A PNG imported
  as `texture` has **no `spriteFrame` sub-asset**, so every Sprite in a prefab
  ends up empty. Compare against the 2.x census and fix the `.meta` `type` via
  `asset-db save-asset-meta`. Atlas pages for spine legitimately stay `texture`.
- **Re-importing loses 9-slice and trim settings.** `capInsets`
  (`borderTop/Bottom/Left/Right`) live on the **sprite-frame**, not on the Sprite
  component; a 3.8 re-import resets them to 0, and a `SLICED` sprite with zero
  insets renders exactly like a stretched image. `trimType` also flips from the
  2.x `custom` (no trim) to `auto` (trim transparent edges), changing
  rect/size/offset. Restore from the 2.x `.meta`: `trimType`, `trimThreshold`,
  `trimX/Y`, `width/height`, `rawWidth/rawHeight`, `offsetX/Y`, `rotated`,
  `border*`. This was the root cause of every "the UI is stretched" report on one
  port, and no prefab-level checker can see it.
- **3.8 eagerly evaluates every `.js` under `assets/`.** 2.x loaded modules
  lazily, so an unused vendor UMD bundle never ran. In 3.8 it runs, and a
  browserify-style `require` reached through an alias (`var i = require;
  i("buffer")`) becomes `Unresolved specifier buffer`, which takes down the whole
  script executor. Check who actually uses it before fixing the specifier — the
  answer is often nobody, and moving it out of `assets/` is the fix.

Full write-up: `dev-cocos-migrate-2x-to-3x/references/pitfalls.md` §18, §19, §29, §30.
