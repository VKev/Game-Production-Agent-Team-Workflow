using System;
using System.Linq;

internal class CommandScript : IRunCommand
{
    public void Execute(ExecutionResult result)
    {
        var assembly = AppDomain.CurrentDomain.GetAssemblies().Single(candidate => candidate.GetName().Name == "NuGetForUnity");
        var identifierType = assembly.GetType("NugetForUnity.Models.NugetPackageIdentifier", true);
        var installerType = assembly.GetType("NugetForUnity.NugetPackageInstaller", true);
        var identifier = Activator.CreateInstance(identifierType, new object[] { "ZLinq", "__ZLINQ_VERSION__" });
        identifierType.GetProperty("IsManuallyInstalled").SetValue(identifier, true, null);
        var install = installerType.GetMethods().Single(method => method.Name == "InstallIdentifier" &&
            method.IsPublic && method.IsStatic && method.GetParameters().Length == 4);
        var installed = (bool)install.Invoke(null, new object[] { identifier, true, false, true });
        result.Log("ZLinq core __ZLINQ_VERSION__ install returned: {0}", installed);
        if (!installed) result.LogError("NuGetForUnity did not install ZLinq __ZLINQ_VERSION__.");
    }
}
