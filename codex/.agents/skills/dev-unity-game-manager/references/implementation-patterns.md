# Game-flow implementation patterns

Use these patterns as selection guidance, not as mandatory templates. Preserve a suitable existing project convention and verify exact APIs against the installed Unity and VContainer versions.

## Pattern selection

| Pressure | Prefer | Avoid |
|---|---|---|
| One scene and two or three stable phases | Thin `MonoBehaviour` coordinator and compact phase switch | DI/state hierarchy with no ownership benefit |
| Multiple scenes with application-wide services | Application root scope plus scene scopes | One unmanaged persistent manager holding scene objects |
| One run spans several scenes | Application root, session child scope, scene grandchildren | Storing run state in application singletons |
| Phase entry/exit behavior keeps growing | Pure C# coordinator plus state objects | Giant switch with asynchronous side effects in each branch |
| Dynamic game modes or feature lifetimes | Explicit child scope or factory at the ownership boundary | Calling the container from arbitrary gameplay code |
| Pause overlays active gameplay | Separate pause/focus policy where possible | Duplicating every phase into paused and unpaused variants |

## Responsibility map

```text
GameFlowCoordinator
|-- knows current phase
|-- validates and serializes transitions
|-- starts and ends session ownership
|-- asks SceneLoader to change scenes
`-- reports transition completion or failure

SceneLoader
|-- owns Unity scene-loading API calls
|-- reports loading progress and result
`-- coordinates scene LifetimeScope parenting

Session services
|-- own run state, score, objectives, and pause policy
`-- are disposed or reset with the session scope

Scene services and presenters
|-- own scene references and scene-specific behavior
`-- are disposed or destroyed with the scene
```

## Phase contract shape

Prefer a small contract conceptually equivalent to:

```text
Game phase state
  identity: which phase it represents
  enter: activate phase-owned work
  exit: stop or release phase-owned work
  optional tick: only for truly phase-owned continuous work
```

Keep the asynchronous type aligned with the installed Unity version and project stack. Do not mix Coroutine, Unity `Awaitable`, `Task`, and UniTask without a deliberate boundary.

Use explicit transition data when a transition needs runtime context, such as the requested level, game mode, save slot, or result. Do not hide runtime values in container registrations or mutable globals.

## Registration shape

Treat this as an ownership outline rather than copy-paste code:

```text
ProjectRootLifetimeScope
  Singleton: configuration, save storage, platform services, scene loader

SessionLifetimeScope
  Scoped: game-flow state, run state, objectives, pause policy
  Entry point: GameFlowCoordinator

GameplaySceneLifetimeScope
  Scoped/component registrations: level rules, spawners, presenters, scene references
```

If the project has no run spanning multiple scenes, omit `SessionLifetimeScope` and parent the gameplay scene directly to the application root. If nothing truly needs to persist across scenes, omit the project root and keep ownership scene-local.

## Transition failure model

Define at least these outcomes:

- `Completed`: the destination phase and its owned scope are active.
- `Rejected`: the transition is illegal or redundant and no state changed.
- `Cancelled`: the owner ended or a newer authorized operation replaced the request.
- `Failed`: loading or activation failed; the system entered a defined recovery phase or retained the previous valid phase.

Never publish transition completion before the destination phase is ready. Never silently swallow failure while mutating the reported current phase.

## Pause model

Treat pause as orthogonal when it changes time scale, input, audio, and presentation without replacing the loaded gameplay session. Give one pause policy authority to coordinate those services. Model pause as a full phase only when it truly owns a distinct lifecycle and transition graph.

## Incremental migration order

1. Draw the existing responsibility and lifetime map.
2. Stabilize one bootstrap path and prevent duplicate persistent roots.
3. Extract scene loading behind an explicit abstraction.
4. Introduce the flow coordinator around existing behavior.
5. Move run-owned state into a session scope when required.
6. Extract complex phases into state objects one at a time.
7. Redirect static callers and remove the global `Instance` last.

This order preserves behavior while ownership becomes explicit and keeps serialized Unity data intact during the migration.
