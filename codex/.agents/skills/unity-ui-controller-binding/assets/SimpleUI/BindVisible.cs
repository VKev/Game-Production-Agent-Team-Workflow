namespace SimpleUI
{
    using UnityEngine;

    /// <summary>
    /// Toggles this GameObject from a Boolean DataContext value.
    /// </summary>
    public class BindVisible : MonoBehaviour, IBindable
    {
        [Tooltip("Boolean DataContext key controlling visibility.")]
        public string Key;

        [Tooltip("Invert the bound Boolean value.")]
        public bool Invert;

        public void Bind(DataContext context)
        {
            if (string.IsNullOrEmpty(Key) || !context.ContainsKey(Key))
            {
                return;
            }

            var visible = context[Key] is bool value && value;
            if (Invert)
            {
                visible = !visible;
            }

            if (gameObject.activeSelf != visible)
            {
                gameObject.SetActive(visible);
            }
        }
    }
}
