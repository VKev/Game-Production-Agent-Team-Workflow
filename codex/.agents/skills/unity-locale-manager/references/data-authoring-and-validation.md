# Locale Data Authoring and Validation

## Contents

1. [Resource layout](#resource-layout)
2. [Table schema](#table-schema)
3. [Key conventions](#key-conventions)
4. [Formatting placeholders](#formatting-placeholders)
5. [Fallback and missing data](#fallback-and-missing-data)
6. [Validation script](#validation-script)
7. [Authoring checklist](#authoring-checklist)

## Resource layout

The bundled loader uses one Resources table per language:

```text
Assets/Resources/
  locale_en.csv
  locale_vi.csv
  locale_ja.csv
```

`LocaleManager.Initialize` accepts a resource prefix. Use `locale_` for the layout above or `Localization/locale_` when files live under `Assets/Resources/Localization/`.

Resources are appropriate for a small fixed language set. Do not use folder scanning as the source of truth at runtime; initialize with an explicit supported-code list. For large or downloadable language packs, replace the loader with Addressables or the installed localization system.

## Table schema

Use two columns named `Key` and `Text`:

```csv
"Key","Text"
"menu.start","Start"
"shop.gold_amount","You have {0:N0} gold"
"shop.confirm","Buy {0} for {1:N0} gold?"
```

Vietnamese:

```csv
"Key","Text"
"menu.start","Bắt đầu"
"shop.gold_amount","Bạn có {0:N0} vàng"
"shop.confirm","Mua {0} với giá {1:N0} vàng?"
```

The bundled parser supports:

- comma-separated CSV or tab-separated TSV;
- UTF-8 text;
- comment lines beginning with `#`;
- quoted CSV cells;
- commas inside quoted cells;
- escaped quotes written as `""`.

It does not implement a full spreadsheet interchange standard. If translators require multiline quoted cells, metadata columns, Excel round-tripping, or complex escaping, reuse a proven CSV library or the project's existing import pipeline.

## Key conventions

Prefer stable semantic keys:

```text
menu.start
settings.language
shop.buy
shop.stat.damage
weapon.ak47.short_description
```

Avoid:

- source sentences as keys;
- hierarchy paths such as `Canvas/Panel/Button/Text`;
- numeric positions such as `button_3`;
- keys coupled to one current English wording;
- the same concept duplicated under unrelated spellings.

Choose one case convention and enforce it. The bundled table lookup is case-sensitive so accidental casing differences remain visible during development.

Keep localization keys in authored config when domain objects need localized names or descriptions. Resolve those keys at presentation time; do not write translated strings back into ScriptableObjects.

## Formatting placeholders

Keep placeholder identities consistent across languages:

```text
fallback: "Bought {0} for {1:N0} gold"
valid:    "Đã mua {0} với giá {1:N0} vàng"
invalid:  "Đã mua với giá {0} vàng"
```

Translators may reorder placeholders, but must not silently remove, add, or rename them unless the call site changes too.

Prefer format specifiers for numbers and dates:

```text
{0:N0}    grouped whole number
{0:P1}    percentage
{0:d}     short date
```

The active `CultureInfo` determines separators and date conventions. Avoid preformatting values with invariant culture before passing them to localized sentences unless the value is intentionally culture-neutral, such as an internal ID.

Pluralization cannot be solved reliably with a single `string.Format` template. Use Unity Localization Smart Strings or a purpose-built rule system when languages require plural categories.

## Fallback and missing data

Use one complete fallback table, normally the source language. Runtime resolution should be:

1. active translation;
2. fallback translation;
3. visible localization key.

The fallback table must still be validated. It is not acceptable for both active and fallback tables to omit a required key.

Decide how empty translations behave. The bundled validator treats empty text as an error because blank UI is usually worse than visible fallback. If blank text is intentional, model that presentation state explicitly rather than using an empty translation as a hidden control flag.

## Validation script

Use Python 3.8 or newer. On Windows, run `python --version` first because an existing `python` command may still resolve to Python 2.

Run the fallback table first, followed by every translation:

```powershell
python scripts/validate_locale_tables.py `
  Assets/Resources/locale_en.csv `
  Assets/Resources/locale_vi.csv
```

The script checks:

- required `Key` and `Text` columns;
- duplicate and blank keys;
- blank translations;
- keys missing from or added beyond the fallback table;
- format-placeholder signature mismatches.

It exits nonzero on errors so it can run in CI or a pre-build validation step. Additional keys are reported because they often indicate the fallback source table was not updated.

For every locale file under one folder:

```powershell
$tables = Get-ChildItem Assets/Resources/Localization/locale_*.csv |
  Sort-Object Name |
  Select-Object -ExpandProperty FullName
python scripts/validate_locale_tables.py @tables
```

Ensure the intended fallback file is the first argument rather than relying on alphabetical order.

## Authoring checklist

- Save every table as UTF-8.
- Keep one canonical language code per file and configuration entry.
- Keep identical key sets across languages.
- Keep placeholder signatures consistent.
- Avoid sentence-fragment concatenation.
- Verify commas and quotes through the actual runtime parser.
- Verify fonts contain all glyphs.
- Test longest translations at target aspect ratios and safe areas.
- Test missing-key visibility deliberately.
- Test language switching after dynamic lists are already visible.
- Re-run validation whenever source keys or formatted strings change.
