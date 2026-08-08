namespace SimpleUI
{
    using System.Globalization;
    using System.Text.RegularExpressions;
    using UnityEngine;
    using UnityEngine.UI;

    /// <summary>
    /// Replaces legacy Text placeholders such as {{playerName}} or {{gold:N0}}.
    /// Replace Text with TMP_Text when the target project uses TextMeshPro.
    /// </summary>
    [RequireComponent(typeof(Text))]
    public class BindText : MonoBehaviour, IBindable
    {
        private static readonly Regex Placeholder = new Regex(@"\{\{[^}]*}}", RegexOptions.Compiled);

        private Text _text;
        private string _template;

        public void Bind(DataContext context)
        {
            CacheTemplate();

            _text.text = Placeholder.Replace(_template, match =>
            {
                var inner = match.Value.Substring(2, match.Value.Length - 4);
                var separatorIndex = inner.IndexOf(':');
                var key = separatorIndex < 0 ? inner : inner.Substring(0, separatorIndex);

                if (!context.ContainsKey(key))
                {
                    return match.Value;
                }

                var value = context[key];
                if (separatorIndex >= 0 && value is System.IFormattable formattable)
                {
                    var format = inner.Substring(separatorIndex + 1);
                    return formattable.ToString(format, CultureInfo.CurrentCulture);
                }

                return value?.ToString() ?? string.Empty;
            });
        }

        private void CacheTemplate()
        {
            if (_text != null)
            {
                return;
            }

            _text = GetComponent<Text>();
            _template = _text.text;
        }
    }
}
