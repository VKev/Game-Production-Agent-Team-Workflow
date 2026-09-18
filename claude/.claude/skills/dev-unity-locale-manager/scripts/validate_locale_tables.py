#!/usr/bin/env python3
"""Validate locale CSV/TSV schema, key parity, and format placeholders."""

from __future__ import annotations

import argparse
import csv
import string
import sys
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Counter as CounterType
from typing import Dict, Iterable, List, Optional, Tuple


@dataclass
class LocaleTable:
    path: Path
    entries: Dict[str, str]
    placeholders: Dict[str, CounterType[Tuple[str, str, str]]]


def data_lines(path: Path) -> List[str]:
    lines = path.read_text(encoding="utf-8-sig").splitlines(keepends=True)
    return [line for line in lines if line.strip() and not line.lstrip().startswith("#")]


def find_column(fieldnames: Iterable[Optional[str]], expected: str) -> Optional[str]:
    for fieldname in fieldnames:
        if fieldname is not None and fieldname.strip().casefold() == expected.casefold():
            return fieldname
    return None


def placeholder_signature(text: str) -> CounterType[Tuple[str, str, str]]:
    signature: CounterType[Tuple[str, str, str]] = Counter()
    for _, field_name, format_spec, conversion in string.Formatter().parse(text):
        if field_name is not None:
            signature[(field_name, format_spec or "", conversion or "")] += 1
    return signature


def load_table(path: Path, errors: List[str]) -> LocaleTable:
    lines = data_lines(path)
    if not lines:
        errors.append(f"{path}: table is empty")
        return LocaleTable(path, {}, {})

    delimiter = "\t" if "\t" in lines[0] else ","
    reader = csv.DictReader(lines, delimiter=delimiter)
    key_column = find_column(reader.fieldnames or [], "Key")
    text_column = find_column(reader.fieldnames or [], "Text")
    if key_column is None or text_column is None:
        errors.append(f"{path}: header must contain Key and Text columns")
        return LocaleTable(path, {}, {})

    entries: Dict[str, str] = {}
    placeholders: Dict[str, CounterType[Tuple[str, str, str]]] = {}
    first_rows: Dict[str, int] = {}

    for row_number, row in enumerate(reader, start=2):
        key = (row.get(key_column) or "").strip()
        text = (row.get(text_column) or "").strip()
        if not key:
            errors.append(f"{path}:{row_number}: blank key")
            continue
        if key in entries:
            errors.append(
                f"{path}:{row_number}: duplicate key {key!r} "
                f"(first seen at row {first_rows[key]})"
            )
        if not text:
            errors.append(f"{path}:{row_number}: blank translation for {key!r}")

        entries[key] = text
        first_rows.setdefault(key, row_number)
        try:
            placeholders[key] = placeholder_signature(text)
        except ValueError as exception:
            errors.append(f"{path}:{row_number}: invalid format string for {key!r}: {exception}")
            placeholders[key] = Counter()

    return LocaleTable(path, entries, placeholders)


def compare_to_fallback(
    fallback: LocaleTable,
    translation: LocaleTable,
    errors: List[str],
) -> None:
    fallback_keys = set(fallback.entries)
    translated_keys = set(translation.entries)

    for key in sorted(fallback_keys - translated_keys):
        errors.append(f"{translation.path}: missing fallback key {key!r}")
    for key in sorted(translated_keys - fallback_keys):
        errors.append(f"{translation.path}: extra key not present in fallback: {key!r}")

    for key in sorted(fallback_keys & translated_keys):
        expected = fallback.placeholders.get(key, Counter())
        actual = translation.placeholders.get(key, Counter())
        if expected != actual:
            errors.append(
                f"{translation.path}: placeholder mismatch for {key!r}; "
                f"expected {dict(expected)}, found {dict(actual)}"
            )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate locale tables; pass the fallback table first."
    )
    parser.add_argument("tables", nargs="+", type=Path)
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    errors: List[str] = []

    missing_paths = [path for path in args.tables if not path.is_file()]
    for path in missing_paths:
        errors.append(f"{path}: file does not exist")

    tables = [load_table(path, errors) for path in args.tables if path.is_file()]
    if tables:
        fallback = tables[0]
        for translation in tables[1:]:
            compare_to_fallback(fallback, translation, errors)

    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        print(f"Locale validation failed with {len(errors)} error(s).", file=sys.stderr)
        return 1

    total_keys = len(tables[0].entries) if tables else 0
    print(f"Locale validation passed: {len(tables)} table(s), {total_keys} fallback key(s).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
