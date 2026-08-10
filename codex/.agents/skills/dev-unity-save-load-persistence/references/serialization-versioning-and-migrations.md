# Serialization, Versioning, and Migrations

## Select the serializer from requirements

Use `JsonUtility` when the schema is structured, Unity-supported fields are sufficient, file readability is useful, and polymorphism or dictionaries are not central requirements.

Confirm its constraints against the installed Unity version:

- It follows Unity field serialization rules.
- Unsupported fields are ignored rather than becoming a general JSON object model.
- Arrays or primitives need a containing serializable type when passed as a root.
- Dictionaries and nested container shapes need a surrogate, callbacks, or another serializer.
- Runtime Unity object references written as instance IDs are not cross-session asset references.
- Background serialization is allowed only when the object is not mutated concurrently.

Choose another maintained serializer only when the project genuinely needs features such as dictionaries, polymorphism, custom converters, strict parsing, or schema tooling. Inspect AOT and IL2CPP behavior, package version, code stripping, generated metadata, allocations, and target-platform support before adopting it.

Do not use obsolete insecure formatters. Do not label a binary format as encryption or integrity protection.

## Define a stable root

Prefer a root resembling:

```text
SaveRoot
  SchemaVersion
  SlotId
  SavedAtUtc
  BuildVersion or ContentVersion
  CurrentSceneId or CheckpointId
  Player
  Inventory
  Quests
  World
  Settings, only if intentionally per slot
```

Use project-appropriate fields; do not add metadata that no recovery, migration, diagnostics, or UX flow consumes.

## Version explicitly

- Increment the schema version for a persisted semantic or structural change that requires migration.
- Do not infer schema solely from missing fields.
- Keep the application/build version separate from the schema version.
- Define the oldest supported schema and the UX for anything older or newer.
- Never silently treat an unknown future schema as a new game.

## Migrate step by step

Prefer a deterministic chain:

```text
v1 -> v2 -> v3 -> current
```

For every migration:

- Accept one known input version and produce exactly the next version.
- Preserve stable IDs and user progress unless the product rule explicitly transforms them.
- Supply defaults from product rules, not serializer accident.
- Handle removed content through a documented compensation, fallback, or quarantine policy.
- Validate after each risky transformation and after the complete chain.
- Keep the original file until the migrated result is durably committed.

Keep migrations pure where practical so fixtures can run outside scenes and GameObjects.

## Resolve content and asset references

Persist one of these project-owned identifiers:

- Addressables address or another stable Addressables key policy.
- An authored GUID copied into a runtime catalog.
- A content database ID with duplicate detection.
- A stable enum only for genuinely closed, migration-controlled sets.

Do not persist `UnityEngine.Object.GetInstanceID()` as a cross-session reference. Do not use array indices when catalogs can be reordered. Define behavior for missing or retired content.

## Validate before applying

Validate at least:

- Root and section presence required for the current schema.
- Collection counts and capacity constraints.
- Numeric ranges and finite floating-point values.
- Duplicate, empty, or unknown IDs.
- Scene, checkpoint, and content identifiers.
- Enum values and mutually exclusive flags.
- References between sections.
- Spawn positions and rotations when invalid values can break physics or navigation.

Reject, quarantine, repair, or default according to an explicit policy. Do not partially mutate live state and then discover that a later section is invalid.

