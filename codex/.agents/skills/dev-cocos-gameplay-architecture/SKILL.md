---
name: dev-cocos-gameplay-architecture
description: Structure a Cocos Creator 3.8 TypeScript game — bootstrap and module side-effect order against tree-shaking, managers and services, scene flow and navigation, event wiring, data tables, localization, and where logic must live to stay testable outside the editor. Use when adding a system, deciding where code belongs, reorganizing folders, or diagnosing "works in preview, broken in the build".
---

# Cocos gameplay architecture

## The bootstrap contract

Cocos 3.x bundles ES modules, so **a module that nobody imports does not exist in the build**. A module whose only effect is registering something on `globalThis` is deleted by the bundler. The editor's preview is more forgiving than the build, which is why this failure is usually discovered late.

- Keep one `bootstrap.ts` that imports every side-effecting module explicitly.
- Order is part of the contract. A module that overrides constants must be imported after the module that defines them; reversing two lines can desynchronize a simulation with no error.
- When a module is added, its bootstrap line is part of the same change — not a follow-up.
- Fail loudly when bootstrap has not run: a single explicit throw in the entry component is far cheaper than a hundred scattered `undefined` errors later.

Prefer explicit exports and imports over global registration. Where a project already has a global registry, migrate it one system at a time (see `dev-cocos-brandi-di`).

## Where logic belongs

| Layer | Contents | Testable without the editor |
|---|---|---|
| Plain TypeScript (`core/`, domain services) | rules, simulation, data access, formulas | yes — Node + `vm`, no `cc` import at module scope |
| Components (`@ccclass`) | adapt the engine lifecycle, read `@property` wiring, call into the layer above | no |
| Scenes and prefabs | structure and wiring only | no |

The practical test: a module that imports `cc` at the top level cannot be loaded outside the engine. Keeping rules free of `cc` imports is what makes the fast, editor-free checks in `dev-cocos-testing-verification` possible.

## Managers, services, and lifetime

- One owner per concern (audio, save, localization, navigation). Two owners for one concern is how a bug becomes unreproducible.
- Prefer an explicit service object over a `static` singleton. If a singleton exists, give it an explicit init called from bootstrap rather than lazy construction on first access from arbitrary code.
- Persistent objects across scenes need a deliberate root node and an explicit destroy path; a node that survives a scene change and is never released is a leak the editor will not report.
- Screen/scene navigation belongs in one place, with the scene name contract written down. `director.loadScene(name)` takes a string — that string is an unchecked contract with the scene's bundle.

## Events and coupling

- Node events (`node.on`) are for UI and engine-driven signals; always pair them with `off` in `onDisable`/`onDestroy`, including when the target is the node itself.
- A typed event bus in plain TypeScript is preferable for cross-system signals, because it is testable and does not depend on the node tree.
- Never route gameplay state through the node hierarchy by name lookups (`getChildByName` chains). Node names double as display strings in some projects, so a translation pass can break a lookup.

## Data and localization

- Author data in tables under a `resources`-style bundle and load it once through one loader. When two data directories exist, exactly one is loaded at runtime — write down which one, because reports generated from the other are quietly wrong.
- Localization tables initialize explicitly; an early lookup before init returns the source-language string without throwing, which is the most expensive kind of silence.
- Randomness: keep deterministic (seeded) generators for anything that must replay or match across clients, and a separate generator for cosmetic effects. Near-identical names for the two is a known source of silent desync — name them so a mix-up is obvious.

## Folder structure

Match what the bundle contract already implies, not an abstract layering:

```text
assets/
  main/        entry scene shipped in the main package
  scene/       scenes bundle
  scripts/     script bundle: core/, ui/, define/, i18n/, platform/, …
  res/         bundled runtime assets
  resources/   assets loaded by path (subpackage candidate)
```

Add a folder only when it has an owner and a rule for what goes in it.

## Boundaries

- Never add a side-effecting module without its bootstrap import in the same change.
- Never reorder bootstrap imports without checking what each module overrides.
- Never put gameplay rules in a component when a plain class would do.
- Never introduce a second owner for an existing concern to avoid touching the first.
- Never assume preview behavior equals build behavior; the bundler is the difference.
