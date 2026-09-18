---
name: dev-unity-observer-pattern
description: Design, implement, review, refactor, debug, and test Unity observer and event systems. Use for C# events and delegates, Action or EventHandler, UnityEvent and generic UnityEvent callbacks, observable or reactive value wrappers, value-change notifications, static events, subscriber lifetime, runtime versus persistent listeners, custom-editor listener tooling, edit-mode versus Play-mode behavior, event channels, or choosing among direct calls, events, bindings, channels, and buses. Compare every materially relevant alternative or skill by benefit, drawback, prerequisites, and rejection conditions; use any justified combination without assigning skill ranks.
---

# Unity Observer and Event Systems

Choose the smallest communication mechanism whose ownership and lifetime remain obvious. Observer-style decoupling helps optional listeners evolve independently, but it adds hidden control flow, retention risk, ordering and exception semantics, and debugging cost.

## Routing and Selection

- Consider this skill for local publisher/subscriber mechanics, C# events, `UnityEvent`, observable values, serialized callbacks, and listener lifecycle.
- Compare direct calls, callbacks, C# events, `UnityEvent`, `INotifyPropertyChanged`, observable values, ScriptableObject channels, and typed buses whenever more than one can satisfy the outcome.
- State each serious candidate's benefit, drawback or added complexity, prerequisites, and rejection condition before selecting it. Use any combination that contributes a distinct implementation or verification concern; use no specialist skill when none earns its cost.
- Prefer a direct method call or delegate parameter when one required receiver owns the operation and the caller must observe success or failure immediately.
- Prefer a C# event for code-only optional subscribers with a clear publisher and bounded lifetime.
- Prefer `UnityEvent<T>` when Inspector-authored callbacks are a real acceptance requirement and its serialized target coupling is acceptable.
- Prefer an observable-value wrapper when storing the value and enforcing its change-notification contract belong together. Reject it when it only hides a field assignment.
- Route feature boundaries, cross-feature ownership, ScriptableObject channels, event buses, or global communication topology through `dev-unity-gameplay-architecture` as well. Keep this skill for the event mechanics when those remain material.
- Compare `dev-unity-ui-controller-binding` for UI snapshot or binding behavior, `dev-unity-stats-modifiers` for actual stat calculation, `dev-unity-vcontainer` for composition and scopes, and `dev-unity-assembly-definitions` for runtime/Editor boundaries. Their presence does not automatically include or exclude this skill.
- Add `dev-unity-performance-profiling` only when event dispatch, allocation, or listener cost is an evidenced performance question. Do not accept unsupported micro-performance claims.

## Workflow

1. Define the outcome and topology.
   - Identify the publisher, every subscriber class, required versus optional receivers, payload, direction, and whether designers must author callbacks.
   - Decide whether the signal is local, feature-wide, scene-wide, or application-wide. Do not infer a global bus from shared keywords.
2. Define lifetime before writing subscriptions.
   - Name who owns the subscription, when it begins, when it ends, and what happens while a component is disabled.
   - Pair `OnEnable` with `OnDisable` only when listening should follow active/enabled state. Use a longer-lived pair such as initialization and destruction when disabled listeners must still react.
   - Ensure publishers cannot retain disposed or destroyed subscribers. Treat static publishers as application-lifetime roots unless explicitly reset.
3. Define dispatch semantics.
   - Specify ordering guarantees, duplicate-subscription policy, mutation during dispatch, reentrancy, exception handling, and thread/main-thread rules.
   - Remember that normal multicast delegate invocation is synchronous; an uncaught handler exception prevents later handlers from running.
4. Keep the publisher boundary narrow.
   - Expose an `event`, not a public delegate field, when outside code must subscribe but must not raise or replace the invocation list.
   - Prefer `Action<T>` or `EventHandler<TEventArgs>` unless a custom delegate name clarifies domain meaning.
   - Keep raise methods private or otherwise controlled by the publisher.
