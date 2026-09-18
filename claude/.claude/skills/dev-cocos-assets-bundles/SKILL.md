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
