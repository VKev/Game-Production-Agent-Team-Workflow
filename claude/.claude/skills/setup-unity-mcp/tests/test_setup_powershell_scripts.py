import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import tomllib
import unittest


ROOT = Path(__file__).parents[1]
UPSERT = ROOT / "scripts" / "upsert_codex_unity_mcp.ps1"
UPSERT_CLAUDE = ROOT / "scripts" / "upsert_claude_unity_mcp.ps1"
CLEANUP = ROOT / "scripts" / "remove_legacy_coplay.ps1"
WAIT_DISCOVERY = ROOT / "scripts" / "wait_unity_mcp_discovery.ps1"


class SetupPowerShellScriptTests(unittest.TestCase):
    def run_script(self, script: Path, *arguments: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            ["pwsh", "-NoProfile", "-File", str(script), *arguments],
            text=True,
            capture_output=True,
            timeout=30,
        )

    def test_upsert_is_idempotent_and_preserves_unrelated_toml(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relay = root / "relay_win.exe"
            relay.write_bytes(b"relay fixture")
            config = root / "config.toml"
            config.write_text(
                'model = "test"\n\n'
                '[mcp_servers.other]\ncommand = "other"\n\n'
                '[mcp_servers.unityMCP]\ncommand = "legacy"\n\n'
                '[mcp_servers.unityMCP.env]\nTOKEN = "legacy-only"\n\n'
                '[features]\nexample = true\n',
                encoding="utf-8",
            )

            first = self.run_script(
                UPSERT, "-ConfigPath", str(config), "-RelayPath", str(relay)
            )
            self.assertEqual(first.returncode, 0, first.stderr)
            first_payload = json.loads(first.stdout)
            self.assertTrue(first_payload["changed"])
            first_text = config.read_text(encoding="utf-8")
            parsed = tomllib.loads(first_text)
            self.assertEqual(parsed["model"], "test")
            self.assertEqual(parsed["mcp_servers"]["other"]["command"], "other")
            self.assertEqual(parsed["mcp_servers"]["unity_mcp"]["args"], ["--mcp"])
            self.assertEqual(
                parsed["mcp_servers"]["unity_mcp"]["tools"]["Unity_ManageEditor"]["approval_mode"],
                "approve",
            )
            self.assertTrue(parsed["mcp_servers"]["unity_mcp"]["enabled"])
            self.assertNotIn("unityMCP", parsed["mcp_servers"])
            self.assertEqual(first_text.count("[mcp_servers.unity_mcp]"), 1)

            second = self.run_script(
                UPSERT, "-ConfigPath", str(config), "-RelayPath", str(relay)
            )
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertFalse(json.loads(second.stdout)["changed"])
            self.assertEqual(config.read_text(encoding="utf-8"), first_text)

    def test_claude_upsert_mirrors_codex_policy_and_is_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relay = root / "relay_win.exe"
            relay.write_bytes(b"relay fixture")
            mcp = root / ".mcp.json"
            mcp.write_text(
                json.dumps(
                    {
                        "mcpServers": {
                            "serena": {"command": "serena", "args": ["start-mcp-server"]},
                            "unity-mcp": {"command": "C:/stale/relay_win.exe", "args": ["--mcp"]},
                        }
                    }
                ),
                encoding="utf-8",
            )
            settings_path = root / ".claude" / "settings.json"
            settings_path.parent.mkdir()
            settings_path.write_text(
                json.dumps(
                    {
                        "hooks": {
                            "SessionStart": [
                                {
                                    "matcher": "",
                                    "hooks": [
                                        {"type": "command", "command": "bd prime --hook-json"}
                                    ],
                                }
                            ]
                        },
                        "permissions": {"allow": ["mcp__codegraph__*"]},
                    }
                ),
                encoding="utf-8",
            )

            first = self.run_script(
                UPSERT_CLAUDE,
                "-ProjectRoot",
                str(root),
                "-RelayPath",
                str(relay),
                "-UserConfigPath",
                str(root / "absent-user-config.json"),
            )
            self.assertEqual(first.returncode, 0, first.stderr)
            payload = json.loads(first.stdout)
            self.assertEqual(payload["status"], "restart-ready")
            self.assertTrue(payload["changed"])
            self.assertEqual(payload["removed_servers"], ["unity-mcp"])

            servers = json.loads(mcp.read_text(encoding="utf-8"))["mcpServers"]
            self.assertEqual(sorted(servers), ["serena", "unity_mcp"])
            self.assertEqual(servers["unity_mcp"]["args"], ["--mcp"])
            self.assertEqual(Path(servers["unity_mcp"]["command"]), relay.resolve())
            self.assertEqual(servers["serena"]["command"], "serena")

            settings = json.loads(settings_path.read_text(encoding="utf-8"))
            self.assertEqual(settings["enabledMcpjsonServers"], ["unity_mcp"])
            self.assertIn("mcp__codegraph__*", settings["permissions"]["allow"])
            self.assertIn("mcp__unity_mcp__*", settings["permissions"]["allow"])
            self.assertEqual(
                settings["permissions"]["ask"], ["mcp__unity_mcp__Unity_ManageEditor"]
            )
            self.assertEqual(
                settings["hooks"]["SessionStart"][0]["hooks"][0]["command"],
                "bd prime --hook-json",
            )

            mcp_text = mcp.read_text(encoding="utf-8")
            settings_text = settings_path.read_text(encoding="utf-8")
            second = self.run_script(
                UPSERT_CLAUDE,
                "-ProjectRoot",
                str(root),
                "-RelayPath",
                str(relay),
                "-UserConfigPath",
                str(root / "absent-user-config.json"),
            )
            self.assertEqual(second.returncode, 0, second.stderr)
            self.assertFalse(json.loads(second.stdout)["changed"])
            self.assertEqual(mcp.read_text(encoding="utf-8"), mcp_text)
            self.assertEqual(settings_path.read_text(encoding="utf-8"), settings_text)

    def test_claude_upsert_reports_user_level_duplicates_before_pruning(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            relay = root / "relay_win.exe"
            relay.write_bytes(b"relay fixture")
            user_config = root / "user.claude.json"
            user_config.write_text(
                json.dumps(
                    {
                        "userID": "keep",
                        "mcpServers": {
                            "unity-mcp": {"command": "C:/Users/x/.unity/relay/relay_win.exe"},
                            "unity_mcp": {"command": "C:/Users/x/.unity/relay/relay_win.exe"},
                            "unrelated": {"command": "keepme"},
                        },
                    }
                ),
                encoding="utf-8",
            )

            report = self.run_script(
                UPSERT_CLAUDE,
                "-ProjectRoot",
                str(root),
                "-RelayPath",
                str(relay),
                "-UserConfigPath",
                str(user_config),
            )
            self.assertEqual(report.returncode, 0, report.stderr)
            payload = json.loads(report.stdout)
            self.assertEqual(payload["status"], "ambiguous")
            self.assertEqual(sorted(payload["user_level_duplicates"]), ["unity-mcp", "unity_mcp"])
            self.assertEqual(payload["pruned_user_level"], [])
            self.assertIn("unity_mcp", json.loads(user_config.read_text(encoding="utf-8"))["mcpServers"])

            pruned = self.run_script(
                UPSERT_CLAUDE,
                "-ProjectRoot",
                str(root),
                "-RelayPath",
                str(relay),
                "-UserConfigPath",
                str(user_config),
                "-PruneUserLevelDuplicates",
            )
            self.assertEqual(pruned.returncode, 0, pruned.stderr)
            pruned_payload = json.loads(pruned.stdout)
            self.assertEqual(sorted(pruned_payload["pruned_user_level"]), ["unity-mcp", "unity_mcp"])
            remaining = json.loads(user_config.read_text(encoding="utf-8"))
            self.assertEqual(list(remaining["mcpServers"]), ["unrelated"])
            self.assertEqual(remaining["userID"], "keep")

    def test_cleanup_removes_only_checkpoint_hash_matches(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            roslyn = root / "Assets" / "Plugins" / "Roslyn"
            roslyn.mkdir(parents=True)
            owned = roslyn / "Coplay.Compiler.dll"
            owned.write_bytes(b"owned")
            owned.with_suffix(".dll.meta").write_text("meta", encoding="utf-8")
            preserved = roslyn / "BetterContext.Analyzer.dll"
            preserved.write_bytes(b"better-context")
            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "unity-mcp-roslyn.json"
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_text(
                json.dumps(
                    {
                        "files": [
                            {
                                "dll_name": owned.name,
                                "sha256": hashlib.sha256(owned.read_bytes()).hexdigest(),
                            }
                        ]
                    }
                ),
                encoding="utf-8",
            )

            result = self.run_script(CLEANUP, "-ProjectRoot", str(root))
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["status"], "legacy-coplay-removed")
            self.assertFalse(owned.exists())
            self.assertFalse(owned.with_suffix(".dll.meta").exists())
            self.assertTrue(preserved.exists())
            self.assertFalse(checkpoint.exists())

    def test_cleanup_preserves_hash_mismatch_for_review(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            roslyn = root / "Assets" / "Plugins" / "Roslyn"
            roslyn.mkdir(parents=True)
            unknown = roslyn / "Unknown.dll"
            unknown.write_bytes(b"user-owned")
            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "unity-mcp-roslyn.json"
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_text(
                json.dumps({"files": [{"dll_name": unknown.name, "sha256": "0" * 64}]}),
                encoding="utf-8",
            )

            result = self.run_script(CLEANUP, "-ProjectRoot", str(root))
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["status"], "ambiguous-legacy-files")
            self.assertTrue(unknown.exists())
            self.assertTrue(checkpoint.exists())

    def test_discovery_wait_accepts_one_exact_live_record(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            status = root / "connections"
            status.mkdir()
            discovery = status / f"bridge-test-{os.getpid()}.json"
            discovery.write_text(
                json.dumps(
                    {
                        "project_path": str(root),
                        "editor_pid": os.getpid(),
                        "connection_type": "named_pipe",
                        "connection_path": r"\\.\pipe\fixture",
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_script(
                WAIT_DISCOVERY,
                "-ProjectRoot",
                str(root),
                "-UnityEditorPath",
                sys.executable,
                "-StatusDirectory",
                str(status),
                "-TimeoutSec",
                "1",
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["status"], "ready")

    def test_discovery_wait_classifies_missing_bootstrap_without_shell_failure(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            status = root / "connections"
            status.mkdir()
            library = root / "Library"
            library.mkdir()
            (library / "EditorInstance.json").write_text(
                json.dumps({"process_id": os.getpid(), "app_path": sys.executable}), encoding="utf-8"
            )
            result = self.run_script(
                WAIT_DISCOVERY,
                "-ProjectRoot",
                str(root),
                "-UnityEditorPath",
                sys.executable,
                "-StatusDirectory",
                str(status),
                "-TimeoutSec",
                "1",
                "-PollMilliseconds",
                "100",
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["status"], "pending-manual-action")
            self.assertEqual(payload["computer_use"], "prohibited")

    def test_discovery_wait_accepts_timeout_seconds_alias_and_reload_state(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            status = root / "connections"
            status.mkdir()
            library = root / "Library"
            library.mkdir()
            (library / "EditorInstance.json").write_text(
                json.dumps({"process_id": os.getpid(), "app_path": sys.executable}), encoding="utf-8"
            )
            result = self.run_script(
                WAIT_DISCOVERY,
                "-ProjectRoot",
                str(root),
                "-UnityEditorPath",
                sys.executable,
                "-StatusDirectory",
                str(status),
                "-TimeoutSeconds",
                "1",
                "-PollMilliseconds",
                "100",
                "-AfterReload",
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["status"], "transient-editor-reload")
            self.assertNotIn("Project Settings", payload["next_action"])

    def test_after_reload_never_claims_transient_without_exact_live_editor(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            status = root / "connections"
            status.mkdir()
            library = root / "Library"
            library.mkdir()
            (library / "EditorInstance.json").write_text(
                json.dumps({"process_id": os.getpid(), "app_path": str(root / "wrong-editor.exe")}),
                encoding="utf-8",
            )
            result = self.run_script(
                WAIT_DISCOVERY,
                "-ProjectRoot",
                str(root),
                "-UnityEditorPath",
                sys.executable,
                "-StatusDirectory",
                str(status),
                "-TimeoutSeconds",
                "1",
                "-PollMilliseconds",
                "100",
                "-AfterReload",
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["status"], "pending-manual-action")
            self.assertFalse(payload["exact_editor_alive"])


if __name__ == "__main__":
    unittest.main()
