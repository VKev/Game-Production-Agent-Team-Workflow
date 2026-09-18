# Official Sources

Confirm the target project's Unity version and `Packages/packages-lock.json` before relying on version-sensitive behavior. The Unity engine links below target 6000.3, while the Localization links target package 1.5.

## Lightweight manager baseline

- [Resources.Load](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Resources.Load.html): load authored language tables from a `Resources` folder.
- [PlayerPrefs](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PlayerPrefs.html): persist a non-sensitive language code between sessions.
- [Application.systemLanguage](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/Application-systemLanguage.html): inspect Unity's system-language value when choosing an initial locale.

## When to use Unity Localization instead

- [About Localization 1.5](https://docs.unity3d.com/Packages/com.unity.localization@1.5/manual/index.html): package scope, string and asset localization, pseudo-localization, and import/export support.
- [Startup Locale Selectors](https://docs.unity3d.com/Packages/com.unity.localization@1.5/manual/LocaleSelector.html): default, system, command-line, and saved-locale selection.
- [Smart Strings](https://docs.unity3d.com/Packages/com.unity.localization@1.5/manual/Smart/SmartStrings.html): placeholders, pluralization, selectors, and locale-aware formatting.

## Formatting

- [CultureInfo](https://learn.microsoft.com/en-us/dotnet/api/system.globalization.cultureinfo): culture-specific formatting behavior.
- [Composite formatting](https://learn.microsoft.com/en-us/dotnet/standard/base-types/composite-formatting): indexed placeholders and format strings used by `string.Format`.
