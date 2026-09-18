# Scene Architecture and Lifetimes

## Contents

- [Choose a scene strategy](#choose-a-scene-strategy)
- [Model lifetimes explicitly](#model-lifetimes-explicitly)
- [Define additive scene groups](#define-additive-scene-groups)
- [Choose a bootstrap path](#choose-a-bootstrap-path)
- [Own cross-scene communication](#own-cross-scene-communication)
- [Add streaming only for a measured need](#add-streaming-only-for-a-measured-need)

## Choose a scene strategy

Use the least complex strategy that satisfies the product.

| Strategy | Prefer when | Main costs and risks |
|---|---|---|
| Single authored scene | Small fixed product, simple lifetime, no independent content loading | Scene growth, slower collaboration, fewer unload boundaries |
| Single-scene replacement | Whole screens or levels replace each other | Persistent services need a separate lifetime; transition rollback is limited |
| Bootstrap plus content scene | Services persist while one content scene changes | Duplicate bootstrap paths and stale content references |
| Bootstrap plus additive group | Gameplay, UI, environment, cinematics, or tools need independent authoring/lifetimes | Readiness, active-scene, lighting, input, and ownership complexity |
| Session scene plus additive content | A run or match spans several levels but must reset without restarting the app | An additional scope and cleanup boundary |
| Streamed cells/chunks | Open worlds or memory limits require spatial residency control | Neighbor dependencies, seams, churn, save identity, navigation, lighting |
| Addressable scenes | Optional/remote content, independent builds, soft references, content updates | Handle ownership, catalogs, bundles, offline behavior, release discipline |

Do not adopt additive scenes merely to make the Hierarchy look organized. Use them when independent authoring, lifetime, memory, delivery, or reuse provides a concrete payoff.

## Model lifetimes explicitly

Use only the roots the project needs:

```text
Application
|-- platform services, save storage, diagnostics, loading service
`-- Session or Run
    |-- game-flow state, run data, shared match services
    `-- Scene Group
        |-- active gameplay scene
        |-- UI or HUD scene
        |-- environment/lighting scene
        |-- cinematic scene
        `-- scene contexts and transient operations
```

Enforce these invariants:

- Let the application lifetime survive every content transition.
- Let session state survive only the levels belonging to that session.
- Let scene-owned objects, registrations, subscriptions, cancellation sources, and provider handles die with their scene or group.
- Keep operation state, such as an in-flight transition, shorter-lived than the target group.
- Do not persist scene-owned cameras, actors, presenters, or environment objects under an application root.
- Prevent a long-lived service from caching an unloaded Unity object.

Use `DontDestroyOnLoad` only on deliberate root GameObjects. Unity also preserves their Transform children, so verify the entire subtree before marking a root persistent.

## Define additive scene groups

Treat a scene group as authoring data, not as the transition engine itself. Include only fields the project needs:

```text
SceneGroup
|-- stable group id
|-- display/debug name
|-- scene entries
|   |-- stable path, reference, or provider key
|   |-- role
|   |-- required/optional policy
|   `-- activation or initialization metadata
|-- one active-scene entry when required
`-- optional transition/presentation policy
```

Useful roles include gameplay, UI/HUD, environment, lighting, cinematic, tooling, and navigation. Roles communicate ownership; they do not replace stable scene identity.

Validate at edit time when possible and at runtime before a transition:

- Every required reference resolves.
- Native scenes are enabled in the active player scene list.
- Addressable scenes resolve in the active profile/catalog.
- Exactly one scene owns each exclusive responsibility.
- Active-scene declarations are valid.
- Duplicate paths or keys are rejected unless multi-instance loading is intentional.
- Required scene-context services can be discovered without global searches.

Use inline serialized groups for a small loader used in one bootstrap scene. Use ScriptableObject group assets when groups are reused, need custom validation, are selected by data, or benefit from independent designer authoring. Do not convert transient runtime state into a ScriptableObject merely because group configuration is asset-based.

## Choose a bootstrap path

Choose one creation authority:

- Put a bootstrap scene first in the build scene list and start the player there.
- Configure an Editor play-mode start scene for development while preserving player boot behavior.
- Use a runtime initialization hook only when direct entry into arbitrary scenes is a supported workflow and its ordering/error behavior is explicitly handled.
- Use a DI framework's project/application root only when that framework is already installed and owns the same lifecycle.

Do not combine several uncoordinated bootstrap mechanisms. A build-index bootstrap, runtime hook, persistent singleton, and project DI root can each create the same services unless one explicit authority suppresses duplicates.

Keep the loading overlay in the persistent boundary when content scenes can unload beneath it. Decide whether its camera, EventSystem, and input blocking are application-owned or transition-owned.

## Own cross-scene communication

Prefer this order:

1. Direct serialized references inside one authored scene or prefab.
2. Explicit initialization or injection from the composition root.
3. A scene context that exposes a narrow registration contract.
4. Narrow events for genuine one-to-many notifications.
5. Asset-based event channels or runtime sets when the project intentionally uses them.
6. A restricted service locator only at a composition boundary when existing architecture requires it.

Do not use scene-name searches, `Find` calls, a global event bus, or a universal locator as routine wiring.

Define a readiness contract distinct from Unity's scene-loaded event. A scene can be loaded and its `OnEnable` callbacks can have run while group-level dependencies, save binding, navigation, spawned actors, or Addressable dependencies remain unready.

## Add streaming only for a measured need

For streamed worlds, add explicit policies for:

- Cell identity and neighbor graph.
- Residency radius and hysteresis.
- Maximum concurrent loads and unloads.
- Player teleport and fast-travel recovery.
- Shared lighting, probes, navigation, physics, and audio zones.
- Stable save IDs independent of scene instance lifetime.
- Cross-cell actors and ownership transfer.
- Peak-memory budget and churn profiling.

Do not infer that starting several async operations guarantees parallel I/O or faster completion. Profile representative device builds and tune the request budget from evidence.
