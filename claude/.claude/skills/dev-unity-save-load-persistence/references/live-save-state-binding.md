# Live Save-State Binding

Use live binding when gameplay models can safely share persistent reference objects so the save aggregate remains current during play. This is distinct from UI binding and does not require a global reactive framework.

## Preserve the safe form

```text
versioned SaveRoot owns section DTOs
-> coordinator assigns one section to its runtime owner
-> runtime owner uses that section as backing state
-> all mutations pass through invariant-preserving model methods
-> save captures or freezes the root before serialization
```

Require all of the following:

- One clear owner for every mutable section.
- Reference-type section data or an explicit write-back mechanism.
- A root assignment when a missing section is created.
- A freeze, copy, lock, or main-thread transaction that prevents mutation during serialization.
- Explicit initial apply behavior and restoration side-effect suppression.
- Stable entity and content IDs.
- Tests for repeated bind, unbind, scene reload, new game, and old-version data.

## Avoid the lost-assignment bug

This is unsafe when `data` is passed by value:

```csharp
void Bind<TData>(TData data) where TData : class, new() {
    if (data == null) data = new TData();
    runtime.Bind(data);
}
```

The new object is only stored in the local parameter. Return it, accept a root setter, or let the root create sections before binding:

```csharp
saveRoot.Player ??= new PlayerSaveData();
player.Bind(saveRoot.Player);
```

Do not use `ref` merely to conceal unclear ownership; prefer root-owned initialization at one composition point.

## Bind models, not views

- Let a player model proxy persisted currency, progress, or equipment through its section when that does not leak persistence concerns into unrelated rules.
- Let an inventory model use a persisted item array or list only if capacity and content-version migrations are handled before binding.
- Keep UI `DataContext`, visual selection, row objects, and animation state transient.
- Avoid exposing public mutable DTO fields to many unrelated systems. Route mutation through the owning model.

## Choose update granularity

Do not copy every transform into save data every frame by default.

- Update on meaningful domain changes for inventory, quests, settings, unlocks, and currency.
- Mark transform or world sections dirty and capture them at a bounded checkpoint or autosave boundary.
- Use periodic sampling only when the recovery product requirement justifies it.
- Profile the total ongoing bookkeeping cost, not only the duration of the final Save call.

## Restore deterministically

1. Deserialize into temporary data.
2. Validate and migrate to the current schema.
3. Load or activate the required scene content.
4. Build the stable-ID registry.
5. Bind or apply each section once.
6. Spawn saved runtime entities and account for intentionally destroyed records.
7. Publish a restoration-complete signal after invariants are valid.

Unity raises `SceneManager.sceneLoaded` after `OnEnable` and before `Start`. Do not rely on a `Start` initializer that must run before the scene-loaded binding callback.

## Replace broad discovery

Avoid choosing a singular entity with unsorted `FindObjectsByType(...).FirstOrDefault()`. Prefer:

- Inspector-assigned references for stable bootstrap objects.
- Registration with a save coordinator or entity registry.
- Scene-authored stable IDs validated in the Editor.
- Spawn records that map saved instance IDs to content IDs and runtime factories.

For collection binding, pre-index save sections by ID instead of performing a linear search for every entity when scale matters. Reject or report duplicate IDs before applying data.

## Tutorial case-study corrections

The git-amend tutorial demonstrates the useful shared-state idea, serializer and data-service separation, stable IDs, scene binding, and inventory backing fields. Do not copy these sample details unchanged:

- `ListSaves()` compares `Path.GetExtension(path)` with `"json"`; the API returns `".json"` including the period.
- A locally created generic binding section is not assigned back into the `GameData` root.
- `DeleteAll()` enumerates every file directly under `Application.persistentDataPath`.
- Slot names are used directly as path components.
- Writes overwrite synchronously without a recovery transaction.
- No schema version, migration, validation, or corruption handling exists.
- The synchronous data-service contract is not sufficient for cloud authentication, retry, cancellation, or conflict resolution.

Treat the video as an architectural case study, not a production implementation.

