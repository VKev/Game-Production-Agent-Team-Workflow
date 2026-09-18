---
name: dev-unity-vcontainer
description: Design, implement, review, and debug Unity 6000.3.21f1 dependency injection with the exact pinned VContainer package. Use for LifetimeScope composition, registrations, constructor or method injection, entry points, nested scopes, factories, disposal, UniTask integration, source generation, diagnostics, or replacing service locators/global singletons.
---

# VContainer Development

Read [references/sources.md](references/sources.md) when an exact API, installed-version behavior, integration, or upgrade detail matters.

## Establish the installed contract

1. Confirm `jp.hadashikick.vcontainer` is installed and record its resolved version and source from Unity Package Manager.
2. Prefer the installed package source for exact signatures. Use online documentation only when it matches that version or the distinction is stated.
3. Do not install or upgrade VContainer during feature work. Route setup to `setup-agents` and `setup-unity-packages`.

## Design the composition root

- Keep registrations in a small `LifetimeScope.Configure(IContainerBuilder)` composition root. Do not spread registrations through gameplay classes.
- Prefer constructor injection and `readonly` dependencies for plain C# types. Use method injection for `MonoBehaviour`; Unity does not support injected constructors on components.
- Register abstractions against concrete implementations explicitly. Keep domain and gameplay classes free of `IObjectResolver` unless the class is a deliberate factory or composition boundary.
- Use `RegisterEntryPoint<T>()` only for plain C# lifecycle participants such as `IStartable`, `ITickable`, `IAsyncStartable`, or `IDisposable`. Do not add an entry point merely to force resolution.
- Register existing scene or prefab components with the component-specific registration APIs. Make scene ownership and destruction behavior explicit.

## Choose lifetimes deliberately

- `Singleton`: one instance shared across the container hierarchy. Reserve it for genuinely application-wide ownership.
- `Scoped`: one instance per `LifetimeScope`. Prefer it for scene, game-mode, session, screen, or feature lifetime.
- `Transient`: a new instance per resolution. Use for cheap stateless objects or factories, not hidden per-frame allocation.
- Model scene and feature boundaries with parent/child scopes. A child may resolve parent registrations; disposing a scope disposes its registered disposable objects.
- Do not assume destroying a scope destroys unrelated registered `MonoBehaviour` objects. Parent owned objects correctly or provide explicit disposal.

## Avoid common failure modes

- Do not turn the container into a service locator through global `Resolve` calls.
- Do not inject optional constructor dependencies; VContainer treats missing constructor dependencies as errors.
- When a class has multiple constructors, mark exactly one with `[Inject]`. Consider `[Inject]` or `link.xml` for IL2CPP stripping-sensitive constructors and injection methods.
- Define one owner for initialization, ticking, cancellation, and disposal. Avoid both Unity callbacks and VContainer entry-point callbacks driving the same lifecycle.
- For UniTask entry points, propagate the supplied cancellation token and verify scope disposal cancels or completes outstanding work safely.
- Keep factories explicit when instances need runtime parameters; do not hide runtime data in container registrations.

## Verify

1. Build the container and fix missing, duplicate, circular, or lifetime-invalid registrations at the composition root.
2. Inspect the VContainer Diagnostics window when resolution paths are unclear.
3. Verify scene transitions and child-scope disposal, including play-mode exit with domain reload settings used by the project.
4. Compile the actual Unity project and test the relevant lifecycle. For IL2CPP targets, verify the player build or stripping configuration when injection relies on reflection.
5. Report the installed VContainer version, affected scopes, registrations, lifecycle evidence, and any Editor/player verification not performed.
