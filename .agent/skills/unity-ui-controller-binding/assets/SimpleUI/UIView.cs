namespace SimpleUI
{
    using UnityEngine;

    /// <summary>
    /// Composition root and lifecycle owner for one bound screen subtree.
    /// </summary>
    public abstract class UIView : MonoBehaviour
    {
        private UIController _controller;
        private bool _initialized;

        public DataContext Context { get; private set; }

        protected virtual UIController CreateController()
        {
            return null;
        }

        private void Awake()
        {
            EnsureInitialized();
        }

        public void Show()
        {
            EnsureInitialized();
            gameObject.SetActive(true);

            var revisionBeforeShow = Context.Revision;
            _controller?.OnStart();
            OnShow();

            if (Context.Revision == revisionBeforeShow)
            {
                Context.RebindAll();
            }
        }

        public void Hide()
        {
            OnHide();
            _controller?.OnDispose();
            gameObject.SetActive(false);
        }

        private void Update()
        {
            if (_initialized && gameObject.activeInHierarchy)
            {
                _controller?.OnUpdate();
            }
        }

        private void EnsureInitialized()
        {
            if (_initialized)
            {
                return;
            }

            _initialized = true;
            Context = new DataContext();

            foreach (var bindable in GetComponentsInChildren<IBindable>(true))
            {
                Context.Register(bindable);
            }

            _controller = CreateController();
            _controller?.Attach(this);
            OnInit();
        }

        protected virtual void OnInit()
        {
        }

        protected virtual void OnShow()
        {
        }

        protected virtual void OnHide()
        {
        }
    }
}
