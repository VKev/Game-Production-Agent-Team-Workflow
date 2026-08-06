namespace SimpleLocalization
{
    using System;
    using UnityEngine;
    using UnityEngine.UI;

    /// <summary>
    /// Refreshes one legacy uGUI Text whenever the active language changes.
    /// Replace Text with TMP_Text when the target project uses TextMeshPro.
    /// </summary>
    [DisallowMultipleComponent]
    [RequireComponent(typeof(Text))]
    public sealed class LocalizedText : MonoBehaviour
    {
        [SerializeField] private string key;
        [SerializeField] private string prefix = string.Empty;
        [SerializeField] private string suffix = string.Empty;

        private Text _text;
        private object[] _formatArguments = Array.Empty<object>();

        public string Key
        {
            get => key;
            set => SetKey(value);
        }

        private void Awake()
        {
            CacheText();
        }

        private void OnEnable()
        {
            LocaleManager.OnLanguageChanged += Refresh;
            Refresh();
        }

        private void OnDisable()
        {
            LocaleManager.OnLanguageChanged -= Refresh;
        }

        public void SetKey(string localizationKey, string literalPrefix = "", string literalSuffix = "")
        {
            key = localizationKey;
            prefix = literalPrefix ?? string.Empty;
            suffix = literalSuffix ?? string.Empty;
            Refresh();
        }

        public void SetFormatArguments(params object[] arguments)
        {
            _formatArguments = arguments ?? Array.Empty<object>();
            Refresh();
        }

        public void Refresh()
        {
            CacheText();
            if (_text == null || string.IsNullOrEmpty(key))
            {
                return;
            }

            var value = _formatArguments.Length == 0
                ? LocaleManager.Get(key)
                : LocaleManager.Get(key, _formatArguments);

            _text.text = prefix + value + suffix;
        }

        private void CacheText()
        {
            if (_text == null)
            {
                _text = GetComponent<Text>();
            }
        }
    }
}
