---
name: dev-cocos-typescript-components
description: Write, review, and debug Cocos Creator 3.8 TypeScript components — @ccclass/@property decorators, the component lifecycle, editor-serialized fields, getComponent by string, tsconfig and type-check limits, @ts-nocheck blind spots, and the 2.x-to-3.x API traps. Use when adding or changing any .ts file under assets/ or when a component behaves differently at runtime than the code suggests.
---

# Cocos TypeScript components

## The contract between a file and the engine

```ts
import { _decorator, Component, Node } from 'cc';
const { ccclass, property } = _decorator;

@ccclass('HealthBar')
export class HealthBar extends Component {
    @property(Node)
    fill: Node | null = null;          // wired in the scene/prefab, null until then

    protected onLoad(): void { }       // once, before the first enable
    protected start(): void { }        // once, before the first update
    protected update(deltaTime: number): void { }
}
```

Four rules follow from how the editor serializes this:

1. **One `@ccclass` per file.** Two component classes in one file share a class-id; the second is dropped and its data is read as the first, silently.
2. **The `@ccclass('Name')` string is a runtime key**, used by `getComponent('Name')` and by serialized data. Renaming it compiles cleanly and breaks the game.
3. **`@property` declares serialized data.** The default in code applies only until the editor writes a value; a field that is not wired is `null` at runtime with no compile error.
4. **A property's type argument matters**: `@property(Node)`, `@property(Sprite)`, `@property({ type: [Prefab] })`. A missing or wrong type makes the editor refuse the value or store the wrong thing.

Lifecycle order: `onLoad` → `onEnable` → `start` → `update`/`lateUpdate` → `onDisable` → `onDestroy`. Anything that depends on another component's `onLoad` belongs in `start`.

## Type checking and its blind spots

- `npx tsc --noEmit -p tsconfig.json` is the type gate. The root `tsconfig.json` extends `temp/tsconfig.cocos.json`, which the editor generates — so the check only works after the editor has imported the project once.
- `skipLibCheck` is commonly on because the engine's own `.d.ts` emits dozens of errors that would mask real ones.
- **A file with `@ts-nocheck` is invisible to the gate.** Sweep those files deliberately; real regressions hide there.
- A clean type check says nothing about serialized wiring, bundle names, or the build. See `dev-cocos-testing-verification`.

## Module side effects and tree-shaking

Cocos 3.x bundles ES modules. A module that only writes to `globalThis` and is never imported is **deleted by the bundler**. Preview may still work because the editor loads more; the build will not.

- Every side-effecting module needs an explicit import in the project's bootstrap module, in a documented order — an override that runs before the module it overrides desynchronizes behavior silently.
- Prefer explicit exports and imports over global registration whenever the choice exists. See `dev-cocos-gameplay-architecture`.

## 2.x → 3.x API traps that compile cleanly

| 2.x | 3.8 | Failure if ported mechanically |
|---|---|---|
| `cc.sys.BYTEDANCE_GAME` | `sys.Platform.BYTEDANCE_MINI_GAME` | `undefined === undefined` makes every platform branch take the wrong path |
| `node.opacity` | `UIOpacity` component | fades do nothing, no error |
| `node.zIndex` | explicit draw-order handling | render order shuffles |
| `node.runAction` / `cc.sequence` | `tween()` | missing method at runtime |
| `node.stopAllActions()` | `Tween.stopAllByTarget(node)` | actions keep running |
| `cc.director.getPhysicsManager()` | `PhysicsSystem2D.instance` (`fixedTimeStep`, `enable`) | physics silently unconfigured |
| `renderer.setMaterial(index, mtl)` | `setMaterial(mtl, index)` | arguments reversed; wrong material or none |
| `onBeginContact(contact, self, other)` | `onBeginContact(self, other, contact)` | `contact.getComponent(...)` returns `undefined`, collision logic stops |
| `resources.load(path, SpriteFrame)` | `resources.load(path + '/spriteFrame', SpriteFrame)` | always fails; see `dev-cocos-assets-bundles` |

## Review checklist

- One `@ccclass` per file, and the string matches every `getComponent('...')` call site.
- Every new `@property` is either wired or explicitly documented as optional, with a null check.
- No `@ts-nocheck` added; if one is unavoidable, note which checks it disables.
- Side-effecting modules are imported from bootstrap, in the right order.
- Engine APIs are 3.8 APIs, not 2.x ones that happen to type-check.
- `deltaTime` is used for time-based motion, not a frame count.

## Boundaries

- Never rename an `@ccclass` string as part of an unrelated refactor.
- Never split or merge component classes across files without checking every serialized reference first.
- Never add a second `@ccclass` to an existing file.
- Never "fix" a null `@property` by constructing the object in code when the design expects editor wiring — check the scene/prefab first.
- Never rely on `constructor.name` at runtime; release builds are minified.


## Traps paid for on a real port

- **`window` does not exist in a mini-game runtime.** The common
  `const w = window as any;` is fine in a browser and throws `ReferenceError`
  inside TikTok/ByteDance/WeChat — while the module is evaluating, so the whole
  game fails to start and all you get is
  `Unable to instantiate chunks:///_virtual/<file>.ts`. Use `globalThis` (ES2020,
  present everywhere including browsers). Replace only the bare identifier, not
  `w.window` or the string `'window'`.
- **ES modules hoist imports, so side-effect order from CommonJS is gone.** 2.x
  code often assigns a global *between* two groups of `require()` calls and relies
  on that position. After porting, any module that builds a singleton at
  evaluation time (`export default new X()`) runs before the assignment. Express
  the dependency in the **module graph** instead: put the assignment in its own
  module, import it from everything that touches it, and call a real exported
  function — a bare `import './X'` is both unordered and tree-shakeable.
- **Adding a helper import to code recovered from a minified bundle collides.**
  That code uses `t`, `e`, `n`, `o`, `i` as locals in almost every function, so
  `import { t } from './I18n'` makes `t(...)` resolve to the local. Use a
  namespace import (`import * as I18n from './I18n'`). `tsc` catches it as
  "This expression is not callable" — which is the lucky case; had the local been
  a function it would have run silently wrong.
- **Default values differ between engines and that is as dangerous as an API
  change, but quieter.** 2.x serialises sparsely, so an absent field carries
  meaning. The clearest case: an empty `Label.string` is omitted by 2.x, and the
  3.8 default is the literal `'label'`, which then renders on screen.

Full write-up: `dev-cocos-migrate-2x-to-3x/references/pitfalls.md` §21, §27, §28, §36.
