import json
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).parents[1]
INSPECTOR = ROOT / "scripts" / "inspect_cocos_setup_state.ps1"


def _cocos_project(root: Path, creator_version: str = "3.8.8") -> None:
    (root / "assets" / "scripts").mkdir(parents=True)
    (root / "settings" / "v2" / "packages").mkdir(parents=True)
    (root / "package.json").write_text(
        json.dumps({"name": "demo", "creator": {"version": creator_version}}),
        encoding="utf-8",
    )
    (root / "tsconfig.json").write_text("{}", encoding="utf-8")
    (root / "settings" / "v2" / "packages" / "project.json").write_text(
        json.dumps({"general": {"startScene": "626242e7-577e-505b-964c-570f4b31b5ac"}}),
        encoding="utf-8",
    )


def _bundle_meta(root: Path, folder: str, bundle_name: str) -> None:
    (root / "assets" / folder).mkdir(parents=True, exist_ok=True)
    (root / "assets" / f"{folder}.meta").write_text(
        json.dumps(
            {
                "ver": "1.2.0",
                "importer": "directory",
                "imported": True,
                "uuid": "67dd238f-11c5-467b-a294-999f9164a7c7",
                "userData": {"isBundle": True, "bundleName": bundle_name, "priority": 8},
            }
        ),
        encoding="utf-8",
    )


