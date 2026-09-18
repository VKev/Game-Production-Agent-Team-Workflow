# Locale Manager Architecture and Flow

## Contents

1. [Exercise 2 baseline](#exercise-2-baseline)
2. [Reusable ownership model](#reusable-ownership-model)
3. [Initialization flow](#initialization-flow)
4. [Language switch flow](#language-switch-flow)
5. [Lookup and formatting flow](#lookup-and-formatting-flow)
6. [Static and dynamic UI refresh](#static-and-dynamic-ui-refresh)
7. [Persistence and system language](#persistence-and-system-language)
8. [Fonts, RTL, and layout](#fonts-rtl-and-layout)
9. [Failure modes](#failure-modes)
10. [When to scale beyond this pattern](#when-to-scale-beyond-this-pattern)

## Exercise 2 baseline

Exercise 2 contains four cooperating pieces:

| Piece | Responsibility |
|---|---|
| `LocaleRecord` | One `Key` and translated `Text` row |
| `LocaleTable` | Load `Resources/locale_<lang>.csv`, index rows by `Key`, return text or null |
| `LocaleManager` | Hold one active table and language, expose `Get`, publish `OnLanguageChanged` |
| `LocalizedText` | Listen for changes and render one legacy uGUI `Text` |

Its runtime flow is:

```text
Screen calls SetLanguage("vi")
  -> construct LocaleTable("vi")
  -> ConfigTable.Load()
  -> Resources.Load<TextAsset>("locale_vi")
  -> TsvParser.Parse<LocaleRecord>()
  -> RebuildIndex("Key")
  -> commit table and CurrentLanguage
  -> invoke OnLanguageChanged
  -> enabled LocalizedText components call Get(key)
```

Dynamic UI cannot always rely on `LocalizedText`. `Screen_ConfigDemo` listens once and rebuilds its item-row dictionaries because labels and rarity names are produced before `BindList` renders. `Screen_WeaponShop` similarly asks its controller to republish localized titles, descriptions, stats, effects, and feature callouts.

This separation is sound: the manager resolves language data, while the screen/controller rebuilds its own presentation snapshot.

### Baseline limitations

The exercise is intentionally educational and omits production concerns:

- Any string is accepted as a language code.
- A missing resource still leaves the new table/current language committed.
- Every `SetLanguage`, including the active code, reloads and reparses the file.
- There is no fallback-language table; a missing entry falls directly to its key.
- Selection is not persisted.
- Initialization is owned opportunistically by whichever screen runs first.
- Formatting uses the process culture rather than the selected locale.
- Legacy `Text` is the only provided binding.
- Font switching is hard-coded in the Weapon Shop view.
- Static event lifetime depends on every subscriber unsubscribing correctly.

Use the baseline as the architectural seed, not as a blind production copy.

## Reusable ownership model

```text
Application composition root
  owns initialization timing and supported-language policy
          |
          v
LocaleManager (application lifetime)
  owns active code, fallback code, table cache, saved selection, event
          |
          +----> LocaleTable loader/parser
          |
          +----> LocalizedText subscribers
          |
          +----> screen/controller refresh subscribers
```

### LocaleManager owns

- canonical supported language codes;
- current, default, and fallback language codes;
- parsed-table cache;
- validation before committing a switch;
- active formatting culture;
- persistence of the selected code;
- the one-to-many change event;
- visible key fallback and diagnostics.

### LocaleManager does not own

- language selection button visuals;
- UI navigation;
- per-screen layout or animation;
- font assignment and fallback-font assets;
- domain/config objects that contain localization keys;
- translator workflow or remote delivery;
- plural, gender, RTL shaping, or localized non-text assets unless explicitly extended.

### Table loader owns

- locating a table from a language code;
- parsing its authoring format;
- duplicate and invalid-row diagnostics;
- efficient key lookup after loading.

If the target project already has a config, database, Addressables, or Unity Localization source, retain that source and adapt the manager contract. Do not copy another parser into the project.

## Initialization flow

Initialize once from the application composition root, before localized UI appears:

```text
Collect supported codes
  -> canonicalize and remove duplicates
  -> validate default and fallback codes
  -> read persisted selection, if enabled
  -> choose persisted or default code
  -> successfully load chosen/default/fallback table
  -> commit CurrentLanguage and CultureInfo
  -> notify any already-enabled subscribers once
```

The bundled manager tries the saved language, default language, fallback language, then remaining supported languages. Initialization fails only if no supported table can load.

Do not initialize independently in each screen. That creates competing defaults, repeated loading, and scene-order-dependent behavior. If a project has no application bootstrap, add one small owner rather than hiding initialization inside arbitrary views.

When Enter Play Mode disables domain reload, static data and listeners can survive between sessions. Reset static runtime state with `RuntimeInitializeOnLoadMethod(SubsystemRegistration)`.

## Language switch flow

`SetLanguage(code)` must be transactional:

1. Reject null, blank, or unsupported codes.
2. Resolve the canonical supported spelling.
3. Return successfully without notification when the code is already active.
4. Load or retrieve the cached table.
5. Abort without changing current state if loading/parsing fails.
6. Commit table, current code, and formatting culture.
7. Persist the selected code when enabled.
8. Invoke `OnLanguageChanged` exactly once.

Validate before committing so a missing file cannot move the manager into a state that claims one language while displaying another.

Use a separate `Refresh()` event when UI must redraw without changing languages. In Exercise 2, `Screen_ConfigDemo.OnShow` calls `SetLanguage(CurrentLanguage)` to force a redraw; the explicit method makes that intent clear and lets same-language selection remain cheap.

## Lookup and formatting flow

Resolve `Get(key)` in this order:

```text
active table contains key?   -> active translation
fallback table contains key? -> fallback translation
otherwise                    -> key itself
```

Returning the visible key is a deliberate development-safe fallback: the UI remains nonblank and missing data is easy to identify. A release build may additionally aggregate missing-key diagnostics, but avoid logging the same miss every frame.

For formatted text:

```csharp
LocaleManager.Get("gold_amount", 1500)
```

Use the culture derived from `CurrentLanguage`, so number and date formatting match the selected language instead of the device/process culture. Treat translation format strings as external data: catch `FormatException`, report the key/language, and return a visible fallback rather than breaking the screen.

Do not build sentences through concatenated localized fragments. Word order varies across languages. Store the complete sentence and pass values into placeholders.

## Static and dynamic UI refresh

### Static authored labels

Attach one `LocalizedText` to the object that owns the text component:

```text
OnEnable  -> subscribe -> Refresh
OnDisable -> unsubscribe
```

Registering in `OnEnable` handles pooled, disabled, and re-enabled UI correctly. Do not subscribe in `Awake` and forget disabled lifetime.

Adapt the same component to the project's actual text system:

- legacy uGUI: `UnityEngine.UI.Text`;
- TextMeshPro: `TMP_Text`;
- UI Toolkit: update a `TextElement` through its panel/lifecycle owner.

Do not ship multiple variants when only one text system is installed.

### Dynamic or composed presentation

A value assembled by a controller before rendering—such as a stat row, shop description, or generated list—must be rebuilt after a language change.

With the SimpleUI controller-binding pattern:

```text
screen subscribes once
  -> controller.RefreshLocalization()
  -> controller rebuilds complete context snapshot
  -> Context.SetRange(...)
  -> bindables render new rows/text
```

Keep the subscription at the screen/controller boundary. Avoid individual static event subscriptions on every dynamically spawned row when one parent refresh already reconstructs those rows.

Unsubscribe from the same lifetime boundary used to subscribe. If the controller subscribes in `OnStart`, unsubscribe in `OnDispose`; if the Unity view subscribes for its whole object lifetime, unsubscribe in `OnDestroy`.

## Persistence and system language

Persist the language code, not translated strings or parsed tables. The bundled template uses one `PlayerPrefs` value as the smallest standalone policy; replace it with the project's save/profile system when one exists.

Selection priority should be explicit. A common order is:

1. valid saved user choice;
2. supported mapping from `Application.systemLanguage`;
3. authored default language;
4. fallback language.

Do not silently overwrite an explicit saved choice with the system language on every boot. Keep mapping from Unity's `SystemLanguage` to project codes in the bootstrap/config layer, especially for regional codes such as `pt-BR` versus `pt-PT`.

## Fonts, RTL, and layout

Language selection affects more than string lookup, but those effects remain presentation concerns:

- map languages to fonts or TMP fallback-font assets;
- ensure the atlas contains every required glyph;
- test line height, wrapping, preferred size, truncation, and button expansion;
- mirror directional layout only when the design and language require it;
- use an appropriate shaping/bidi solution for Arabic, Persian, Hebrew, and similar scripts;
- test controller navigation after mirroring.

Exercise 2 changes the Weapon Shop font when `CurrentLanguage == "vi"`. Generalize that through language metadata or a font policy owned by the screen/theme layer; do not hard-code language-specific font decisions inside `LocaleManager.Get`.

## Failure modes

### Missing table

Do not commit the requested language. Keep the previous working language and return `false` from the switch.

### Missing key

Try the fallback table, then display the key. Use the validator to catch parity problems before runtime.

### Duplicate key

Report the duplicate with table and row information. Either reject the table or define that the last row wins; never leave the behavior undocumented.

### Placeholder mismatch

If fallback uses `{0}` and a translation removes it or changes it to `{1}`, formatting is semantically broken even if parsing succeeds. Validate signatures offline.

### Event leak or duplicate refresh

Use symmetric subscription. Avoid lambdas that cannot be unsubscribed. Do not invoke change events for same-language no-ops.

### Stale dynamic UI

Static `LocalizedText` may refresh correctly while controller-built rows remain in the old language. Subscribe the presentation owner and republish its snapshot.

### Reloading every switch

Cache parsed tables by canonical code. Localization data is authored configuration and normally does not change during a session.

## When to scale beyond this pattern

Move to Unity Localization or a larger system when requirements include:

- plural/gender/select rules and Smart Strings;
- localized sprites, audio, prefabs, or other assets;
- Addressables-based remote language packs;
- translator import/export and metadata workflows;
- pseudo-localization and automated locale QA;
- large tables that should load asynchronously or unload;
- robust RTL shaping and mirrored UI frameworks.

Preserve the useful ownership boundaries even when replacing the implementation: one application locale authority, explicit data adapters, lifecycle-safe presentation subscribers, and deterministic fallback behavior.
