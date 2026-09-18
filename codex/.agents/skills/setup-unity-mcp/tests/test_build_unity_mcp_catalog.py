import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "build_unity_mcp_catalog.py"
SPEC = importlib.util.spec_from_file_location("catalog", SCRIPT)
catalog = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(catalog)


class CatalogTests(unittest.TestCase):
    def test_name_policy_is_deterministic(self):
        self.assertEqual(catalog.expose_name("Unity.ManageScene"), "Unity_ManageScene")
        long_name = "Unity." + "VeryLongToolSegment" * 4
        exposed = catalog.expose_name(long_name)
        self.assertEqual(len(exposed), 42)
        self.assertRegex(exposed, r"_[0-9a-f]{8}$")
        self.assertEqual(exposed, catalog.expose_name(long_name))

    def test_source_discovery_and_exact_live_comparison(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            tools = root / "Modules" / "Unity.AI.MCP.Editor" / "Tools"
            tools.mkdir(parents=True)
            native = "\n".join(
                f'[McpTool("Unity.Native{i}", "description", Groups = new string[] {{ "core" }})] public static object T{i}(object p) => p;'
                for i in range(20)
            )
            (tools / "Native.cs").write_text(native, encoding="utf-8")
            (tools / "DefaultNative.cs").write_text(
                '[McpTool("Unity.DefaultNative", "description", EnabledByDefault = true)] '
                'public static object DefaultNative(object p) => p;',
                encoding="utf-8",
            )
            adapted_dir = root / "Modules" / "Unity.AI.Assistant.Tools"
            adapted_dir.mkdir(parents=True)
            adapted = "\n".join(
                f'[AgentTool("description", "Unity.Adapted{i}")]\n[AgentToolSettings(mcp: McpAvailability.Default)] public static object A{i}() => null;'
                for i in range(10)
            )
            (adapted_dir / "Adapted.cs").write_text(adapted, encoding="utf-8")
            discovered = catalog.discover_official_tools(root)
            self.assertEqual(sum(item["kind"] == "mcp-native" for item in discovered), 21)
            self.assertEqual(sum(item["kind"] == "assistant-adapted" for item in discovered), 10)
            native_defaults = {
                item["source_name"]: item["enabled_by_default_from_source"]
                for item in discovered
                if item["kind"] == "mcp-native"
            }
            self.assertFalse(native_defaults["Unity.Native0"])
            self.assertTrue(native_defaults["Unity.DefaultNative"])
            schema = {
                "type": "object",
                "properties": {
                    "id": {"type": "integer", "default": 1},
                    "mode": {"type": "string", "enum": ["read", "write"]},
                },
                "required": ["id"],
            }
            live = [
                catalog.normalize_live(
                    {
                        "Info": {"name": item["exposed_name"], "inputSchema": schema, "outputSchema": None},
                        "Groups": item["groups_from_source"],
                        "IsEnabled": True,
                        "IsDefault": item["enabled_by_default_from_source"],
                    }
                )
                for item in discovered
            ]
            custom = catalog.normalize_live(
                {
                    "Info": {"name": "Project_CustomTool", "inputSchema": schema, "outputSchema": {"type": "object"}},
                    "Groups": ["project"],
                    "IsEnabled": True,
                    "IsDefault": False,
                }
            )
            live.append(custom)
            client = [catalog.normalize_live({"name": item["name"], "inputSchema": schema, "outputSchema": None}) for item in live]
            client[-1] = catalog.normalize_live(
                {"name": custom["name"], "inputSchema": schema, "outputSchema": {"type": "object"}}
            )
            self.assertEqual(catalog.compare(discovered, live, client)["status"], "complete")
            client[0]["input_schema"] = {"type": "object"}
            client[0]["input_schema_sha256"] = catalog.canonical_hash(client[0]["input_schema"])
            self.assertEqual(catalog.compare(discovered, live, client)["status"], "skill-surface-drift")

            native_index = next(index for index, item in enumerate(discovered) if item["groups_from_source"])
            client[native_index] = catalog.normalize_live(
                {"name": live[native_index]["name"], "inputSchema": schema, "outputSchema": None}
            )
            live[native_index]["groups"] = ["wrong-group"]
            comparison = catalog.compare(discovered, live, client)
            self.assertEqual(comparison["status"], "skill-surface-drift")
            self.assertEqual(comparison["source_metadata_mismatches"][0]["field"], "groups")

    def test_resource_path_rejects_escape(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            (root / "Assets").mkdir()
            self.assertEqual(catalog.normalize_project_resource("unity://path/Assets/Test.cs", root), "Assets/Test.cs")
            self.assertEqual(catalog.normalize_project_resource("script-edits", root), "script-edits")
            with self.assertRaises(ValueError):
                catalog.normalize_project_resource("unity://path/Assets/%2e%2e/%2e%2e/secret.txt", root)


if __name__ == "__main__":
    unittest.main()
