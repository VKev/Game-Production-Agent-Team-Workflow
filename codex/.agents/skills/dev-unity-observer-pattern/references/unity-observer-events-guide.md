# Unity Observer and Event Systems Guide

## Contents

1. Evidence and scope
2. Terminology
3. Tutorial reconstruction
4. Production corrections
5. Mechanism comparison
6. C# event semantics
7. Unity lifecycle and static state
8. Observable-value contract
9. UnityEvent runtime and persistent listeners
10. Safe Editor tooling
11. Serialization and implicit conversion
12. Related skills and overlap
13. Failure modes
14. Verification matrix
15. Primary sources

## 1. Evidence and Scope

The source tutorial is [How to do MORE with the Observer Pattern](https://www.youtube.com/watch?v=Qa8QUru6hc0). Analysis used the video's available automatic English captions and targeted frames; no speech-to-text fallback was used.

Evidence highlights:

- `00:58`: the frame shows `public delegate void Notify(int points);` and `public static event Notify OnAnyCollected;`.
- `02:31`: the final ScoreManager frame shows subscription in `OnEnable` and removal in `OnDisable`.
- `04:07`: the frame shows a serializable generic `Observer<T>` with a serialized value, `UnityEvent<T>`, a `Value` property, and an equality-suppressing setter.
- `07:07` and `07:32`: the frames show `UnityEventTools` branches for persistent add/remove and runtime `UnityEvent` branches for player code.
- `07:48`: the frame shows the tutorial reflecting into private `UnityEventBase.m_PersistentCalls` to call `Clear`; this guide explicitly rejects that technique.
- `09:21`: the frame shows custom Inspector buttons mutating the hero's health wrapper.
- `11:29`: the frame shows an implicit conversion from the wrapper to its value type.

Captions establish the broader flow: a collectible raises a point event; a score display subscribes; a generic value wrapper suppresses equal assignments and invokes a serialized `UnityEvent<T>`; custom Editor tooling adds persistent callbacks; and persistent authoring during Play Mode rolls back when Play Mode exits.

The tutorial is useful as an exploration of observer mechanics. Its private reflection, compile-symbol routing, listener counts, naming, and serialized/runtime lifetime boundaries need correction for production code.

## 2. Terminology

- **Publisher / subject / observable:** owns the signal and decides when to raise it.
- **Subscriber / observer:** registers a callback and reacts.
- **C# event:** language boundary that permits external add/remove while reserving raise/assignment for the declaring type.
- **Runtime UnityEvent listener:** added through `UnityEvent.AddListener`; it is not serialized as authored scene data.
- **Persistent UnityEvent listener:** serialized with the host object and usually authored in the Inspector or with Editor APIs.
- **Observable value:** owns both a value and the contract for notifying when that value changes.
- **Event channel:** usually a designer-referenceable asset used to connect publishers and subscribers.
- **Event bus:** a routing abstraction for multiple message types or publishers, often with application-wide reach.

The video's `Observer<T>` is an observable value, not an observer. Prefer `ObservableValue<T>`, `ReactiveValue<T>`, or a domain name such as `HealthValue`.

## 3. Tutorial Reconstruction

### Basic code-only event

The collectible declares a custom delegate and a static event, then raises the event with awarded points. ScoreManager initializes its text in `Awake`, subscribes while enabled, removes the same handler while disabled, accumulates points, and refreshes text.

The final lifecycle pair is visible at `02:31`. An earlier `02:18` frame is intermediate code with an unfinished `OnEnable`; do not treat it as the final implementation.

### Generic value wrapper

The tutorial creates a serializable `Observer<T>` with:

- a serialized current value;
- a serialized `UnityEvent<T>`;
- a `Value` property that delegates to `Set`;
- equality suppression before assignment and invocation;
- add, remove, remove-all, invoke, and dispose methods;
- an optional callback constructor;
- an implicit conversion to `T`.

A hero exposes an integer health wrapper initialized to 100. A health display is connected through the Inspector. Editor buttons alter the value and add/remove a persistent debug callback.

### Persistent callback tooling

The tutorial uses `UnityEventTools.AddPersistentListener` and `RemovePersistentListener` inside `#if UNITY_EDITOR`, then uses reflection to clear the private persistent-call collection. It notes two genuine authoring constraints: persistent targets are serializable `UnityEngine.Object` references, and persistent changes made only during Play Mode are rolled back on exit.

## 4. Production Corrections

### Do not make one API mean two different things

This branch is ambiguous:

```csharp
#if UNITY_EDITOR
UnityEventTools.AddPersistentListener(changed, callback);
#else
changed.AddListener(callback);
#endif
```

`UNITY_EDITOR` is also defined while the Editor is in Play Mode. The same gameplay call therefore means “persistent authoring” in the Editor and “runtime subscription” in a player. Persistent changes made during Play Mode can roll back when Play Mode exits.

Expose separate intent:

```csharp
public void AddRuntimeListener(UnityAction<int> listener) => changed.AddListener(listener);
public void RemoveRuntimeListener(UnityAction<int> listener) => changed.RemoveListener(listener);
```

Keep persistent authoring in Editor-only tooling, named `AddPersistentListener`, `RemovePersistentListener`, or `ClearPersistentListeners`.

### Do not reflect into Unity internals

The tutorial reaches into `m_PersistentCalls` and invokes a private `Clear` method. Private names and internal representations are not a compatibility contract, can change between Unity versions, and bypass normal Editor state handling.

Use the supported indexed API:

```csharp
for (var index = unityEvent.GetPersistentEventCount() - 1; index >= 0; index--)
{
    UnityEventTools.RemovePersistentListener(unityEvent, index);
}
```

Loop backward because every removal shifts later indices.

### Count the right listener kind

`GetPersistentEventCount()` counts only persistent listeners. It does not expose the total number of runtime and persistent callbacks. Do not use it to log or assert a total listener count.

### Do not erase authored listeners during runtime cleanup

`UnityEventBase.RemoveAllListeners()` removes non-persistent listeners only. That is appropriate for clearing runtime subscriptions owned by the wrapper. Persistent callbacks are authored data and should only be edited through explicit Editor tooling.

### Do not assume Unity calls Dispose

A normal serializable field is not a component lifecycle object. Unity does not automatically call an arbitrary `Dispose()` method on it. The owner must explicitly release runtime resources it owns. Disposing the wrapper should not destroy persistent authoring data.

## 5. Mechanism Comparison

| Mechanism | Benefit | Main drawback | Prerequisite | Reject when |
|---|---|---|---|---|
| Direct method call | Obvious control flow, return value, and failure | Tight compile-time coupling | One known required receiver | Receivers are optional or independently owned |
| Delegate parameter | Required callback can be supplied or tested | Caller still owns invocation contract | A single operation boundary | Long-lived subscriber discovery is required |
| C# `event Action<T>` | Small, type-safe, code-only multicast API | Hidden control flow and retention risk | Clear publisher and bounded subscriber lifetime | Designers must author callbacks or one receiver is required |
| `EventHandler<TEventArgs>` | Familiar .NET sender/event-data convention | More ceremony and allocation if event args are created repeatedly | .NET-style APIs or tooling | A small Unity-local payload is clearer as `Action<T>` |
| `UnityEvent<T>` | Inspector-authored persistent callbacks | Serialized target coupling, reflection-like method selection, two listener lifetimes | Designer workflow and supported serializable payload | Code-only subscribers or callback integrity must be compile-time obvious |
| Observable value | Centralizes equality, validation, storage, and notifications | Wrapper state and API complexity | Value and notification contract truly belong together | It merely hides a field assignment or domain behavior owns the mutation |
| `INotifyPropertyChanged` | Standard property-change binding contract | String/property-name semantics and broad notifications | Binding infrastructure expects it | A typed domain event or snapshot is clearer |
| ScriptableObject event channel | Designer-visible shared channel across scene references | Asset lifecycle, global reach, and traceability cost | Shared designer-authored topology | Local publisher reference is already available |
| Typed event bus | Decouples many producers/consumers across boundaries | Global hidden dependencies, ordering/lifetime/debugging complexity | Architecture explicitly owns routing and reset policy | A local event, reference, or channel suffices |
| Reactive stream library | Composition, filtering, lifetime operators | Dependency, abstraction, allocation, and debugging cost | Project already uses it and composition is material | Only one simple value or event is needed |

There is no universal ranking. Select every mechanism or related skill that owns a distinct concern, and no more.

## 6. C# Event Semantics

### Publisher control

Use an event when subscribers may register and unregister but must not invoke or replace the callback list:

```csharp
public sealed class Collectible : MonoBehaviour
{
    public static event Action<int> AnyCollected;

    private void Collect(int points)
    {
        AnyCollected?.Invoke(points);
        gameObject.SetActive(false);
    }
}
```

A public delegate field would let outside code replace or invoke the entire list. Keep the raise point inside the publisher.

### Required versus optional behavior

Microsoft's guidance distinguishes required callback contracts from optional event subscribers. If the operation cannot succeed without the receiver and its return or failure matters, use a direct call or delegate parameter. Events model optional notification.

### Ordering and exceptions

Normal multicast delegate invocation is synchronous and follows the invocation list order. If one handler throws and the publisher does not catch it, later handlers are not invoked. Decide whether that fail-fast behavior is correct. Catching per listener requires intentionally enumerating the invocation list and changes semantics; do not do it silently.

### Duplicate subscriptions

Adding the same handler twice creates duplicate invocation entries. For normal C# events, one `-=` removes one matching occurrence. Prevent duplicates where duplication is a bug, or test and document that duplicates are allowed.

### Retention

The publisher holds references through its delegate invocation list. A longer-lived publisher can keep a shorter-lived subscriber reachable. Unsubscribe before the subscriber should be collectible or destroyed.

Anonymous lambdas are hard to remove unless the exact delegate instance is stored:

```csharp
private Action<int> scoreHandler;

private void OnEnable()
{
    scoreHandler = points => AddScore(points);
    Collectible.AnyCollected += scoreHandler;
}

private void OnDisable()
{
    Collectible.AnyCollected -= scoreHandler;
    scoreHandler = null;
}
```

Prefer a named method when no closure is needed.

## 7. Unity Lifecycle and Static State

### Choose a semantic pair

Use `OnEnable`/`OnDisable` when the object should listen only while enabled and active:

```csharp
private void OnEnable() => Collectible.AnyCollected += AddScore;
private void OnDisable() => Collectible.AnyCollected -= AddScore;
```

Use a longer-lived initialization/destruction pair when a disabled object must continue receiving events. The correct pair follows desired behavior, not a universal recipe.

### Static publishers

Static events can behave like application-lifetime roots. They are easy to reach but hide ownership, complicate tests, and can retain stale subscribers. Prefer an instance publisher when an owner already exists.

When Domain Reload is disabled, Unity does not automatically reset static fields or unregister static event handlers between Play sessions. Reset application-owned static events at subsystem registration:

```csharp
public static class GameplaySignals
{
    public static event Action<int> ScoreChanged;

    [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
    private static void ResetStatics()
    {
        ScoreChanged = null;
    }

    public static void RaiseScoreChanged(int value) => ScoreChanged?.Invoke(value);
}
```

Only the declaring type can assign the event to `null`. If the static event is not application-owned, unregister the handlers your code owns instead of clearing other owners' subscriptions.

## 8. Observable-Value Contract

Before implementing, answer:

1. What values are legal, and where are they clamped or rejected?
2. Is notification distinct-only, always, or caller-selectable?
3. Is equality `EqualityComparer<T>.Default`, reference identity, approximate numeric equality, or a domain comparer?
4. Does the payload contain the new value only, old and new values, or a domain change object?
5. Is assignment visible before callbacks run?
6. What happens if a callback sets the value again?
7. What happens when a callback throws?
8. Must every call occur on Unity's main thread?
9. Is there a `ForceNotify` operation, and why?

A code-only baseline:

```csharp
using System;
using System.Collections.Generic;

[Serializable]
public class ObservableValue<T>
{
    private T value;

    [field: NonSerialized]
    public event Action<T, T> Changed;

    public T Value
    {
        get => value;
        set => Set(value);
    }

    public bool Set(T next)
    {
        if (EqualityComparer<T>.Default.Equals(value, next))
            return false;

        var previous = value;
        value = next;
        Changed?.Invoke(previous, next);
        return true;
    }

    public void ForceNotify() => Changed?.Invoke(value, value);
}
```

This is a policy sketch, not a universal implementation. A serialized Inspector callback can be added separately when the designer workflow earns it. For `UnityEngine.Object` values, explicitly test destroyed-object fake-null behavior rather than assuming a general comparer matches domain intent.

## 9. UnityEvent Runtime and Persistent Listeners

`UnityEvent` is a serialized callback container. Unity documents that:

- persistent callbacks can be saved with the Scene or host asset;
- `AddListener` adds a non-persistent listener;
- `Invoke` calls runtime and persistent listeners;
- `GetPersistentEventCount` counts persistent listeners;
- `RemoveAllListeners` removes non-persistent listeners only;
- UnityEvents hold target references and therefore affect garbage collection.

Inspector calls can be static, using a configured argument, or dynamic, using the argument passed to `Invoke`. Generic UnityEvents support up to four arguments; for robust Inspector authoring, define concrete serializable event classes when the exact Unity version or drawer requires them:

```csharp
[Serializable]
public sealed class IntChangedEvent : UnityEvent<int> { }
```

Do not expose persistent mutation from runtime assemblies. Persistent listeners are authored data, not gameplay subscriptions.

## 10. Safe Editor Tooling

Place Editor code under an `Editor` folder or in an Editor-only assembly. A safe persistent clear helper:

```csharp
using UnityEditor;
using UnityEditor.Events;
using UnityEngine;
using UnityEngine.Events;

public static class PersistentEventEditor
{
    public static void Clear(Object owner, UnityEventBase unityEvent)
    {
        Undo.RecordObject(owner, "Clear Persistent Listeners");

        for (var i = unityEvent.GetPersistentEventCount() - 1; i >= 0; i--)
            UnityEventTools.RemovePersistentListener(unityEvent, i);

        PrefabUtility.RecordPrefabInstancePropertyModifications(owner);
        EditorUtility.SetDirty(owner);
    }
}
```

Adapt dirty handling to the target type. Unity recommends `SerializedProperty` plus `ApplyModifiedProperties` for custom Inspector fields because it handles Undo, dirty state, multi-object editing, and Prefab overrides. `UnityEventTools` is the supported API for persistent listener mutation; still record the owning object and verify the resulting scene, prefab, or asset state.

Do not author persistent listeners while `Application.isPlaying` unless the tool explicitly treats the change as temporary and communicates that it will roll back. Do not choose persistent versus runtime behavior only from compile symbols.

Persistent callbacks need a serializable target and compatible public method. Lambdas, closures, and arbitrary plain managed objects are not persistent Inspector targets.

## 11. Serialization and Implicit Conversion

Unity serializes eligible fields, not ordinary properties. Custom serializable classes are normally serialized inline by value, so sharing the same managed instance across two fields does not preserve reference identity unless `[SerializeReference]` is deliberately used.

Verify generic serializable wrappers in the exact Unity version and Inspector workflow. Concrete wrappers and concrete `UnityEvent<T>` subclasses are a conservative portability choice when drawers, older versions, or asset migration are involved.

Do not perform Unity Scripting API calls from serializable class constructors. Deserialization can recreate or replace serialized state, so rebuild runtime-only comparers and callbacks explicitly after load or from the owning component's lifecycle.

An implicit conversion such as this is legal C#:

```csharp
public static implicit operator T(ObservableValue<T> source) => source.Value;
```

It also hides access, creates null ambiguity, and does not apply in every overload-resolution scenario. Prefer `.Value` when explicitness matters. The tutorial's performance remark about implicit conversion is not evidence; profile the actual project before making a cost claim.

## 12. Related Skills and Overlap

Compare any materially relevant skill; do not assign fixed rank or force one primary skill.

- `dev-unity-gameplay-architecture`: feature ownership, event-channel or bus topology, dependency direction, cross-scene reach, and global state. Benefit: coherent boundaries. Drawback: broader design work. Reject when a local publisher/subscriber decision is already bounded.
- `dev-unity-ui-controller-binding`: UI snapshots, `DataContext`, and presentation binding. Benefit: explicit UI flow. Drawback: UI-specific structure. Reject for non-UI domain notification.
- `dev-unity-stats-modifiers`: base/current/derived stats and modifier order. Benefit: owns stat math. Drawback: unnecessary for a generic change signal. Combine when health or stats semantics—not merely notification—are part of acceptance.
- `dev-unity-vcontainer`: dependency composition and scopes. Benefit: makes lifetime ownership explicit. Drawback: container coupling. Reject when normal references already compose the participants.
- `dev-unity-assembly-definitions`: runtime/Editor assembly separation. Benefit: compile-safe UnityEditor boundaries. Drawback: extra assembly graph. Use when implementing Editor tooling in a modular project.
- `dev-unity-performance-profiling`: measured dispatch, allocation, or GC diagnosis. Benefit: evidence. Drawback: profiling effort. Reject unsupported optimization work without a performance symptom or requirement.
- `dev-unity-clean-code-principles` and `dev-ponytail`: simplicity and review lenses. Benefit: prevent event overengineering. Drawback: duplicate review if this skill already resolves the mechanism. Use only when broader code-quality acceptance changes the result.

## 13. Failure Modes

- A public delegate field lets outside code replace or invoke the subscriber list.
- A static event retains destroyed scene subscribers or duplicates callbacks across no-domain-reload Play sessions.
- `OnEnable` subscribes repeatedly but no matching `OnDisable` removes the same delegate instance.
- A lambda is recreated during removal, so it does not match the subscribed instance.
- A required operation is modeled as an optional event and silently has zero listeners.
- An event bus hides dependencies that a direct reference would make obvious.
- `GetPersistentEventCount()` is reported as the total listener count.
- `RemoveAllListeners()` is assumed to delete persistent Inspector callbacks.
- Editor Play Mode calls `UnityEventTools` because `UNITY_EDITOR` is defined.
- Private reflection into `m_PersistentCalls` breaks after a Unity change or bypasses Undo and Prefab overrides.
- An observable wrapper uses unclear equality, cannot force a refresh when required, or re-enters indefinitely.
- A serialized wrapper's constructor-created runtime listeners vanish or duplicate after deserialization.
- `Dispose()` removes designer-authored persistent callbacks or is never called by its owner.
- A listener throws and unexpectedly prevents later listeners from running.
- Persistent callbacks target renamed methods or missing objects and fail only at runtime.

## 14. Verification Matrix

### C# events

- zero, one, and multiple subscribers;
- duplicate subscription behavior;
- named handler and stored-lambda removal;
- subscriber disabled, destroyed, and recreated;
- publisher destroyed before subscriber and vice versa;
- handler throws;
- handler subscribes or unsubscribes during dispatch;
- handler raises the event reentrantly;
- repeated scene loads and Play sessions.

### Observable values

- initial value and deserialized value;
- equal assignment suppression;
- changed assignment with correct old/new payload;
- custom equality or Unity-object fake-null cases;
- validation/clamping before notification;
- `ForceNotify` behavior;
- reentrant set;
- callback exception policy;
- runtime-only listener cleanup.

### UnityEvent and Editor tooling

- persistent-only, runtime-only, and mixed listeners;
- dynamic and configured static Inspector calls;
- add/remove by callback and by index;
- clear from the last persistent index to zero;
- Undo and Redo;
- Scene dirty state, ScriptableObject dirty state, and Prefab override preservation;
- change in Edit Mode, in Play Mode, and after exiting Play Mode;
- assembly compiles in player without `UnityEditor` references;
- standalone/development player invokes the expected callbacks;
- Domain Reload enabled and disabled.

## 15. Primary Sources

### Microsoft C# and .NET

- [event keyword](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/keywords/event)
- [Events programming guide](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/)
- [Delegates versus events](https://learn.microsoft.com/en-us/dotnet/csharp/distinguish-delegates-events)
- [Subscribe to and unsubscribe from events](https://learn.microsoft.com/en-us/dotnet/csharp/programming-guide/events/how-to-subscribe-to-and-unsubscribe-from-events)
- [C# delegate language specification](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/language-specification/delegates)
- [EqualityComparer<T>.Default](https://learn.microsoft.com/en-us/dotnet/api/system.collections.generic.equalitycomparer-1.default)
- [User-defined conversions](https://learn.microsoft.com/en-us/dotnet/csharp/language-reference/operators/user-defined-conversion-operators)
- [INotifyPropertyChanged](https://learn.microsoft.com/en-us/dotnet/api/system.componentmodel.inotifypropertychanged)

### Unity 6.3

- [UnityEvent](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEvent.html)
- [UnityEvent<T>](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEvent_1.html)
- [UnityEvent overview](https://docs.unity3d.com/6000.3/Documentation/Manual/UnityEvents.html)
- [UnityEvent.AddListener](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEvent.AddListener.html)
- [UnityEventBase.GetPersistentEventCount](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEventBase.GetPersistentEventCount.html)
- [UnityEventBase.RemoveAllListeners](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEventBase.RemoveAllListeners.html)
- [UnityEventTools.AddPersistentListener](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEventTools.AddPersistentListener.html)
- [UnityEventTools.RemovePersistentListener](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Events.UnityEventTools.RemovePersistentListener.html)
- [Script serialization](https://docs.unity3d.com/6000.3/Documentation/Manual/script-Serialization.html)
- [MonoBehaviour.OnEnable](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.OnEnable.html)
- [MonoBehaviour.OnDisable](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/MonoBehaviour.OnDisable.html)
- [Configurable Enter Play Mode](https://docs.unity3d.com/6000.3/Documentation/Manual/ConfigurableEnterPlayMode.html)
- [Undo.RecordObject](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Undo.RecordObject.html)
- [SerializedObject.ApplyModifiedProperties](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/SerializedObject.ApplyModifiedProperties.html)
- [EditorUtility.SetDirty](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/EditorUtility.SetDirty.html)
