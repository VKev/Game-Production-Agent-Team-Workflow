namespace SimpleUI
{
    using UnityEngine;
    using UnityEngine.UI;

    /// <summary>
    /// Renders a Sprite, or a Resources path string, into an Image.
    /// </summary>
    [RequireComponent(typeof(Image))]
    public class BindImage : MonoBehaviour, IBindable
    {
        [Tooltip("DataContext key containing a Sprite or Resources path string.")]
        public string Key;

        [Tooltip("Clear the current sprite when the key is missing or has an unsupported value.")]
        public bool ClearWhenMissing;

        private Image _image;

        public void Bind(DataContext context)
        {
            if (_image == null)
            {
                _image = GetComponent<Image>();
            }

            if (string.IsNullOrEmpty(Key) || !context.ContainsKey(Key))
            {
                ClearIfRequested();
                return;
            }

            var value = context[Key];
            if (value is Sprite sprite)
            {
                _image.sprite = sprite;
                return;
            }

            if (value is string resourcePath && !string.IsNullOrEmpty(resourcePath))
            {
                _image.sprite = Resources.Load<Sprite>(resourcePath);
                return;
            }

            ClearIfRequested();
        }

        private void ClearIfRequested()
        {
            if (ClearWhenMissing)
            {
                _image.sprite = null;
            }
        }
    }
}
