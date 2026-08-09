namespace SimpleLocalization
{
    using System;
    using System.Collections.Generic;
    using System.Text;
    using UnityEngine;

    /// <summary>
    /// Immutable key-to-text table loaded from a two-column Resources CSV or TSV file.
    /// </summary>
    public sealed class LocaleTable
    {
        private readonly Dictionary<string, string> _entries;

        private LocaleTable(Dictionary<string, string> entries)
        {
            _entries = entries;
        }

        public bool TryGetText(string key, out string text)
        {
            if (key == null)
            {
                text = null;
                return false;
            }

            if (_entries.TryGetValue(key, out text) && !string.IsNullOrEmpty(text))
            {
                return true;
            }

            text = null;
            return false;
        }

        public static bool TryLoad(string resourceName, out LocaleTable table)
        {
            table = null;
            var asset = Resources.Load<TextAsset>(resourceName);
            if (asset == null)
            {
                Debug.LogError($"[Locale] Missing Resources table '{resourceName}'.");
                return false;
            }

            try
            {
                var entries = Parse(asset.text, resourceName);
                if (entries.Count == 0)
                {
                    Debug.LogError($"[Locale] Table '{resourceName}' contains no translations.");
                    return false;
                }

                table = new LocaleTable(entries);
                return true;
            }
            catch (Exception exception)
            {
                Debug.LogError($"[Locale] Could not parse '{resourceName}': {exception.Message}");
                return false;
            }
        }

        private static Dictionary<string, string> Parse(string source, string tableName)
        {
            var entries = new Dictionary<string, string>(StringComparer.Ordinal);
            if (string.IsNullOrEmpty(source))
            {
                return entries;
            }

            var lines = source.Replace("\r\n", "\n").Replace('\r', '\n').Split('\n');
            var separator = ',';
            var keyColumn = -1;
            var textColumn = -1;
            var hasHeader = false;

            for (var lineIndex = 0; lineIndex < lines.Length; lineIndex++)
            {
                var line = lines[lineIndex];
                if (string.IsNullOrWhiteSpace(line) || line.TrimStart().StartsWith("#", StringComparison.Ordinal))
                {
                    continue;
                }

                if (!hasHeader)
                {
                    separator = line.IndexOf('\t') >= 0 ? '\t' : ',';
                    var headers = SplitRow(line, separator);
                    keyColumn = FindColumn(headers, "Key");
                    textColumn = FindColumn(headers, "Text");
                    if (keyColumn < 0 || textColumn < 0)
                    {
                        throw new FormatException("The first data row must contain Key and Text columns.");
                    }

                    hasHeader = true;
                    continue;
                }

                var cells = SplitRow(line, separator);
                if (keyColumn >= cells.Count || textColumn >= cells.Count)
                {
                    Debug.LogWarning($"[Locale] Skipping incomplete row {lineIndex + 1} in '{tableName}'.");
                    continue;
                }

                var key = cells[keyColumn].Trim();
                if (string.IsNullOrEmpty(key))
                {
                    Debug.LogWarning($"[Locale] Skipping blank key at row {lineIndex + 1} in '{tableName}'.");
                    continue;
                }

                if (entries.ContainsKey(key))
                {
                    Debug.LogWarning($"[Locale] Duplicate key '{key}' at row {lineIndex + 1} in '{tableName}'; the last value wins.");
                }

                entries[key] = cells[textColumn].Trim();
            }

            if (!hasHeader)
            {
                throw new FormatException("The table has no Key,Text header row.");
            }

            return entries;
        }

        private static int FindColumn(IReadOnlyList<string> headers, string expectedName)
        {
            for (var index = 0; index < headers.Count; index++)
            {
                var header = headers[index].Trim().TrimStart('\uFEFF');
                if (string.Equals(header, expectedName, StringComparison.OrdinalIgnoreCase))
                {
                    return index;
                }
            }

            return -1;
        }

        private static List<string> SplitRow(string row, char separator)
        {
            if (separator == '\t')
            {
                return new List<string>(row.Split('\t'));
            }

            var cells = new List<string>();
            var cell = new StringBuilder();
            var quoted = false;

            for (var index = 0; index < row.Length; index++)
            {
                var character = row[index];
                if (character == '"')
                {
                    if (quoted && index + 1 < row.Length && row[index + 1] == '"')
                    {
                        cell.Append('"');
                        index++;
                    }
                    else
                    {
                        quoted = !quoted;
                    }
                }
                else if (character == separator && !quoted)
                {
                    cells.Add(cell.ToString());
                    cell.Clear();
                }
                else
                {
                    cell.Append(character);
                }
            }

            if (quoted)
            {
                throw new FormatException("A CSV row contains an unclosed quote.");
            }

            cells.Add(cell.ToString());
            return cells;
        }
    }
}
