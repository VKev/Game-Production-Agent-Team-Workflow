# UIView, UIController, and Binding Architecture

## Contents

1. [Purpose and dependency direction](#purpose-and-dependency-direction)
2. [Roles and ownership](#roles-and-ownership)
3. [Exact execution flow](#exact-execution-flow)
4. [Snapshots and binding keys](#snapshots-and-binding-keys)
5. [Actions as UI commands](#actions-as-ui-commands)
6. [BindList and child contexts](#bindlist-and-child-contexts)
7. [Dynamic registration and replacement](#dynamic-registration-and-replacement)
8. [Screen placement and navigation](#screen-placement-and-navigation)
9. [Shop-screen case study](#shop-screen-case-study)
10. [Failure modes and scaling](#failure-modes-and-scaling)
11. [Verification checklist](#verification-checklist)

## Purpose and dependency direction

This is a deliberately small one-way presentation architecture for Unity uGUI. It separates decisions from rendering without introducing a service locator, global event bus, reactive package, or MonoBehaviour controller.

```text
Authoring config / application services
                 |
                 v
          UIController state
                 |
          publish SetRange
                 v
          root DataContext
            /          \
           v            v
  ordinary IBindable   BindList
                         |
                 child DataContext per row
                         |
                    row IBindable

Button click -> cached Action -> UIController -> new snapshot
```

Dependencies point toward small contracts. The controller knows `UIView` and `DataContext`, but it does not know concrete `Text`, `Image`, `Button`, animation, hierarchy paths, or prefabs. Bindables know how to render Unity objects, but not the business rules behind the values.

## Roles and ownership

| Type | Owns | Must not own |
|---|---|---|
| Concrete `UIView` | Serialized references, screen composition, controller construction, lifecycle-specific wiring | Selection rules, prices, equip validation, animation details |
| `UIController` | Runtime presentation state, validation, commands, complete render snapshots | `GameObject`, `Transform`, coroutines, DOTween calls, hierarchy searches |
| `DataContext` | Current `string -> object` render state and registered bindables | Save data, long-lived domain state, navigation policy |
| Generic `IBindable` | One small rendering concern such as text, image, visibility, or list creation | Mutating controller state directly or writing context during `Bind` |
| Feature bindable | Coordinated Unity references, animation, button mode, input forwarding | Business decisions about whether an action is valid |
| `BindList` | Row prefab lifetime and one child context per row | Root screen state or row-domain mutation |
| ScriptableObject config | Authored, reusable data defaults | Mutable session selection unless cloned by an explicit runtime owner |

Central rule: the controller writes render state; bindables read render state. A binder can invoke a command supplied by the controller, but the command performs the mutation and republishes state.

## Exact execution flow

### Initialization

1. Unity calls `UIView.Awake`.
2. `EnsureInitialized` creates one root `DataContext`.
3. The view finds every descendant `IBindable`, including inactive objects, and registers it.
4. The concrete view creates its controller with `CreateController`.
5. The base view attaches itself to the controller.
6. The concrete view's `OnInit` hook runs. This is where screen-specific binder replacement or authored-placeholder cleanup can occur.

### Showing and rendering

1. Caller invokes `Show`.
2. The screen GameObject becomes active.
3. Controller `OnStart` loads or refreshes state and normally calls one publish method.
4. The publish method calls `Context.SetRange` with a complete render snapshot.
5. `DataContext` increments its revision and calls `RebindAll`.
6. Each registered root binder reads the snapshot.
7. Each `BindList` clears its generated rows, instantiates rows in list order, creates a child context per row, registers row bindables, and publishes the row map.
8. The view's `OnShow` hook runs for view-specific presentation behavior.
9. The bundled `UIView` only forces a bind when `OnStart` and `OnShow` did not publish, preventing the common double initial list rebuild.

### Interaction

1. A button listener was installed by a bindable.
2. On the last bind, that bindable cached the current `Action` from its context.
3. A click invokes the cached action.
4. The controller validates the command and changes controller-owned state.
5. The controller republishes a complete snapshot.
6. All registered bindables render the new state.

### Hiding

1. Caller invokes `Hide`.
2. View `OnHide` stops presentation-owned work.
3. Controller `OnDispose` unsubscribes from external events or releases controller-owned resources.
4. The screen GameObject becomes inactive.

`OnStart` and `OnDispose` form a show-session pair. They may run multiple times during the lifetime of one view and controller instance.

## Snapshots and binding keys

Centralize every key and its expected runtime type:

```csharp
public static class InventoryBindingKeys
{
    public const string Items = "items";                 // IEnumerable<IDictionary<string, object>>
    public const string ItemName = "itemName";           // string
    public const string ItemIcon = "itemIcon";           // Sprite
    public const string IsSelected = "isSelected";       // bool
    public const string OnSelect = "onSelect";           // Action
    public const string ShowEquip = "showEquip";         // bool
    public const string OnEquip = "onEquip";             // Action
}
```

Prefer one controller method that constructs the whole visible state:

```csharp
private void Publish()
{
    Context.SetRange(new Dictionary<string, object>
    {
        [InventoryBindingKeys.Items] = BuildRows(),
        [InventoryBindingKeys.ShowEquip] = CanEquipSelected(),
        [InventoryBindingKeys.OnEquip] = (Action)EquipSelected
    });
}
```

This makes state transitions inspectable and avoids repeated whole-screen rebinds from several `Set` calls.

`SetRange` updates supplied keys; it does not delete omitted keys. Therefore either publish all keys that define the screen, add an explicit removal API, or deliberately overwrite values that should clear. Do not let an old action, sprite, or visibility flag survive because its key was omitted.

Treat the dictionary as an untyped boundary:

- Document expected types beside constants.
- Use safe type checks in bindables.
- Decide whether a missing or invalid value keeps the authored visual, hides it, or explicitly clears it.
- Never persist delegates from a context.
- Never call `Set` or `SetRange` from inside `Bind`; doing so can recursively enter rebinding.

## Actions as UI commands

Actions let Unity-facing bindables forward input without teaching the controller about buttons.

Controller row construction:

```csharp
private IDictionary<string, object> BuildRow(Item item)
{
    return new Dictionary<string, object>
    {
        [InventoryBindingKeys.ItemName] = item.DisplayName,
        [InventoryBindingKeys.ItemIcon] = item.Icon,
        [InventoryBindingKeys.IsSelected] = item == _selected,
        [InventoryBindingKeys.OnSelect] = (Action)(() => Select(item))
    };
}
```

Bindable input forwarding:

```csharp
private Action _onSelect;

private void Awake()
{
    _button.onClick.AddListener(HandleClick);
}

public void Bind(DataContext context)
{
    _onSelect = context[InventoryBindingKeys.OnSelect] as Action;
}

private void HandleClick()
{
    _onSelect?.Invoke();
}

private void OnDestroy()
{
    _button.onClick.RemoveListener(HandleClick);
}
```

Register the Unity listener once and update the cached command on every bind. Do not add a new lambda listener on every bind; that creates duplicate clicks and closure lifetime problems.

The controller remains the authority. It must re-check ownership, lock state, prices, and current selection even if the UI hides or disables an invalid action.

Context actions are synchronous entry points. For an asynchronous equip, purchase, or load operation:

1. The bindable invokes a normal controller command.
2. The controller starts the asynchronous operation through an injected application service.
3. The controller publishes busy/interactable/error presentation values.
4. The controller ignores or serializes duplicate commands according to the feature rule.
5. Cancellation belongs to the controller's show-session lifetime and is triggered from `OnDispose`.
6. Completion is validated against the current screen state before publishing again.

Avoid `async void` bindable handlers except Unity's unavoidable event boundary, and keep exception handling and cancellation in the controller/application layer.

## BindList and child contexts

The root context stores an enumerable of row dictionaries. Each row dictionary is a complete row snapshot.

```text
root key "items"
  -> row map 0 -> child context 0 -> binders inside row instance 0
  -> row map 1 -> child context 1 -> binders inside row instance 1
  -> row map 2 -> child context 2 -> binders inside row instance 2
```

This isolation is why every row can reuse the same key names. A row's `isSelected` cannot collide with another row's `isSelected` because their bindables read different contexts.

Important consequences:

- Spawned row bindables must not also be registered with the root context.
- Row callbacks should capture stable domain/config objects or stable IDs, not loop variables that will change.
- The baseline rebuilds every row on every root rebind.
- Unity `Destroy` is deferred until the end of the frame. Do not inspect same-frame layout as if destroyed rows are already gone.
- For auto-scroll-to-selection, wait until the rebuilt layout is valid, force a layout rebuild if needed, then calculate the normalized position.
- Reject `string` as a list source even though it implements `IEnumerable`.

Use this list only for modest row counts and low update frequency. For large catalogs or fast refreshes, use pooling plus stable row identity, or a recycled scroll implementation.

## Dynamic registration and replacement

The view scans bindables only once during initialization. Later changes require explicit registry maintenance.

Replacing a generic binder with a specialized one:

```csharp
protected override void OnInit()
{
    var oldBinder = previewObject.GetComponent<BindImage>();
    if (oldBinder != null)
    {
        Context.Unregister(oldBinder);
        oldBinder.enabled = false;
    }

    var preview = previewObject.GetComponent<WeaponPreviewView>();
    if (preview == null)
    {
        preview = previewObject.AddComponent<WeaponPreviewView>();
    }

    Context.Register(preview);
}
```

Removing authored placeholders:

1. Find each placeholder's descendant bindables.
2. Call `Context.Unregister` for each one.
3. Destroy the placeholder.
4. Let the runtime list binder create the authoritative rows.

When a dynamically added component has its own event listeners, also make listener setup and teardown symmetric in `Awake`/`OnDestroy` or `OnEnable`/`OnDisable`, according to its intended lifetime.

## Screen placement and navigation

Place `UIView` on the smallest hierarchy root that represents one coherent screen and one controller lifetime.

Wrong:

```text
MainCanvas [UIView]
  HUD bindables
  WeaponShop bindables
  Settings bindables
```

Every context update would rebind unrelated UI and every discovered binder would share the wrong data source.

Correct:

```text
MainCanvas
  HUD [its own owner]
  Screen_WeaponShop [UIView + one controller/context]
  Screen_Settings [UIView + one controller/context]
```

A navigation manager is optional and orthogonal. It may own screen spawning, layers, back-stack, and popup lifetime, but it should call each screen's `Show` and `Hide` rather than absorb controller or binder responsibilities. Adapt to the project's existing navigation system; do not force a bundled manager into another project.

## Shop-screen case study

A weapon shop is a useful example because it contains two dynamic lists, a preview, stats, lock/equip states, commands, and animation.

Controller-owned state:

- selected gun
- selected skin for the selected gun
- equipped gun and equipped skin
- unlocked gun and skin identities
- derived button modes and prices

One publication can include:

- gun row maps
- skin row maps
- stat row maps
- equip-effect and own-effect row maps
- preview sprite and transition direction
- title and short description
- action-button visibility, labels, prices, and commands

Separation examples:

- Selecting a gun is a controller command; changing the selected border is a row bindable render concern.
- Deciding whether `Equip Gun` is valid belongs to the controller; toggling the button GameObject belongs to a feature bindable.
- Computing which weapon should be previewed belongs to the controller; moving or fading the preview belongs to a preview bindable.
- Feature callout configuration belongs to authored data; drawing and animating the callout belongs to a callout bindable.
- The concrete view may wire or replace components during initialization, but should not become a second controller.

## Failure modes and scaling

### Double initial rendering

If controller `OnStart` calls `SetRange` and `UIView.Show` then always calls `RebindAll`, lists are built twice. The bundled template uses a `DataContext.Revision` guard: it forces a render only when neither `OnStart` nor `OnShow` published.

### Rebinding everything

The baseline intentionally has no key subscriptions. A timer update can rebuild an unrelated shop list. First batch changes with `SetRange`. If measured costs remain material, add dirty-key notifications so bindables declare their dependencies.

### Stale visuals

A missing or invalid key can leave the previous sprite, action, text, or visibility in place. Each binder must define a clearing policy. Controllers should publish complete state transitions rather than relying on old context values.

### Registry leaks

Destroyed or replaced bindables remain in the registry unless explicitly unregistered. Unity's destroyed-object null behavior can hide this for a while, but the registry still accumulates stale entries.

### Listener duplication

Adding listeners during every `Bind` produces repeated commands. Register one stable handler and replace only the cached action.

### Order coupling

The baseline iterates bindables in reverse registration order so removal during binding is less hazardous. This is not a dependency ordering system. Bindables must not rely on another binder having already run.

### Direct destruction

Destroying a screen without `Hide` skips controller `OnDispose`. Ensure the navigation owner closes the view cleanly, or add a project-specific destruction safeguard when external subscriptions require it.

### Text system mismatch

The bundled `BindText` targets legacy `UnityEngine.UI.Text`. Replace it with a `TMP_Text` variant when the project uses TextMeshPro; do not carry both without a real need.

## Verification checklist

### Architecture

- The `UIView` root contains only bindables for one screen.
- The controller contains no Unity presentation or animation code.
- Bindables do not mutate context during `Bind`.
- Binding keys are centralized and their value types are known.
- Config assets remain read-only authoring inputs.

### Lifecycle

- First `Show` renders exactly once when the controller publishes.
- Hide then show again produces correct state and no duplicate listeners.
- External event subscriptions pair with `OnDispose` cleanup.
- One owner is responsible for opening and closing the screen.

### Dynamic content

- Runtime-added bindables are registered.
- Removed bindables are unregistered before destruction.
- Each list row uses a child context and the expected row map.
- Row order matches source order.
- Empty lists clear generated rows.
- Invalid string list data does not spawn character rows.

### Interaction and state

- Commands are cached from the latest snapshot.
- Controller commands revalidate lock, ownership, price, and equip rules.
- Only the intended selected/equipped states render at once.
- Missing values clear or preserve visuals according to an explicit policy.

### Performance

- Use the Unity Profiler to measure rebind cost, instantiation, destruction, layout rebuilds, and GC allocation.
- Keep rebuild-on-bind lists short and low-frequency.
- Introduce pooling, recycling, diffing, or dirty-key binding only when measurements justify the added complexity.
