---
name: dev-unity-game-manager
description: Design, implement, review, and refactor Unity game-flow coordination with VContainer. Use when a task involves GameManager, GameManager.Instance, global manager cleanup, boot/menu/loading/gameplay/results flow, game phases and transitions, pause/restart/quit orchestration, cross-scene persistence, session ownership, additive-scene LifetimeScopes, or replacing a god manager with scoped services and pure C# entry points.
---

# Unity Game Manager

Treat the game manager as a small game-flow coordinator, not as a container for unrelated systems. Let VContainer own construction and lifetime; let focused services own gameplay capabilities.

Read [references/implementation-patterns.md](references/implementation-patterns.md) when selecting a concrete scope/state shape or migrating an existing manager. Read [references/sources.md](references/sources.md) when exact VContainer APIs, installed-version behavior, or source attribution matters.

## Establish the project contract

1. Read the relevant project instructions, GDD, existing bootstrap code, scene-loading flow, and current manager implementations.
2. Confirm whether `jp.hadashikick.vcontainer` is installed and record its resolved version. Use `dev-unity-vcontainer` for exact registration, injection, and package behavior.
3. Do not install VContainer during feature work. If it is absent, preserve the project stack and present a migration decision instead of silently adding DI.
4. Inventory every responsibility currently assigned to `GameManager`, static globals, persistent roots, scene loaders, and state controllers.
5. Classify each responsibility by owner and lifetime: application, session/run, scene, feature, entity, or operation.

## Choose the smallest suitable shape

- Keep a thin `MonoBehaviour` coordinator for a small one-scene prototype with a few stable phases and no meaningful session or cross-scene ownership problem.
- Use a pure C# game-flow coordinator registered as a VContainer entry point when the project has multiple scenes, restartable sessions, asynchronous transitions, testable rules, or existing VContainer composition roots.
- Keep an enum or compact switch for a few trivial, stable phases. Introduce state objects when phases have independent entry, exit, failure, or transition behavior.
- Add a session child scope only when run/match data must survive scene changes but must reset before the next run.
- Do not introduce a new `GameManager` merely because the name is familiar. Prefer an established project name; otherwise use a responsibility-revealing name such as `GameFlowCoordinator`.

## Define the coordinator boundary

Allow the coordinator to own only:

- The current high-level game phase.
- The legal transition table and one transition authority.
- Serialization, cancellation, and observable failure of transitions.
- Starting and ending a session or run.
- Coordinating scene load/unload through an injected scene-loading abstraction.
- Coordinating application-level requests such as restart or return to menu.

Keep these responsibilities outside the coordinator:

- Score, objectives, inventory, progression, economy, save serialization, and analytics.
- Input polling, audio playback, localization, UI rendering, spawning, pooling, and entity behavior.
- Direct scene-object discovery, prefab instantiation details, or addressable handle ownership.
- A generic registry of every service in the project.

Inject narrow services into the coordinator or into the state that needs them. Do not expose the container or a global service locator to gameplay code.

## Model lifetimes with scopes

Use this ownership model only to the depth the project needs:

```text
Application or Project Root LifetimeScope
|-- configuration, save storage, platform services, diagnostics
|-- scene-loading service
`-- Session LifetimeScope
    |-- game-flow coordinator and phase state machine
    |-- run data, score/objectives, pause policy
    `-- Scene LifetimeScope
        |-- scene presenters and scene references
        |-- level rules and spawners
        `-- scene-owned views and adapters
