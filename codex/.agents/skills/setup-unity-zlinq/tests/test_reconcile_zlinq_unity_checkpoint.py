from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "reconcile_zlinq_unity_checkpoint.py"
VERSION = "1.5.6"
URL = "https://github.com/Cysharp/ZLinq.git?path=src/ZLinq.Unity/Assets/ZLinq.Unity#1.5.6"


class ReconcileTests(unittest.TestCase):
    def create_state(self, root: Path) -> tuple[Path, Path]:
        (root / "Packages").mkdir(parents=True)
        checkpoint_root = root / ".agent-temp" / "setup-checkpoints"
        checkpoint_root.mkdir(parents=True)
        phase_a = {"com.example.keep": "1.2.3", "com.unity.ai.assistant": "2.17.0-pre.1"}
        (root / "Packages" / "manifest.json").write_text(
            json.dumps({"dependencies": {**phase_a, "com.cysharp.zlinq": URL}}, indent=2), encoding="utf-8"
        )
        (root / "Packages" / "packages-lock.json").write_text(
            json.dumps({"dependencies": {"com.cysharp.zlinq": {"version": URL, "source": "git", "depth": 0}}}, indent=2),
            encoding="utf-8",
        )
        graph = checkpoint_root / "unity-63-package-graph.json"
        graph.write_text(json.dumps({"unity_version": "6000.3.21f1", "dependencies_after": phase_a}), encoding="utf-8")
        setup = checkpoint_root / "setup-agents.json"
        setup.write_text(
            json.dumps({"projectRoot": str(root), "unityVersion": "6000.3.21f1", "phase": "phase-b"}), encoding="utf-8"
        )
        return graph, setup

    def run_script(self, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), "--project-root", str(root), "--zlinq-version", VERSION, "--zlinq-git-url", URL],
            text=True, capture_output=True, check=False,
        )

    def test_reconciles_only_exact_authorized_addition(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, setup = self.create_state(root)
            result = self.run_script(root)
            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(setup.read_text(encoding="utf-8"))
            self.assertEqual(data["zlinqUnityReconciliation"]["status"], "authorized-live-addition-verified")
            self.assertEqual(len(data["manifestAfterZLinqUnitySha256"]), 64)
            self.assertEqual(len(data["packageLockAfterZLinqUnitySha256"]), 64)

    def test_rejects_unrelated_manifest_drift_without_checkpoint_write(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, setup = self.create_state(root)
            manifest_path = root / "Packages" / "manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["dependencies"]["com.example.unplanned"] = "9.9.9"
            manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
            before = setup.read_bytes()
            result = self.run_script(root)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("Manifest drift exceeds", result.stderr)
            self.assertEqual(setup.read_bytes(), before)

    def test_reconstructs_legacy_phase_a_checkpoint_from_owned_backup(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            graph, setup = self.create_state(root)
            graph.write_text(
                json.dumps(
                    {
                        "unity_version": "6000.3.21f1",
                        "packages": {"com.unity.ai.assistant": "2.17.0-pre.1"},
                    }
                ),
                encoding="utf-8",
            )
            (graph.parent / "manifest.pre-unity-63.json").write_text(
                json.dumps(
                    {
                        "dependencies": {
                            "com.example.keep": "1.2.3",
                            "com.coplaydev.unity-mcp": "legacy",
                        }
                    }
                ),
                encoding="utf-8",
            )

            result = self.run_script(root)

            self.assertEqual(result.returncode, 0, result.stderr)
            data = json.loads(setup.read_text(encoding="utf-8"))
            self.assertEqual(data["zlinqUnityReconciliation"]["status"], "authorized-live-addition-verified")

    def test_rejects_lockfile_mismatch_without_checkpoint_write(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            _, setup = self.create_state(root)
            lock_path = root / "Packages" / "packages-lock.json"
            lock_path.write_text(
                json.dumps(
                    {
                        "dependencies": {
                            "com.cysharp.zlinq": {
                                "version": URL,
                                "source": "registry",
                                "depth": 0,
                            }
                        }
                    }
                ),
                encoding="utf-8",
            )
            before = setup.read_bytes()

            result = self.run_script(root)

            self.assertNotEqual(result.returncode, 0)
            self.assertIn("does not resolve the exact official", result.stderr)
            self.assertEqual(setup.read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
