namespace SimpleUI
{
    /// <summary>
    /// Renders one concern from a DataContext into Unity UI.
    /// </summary>
    public interface IBindable
    {
        void Bind(DataContext context);
    }
}
