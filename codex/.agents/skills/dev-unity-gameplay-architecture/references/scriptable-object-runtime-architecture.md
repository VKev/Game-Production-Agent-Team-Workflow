# ScriptableObject Runtime Architecture

Use ScriptableObjects as intentional assets. Do not assume that replacing a scene reference or singleton with an asset automatically removes coupling.

## Contents

- [Classify the asset role](#classify-the-asset-role)
- [Choose the communication mechanism](#choose-the-communication-mechanism)
- [Design mutable variables explicitly](#design-mutable-variables-explicitly)
- [Reset reliably](#reset-reliably)
- [Make event channels lifetime-safe](#make-event-channels-lifetime-safe)
- [Maintain runtime sets](#maintain-runtime-sets)
- [Keep editor tooling safe](#keep-editor-tooling-safe)
- [Treat third-party SOAP tooling as optional](#treat-third-party-soap-tooling-as-optional)
- [Verification](#verification)
- [Sources and example provenance](#sources-and-example-provenance)

## Classify the asset role

| Role | Runtime mutation | Typical ownership |
|---|---:|---|
| Definition or catalog | No | Project-authored asset |
| Strategy or effect definition | Usually no | Project-authored asset plus runtime executor |
| ScriptableVariable | Yes, intentionally shared | Session or application owner |
| Event channel | Listener list only | Publisher contract plus listener lifetimes |
| Runtime set | Yes, intentionally shared | Scene, feature, or session registry |
| Per-entity state | Not on the shared source asset | Entity-owned runtime object or clone |
| Save data | Never use the asset as the deployed save file | Save-system DTO/storage |

Separate authored defaults, mutable session state, and persistent save state even when they share the same value shape.

## Choose the communication mechanism

| Need | Prefer |
|---|---|
| Owned local one-to-one collaboration | Direct reference or narrow interface |
| Code-owned one-to-many notification | C# event |
| Designer-wired callback on a component | UnityEvent |
| Scene-independent asset identity and Inspector wiring | ScriptableObject event channel |
| Long-lived service with explicit lifetime and construction | Composition root or installed DI framework |

Do not route a local call through an asset channel merely to hide a visible dependency. An asset reference is still a dependency and can behave like global state.

## Design mutable variables explicitly

- Keep an authored initial value separate from the runtime value.
- Define who may write and who may only observe.
- Avoid exposing unrestricted setters when one system owns the mutation rule.
- Define equality behavior before raising change events; use deliberate float tolerance when appropriate.
- Decide whether setting the same value is ignored, refreshed, or still announced.
- Provide a read/snapshot path for late subscribers; an event alone does not contain current state.
- Clone or create a runtime instance when each player, entity, test, or session needs independent state.
- Never treat a ScriptableObject asset as the player's deployed save file.

## Reset reliably

Do not rely only on `OnEnable`, scene reload, or a static registry being naturally cleared.

- Define the reset boundary: application start, session start, scene load, test setup, manual reset, or never.
- Support Enter Play Mode with Domain Reload disabled when the project uses it.
- Reset runtime statics and handlers through `RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)` or the project's equivalent bootstrap contract.
- Clear stale listeners and runtime-set entries as part of the same lifecycle policy.
- Do not fire gameplay change notifications during bootstrap unless subscribers and ordering are ready.
- Verify repeated Play Mode entry both with and without Domain Reload when editor correctness matters.

## Make event channels lifetime-safe

- Name channels as facts that happened, not commands to unknown recipients.
- Define which systems may raise each event.
- Pair registration and deregistration symmetrically.
- Prevent duplicate registration or define duplicate semantics explicitly.
- Remove destroyed or stale Unity listeners safely.
- Define behavior when a listener adds, removes, destroys, or triggers another listener during dispatch.
- Iterating backwards protects some self-removal cases, but it does not solve every mutation or reentrancy case. Use a snapshot, deferred mutations, or an explicit dispatch policy when required.
- Define listener ordering only when it is a real contract; otherwise treat order as unspecified.
- Decide whether one listener exception stops dispatch, is collected, or is isolated and reported.
- Avoid anonymous callbacks that cannot be unregistered.
- Keep request/response and ordered transactions as direct calls or explicit workflows rather than broadcasts.

For UI or other late listeners, initialize from current state before relying on future events.

## Maintain runtime sets

- Make add and remove idempotent unless duplicates are intentional.
- Remove entries on the owner's disable or destruction path.
- Handle scene unload, pooled-object release, and Unity's destroyed-object null behavior.
- Expose read-only enumeration to consumers.
- Avoid retaining scene objects in a project asset beyond their intended lifetime.
- Verify the set after repeated enable/disable, pooling, scene reload, and Domain Reload-disabled Play Mode sessions.

## Keep editor tooling safe

- Treat property drawers and custom inspectors as views over serialized references and runtime debug state.
- Unregister UI Toolkit callbacks when an element is rebound or detached.
- Do not let a debug label make hidden runtime mutation appear serialized or persistent.
- Avoid marking source assets dirty from Play Mode debug updates unless the tool explicitly edits authored data.
- Display ownership and reset mode where designers can see them.

## Treat third-party SOAP tooling as optional

Inspect the installed package and version before using vendor APIs. Do not install SOAP or reproduce its runtime injector automatically.

Runtime injectors based on string identifiers, attributes, or reflection trade explicit references for tooling convenience. Compare them with constructors, factories, serialized references, or installed VContainer composition. Require unique identifiers, validation, deterministic initialization, stripping compatibility, useful errors, and tests before accepting that tradeoff.

## Verification

Test authored defaults, runtime mutation, same-value assignment, late subscribers, duplicate listeners, listener mutation during dispatch, exceptions, scene unload, pooled owners, repeated Play Mode entry, Domain Reload-disabled entry, independent clones, and save/load separation. Verify Inspector visibility separately from runtime correctness.

## Sources and example provenance

- Unity ScriptableObject architecture: https://unity.com/how-to/architect-game-code-scriptable-objects
- Unity event-channel guidance: https://unity.com/how-to/scriptableobjects-event-channels-game-code
- Unity 2022.3 ScriptableObject API: https://docs.unity3d.com/2022.3/Documentation/ScriptReference/ScriptableObject.html
- Unity Domain Reload guidance: https://docs.unity3d.com/2022.3/Documentation/Manual/DomainReloading.html
- Unity 2022.3 runtime initialization API: https://docs.unity3d.com/2022.3/Documentation/ScriptReference/RuntimeInitializeOnLoadMethodAttribute.html
- Analyzed ScriptableObject architecture tutorial: https://www.youtube.com/watch?v=bO8WOHCxPq8

Treat the tutorial and third-party SOAP asset as examples, not mandatory project architecture.
