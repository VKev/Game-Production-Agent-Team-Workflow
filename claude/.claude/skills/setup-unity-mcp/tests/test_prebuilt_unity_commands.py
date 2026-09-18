from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


SKILLS = Path(__file__).parents[2]

COMMON_STUBS = r"""
internal interface IRunCommand
{
    void Execute(ExecutionResult result);
}

internal sealed class ExecutionResult
{
    public void Log(string format, params object[] args) { }
    public void LogError(string format, params object[] args) { }
}
"""

MCP_STUBS = COMMON_STUBS + r"""
namespace Unity.AI.Assistant.Agent.Dynamic.Extension.Editor { }

namespace Unity.AI.MCP.Editor.ToolRegistry
{
    internal sealed class ToolInfo
    {
        public string name = "";
        public string title = "";
        public string description = "";
        public object inputSchema = new object();
        public object outputSchema = new object();
        public object annotations = new object();
    }

    internal sealed class RegisteredTool
    {
        public ToolInfo Info = new ToolInfo();
        public bool IsEnabled;
        public bool IsDefault;
        public string[] Groups = System.Array.Empty<string>();
    }

    internal static class McpToolRegistry
    {
        public static RegisteredTool[] GetAllToolsForSettings() => System.Array.Empty<RegisteredTool>();
        public static ToolInfo[] GetAvailableTools(bool ignoreEnableState) => System.Array.Empty<ToolInfo>();
        public static ToolInfo[] GetAvailableTools() => System.Array.Empty<ToolInfo>();
    }
}

namespace UnityEngine
{
    internal static class Application
    {
        public static string dataPath => "Assets";
    }
}
"""

DOTWEEN_STUBS = COMMON_STUBS + r"""
namespace UnityEngine
{
    internal class Object { }
}

namespace UnityEditor
{
    internal static class AssetDatabase
    {
        public static bool IsValidFolder(string path) => true;
        public static string CreateFolder(string parent, string name) => "";
        public static void SaveAssets() { }
        public static void Refresh() { }
        public static string GetAssetPath(UnityEngine.Object asset) => "";
        public static string[] FindAssets(string filter) => System.Array.Empty<string>();
        public static string GUIDToAssetPath(string guid) => "";
    }

    internal static class EditorUtility
    {
        public static void SetDirty(UnityEngine.Object asset) { }
    }
}
"""


class PrebuiltUnityCommandTests(unittest.TestCase):
    @staticmethod
    def compile_command(path: Path, stubs: str) -> None:
        dotnet = shutil.which("dotnet")
        if dotnet is None:
            raise unittest.SkipTest("dotnet SDK is unavailable")

        source = path.read_text(encoding="utf-8").replace("__ZLINQ_VERSION__", "1.5.6")
        project = """<Project Sdk=\"Microsoft.NET.Sdk\">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <OutputType>Library</OutputType>
    <ImplicitUsings>disable</ImplicitUsings>
    <Nullable>disable</Nullable>
    <LangVersion>12.0</LangVersion>
  </PropertyGroup>
</Project>
"""
        with tempfile.TemporaryDirectory(prefix="unity-command-compile-") as temporary:
            root = Path(temporary)
            (root / "Command.cs").write_text(source + "\n" + stubs, encoding="utf-8")
            (root / "Command.csproj").write_text(project, encoding="utf-8")
            completed = subprocess.run(
                [
                    dotnet,
                    "build",
                    "Command.csproj",
                    "--nologo",
                    "--verbosity",
                    "quiet",
                    "--disable-build-servers",
                    "-p:RestoreIgnoreFailedSources=true",
                ],
                cwd=root,
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
            )
            if completed.returncode != 0:
                output = "\n".join(part for part in (completed.stdout, completed.stderr) if part)
                raise AssertionError(f"{path.name} failed C# compilation:\n{output}")

    def test_registry_export_uses_verified_public_surface_without_newtonsoft(self) -> None:
        source = (SKILLS / "setup-unity-mcp" / "assets" / "unity-commands" / "export-live-registry.cs").read_text(encoding="utf-8")
        self.assertNotIn("Newtonsoft", source)
        self.assertIn("GetAllToolsForSettings()", source)
        self.assertIn("tool.Info.name", source)
        self.assertIn("registered.Length", source)
        self.assertIn("unity-registry.json", source)
        self.assertIn("File.WriteAllBytes", source)

    def test_dotween_commands_are_checked_in_and_exact_api_bounded(self) -> None:
        configure = (SKILLS / "setup-unity-packages" / "assets" / "unity-commands" / "configure-dotween.cs").read_text(encoding="utf-8")
        verify = (SKILLS / "setup-unity-packages" / "assets" / "unity-commands" / "verify-dotween.cs").read_text(encoding="utf-8")
        self.assertIn('GetName().Name == "DOTweenEditor"', configure)
        self.assertIn('"ApplyModulesSettings"', configure)
        self.assertIn('"ApplyASMDEFSettings"', configure)
        self.assertIn('"DOTweenSetupRequired"', verify)

    def test_zlinq_installer_has_one_version_placeholder_and_exact_public_shape(self) -> None:
        source = (SKILLS / "setup-unity-zlinq" / "assets" / "unity-commands" / "install-zlinq-core.cs").read_text(encoding="utf-8")
        self.assertEqual(source.count("__ZLINQ_VERSION__"), 3)
        self.assertIn('GetName().Name == "NuGetForUnity"', source)
        self.assertIn("method.GetParameters().Length == 4", source)
        self.assertNotIn("using NugetForUnity", source)

    def test_all_prebuilt_commands_compile_with_their_declared_host_surface(self) -> None:
        commands = (
            (SKILLS / "setup-unity-mcp" / "assets" / "unity-commands" / "export-live-registry.cs", MCP_STUBS),
            (SKILLS / "setup-unity-packages" / "assets" / "unity-commands" / "configure-dotween.cs", DOTWEEN_STUBS),
            (SKILLS / "setup-unity-packages" / "assets" / "unity-commands" / "verify-dotween.cs", DOTWEEN_STUBS),
            (SKILLS / "setup-unity-zlinq" / "assets" / "unity-commands" / "install-zlinq-core.cs", COMMON_STUBS),
            (SKILLS / "setup-unity-zlinq" / "assets" / "unity-commands" / "verify-zlinq-core.cs", COMMON_STUBS),
        )
        for path, stubs in commands:
            with self.subTest(command=path.name):
                self.compile_command(path, stubs)


if __name__ == "__main__":
    unittest.main()
