using System;
using System.Collections;
using System.Linq;

internal class CommandScript : IRunCommand
{
    public void Execute(ExecutionResult result)
    {
        var assembly = AppDomain.CurrentDomain.GetAssemblies().Single(candidate => candidate.GetName().Name == "NuGetForUnity");
        var managerType = assembly.GetType("NugetForUnity.InstalledPackagesManager", true);
        var installed = (IEnumerable)managerType.GetProperty("InstalledPackages").GetValue(null, null);
        object match = null;
        foreach (var package in installed)
        {
            var id = (string)package.GetType().GetProperty("Id").GetValue(package, null);
            if (string.Equals(id, "ZLinq", StringComparison.OrdinalIgnoreCase)) { match = package; break; }
        }
        if (match == null)
        {
            result.LogError("InstalledPackagesManager did not report ZLinq.");
            return;
        }
        var version = match.GetType().GetProperty("Version").GetValue(match, null);
        var manual = match.GetType().GetProperty("IsManuallyInstalled").GetValue(match, null);
        result.Log("InstalledPackagesManager: ZLinq {0}, manual={1}", version, manual);
    }
}
