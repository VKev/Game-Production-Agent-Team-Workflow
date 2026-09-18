import hashlib
import importlib.util
import json
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path


SKILL_ROOT = Path(__file__).parents[1]
SCRIPT = SKILL_ROOT / "scripts" / "prepare_unitypackage.py"
FEEL_ARCHIVE = SKILL_ROOT / "assets" / "Feel.unitypackage"
FEEL_SHA256 = "b422040ecba5efd0b6b54f2667d7ba2bbba30e7511e2f10b6bfd8fceb7dd4438"
PROFILE_ID = "feel-6.0-unity-6000.3-find-objects-by-type"


def load_prepare_module():
    spec = importlib.util.spec_from_file_location("prepare_unitypackage", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def load_apply_module(prepare_module):
    sys.modules["prepare_unitypackage"] = prepare_module
    script = SKILL_ROOT / "scripts" / "apply_unity_compatibility_profile.py"
    spec = importlib.util.spec_from_file_location("apply_unity_compatibility_profile", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def extract_registered_sources(archive, paths):
    sources = {}
    current_guid = None
    current_asset = None
    with tarfile.open(archive, "r:gz") as package:
        for member in package:
            if not member.isfile() or "/" not in member.name:
                continue
            guid, leaf = member.name.split("/", 1)
            if guid != current_guid:
                current_guid = guid
                current_asset = None
            if leaf == "asset":
                current_asset = package.extractfile(member).read()
            elif leaf == "pathname" and current_asset is not None:
                path = package.extractfile(member).read().decode("utf-8").splitlines()[0].rstrip("/")
                if path in paths:
                    sources[path] = current_asset
    return sources


class FeelCompatibilityProfileTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.module = load_prepare_module()
        cls.profile = cls.module.load_compatibility_profile(FEEL_SHA256, "6000.3.21f1")
        cls.files = {entry["path"]: entry for entry in cls.profile["files"]}
        cls.sources = extract_registered_sources(FEEL_ARCHIVE, set(cls.files))

    def test_profile_is_exact_and_complete(self):
        self.assertEqual(self.profile["id"], PROFILE_ID)
        self.assertEqual(self.profile["archive_sha256"], FEEL_SHA256)
        self.assertEqual(self.profile["unity_version"], "6000.3.21f1")
        self.assertEqual(len(self.files), 9)
        self.assertEqual(sum(len(entry["hunks"]) for entry in self.files.values()), 10)
        self.assertEqual(set(self.sources), set(self.files))

    def test_all_registered_sources_patch_to_registered_results(self):
        for path, source in self.sources.items():
            with self.subTest(path=path):
                result, changed = self.module.apply_compatibility_patch(path, source, self.files)
                self.assertTrue(changed)
                self.assertEqual(hashlib.sha256(result).hexdigest(), self.files[path]["result_sha256"])

    def test_unknown_source_drift_is_rejected(self):
        path = sorted(self.sources)[0]
        with self.assertRaisesRegex(self.module.PreparationError, "source hash mismatch"):
            self.module.apply_compatibility_patch(path, self.sources[path] + b"\n", self.files)

    def test_manifest_rejects_another_editor_version(self):
        with self.assertRaisesRegex(self.module.PreparationError, "compatibility manifest targets"):
            self.module.load_compatibility_profile(FEEL_SHA256, "6000.3.20f1")

    def test_every_profile_matches_its_real_archive_and_exact_counts(self):
        manifest = json.loads(self.module.PATCH_MANIFEST.read_text(encoding="utf-8"))
        for profile in manifest["profiles"]:
            with self.subTest(profile=profile["id"]):
                archive = SKILL_ROOT / "assets" / profile["archive"]
                archive_hash = hashlib.sha256(archive.read_bytes()).hexdigest()
                self.assertEqual(archive_hash, profile["archive_sha256"])
                loaded = self.module.load_compatibility_profile(archive_hash, "6000.3.21f1")
                self.assertEqual(loaded["id"], profile["id"])
                self.assertEqual(len(loaded["files"]), loaded["expected_file_count"])
                self.assertEqual(sum(len(entry["hunks"]) for entry in loaded["files"]), loaded["expected_hunk_count"])
                files = {entry["path"]: entry for entry in loaded["files"]}
                sources = extract_registered_sources(archive, set(files))
                self.assertEqual(set(sources), set(files))
                for path, source in sources.items():
                    self.assertEqual(hashlib.sha256(source).hexdigest(), files[path]["source_file_sha256"])
                    result, changed = self.module.apply_compatibility_patch(path, source, files)
                    self.assertTrue(changed)
                    self.assertEqual(hashlib.sha256(result).hexdigest(), files[path]["result_file_sha256"])

    def test_live_applier_is_idempotent_and_rejects_drift(self):
        apply_module = load_apply_module(self.module)
        profile_id = "fimpossible-legs-unity-6000.3-physics-material"
        profile = apply_module.load_profile(profile_id)
        archive = SKILL_ROOT / "assets" / profile["archive"]
        primary_archive_path = profile["archive_root"] + profile["primary_path"][len(profile["installed_root"]):]
        wanted = {primary_archive_path, *(entry["path"] for entry in profile["files"])}
        sources = extract_registered_sources(archive, wanted)
        self.assertEqual(set(sources), wanted)
        with tempfile.TemporaryDirectory() as temporary:
            project = Path(temporary)
            (project / "Assets").mkdir()
            (project / "Packages").mkdir()
            (project / "ProjectSettings").mkdir()
            (project / "Packages" / "manifest.json").write_text("{}\n", encoding="utf-8")
            (project / "ProjectSettings" / "ProjectVersion.txt").write_text(
                "m_EditorVersion: 6000.3.21f1\n", encoding="utf-8"
            )
            primary = project.joinpath(*Path(profile["primary_path"]).parts)
            primary.parent.mkdir(parents=True, exist_ok=True)
            primary.write_bytes(sources[primary_archive_path])
            for entry in profile["files"]:
                installed = apply_module.installed_path(project, profile, entry["path"])
                installed.parent.mkdir(parents=True, exist_ok=True)
                installed.write_bytes(sources[entry["path"]])

            checked = apply_module.apply_profile(project, archive, profile_id, True)
            self.assertEqual(checked["status"], "repairable")
            repaired = apply_module.apply_profile(project, archive, profile_id, False)
            self.assertEqual(repaired["status"], "repaired")
            self.assertEqual(repaired["patched_count"], profile["expected_file_count"])
            correct = apply_module.apply_profile(project, archive, profile_id, False)
            self.assertEqual(correct["status"], "correct")

            installed = apply_module.installed_path(project, profile, profile["files"][0]["path"])
            installed.write_bytes(installed.read_bytes() + b"\n")
            with self.assertRaisesRegex(self.module.PreparationError, "source/result hash mismatch"):
                apply_module.apply_profile(project, archive, profile_id, False)


if __name__ == "__main__":
    unittest.main()
