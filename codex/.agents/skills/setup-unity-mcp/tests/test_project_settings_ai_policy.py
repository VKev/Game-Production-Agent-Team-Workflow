import importlib.util
import json
from pathlib import Path
import tempfile
import unittest


ROOT = Path(__file__).parents[1]
DEV_SKILL = ROOT.parent / "dev-unity-mcp"
SETUP_AGENT = ROOT.parents[2] / ".codex" / "agents" / "setup_agents.toml"
INSPECTOR = ROOT / "scripts" / "inspect_unity_mcp_settings.py"


def load_inspector():
    spec = importlib.util.spec_from_file_location("inspect_unity_mcp_settings", INSPECTOR)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


class ProjectSettingsPolicyTests(unittest.TestCase):
    def test_policy_routes_only_unity_mcp_server_to_codex_setup(self) -> None:
        policy = (ROOT / "references" / "project-settings-ai.md").read_text(
            encoding="utf-8"
        )
        for label in (
            "**Assistant**",
            "**Assistant MCP Extensions**",
            "**Gateway**",
            "**UI**",
            "**Unity MCP Server**",
        ):
            self.assertIn(label, policy)
        self.assertIn("registered_count = enabled_count = codex_visible_count", policy)
        self.assertIn("does not expose a public **Enable All** button", policy)

    def test_setup_requires_a_final_post_import_full_tool_gate(self) -> None:
        setup_skill = (ROOT / "SKILL.md").read_text(encoding="utf-8")
        setup_agent = SETUP_AGENT.read_text(encoding="utf-8")
        live_export = (
            DEV_SKILL / "references" / "live-registry-export.md"
        ).read_text(encoding="utf-8")

        self.assertNotIn("official Unity MCP **Enable All** control", setup_skill)
        self.assertIn("final pass is authoritative", setup_skill)
        self.assertIn("Then submit the checked-in MCP registry exporter", setup_agent)
        self.assertIn("Only after step 19 leaves no temporary source", setup_agent)
        self.assertIn("Only the second result is final", live_export)
        self.assertIn("operate UI through Computer Use", setup_agent)

    def test_inspector_detects_direction_and_public_controls(self) -> None:
        inspector = load_inspector()
        with tempfile.TemporaryDirectory() as directory:
            package = Path(directory)
            files = {
                "package.json": json.dumps(
                    {"name": "com.unity.ai.assistant", "version": "9.9.9-test.1"}
                ),
                "Editor/UI/Scripts/AssistantProjectSettingsProvider.cs": (
                    'new SettingsProvider("Project/AI/Assistant", SettingsScope.Project) '
                    '{ label = "Assistant" };'
                ),
                "Editor/UI/Scripts/McpClientSettingsProvider.cs": (
                    'const string k_SettingsPath = "Project/AI/Assistant MCP Extensions"; '
                    "new SettingsProvider(k_SettingsPath, SettingsScope.Project) "
                    '{ label = "Assistant MCP Extensions" };'
                ),
                "Editor/UI/Scripts/GatewayProjectSettingsProvider.cs": (
                    'new SettingsProvider("Project/AI/Gateway", SettingsScope.Project) '
                    '{ label = "Gateway" };'
                ),
                "Editor/UI/AssistantUISettingsProvider.cs": (
                    'new SettingsProvider("Project/AI/UI", SettingsScope.Project) '
                    '{ label = "UI" };'
                ),
                "Modules/Unity.AI.MCP.Editor/Settings/UI/MCPSettingsProvider.cs": (
                    "return new MCPSettingsProvider(MCPConstants.projectSettingsPath);"
                ),
                "Modules/Unity.AI.MCP.Editor/Settings/MCPConstants.cs": (
                    'public const string projectSettingsPath = "Project/AI/Unity MCP Server";'
                ),
                "Modules/Unity.AI.MCP.Editor/Settings/MCPSettings.cs": (
                    "public bool bridgeEnabled = true;\n"
                    "public bool autoApproveInBatchMode = true;\n"
                    "public string validationLevel = ToolDescriptions.ValidationLevels[1];\n"
                    "public void EnableAllTools() {}\n"
                ),
                "Modules/Unity.AI.MCP.Editor/Settings/UI/MCPSettingsPanel.uxml": (
                    '<ui:UXML xmlns:ui="UnityEngine.UIElements">'
                    '<ui:Button name="resetToolsButton" text="Reset to Defaults" />'
                    "</ui:UXML>"
                ),
                "Modules/Unity.AI.MCP.Editor/Settings/UI/ToolItemControl.uxml": (
                    '<ui:UXML xmlns:ui="UnityEngine.UIElements">'
                    '<ui:Toggle name="toolItemCheckbox" />'
                    "</ui:UXML>"
                ),
                "Modules/Unity.AI.MCP.Editor/Tools/RunCommand.cs": (
                    '[McpTool("Unity.RunCommand", Groups = new string[] { "core" }, '
                    "EnabledByDefault = true)] public static void HandleCommand() {}"
                ),
                "CHANGELOG.md": (
                    "MCP and gateway connections are no longer capped or gated by "
                    "entitlement limits"
                ),
            }
            for relative, content in files.items():
                path = package / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(content, encoding="utf-8")

            payload = inspector.inspect(package)
            pages = {entry["key"]: entry for entry in payload["pages"]}
            self.assertEqual(pages["unity_mcp_server"]["codex_policy"], "configure")
            self.assertTrue(
                all(
                    entry["codex_policy"] == "preserve"
                    for key, entry in pages.items()
                    if key != "unity_mcp_server"
                )
            )
            controls = payload["unity_mcp_server"]["controls"]
            self.assertFalse(controls["public_enable_all"])
            self.assertTrue(controls["per_tool_checkbox"])
            self.assertTrue(payload["unity_mcp_server"]["run_command_enabled_by_default"])


if __name__ == "__main__":
    unittest.main()
