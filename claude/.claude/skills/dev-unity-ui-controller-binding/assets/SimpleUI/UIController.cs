namespace SimpleUI
{
    /// <summary>
    /// Plain C# presentation controller for one UIView.
    /// </summary>
    public abstract class UIController
    {
        protected UIView View { get; private set; }
        protected DataContext Context => View.Context;

        internal void Attach(UIView view)
        {
            View = view;
        }

        /// <summary>Runs whenever the view is shown.</summary>
        public virtual void OnStart()
        {
        }

        /// <summary>Runs each frame while the view is active.</summary>
        public virtual void OnUpdate()
        {
        }

        /// <summary>Runs whenever the view is hidden.</summary>
        public virtual void OnDispose()
        {
        }
    }
}
