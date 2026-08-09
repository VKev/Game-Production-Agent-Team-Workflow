namespace SimpleUI
{
    using System.Collections.Generic;

    /// <summary>
    /// Stores the current render snapshot for one view and refreshes its bindables.
    /// </summary>
    public class DataContext
    {
        private readonly Dictionary<string, object> _values = new Dictionary<string, object>();
        private readonly List<IBindable> _bindables = new List<IBindable>();

        /// <summary>
        /// Changes once per published update. UIView uses it to avoid an unnecessary
        /// second initial bind when a controller already publishes during Show.
        /// </summary>
        public int Revision { get; private set; }

        public object this[string key]
        {
            get => _values.TryGetValue(key, out var value) ? value : null;
            set => Set(key, value);
        }

        public bool ContainsKey(string key)
        {
            return _values.ContainsKey(key);
        }

        public void Register(IBindable bindable)
        {
            if (bindable != null && !_bindables.Contains(bindable))
            {
                _bindables.Add(bindable);
            }
        }

        public void Unregister(IBindable bindable)
        {
            _bindables.Remove(bindable);
        }

        public void Set(string key, object value)
        {
            _values[key] = value;
            Revision++;
            RebindAll();
        }

        public void SetRange(IDictionary<string, object> values)
        {
            foreach (var pair in values)
            {
                _values[pair.Key] = pair.Value;
            }

            Revision++;
            RebindAll();
        }

        public void RebindAll()
        {
            for (var index = _bindables.Count - 1; index >= 0; index--)
            {
                _bindables[index]?.Bind(this);
            }
        }
    }
}
