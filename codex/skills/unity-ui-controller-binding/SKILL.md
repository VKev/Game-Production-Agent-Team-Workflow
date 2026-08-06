---
name: unity-ui-controller-binding
description: Design, implement, review, debug, and port lightweight Unity uGUI screens built around a screen-root UIView, plain-C# UIController, one-way DataContext snapshots, IBindable presentation components, and BindList item contexts. Use for data-bound screen architecture, controller/view separation, dynamic prefab lists, binding keys, context actions, runtime binder registration, screen lifecycle, selection/equip/shop UI, or when moving this SimpleUI pattern into another Unity project.
---

# Unity UI Controller Binding

Use this skill to build small and medium Unity uGUI screens with traceable one-way data flow. Keep screen state and decisions in a plain C# controller, Unity presentation in bindable components, and lifecycle/composition at the screen-root view.

## Decide whether this pattern fits

1. Inspect the existing UI framework, screen hierarchy, navigation owner, Unity version, and text package before adding code.
2. Reuse equivalent project abstractions when they already exist. Do not create a parallel binding framework merely to match these names.
3. Use this baseline for screens with modest data volume and low-frequency updates: shops, inventories, loadouts, menus, and settings.
4. Do not use global `RebindAll` plus rebuild-on-bind lists for rapidly changing HUD data or large virtualized collections. Preserve the ownership model, but add key-specific invalidation and pooled or recycled rows.
5. Use `unity-gameplay-architecture` first when the architectural style itself is still undecided.

## Preserve the core contract

```text
Unity input
  -> Action read by an IBindable
  -> UIController validates and mutates runtime state
  -> controller publishes one DataContext snapshot
  -> DataContext rebinds registered IBindable components
  -> bindables render Unity UI
```

- `UIView` is the composition root and lifecycle owner for exactly one screen subtree.
- `UIController` owns presentation state, selection rules, commands, and snapshot construction. It is plain C# and must not animate, toggle, or search Unity objects.
- `DataContext` is the current render-state dictionary and binder registry. It is not persistent save data or domain state.
- `IBindable` reads context values, renders Unity objects, and forwards user input through context actions. It must not write back into the context from `Bind`.
- `BindList` creates one child `DataContext` per row. Row bindables belong to that child context, not the screen context.
- ScriptableObjects and other configs are read-only authoring inputs at runtime unless the project explicitly defines a mutable clone.

## Implementation workflow

1. Place the `UIView` on the actual screen root, not on a global Canvas or a parent containing unrelated screens.
2. Define centralized constants for every binding key and document the runtime type stored under each key.
3. Define the controller-owned state and the complete render snapshot before wiring components.
4. Constructor-inject required config or services from the concrete `UIView.CreateController` override.
5. Publish related values together with one `Context.SetRange` call. Avoid a sequence of `Set` calls.
6. Use simple binders for text, images, visibility, and short lists. Create feature-specific bindables for animations, complex button states, or multiple coordinated Unity references.
7. Pass UI commands as `System.Action` or `System.Action<T>` values in the snapshot. Bindables cache the current command and keep Unity listener registration symmetric.
8. For `BindList`, publish each row as `IDictionary<string, object>`. Include row values, state flags, and its command in that row map.
9. Explicitly register bindables instantiated or added after `UIView` initialization. Explicitly unregister bindables before removing authored placeholders or runtime components.
10. Verify first show, hide/show again, selection changes, stale-value clearing, listener cleanup, list order, and destruction paths.

Keep context commands as synchronous entry points. When an operation is asynchronous, let the controller start it through an application service, publish busy/error states, and own cancellation tied to `OnDispose`; do not put `async void` work in a bindable.

## Lifecycle rules

- `Awake` initializes the view, creates the root context, registers inactive descendants, creates and attaches the controller, then calls `OnInit`.
- `Show` activates the screen, invokes controller `OnStart`, invokes view `OnShow`, and renders if the controller did not already publish.
- `Update` forwards only while the screen is active.
- `Hide` invokes `OnHide`, then controller `OnDispose`, then deactivates the screen.
- `OnStart` means every show, not once per controller lifetime.
- Use one navigation/opening owner. Do not combine a self-opening `Start` method with a manager that also calls `Show`.
- Do not rely on binder execution order.

## Dynamic UI rules

- Initial descendant bindables, including inactive ones, are registered automatically.
- Runtime-created bindables are invisible to the root context until `Context.Register` is called.
- Removed bindables remain in the registry until `Context.Unregister` is called.
- A `BindList` registers spawned row bindables only in that row's child context.
- Authored preview rows must be unregistered from the root context before destruction if they were discovered during initialization.

## Performance boundary

The bundled implementation deliberately favors clarity over granular invalidation:

- Any `Set` or `SetRange` rebinds all registered bindables.
- Any screen update also causes every `BindList` to destroy and recreate its rows.
- Use it unchanged only for short, infrequently updated lists.
- When profiling proves the need, retain the same controller/view/binder boundaries but introduce dirty-key notifications, row identity diffing, pooling, or recycled scrolling.

## Reusable assets

Copy only the missing files from `assets/SimpleUI/` into the target Unity project. The bundled baseline contains:

- `IBindable.cs`
- `DataContext.cs`
- `UIController.cs`
- `UIView.cs`
- `BindText.cs` for legacy `UnityEngine.UI.Text`
- `BindImage.cs`
- `BindVisible.cs`
- `BindList.cs`

Adapt `BindText` to TextMeshPro when the target project uses TMP. Do not copy an optional navigation manager unless it matches the project's screen stack and popup ownership.

## Reference loading guide

Read `references/architecture-and-flow.md` before implementing or porting this pattern. It contains the role boundaries, exact execution flow, snapshot and command shapes, dynamic registration examples, a shop-screen case study, failure modes, scaling choices, and a verification checklist.

## Related skills

- `unity-locale-manager` for language selection, localized bindables, and republishing dynamic screen snapshots after a locale change.
- `unity-gameplay-architecture` for selecting the wider feature architecture and ownership boundaries.
- `unity-clean-code-principles` for naming, small responsibilities, and safe refactors.
- `unity-object-pooling` when `BindList` row churn is measured as a problem.
- `unity-performance-profiling` before adding selective invalidation or recycled scrolling complexity.
