namespace SimpleUI
{
    using System.Collections;
    using System.Collections.Generic;
    using UnityEngine;

    /// <summary>
    /// Rebuilds a short prefab list and gives every row its own DataContext.
    /// Use pooling or recycled scrolling for large or frequently updated lists.
    /// </summary>
    public class BindList : MonoBehaviour, IBindable
    {
        [Tooltip("DataContext key containing an enumerable of row dictionaries.")]
        public string Key;

        [Tooltip("Prefab instantiated once for every source element.")]
        public GameObject ItemPrefab;

        [Tooltip("Parent transform for generated rows.")]
        public Transform Container;

        private readonly List<GameObject> _spawned = new List<GameObject>();

        public void Bind(DataContext context)
        {
            if (ItemPrefab == null || Container == null)
            {
                return;
            }

            ClearSpawned();

            if (string.IsNullOrEmpty(Key) || !context.ContainsKey(Key))
            {
                return;
            }

            var source = context[Key];
            if (source is string || !(source is IEnumerable items))
            {
                return;
            }

            foreach (var element in items)
            {
                var instance = Instantiate(ItemPrefab, Container);
                instance.transform.SetSiblingIndex(_spawned.Count);
                instance.SetActive(true);
                _spawned.Add(instance);

                var itemContext = new DataContext();
                foreach (var bindable in instance.GetComponentsInChildren<IBindable>(true))
                {
                    itemContext.Register(bindable);
                }

                if (element is IDictionary<string, object> row)
                {
                    itemContext.SetRange(row);
                }
                else
                {
                    itemContext.Set("value", element);
                }
            }
        }

        private void ClearSpawned()
        {
            foreach (var instance in _spawned)
            {
                if (instance != null)
                {
                    Destroy(instance);
                }
            }

            _spawned.Clear();
        }
    }
}
