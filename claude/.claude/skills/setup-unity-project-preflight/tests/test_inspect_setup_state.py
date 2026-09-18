from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "inspect_setup_state.ps1"
EDITOR = Path(os.environ.get("UNITY_6000_3_21F1_EDITOR", r"D:\Apps\Unity\6000.3.21f1\Editor\Unity.exe"))


@unittest.skipUnless(EDITOR.is_file(), "exact Unity 6000.3.21f1 Editor is unavailable")
class PreflightTests(unittest.TestCase):
    def project(self, root: Path, version: str = "6000.3.21f1") -> None:
        (root / "Assets").mkdir(parents=True)
        (root / "Packages").mkdir()
        (root / "ProjectSettings").mkdir()
        (root / "Packages" / "manifest.json").write_text('{"dependencies": {}}\n', encoding="utf-8")
        (root / "ProjectSettings" / "ProjectVersion.txt").write_text(
            f"m_EditorVersion: {version}\n"
            "m_EditorVersionWithRevision: 6000.3.21f1 (c02631ffc030)\n",
            encoding="utf-8",
        )

    def run_preflight(self, root: Path, *, explicit_editor: bool = True) -> subprocess.CompletedProcess[str]:
        command = [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy",
                "Bypass",
                "-File",
                str(SCRIPT),
                "-ProjectRoot",
                str(root),
            ]
        environment = os.environ.copy()
        if explicit_editor:
            command.extend(["-UnityEditorPath", str(EDITOR)])
        else:
            environment["UNITY_6000_3_21F1_EDITOR"] = str(EDITOR)
        return subprocess.run(
            command,
            text=True,
            capture_output=True,
            check=False,
            env=environment,
        )

    def test_closed_new_project_routes_phase_a_and_parallel_lanes(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.project(root)
            result = self.run_preflight(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["recommended_phase"], "phase-a")
            self.assertTrue(payload["parallel_safe"])
            self.assertEqual(len(payload["parallel_lanes"]), 3)
            self.assertEqual(payload["git"]["state"], "missing")

    def test_matching_checkpoint_routes_await_unity_open(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.project(root)
            manifest = root / "Packages" / "manifest.json"
            import hashlib

            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "setup-agents.json"
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_text(
                json.dumps(
                    {
                        "projectRoot": str(root),
                        "unityVersion": "6000.3.21f1",
                        "phase": "editor-closed-checkpoint",
                        "manifestAfterSha256": hashlib.sha256(manifest.read_bytes()).hexdigest(),
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_preflight(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["recommended_phase"], "await-unity-open")
            self.assertTrue(payload["checkpoint"]["reusable"])
            self.assertFalse(payload["parallel_safe"])

    def test_editor_can_resolve_from_registered_environment_path(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.project(root)
            result = self.run_preflight(root, explicit_editor=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(Path(payload["editor"]["path"]), EDITOR)

    def test_wrong_project_version_fails_before_setup(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.project(root, "6000.3.20f1")
            result = self.run_preflight(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("requires Unity 6000.3.21f1", result.stderr)

    def test_completed_checkpoint_uses_final_package_hashes(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.project(root)
            package_lock = root / "Packages" / "packages-lock.json"
            package_lock.write_text('{"dependencies": {}}\n', encoding="utf-8")
            import hashlib

            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "setup-agents.json"
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_text(
                json.dumps(
                    {
                        "projectRoot": str(root),
                        "unityVersion": "6000.3.21f1",
                        "phase": "completed",
                        "manifestAfterZLinqUnitySha256": hashlib.sha256(
                            (root / "Packages" / "manifest.json").read_bytes()
                        ).hexdigest(),
                        "packageLockAfterZLinqUnitySha256": hashlib.sha256(
                            package_lock.read_bytes()
                        ).hexdigest(),
                    }
                ),
                encoding="utf-8",
            )
            result = self.run_preflight(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["recommended_phase"], "verify-complete")
            self.assertTrue(payload["checkpoint"]["reusable"])

    def test_stale_checkpoint_is_classified_blocker_not_shell_failure(self) -> None:
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            self.project(root)
            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "setup-agents.json"
            checkpoint.parent.mkdir(parents=True)
            checkpoint.write_text(
                json.dumps({
                    "projectRoot": str(root),
                    "unityVersion": "6000.3.21f1",
                    "phase": "phase-a-complete",
                    "manifestAfterSha256": "0" * 64,
                }),
                encoding="utf-8",
            )
            result = self.run_preflight(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["status"], "blocked")
            self.assertEqual(payload["recommended_phase"], "ambiguous")
            self.assertIn("checkpoint-stale", payload["blockers"])


if __name__ == "__main__":
    unittest.main()
