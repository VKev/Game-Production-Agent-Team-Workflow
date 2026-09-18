from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "manage_zlinq_compile_probe.py"


class ProbeTests(unittest.TestCase):
    def project(self, root: Path) -> None:
        (root / "Assets").mkdir(parents=True)
        (root / "Packages").mkdir()
        (root / "Packages" / "manifest.json").write_text('{"dependencies": {}}\n', encoding="utf-8")

    def run_script(self, operation: str, root: Path) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [sys.executable, str(SCRIPT), operation, "--project-root", str(root)],
            text=True, capture_output=True, check=False,
        )

    def test_create_is_idempotent_and_cleanup_is_bounded(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.project(root)
            first = self.run_script("create", root)
            self.assertEqual(first.returncode, 0, first.stderr)
            second = self.run_script("create", root)
            self.assertEqual(second.returncode, 0, second.stderr)
            checkpoint = Path(json.loads(second.stdout)["checkpoint"])
            self.assertTrue(json.loads(checkpoint.read_text(encoding="utf-8"))["reused"])
            probe = root / "Assets" / "AgentSetupZLinqProbe"
            (probe / "ZLinqCompileProbe.cs.meta").write_text("generated", encoding="utf-8")
            (root / "Assets" / "AgentSetupZLinqProbe.meta").write_text("generated", encoding="utf-8")
            (root / "Agent.Setup.ZLinqProbe.csproj").write_text("<AssemblyName>Agent.Setup.ZLinqProbe</AssemblyName>", encoding="utf-8")
            cleaned = self.run_script("cleanup", root)
            self.assertEqual(cleaned.returncode, 0, cleaned.stderr)
            self.assertFalse(probe.exists())
            self.assertFalse((root / "Agent.Setup.ZLinqProbe.csproj").exists())

    def test_cleanup_refuses_unowned_probe_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.project(root)
            self.assertEqual(self.run_script("create", root).returncode, 0)
            probe = root / "Assets" / "AgentSetupZLinqProbe"
            (probe / "user.txt").write_text("keep", encoding="utf-8")
            result = self.run_script("cleanup", root)
            self.assertNotEqual(result.returncode, 0)
            self.assertTrue((probe / "user.txt").exists())


if __name__ == "__main__":
    unittest.main()
