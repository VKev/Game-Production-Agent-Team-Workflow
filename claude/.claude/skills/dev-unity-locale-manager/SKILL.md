---
name: dev-unity-locale-manager
description: Design, implement, review, debug, and port lightweight Unity runtime localization built around a LocaleManager, per-language text tables, fallback lookup, saved language selection, language-change events, and LocalizedText presentation components. Use for language settings, locale switching, CSV or TSV translation tables, localized uGUI or TextMeshPro text, dynamic UI refresh, format placeholders, missing-key behavior, font or RTL concerns, and Exercise 2-style localization architecture.
---

# Unity Locale Manager

Build a small, predictable localization layer for projects that only need runtime string tables and language switching. Reuse the Exercise 2 flow while fixing its initialization, fallback, caching, persistence, and validation gaps.

## Select the smallest suitable solution

1. Inspect the Unity version, installed packages, existing localization code, data source, text system, bootstrap owner, save system, and supported platforms.
2. Reuse an existing project localization service or Unity Localization package instead of creating a parallel manager.
3. Use this lightweight pattern when the project needs string lookup, formatted text, a modest language list, and immediate UI refresh.
4. Prefer Unity Localization or another established system when the requirements include Smart Strings, plural/gender rules, localized assets, pseudo-localization, Addressables integration, complex RTL shaping, or a large translator pipeline.

## Preserve the core flow

```text
Application bootstrap
  -> initialize supported/default/fallback languages once
  -> LocaleManager loads and caches one language table
  -> UI calls Get(key) or listens for OnLanguageChanged

Language button
  -> LocaleManager.SetLanguage(code)
  -> validate and load table before committing
  -> persist selection
  -> publish OnLanguageChanged once
  -> LocalizedText and dynamic screen presenters refresh
```

- Let `LocaleManager` own the active language, supported language codes, table cache, fallback lookup, formatting culture, persistence policy, and change event.
- Let the table loader own parsing and key-to-text storage. Reuse the project's config parser when it already satisfies the format.
- Let `LocalizedText` or its TMP equivalent own one text component and subscribe symmetrically in `OnEnable`/`OnDisable`.
- Let controllers or screen presenters rebuild composed or dynamic text when the language changes.
- Keep font selection, layout changes, animation, and right-to-left presentation outside the manager.

## Implementation workflow

1. Define canonical language codes such as `en`, `vi`, or `pt-BR`, one default language, and one fallback language.
2. Choose exactly one application bootstrap owner. Initialize localization before the first localized screen appears; do not let unrelated screens race to choose defaults.
3. Keep one table per language with the same keys. Use stable semantic keys such as `shop.buy` rather than source English sentences.
4. Validate a requested language and successfully load its table before changing `CurrentLanguage` or notifying UI.
5. Cache parsed tables. Switching back to a loaded language must not reload or reparse its file.
6. Persist only the chosen language code. Translation tables remain authored configuration, not save data.
7. Make setting the already-active language a no-op. Provide an explicit refresh operation when UI must redraw without a language change.
8. Resolve text in this order: active table, fallback table, visible key. Never replace a usable screen with blank text because one translation is missing.
9. Format placeholders with the active locale's `CultureInfo`. Catch and report invalid translator-authored format strings.
10. Refresh static labels with localized text components and refresh generated lists/controller snapshots from one screen-level language-change subscription.
11. Validate table parity, duplicate keys, empty values, and placeholder signatures before completing the work.

## Exercise 2 adaptation

The Exercise 2 implementation uses `LocaleTable : ConfigTable<LocaleRecord>`, loads `Resources/locale_<lang>.csv`, builds an index on `Key`, and exposes a static `LocaleManager`. Preserve that adapter when `SimpleConfig` already belongs to the target project.

Do not copy the dependency into an unrelated project merely for localization. The self-contained files in `assets/LocaleManager/` provide the same small architecture without requiring `SimpleConfig`:

- `LocaleTable.cs` loads and parses two-column CSV or TSV resources.
- `LocaleManager.cs` manages supported languages, fallback, cache, persistence, culture, and notifications.
- `LocalizedText.cs` updates a legacy uGUI `Text`; adapt the same lifecycle to `TMP_Text` when TMP is installed.

Initialize the bundled manager from the project's existing composition root:

```csharp
LocaleManager.Initialize(
    new[] { "en", "vi" },
    defaultLanguage: "en",
    fallbackLanguage: "en");
```

Then let settings UI call `LocaleManager.SetLanguage("vi")`. Do not add a second singleton or bootstrap component when an application initializer already exists.

## UI integration rules

- Use one `LocalizedText` per authored static label.
- For dynamic rows, stats, prices, or controller-built descriptions, subscribe once at the screen/controller boundary and republish the screen snapshot.
- Avoid adding one screen-level subscription per spawned row when row data is already rebuilt together.
- Subscribe and unsubscribe on matching lifetime boundaries.
- Do not call `SetLanguage` merely to force a refresh; use `Refresh`.
- Keep language button labels readable in their own language and show the active state separately.
- Test text expansion, truncation, wrapping, fonts, safe areas, and layout at every supported language.

## Data and formatting rules

- Keep identical keys across language tables.
- Treat keys as case-sensitive unless an established project convention says otherwise.
- Keep `{0}`, `{1}`, and named placeholder signatures consistent across translations.
- Do not concatenate grammar-sensitive sentence fragments. Localize the complete sentence and pass values as format arguments.
- Keep translator comments or metadata outside the runtime `Key,Text` schema unless the parser explicitly supports them.
- Store files as UTF-8 and verify every font covers required glyphs.

## Verification

Run `scripts/validate_locale_tables.py` against the fallback table followed by every translated table. Then compile and play-test:

The validator requires Python 3.8 or newer and uses only the standard library. Check the resolved interpreter on Windows; do not assume a `python` command points to Python 3.

- first boot with no saved language;
- boot with a valid and invalid saved code;
- every language switch and switching back to a cached language;
- missing key and missing table behavior;
- formatted values and malformed placeholders;
- disabled/re-enabled localized components;
- dynamic lists and controller-generated text;
- font coverage, wrapping, RTL needs, and layout expansion.

## Reference loading guide

- Read `references/architecture-and-flow.md` before implementing, porting, or debugging manager lifecycle and UI refresh.
- Read `references/data-authoring-and-validation.md` when creating tables, defining keys/placeholders, validating translations, or reviewing fonts and RTL scope.
- Read `references/sources.md` when checking Unity APIs, .NET formatting behavior, or whether the Unity Localization package should replace this lightweight manager.

## Related skills

- `dev-unity-ui-controller-binding` for republishing localized controller snapshots and dynamic `BindList` rows.
- `dev-unity-gameplay-architecture` for application lifetime, composition roots, and ownership decisions.
- `dev-unity-project-context` for locating the project bootstrap, Resources, Addressables, and text packages.
- `dev-unity-assets-addressables` when localized assets or remote language packs exceed this lightweight Resources-based pattern.
