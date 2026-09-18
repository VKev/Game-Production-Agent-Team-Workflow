import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).parents[1] / "scripts" / "apply_unity_63_manifest.py"
PACKAGES = {
    "com.unity.ai.assistant": "2.17.0-pre.1",
    "com.unity.probuilder": "6.1.2",
    "com.unity.visualeffectgraph": "17.3.0",
    "com.unity.cloud.gltfast": "6.19.0",
    "com.unity.cinemachine": "3.1.7",
    "jp.hadashikick.vcontainer": "https://github.com/hadashiA/VContainer.git?path=VContainer/Assets/VContainer#1.19.0",
    "com.unity.burst": "1.8.30",
    "com.unity.collections": "2.6.8",
}


class ManifestTests(unittest.TestCase):
    def create_project(self, root: Path, version: str = "6000.3.21f1"):
        (root / "Packages").mkdir(parents=True)
        (root / "ProjectSettings").mkdir()
        (root / "Packages" / "manifest.json").write_text(
            json.dumps({"dependencies": {"com.example.keep": "1.2.3", "com.coplaydev.unity-mcp": "old"}}, indent=2),
            encoding="utf-8",
        )
        (root / "ProjectSettings" / "ProjectVersion.txt").write_text(f"m_EditorVersion: {version}\n", encoding="utf-8")
        packages = root / "packages.json"
        packages.write_text(json.dumps({"packages": PACKAGES}), encoding="utf-8")
        evidence = root / "evidence.json"
        evidence.write_text(
            json.dumps(
                {
                    "unity_version": "6000.3.21f1",
                    "unity_editor_path": "D:/Unity/6000.3.21f1/Editor/Unity.exe",
                    "package_evidence": {
                        key: {
                            "manifest_value": value,
                            "verification": "verified",
                            "source": "test-fixture",
                            "integrity": {"sha256": "a" * 64},
                        }
                        for key, value in PACKAGES.items()
                    },
                    "archives": [],
                }
            ),
            encoding="utf-8",
        )
        return packages, evidence

    def test_atomic_complete_graph_and_checkpoint(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            packages, evidence = self.create_project(root)
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--project-root", str(root), "--packages-json", str(packages), "--evidence-json", str(evidence)],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            manifest = json.loads((root / "Packages" / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["dependencies"]["com.example.keep"], "1.2.3")
            self.assertNotIn("com.coplaydev.unity-mcp", manifest["dependencies"])
            self.assertTrue(set(PACKAGES).issubset(manifest["dependencies"]))
            checkpoint = root / ".agent-temp" / "setup-checkpoints" / "unity-63-package-graph.json"
            self.assertTrue(checkpoint.is_file())
            report = json.loads(checkpoint.read_text(encoding="utf-8"))
            self.assertEqual(report["dependencies_after"], manifest["dependencies"])

    def test_wrong_editor_version_does_not_mutate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            packages, evidence = self.create_project(root, "6000.3.20f1")
            before = (root / "Packages" / "manifest.json").read_bytes()
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--project-root", str(root), "--packages-json", str(packages), "--evidence-json", str(evidence)],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual((root / "Packages" / "manifest.json").read_bytes(), before)

    def test_missing_evidence_does_not_mutate(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            packages, _ = self.create_project(root)
            before = (root / "Packages" / "manifest.json").read_bytes()
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--project-root", str(root), "--packages-json", str(packages)],
                text=True,
                capture_output=True,
                check=False,
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("evidence-json is required", result.stderr)
            self.assertEqual((root / "Packages" / "manifest.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