class InspectCocosSetupStateTests(unittest.TestCase):
    def run_inspector(self, root: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "pwsh",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(INSPECTOR),
                "-ProjectRoot",
                str(root),
                *arguments,
            ],
            text=True,
            capture_output=True,
            timeout=90,
        )

    def test_reports_project_identity_and_bundle_contract(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _cocos_project(root)
            # The folder name and the bundle name deliberately differ: that mismatch
            # is the contract `loadBundle` depends on.
            _bundle_meta(root, "scripts", "script")
            _bundle_meta(root, "resources", "resources")

            result = self.run_inspector(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["project"]["engine"], "cocos")
            self.assertEqual(payload["project"]["creator_version"], "3.8.8")
            self.assertTrue(payload["project"]["has_tsconfig"])
            bundles = {item["folder"]: item["bundle_name"] for item in payload["project"]["bundles"]}
            self.assertEqual(bundles["assets/scripts"], "script")
            self.assertEqual(bundles["assets/resources"], "resources")
            self.assertEqual(payload["recommended_phase"], "phase-a")
            self.assertEqual(payload["status"], "ready")

    def test_creator_2x_project_is_accepted_without_an_mcp_phase(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            # Creator 2.x has no package.json; the root project.json carries the version.
            (root / "assets" / "scripts").mkdir(parents=True)
            (root / "settings").mkdir()
            (root / "project.json").write_text(
                json.dumps(
                    {"engine": "cocos-creator-js", "packages": "packages", "version": "2.4.14"}
                ),
                encoding="utf-8",
            )

            result = self.run_inspector(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["project"]["creator_version"], "2.4.14")
            self.assertEqual(payload["project"]["creator_major"], 2)
            self.assertFalse(payload["engine"]["supports_mcp"])
            # Nothing live to wait for: the MCP extension does not exist for 2.x.
            self.assertFalse(payload["cocos_mcp"]["applicable"])
            self.assertEqual(payload["cocos_mcp"]["port"], 0)
            self.assertFalse(payload["cocos_mcp"]["reachable"])
            self.assertEqual(payload["recommended_phase"], "phase-a")
            self.assertEqual(payload["status"], "ready")

    def test_creator_2x_never_probes_a_configured_port(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "project.json").write_text(
                json.dumps({"engine": "cocos-creator-js", "version": "2.4.14"}), encoding="utf-8"
            )
            # A stray config from a copied bundle must not make a 2.x project probe.
            (root / "funplay-cocos-mcp.config.json").write_text(
                json.dumps({"host": "127.0.0.1", "port": 29999}), encoding="utf-8"
            )

            payload = json.loads(self.run_inspector(root).stdout)

            self.assertFalse(payload["cocos_mcp"]["applicable"])
            self.assertEqual(payload["cocos_mcp"]["config_path"], "")
            self.assertEqual(payload["cocos_mcp"]["port"], 0)

    def test_managed_extension_state_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _cocos_project(root)
            dev_tools = root / "extensions" / "dev-tools"
            dev_tools.mkdir(parents=True)
            (dev_tools / "package.json").write_text(
                json.dumps({"name": "dev-tools", "version": "1.0.0", "editor": ">=3.8.0"}),
                encoding="utf-8",
            )

            payload = json.loads(self.run_inspector(root).stdout)

            managed = {
                item["name"]: item for item in payload["project"]["managed_extensions"]
            }
            self.assertEqual(sorted(managed), ["dev-tools", "funplay-cocos-mcp", "minigame-pack"])
            self.assertTrue(managed["dev-tools"]["installed"])
            self.assertEqual(managed["dev-tools"]["path"], "extensions/dev-tools")
            self.assertEqual(managed["dev-tools"]["engine_line"], "cocos-creator-3x")
            self.assertEqual(managed["dev-tools"]["version"], "1.0.0")
            self.assertFalse(managed["minigame-pack"]["installed"])
            self.assertFalse(managed["funplay-cocos-mcp"]["installed"])

    def test_creator_2x_extensions_are_found_under_packages(self) -> None:
        """Creator 2.x loads project-local extensions from `packages/`, not `extensions/`.

        Scanning only `extensions/` reported a correctly installed 2.x extension as
        missing, which made setup reinstall it on every run.
        """
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "project.json").write_text(
                json.dumps({"engine": "cocos-creator-js", "version": "2.4.14"}), encoding="utf-8"
            )
            for name in ("dev-tools", "minigame-pack"):
                folder = root / "packages" / name
                folder.mkdir(parents=True)
                (folder / "package.json").write_text(
                    json.dumps(
                        {
                            "name": name,
                            "version": "1.0.0",
                            "main": "main.js",
                            "cocos-creator": ">=2.4.0 <3.0.0",
                        }
                    ),
                    encoding="utf-8",
                )

            payload = json.loads(self.run_inspector(root).stdout)

            self.assertEqual(
                payload["project"]["extensions"],
                ["packages/dev-tools", "packages/minigame-pack"],
            )
            managed = {item["name"]: item for item in payload["project"]["managed_extensions"]}
            for name in ("dev-tools", "minigame-pack"):
                self.assertTrue(managed[name]["installed"], name)
                self.assertEqual(managed[name]["path"], f"packages/{name}")
                self.assertEqual(managed[name]["engine_line"], "cocos-creator-2x")
                self.assertEqual(managed[name]["version"], "1.0.0")
            # There is no 2.x build of the MCP extension.
            self.assertFalse(managed["funplay-cocos-mcp"]["installed"])

    def test_refuses_a_non_cocos_root(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "assets").mkdir()
            (root / "package.json").write_text(json.dumps({"name": "site"}), encoding="utf-8")

            result = self.run_inspector(root)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Not a Cocos Creator project root", result.stderr)

    def test_reports_mcp_configuration_without_contacting_an_absent_server(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _cocos_project(root)
            (root / "funplay-cocos-mcp.config.json").write_text(
                json.dumps(
                    {
                        "host": "127.0.0.1",
                        # A port no listener owns: the inspector must report it as
                        # unreachable rather than hanging or failing.
                        "port": 29999,
                        "toolProfile": "core",
                        "executeJavascriptSafetyChecks": True,
                    }
                ),
                encoding="utf-8",
            )
            extension = root / "extensions" / "funplay-cocos-mcp"
            extension.mkdir(parents=True)
            (extension / "package.json").write_text(
                json.dumps({"name": "funplay-cocos-mcp", "version": "0.6.3"}), encoding="utf-8"
            )

            result = self.run_inspector(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            mcp = json.loads(result.stdout)["cocos_mcp"]
            self.assertEqual(mcp["port"], 29999)
            self.assertEqual(mcp["tool_profile"], "core")
            self.assertTrue(mcp["safety_checks"])
            self.assertEqual(mcp["extension_path"], "extensions/funplay-cocos-mcp")
            self.assertEqual(mcp["extension_version"], "0.6.3")
            self.assertFalse(mcp["reachable"])

    def test_detects_client_bundles(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _cocos_project(root)
            (root / ".claude" / "agents").mkdir(parents=True)
            (root / ".claude" / "agents" / "setup-agents.md").write_text("x", encoding="utf-8")

            payload = json.loads(self.run_inspector(root).stdout)

            self.assertTrue(payload["clients"]["claude"])
            self.assertFalse(payload["clients"]["codex"])

    def test_stale_checkpoint_reports_its_reason(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _cocos_project(root)
            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "setup-agents-cocos.json"
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_text(
                json.dumps(
                    {
                        "phase": "phase-b",
                        "project_root": str(root),
                        "creator_version": "3.8.4",
                        "package_json_sha256": "0" * 64,
                    }
                ),
                encoding="utf-8",
            )

            payload = json.loads(self.run_inspector(root).stdout)

            self.assertTrue(payload["checkpoint"]["exists"])
            self.assertFalse(payload["checkpoint"]["reusable"])
            self.assertIn("creator-version-changed", payload["checkpoint"]["stale_reasons"])
            self.assertIn("package-json-changed", payload["checkpoint"]["stale_reasons"])
            self.assertEqual(payload["recommended_phase"], "phase-a")


if __name__ == "__main__":
    unittest.main()
