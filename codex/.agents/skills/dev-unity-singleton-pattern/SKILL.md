---
name: dev-unity-singleton-pattern
description: Design, implement, review, refactor, debug, and test Singleton pattern usage in Unity C#. Use for `Instance` properties, one-instance enforcement, global access, persistent managers, `DontDestroyOnLoad`, static service state, duplicate scene instances, disabled Domain Reload, and decisions among Singleton, serialized references, a scene bootstrap, static stateless APIs, ScriptableObject references, GameManager, service locator, or VContainer lifetimes.
---

# Unity Singleton Pattern

Separate two decisions: whether exactly one instance is required and whether global access is required. Do not assume one implies the other.

## Compare Before Selecting

State benefit, drawback, prerequisite, rejection condition, and combinations for Singleton and every realistic alternative. Use any justified combination or none; do not assign primary/supporting ranks.

Compare serialized references, scene bootstrap, VContainer lifetime scopes, a stateless static API, ScriptableObject references, a bounded GameManager, service location, and Singleton.

## Prove the Invariant

1. Explain what breaks if two instances exist.
2. Define lifetime: scene, play session, process, or editor domain.
3. List every consumer and why explicit injection is insufficient.
4. Define initialization, duplicate handling, teardown, and test replacement.

Benefit: convenient access and enforceable singular identity. Drawbacks: hidden dependencies, initialization order, global mutable state, scene coupling, stale statics, test isolation, and teardown complexity.

Reject Singleton when the requirement is merely “easy access,” when scope is scene/feature-local, or when explicit references remain simple.

## Implement Deliberately

- Initialize at a known bootstrap point instead of relying on arbitrary `Awake` order.
- Detect duplicates and fail visibly; do not silently destroy valid authored state without policy.
- Use `DontDestroyOnLoad` only for a real cross-scene lifetime.
- Clear static fields and static events when Domain Reload is disabled.
- Handle Unity destroyed-object null semantics.
- Avoid lazy scene searches such as repeated `FindObjectOfType` in the accessor.
- Avoid a generic `Singleton<T>` base that spreads one lifetime policy to unrelated systems.
- Keep the singleton’s responsibility narrow; global access does not justify a god manager.

A ScriptableObject asset is a shared reference, not automatic one-instance enforcement. A VContainer singleton lifetime is scoped by its container and does not require global static access.

## Verify

- Load scenes additively and create deliberate duplicates.
- Test scene reload, application quit, and teardown order.
- Enter Play Mode repeatedly with Domain Reload on and off.
- Test before initialization, after destruction, and during shutdown.
- Replace the service in an isolated test without editing global production state.
- Scan consumers to ensure dependencies are visible enough to reason about.

Read [references/singleton-guide.md](references/singleton-guide.md) for lifecycle failure modes and sources.
