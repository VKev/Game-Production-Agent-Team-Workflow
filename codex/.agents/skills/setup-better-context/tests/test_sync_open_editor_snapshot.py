from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "sync_open_editor_snapshot.py"
SPEC = importlib.util.spec_from_file_location("sync_open_editor_snapshot", SCRIPT)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(MODULE)


class SyncOpenEditorSnapshotTests(unittest.TestCase):
    def make_project(self, root: Path, *, version: str = "6000.3.21f1") -> Path:
        (root / "Assets").mkdir()
        (root / "Library").mkdir()
        (root / "ProjectSettings").mkdir()
        (root / "ProjectSettings" / "ProjectVersion.txt").write_text(
            f"m_EditorVersion: {version}\n", encoding="utf-8"
        )
        editor = root / version / "Editor" / "Unity.exe"
        editor.parent.mkdir(parents=True)
        editor.touch()
        (root / "Library" / "EditorInstance.json").write_text(
            json.dumps({"process_id": 123, "version": version, "app_path": str(editor)}),
            encoding="utf-8",
        )
        return editor

    def test_accepts_exact_live_editor_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            editor = self.make_project(root)
            self.assertEqual(MODULE._verify_editor_identity(root, lambda _: editor), 123)

    def test_rejects_process_image_mismatch(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_project(root)
            other = root / "other" / "Unity.exe"
            other.parent.mkdir()
            other.touch()
            with self.assertRaisesRegex(RuntimeError, "does not match"):
                MODULE._verify_editor_identity(root, lambda _: other)

    def test_rejects_project_version_mismatch(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            self.make_project(root)
            (root / "ProjectSettings" / "ProjectVersion.txt").write_text(
                "m_EditorVersion: 6000.3.20f1\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(RuntimeError, "version does not match"):
                MODULE._verify_editor_identity(root, lambda _: root)


if __name__ == "__main__":
    unittest.main()
