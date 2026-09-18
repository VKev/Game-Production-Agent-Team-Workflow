namespace SimpleLocalization
{
    using System;
    using System.Collections.Generic;
    using System.Globalization;
    using UnityEngine;

    /// <summary>
    /// Application-level language selection, cached lookup, fallback, and notification.
    /// Initialize once before the first localized screen appears.
    /// </summary>
    public static class LocaleManager
    {
        private const string PreferenceKey = "locale.language";

        private static readonly Dictionary<string, LocaleTable> Tables =
            new Dictionary<string, LocaleTable>(StringComparer.OrdinalIgnoreCase);

        private static readonly List<string> Languages = new List<string>();
        private static readonly IReadOnlyList<string> ReadOnlyLanguages = Languages.AsReadOnly();

        private static LocaleTable _currentTable;
        private static string _defaultLanguage;
        private static string _fallbackLanguage;
        private static string _resourcePrefix = "locale_";
        private static bool _persistSelection;
        private static bool _initialized;
        private static bool _warnedNotInitialized;
        private static CultureInfo _currentCulture = CultureInfo.InvariantCulture;

        public static string CurrentLanguage { get; private set; }
        public static string DefaultLanguage => _defaultLanguage;
        public static string FallbackLanguage => _fallbackLanguage;
        public static CultureInfo CurrentCulture => _currentCulture;
        public static IReadOnlyList<string> SupportedLanguages => ReadOnlyLanguages;

        public static event Action OnLanguageChanged;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.SubsystemRegistration)]
        private static void ResetStaticState()
        {
            Tables.Clear();
            Languages.Clear();
            _currentTable = null;
            _defaultLanguage = null;
            _fallbackLanguage = null;
            _resourcePrefix = "locale_";
            _persistSelection = false;
            _initialized = false;
            _warnedNotInitialized = false;
            _currentCulture = CultureInfo.InvariantCulture;
            CurrentLanguage = null;
            OnLanguageChanged = null;
        }

        public static bool Initialize(
            IEnumerable<string> supportedLanguages,
            string defaultLanguage,
            string fallbackLanguage = null,
            string resourcePrefix = "locale_",
            bool persistSelection = true)
        {
            Tables.Clear();
            Languages.Clear();
            _currentTable = null;
            CurrentLanguage = null;
            _warnedNotInitialized = false;

            if (supportedLanguages != null)
            {
                foreach (var language in supportedLanguages)
                {
                    var code = language?.Trim();
                    if (string.IsNullOrEmpty(code) || ResolveSupportedCode(code) != null)
                    {
                        continue;
                    }

                    Languages.Add(code);
                }
            }

            if (Languages.Count == 0)
            {
                _initialized = false;
                Debug.LogError("[Locale] Initialize requires at least one supported language.");
                return false;
            }

            _defaultLanguage = ResolveSupportedCode(defaultLanguage) ?? Languages[0];
            _fallbackLanguage = ResolveSupportedCode(fallbackLanguage) ?? _defaultLanguage;
            _resourcePrefix = string.IsNullOrWhiteSpace(resourcePrefix) ? "locale_" : resourcePrefix.Trim();
            _persistSelection = persistSelection;
            _initialized = true;

            if (!TryGetTable(_fallbackLanguage, out _))
            {
                _initialized = false;
                Debug.LogError($"[Locale] Fallback language table '{_fallbackLanguage}' could not be loaded.");
                return false;
            }

            var candidates = new List<string>();
            if (_persistSelection)
            {
                AddCandidate(candidates, PlayerPrefs.GetString(PreferenceKey, null));
            }

            AddCandidate(candidates, _defaultLanguage);
            AddCandidate(candidates, _fallbackLanguage);
            foreach (var language in Languages)
            {
                AddCandidate(candidates, language);
            }

            foreach (var candidate in candidates)
            {
                if (!TrySetLanguage(candidate, notify: false))
                {
                    continue;
                }

                OnLanguageChanged?.Invoke();
                return true;
            }

            _initialized = false;
            Debug.LogError("[Locale] None of the supported language tables could be loaded.");
            return false;
        }

        public static bool SetLanguage(string languageCode)
        {
            return TrySetLanguage(languageCode, notify: true);
        }

        public static void Refresh()
        {
            if (_initialized)
            {
                OnLanguageChanged?.Invoke();
            }
        }

        public static bool IsSupported(string languageCode)
        {
            return ResolveSupportedCode(languageCode) != null;
        }

        public static string Get(string key)
        {
            if (string.IsNullOrEmpty(key))
            {
                return string.Empty;
            }

            if (!_initialized || _currentTable == null)
            {
                if (!_warnedNotInitialized)
                {
                    _warnedNotInitialized = true;
                    Debug.LogWarning("[Locale] LocaleManager has not been initialized; returning visible keys.");
                }

                return key;
            }

            if (_currentTable.TryGetText(key, out var text))
            {
                return text;
            }

            if (!string.Equals(CurrentLanguage, _fallbackLanguage, StringComparison.OrdinalIgnoreCase) &&
                TryGetTable(_fallbackLanguage, out var fallbackTable) &&
                fallbackTable.TryGetText(key, out text))
            {
                return text;
            }

            return key;
        }

        public static string Get(string key, params object[] arguments)
        {
            var template = Get(key);
            if (arguments == null || arguments.Length == 0)
            {
                return template;
            }

            try
            {
                return string.Format(_currentCulture, template, arguments);
            }
            catch (FormatException exception)
            {
                Debug.LogError($"[Locale] Invalid format for key '{key}' in '{CurrentLanguage}': {exception.Message}");
                return template;
            }
        }

        private static bool TrySetLanguage(string languageCode, bool notify)
        {
            if (!_initialized)
            {
                Debug.LogError("[Locale] Call Initialize before SetLanguage.");
                return false;
            }

            var canonicalCode = ResolveSupportedCode(languageCode);
            if (canonicalCode == null)
            {
                Debug.LogWarning($"[Locale] Unsupported language '{languageCode}'.");
                return false;
            }

            if (string.Equals(CurrentLanguage, canonicalCode, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }

            if (!TryGetTable(canonicalCode, out var table))
            {
                return false;
            }

            _currentTable = table;
            CurrentLanguage = canonicalCode;
            _currentCulture = ResolveCulture(canonicalCode);

            if (_persistSelection)
            {
                PlayerPrefs.SetString(PreferenceKey, canonicalCode);
            }

            if (notify)
            {
                OnLanguageChanged?.Invoke();
            }

            return true;
        }

        private static bool TryGetTable(string languageCode, out LocaleTable table)
        {
            if (Tables.TryGetValue(languageCode, out table))
            {
                return true;
            }

            if (!LocaleTable.TryLoad(_resourcePrefix + languageCode, out table))
            {
                return false;
            }

            Tables[languageCode] = table;
            return true;
        }

        private static string ResolveSupportedCode(string languageCode)
        {
            if (string.IsNullOrWhiteSpace(languageCode))
            {
                return null;
            }

            foreach (var supportedLanguage in Languages)
            {
                if (string.Equals(supportedLanguage, languageCode.Trim(), StringComparison.OrdinalIgnoreCase))
                {
                    return supportedLanguage;
                }
            }

            return null;
        }

        private static void AddCandidate(ICollection<string> candidates, string languageCode)
        {
            var canonicalCode = ResolveSupportedCode(languageCode);
            if (canonicalCode == null)
            {
                return;
            }

            foreach (var candidate in candidates)
            {
                if (string.Equals(candidate, canonicalCode, StringComparison.OrdinalIgnoreCase))
                {
                    return;
                }
            }

            candidates.Add(canonicalCode);
        }

        private static CultureInfo ResolveCulture(string languageCode)
        {
            try
            {
                return CultureInfo.GetCultureInfo(languageCode.Replace('_', '-'));
            }
            catch (CultureNotFoundException)
            {
                return CultureInfo.InvariantCulture;
            }
        }
    }
}