5. Separate runtime and persistent Unity listeners.
   - Give runtime subscription APIs names such as `AddRuntimeListener` and `RemoveRuntimeListener`.
   - Keep persistent mutation in Editor-only code using `UnityEditor.Events.UnityEventTools`; do not switch behavior solely with `#if UNITY_EDITOR`, because that symbol is also defined during Editor Play Mode.
   - Never reflect into `UnityEventBase` private fields. Remove persistent listeners through supported indexed APIs.
6. Specify an observable-value contract when used.
   - Define equality with `EqualityComparer<T>.Default` or an explicit comparer, including Unity object fake-null behavior.
   - Decide distinct-only versus always-notify, old/new payload, validation or clamping, assignment timing, force-notify naming, reentrancy, and callback exception policy.
   - Do not let public setters and public `Invoke` paths bypass those invariants.
7. Respect Unity serialization and Editor state.
   - Serialize fields, not auto-properties. Verify generic wrapper and drawer behavior in the exact Unity version; use concrete serializable wrappers/events when portability matters.
   - Do not depend on a serialized class constructor to rebuild runtime-only listener state after deserialization.
   - Put `UnityEditor` code in an Editor assembly/folder or an equivalent explicit compile boundary.
   - Use `SerializedProperty` where practical; otherwise record Undo and preserve Prefab overrides and dirty state when editor tooling mutates authored data.
8. Verify behavior, not just compilation.
   - Test zero, one, multiple, and duplicate listeners; add/remove symmetry; disabled and destroyed subscribers; exceptions; reentrancy; and mutation during dispatch.
   - For `UnityEvent`, test persistent and runtime listeners separately in Edit Mode, Play Mode, after exiting Play Mode, after scene reload, and in a player build.
   - Test repeated Play sessions with Domain Reload enabled and disabled when static state exists.

## Tutorial Corrections

- The video's generic `Observer<T>` stores and publishes a value, so `ObservableValue<T>`, `ReactiveValue<T>`, or a domain name is clearer than `Observer<T>`.
- `GetPersistentEventCount()` counts persistent listeners only; it is not a total listener count.
- `UnityEventBase.RemoveAllListeners()` removes non-persistent listeners only.
- Reject the video's reflection-based clearing of `m_PersistentCalls`; use `UnityEventTools.RemovePersistentListener(event, index)` from the last index to zero in Editor-only tooling.
- Reject a single `AddListener` whose meaning changes under `#if UNITY_EDITOR`. Editor Play Mode still compiles that branch, so it can attempt persistent authoring while the game is running.
- Treat implicit conversion from an observable wrapper to `T` as optional ergonomics with hidden access and null ambiguity, not a proven optimization.
- Do not call `Dispose()` automatically on a Unity-serialized field or let disposal delete authored persistent listeners. The owner must explicitly release runtime subscriptions it owns.

## Detailed Guidance

Read [references/unity-observer-events-guide.md](references/unity-observer-events-guide.md) before designing or changing an event system. It contains the caption and frame evidence, selection matrix, safe code sketches, Editor tooling, lifecycle and Domain Reload guidance, failure modes, test matrix, related-skill comparisons, and primary documentation.

## Review Checklist

- The chosen mechanism is simpler than the alternatives for this exact outcome.
- Publisher, subscriber, payload, ownership, and lifetime are explicit.
- Required calls are not disguised as optional events.
- Subscription and removal use the same delegate instance and compatible lifecycle boundaries.
- Runtime listeners and persistent listeners have separate APIs and tests.
- No private Unity internals or reflection are used to mutate serialized callbacks.
- Observable values define equality, validation, notification timing, reentrancy, and force-notify behavior.
- Static state resets correctly without Domain Reload and cannot accumulate handlers.
- Editor changes support Undo, dirtying, Prefab overrides, and Play Mode rollback expectations.
- Verification reports what was compiled, tested in Edit Mode/Play Mode/player, or only reviewed statically.