```

- Use `Singleton` only for genuine application-wide ownership shared across the container hierarchy.
- Use `Scoped` for session, scene, game mode, screen, or feature state that must reset with its owner.
- Use `Transient` for cheap stateless collaborators or explicit factory products.
- Dispose the scene scope on scene unload and the session scope when the run ends. Treat disposal as the ownership boundary for cancellation, subscriptions, and disposable resources.
- Do not assume disposing a scope destroys unrelated registered `MonoBehaviour` objects. Align their GameObject ownership with the scope or clean them up explicitly.
- Prevent duplicate persistent roots. Do not combine an unmanaged `DontDestroyOnLoad` GameManager with a VContainer project root that owns the same lifecycle.

## Design phases and transitions

1. Name high-level phases after player-visible flow or lifecycle, for example `Boot`, `MainMenu`, `Loading`, `Playing`, and `Results`.
2. Define valid transitions explicitly. Reject or safely coalesce invalid and duplicate transition requests.
3. Give state objects narrow enter and exit behavior. Add ticking only when continuous work cannot live in an owned gameplay system.
4. Keep construction separate from activation. A scoped state may enter and exit more than once; do not assume its constructor represents phase entry.
5. Keep pause, application focus, connection status, and overlays orthogonal when combining them with every phase would create state explosion.
6. Route UI, input, or gameplay requests into the coordinator, but let the coordinator decide whether and when the transition occurs.

For an asynchronous transition, preserve this order unless the current project requires a documented alternative:

```text
receive request
-> acquire the single transition gate
-> validate the requested transition
-> exit the current phase
-> unload or release the old scene/feature scope
-> create or load the next child scope
-> enter the next phase
-> publish completion or a classified failure
-> release the transition gate
```

- Tie cancellation to the owning scope and propagate it through loading and state entry/exit work.
- Define recovery for loading failure, cancellation, and partial activation. Do not leave the phase field reporting `Playing` when scene activation failed.
- Avoid parallel coroutines, tasks, and event handlers mutating the phase independently.
- Use `dev-unity-async-coroutines-unitask` when the transition implementation materially depends on coroutines, Awaitable, or UniTask.

## Integrate VContainer deliberately

- Keep registrations in the owning `LifetimeScope.Configure(IContainerBuilder)` composition root.
- Register a pure C# coordinator as an entry point only when it participates in VContainer lifecycle interfaces. Do not use an entry point merely to force object resolution.
- Prefer constructor injection and `readonly` dependencies for the coordinator, states, and plain C# services.
- Inject an explicit state registry or factory when state selection is dynamic. Do not call `Resolve` inside every transition.
- Keep scene components registered and injected through component-specific APIs. Do not move Unity object lifecycle into pure C# merely for architectural symmetry.
- For additive scene loading, parent the scene `LifetimeScope` to the intended application or session scope during the load. Verify the installed VContainer API before applying an online snippet.
- Keep one lifecycle authority. Do not let both a `MonoBehaviour.Update` manager and a VContainer `ITickable` coordinator drive the same flow.

## Migrate a god manager safely

1. Characterize current behavior before decomposition, including public/static APIs, serialized fields, scene references, events, initialization order, and persistence.
2. Extract one coherent capability at a time into the lifetime scope that owns it.
3. Establish the flow coordinator and transition contract without simultaneously rewriting every subsystem.
4. Redirect callers through explicit dependencies, commands, or narrow events.
5. Preserve serialized references, asset GUIDs, scene wiring, and save compatibility during incremental migration.
6. Remove `Instance`, static mutable state, duplicate callbacks, and obsolete persistent roots only after all callers and scene entry paths are verified.
7. Avoid creating replacement classes named `AudioManager`, `ScoreManager`, and similar unless each has a clear capability contract and owner.

## Verify the result

1. Build every affected container and resolve missing, duplicate, circular, or lifetime-invalid registrations.
2. Exercise boot, menu, start, loading, playing, results, restart, return-to-menu, and quit paths that exist in the product.
3. Test rapid duplicate requests, cancellation, load failure, session restart, scene unload, and application exit or play-mode stop.
4. Confirm session data resets between runs while application-owned data persists.
5. Confirm scene objects, subscriptions, cancellation sources, addressable handles, and disposables are released by the correct owner.
6. Check for duplicate roots and stale scene references after repeated transitions.
7. Compile the actual Unity project, inspect the Console, and run relevant Edit Mode or Play Mode tests. Use VContainer Diagnostics when resolution paths are unclear.
8. Report the installed VContainer version, scope tree, transition ownership, migration compatibility, and any Editor/player verification not performed.

## Quality rules

- Prefer an explicit transition table over implicit state changes spread across unrelated systems.
- Prefer traceable direct calls for owned one-to-one collaboration and narrow events for genuine one-to-many notifications.
- Do not add interfaces, state classes, child scopes, or factories unless they protect a real variation, lifetime, failure, or test boundary.
- Do not store scene-owned objects in application singletons.
- Do not use `GameObject.Find`, tag searches, or global `Resolve` calls as routine wiring.
- Do not claim that VContainer alone prevents bad ownership; verify the actual scope tree and disposal behavior.

## Related skills

- Use `dev-unity-vcontainer` for registration APIs, injection, entry points, factories, diagnostics, and version-specific behavior.
- Use `dev-unity-gameplay-architecture` for broader module, dependency, State pattern, and folder decisions.
- Use `dev-unity-gameplay-hierarchy-architecture` for bootstrap, persistent, session, and scene hierarchy ownership.
- Use `dev-unity-async-coroutines-unitask` for transition sequencing and cancellation.
- Use `dev-unity-assets-addressables` when scene or content transitions own Addressables handles.
- Use `dev-unity-project-context` before navigating or editing a real Unity project.
