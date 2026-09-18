---
name: dev-cocos-brandi-di
description: Introduce and use Brandi dependency injection in a Cocos Creator 3.8 TypeScript project — tokens, container bindings and scopes, a bootstrap composition root, and how to inject into Components that the engine constructs. Use when wiring services, replacing singletons or globalThis registries, making systems testable outside the editor, or deciding whether a DI container is justified at all.
---

# Brandi DI in Cocos Creator

[Brandi](https://github.com/vovaspace/brandi) is a small, framework-agnostic TypeScript DI container. It fits Cocos better than decorator-based containers for one concrete reason: it needs **no decorators and no `reflect-metadata`**, only `Symbol` and `WeakMap`. Nothing has to change in `tsconfig.json`, and nothing extra ships to a mini-game package.

## Decide before you install

A container earns its place when several systems share dependencies, when construction order matters, or when tests must replace a dependency. It does not earn its place for one manager used in two files — a plain module export is simpler, and `dev-ponytail` applies.

Do not introduce Brandi in the middle of an unrelated task.

## The core API

```ts
import { Container, token } from 'brandi';

class ApiService {}

const TOKENS = {
  apiService: token<ApiService>('apiService'),
};

const container = new Container();

container
  .bind(TOKENS.apiService)
  .toInstance(ApiService)
  .inTransientScope();

const apiService = container.get(TOKENS.apiService);
```

- `token<T>('name')` is a typed key; the string is for diagnostics only.
- `toInstance(Class)` constructs, `toConstant(value)` binds a ready value, `toFactory(...)` defers construction.
- Scopes: `inTransientScope()` (new every time), `inSingletonScope()` (one per container), `inContainerScope()`, `inResolutionScope()`.
- `container.extend(parent)` builds hierarchies — a good fit for "app container" plus "per-battle container".
- `capture()`/`restore()` snapshot bindings for tests; they are development-mode helpers.

## The Cocos-specific constraint

**The engine constructs Components.** A `@ccclass` component is instantiated by the scene loader, never by the container, so constructor injection is not available for components. Resolve dependencies instead:

```ts
// composition root, imported once from bootstrap
export const container = new Container();
container.bind(TOKENS.audio).toInstance(AudioService).inSingletonScope();
container.bind(TOKENS.save).toInstance(SaveService).inSingletonScope();

// component: resolve in onLoad, never in the constructor or at module scope
@ccclass('HudController')
export class HudController extends Component {
    private audio!: AudioService;

    protected onLoad(): void {
        this.audio = container.get(TOKENS.audio);
    }
}
```

Rules that follow:

1. Build the container in **one composition root module**, and import that module from the project's bootstrap so the bundler cannot tree-shake it away (see `dev-cocos-gameplay-architecture`).
2. Resolve in `onLoad`/`start`, never at module top level: module evaluation order is not the scene's lifecycle, and a resolve at import time runs before bindings exist.
3. Keep game logic in plain classes that the container constructs; keep components thin — they adapt the engine lifecycle to those classes. Plain classes are also the part you can unit-test in Node with `vm`, without the editor.
4. Bind engine-owned objects (`Node`, `Component`, `SpriteFrame`) as constants only when they genuinely have app lifetime. A destroyed node held by a singleton is a leak the editor will not warn about.
5. One container per lifetime. Extend a child container for a battle or a screen and drop it at the end instead of clearing singletons.

## Migrating away from a global registry

Replace `globalThis.xxx` registration one system at a time:

1. Introduce the token and binding beside the existing global.
2. Move call sites to `container.get(...)`.
3. Delete the global write and its bootstrap import line together — removing the import without removing the dependency is how a module gets tree-shaken and the game breaks only in the build.

## Boundaries

- Never enable `experimentalDecorators`-based DI or add `reflect-metadata` for this; the point of Brandi here is that neither is needed.
- Never resolve from the container inside `update()`; resolve once in `onLoad`/`start` and hold the reference.
- Never make the container itself a `globalThis` value to avoid an import — that reintroduces the problem it replaces.
- Never bind a Component subclass `toInstance`; the engine owns component construction.
- Never leave a container binding that outlives the node it references.
- Do not add Brandi to a project that has no dependency problem to solve.
