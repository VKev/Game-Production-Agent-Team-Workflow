import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tarfile
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "resolve_official_unity_mcp.ps1"
EDITOR = Path(os.environ.get("UNITY_6000_3_21F1_EDITOR", ""))


@unittest.skipUnless(EDITOR.is_file(), "set UNITY_6000_3_21F1_EDITOR to the exact Unity 6000.3.21f1 executable")
class OfficialUnityMcpResolverTests(unittest.TestCase):
    def create_project(self, root: Path, version: str = "6000.3.21f1") -> None:
        (root / "ProjectSettings").mkdir(parents=True)
        (root / "Packages").mkdir(parents=True)
        (root / "ProjectSettings" / "ProjectVersion.txt").write_text(
            f"m_EditorVersion: {version}\n", encoding="utf-8"
        )
        (root / "Packages" / "manifest.json").write_text(
            '{"dependencies":{}}\n', encoding="utf-8"
        )

    def create_archive(self, path: Path, version: str = "2.17.0-pre.1") -> str:
        payload = json.dumps(
            {
                "name": "com.unity.ai.assistant",
                "version": version,
                "dependencies": {"com.unity.nuget.newtonsoft-json": "3.2.1"},
            },
            separators=(",", ":"),
        ).encode()
        with tarfile.open(path, "w:gz") as archive:
            info = tarfile.TarInfo("package/package.json")
            info.size = len(payload)
            archive.addfile(info, io.BytesIO(payload))
        return hashlib.sha1(path.read_bytes()).hexdigest()

    def metadata(self, selected_sha1: str) -> dict:
        def entry(version: str, unity: str, unity_release: str, sha1: str) -> dict:
            return {
                "name": "com.unity.ai.assistant",
                "version": version,
                "unity": unity,
                "unityRelease": unity_release,
                "dist": {
                    "tarball": f"https://download.packages.unity.com/com.unity.ai.assistant/-/com.unity.ai.assistant-{version}.tgz",
                    "shasum": sha1,
                },
            }

        return {
            "name": "com.unity.ai.assistant",
            "versions": {
                "2.16.0": entry("2.16.0", "6000.0", "60f1", "1" * 40),
                "2.17.0-pre.1": entry("2.17.0-pre.1", "6000.0", "60f1", selected_sha1),
                "3.0.0-pre.1": entry("3.0.0-pre.1", "7000.0", "1f1", "3" * 40),
            },
        }

    def run_resolver(self, project: Path, *extra: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [
                "pwsh",
                "-NoProfile",
                "-File",
                str(SCRIPT),
                "-ProjectRoot",
                str(project),
                "-UnityEditorPath",
                str(EDITOR),
                *extra,
            ],
            text=True,
            capture_output=True,
            timeout=90,
        )

    def test_selects_compatible_prerelease_and_verifies_archive(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.create_project(root)
            archive = root / "assistant.tgz"
            sha1 = self.create_archive(archive)
            metadata_path = root / "metadata.json"
            metadata_path.write_text(json.dumps(self.metadata(sha1)), encoding="utf-8")

            result = self.run_resolver(
                root, "-MetadataPath", str(metadata_path), "-ArchivePath", str(archive)
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            payload = json.loads(result.stdout)
            self.assertEqual(payload["unity_version"], "6000.3.21f1")
            self.assertEqual(payload["version"], "2.17.0-pre.1")
            self.assertEqual(payload["sha1"], sha1)
            self.assertEqual(payload["metadata_source"], "provided-metadata")

    def test_rejects_hash_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.create_project(root)
            archive = root / "assistant.tgz"
            self.create_archive(archive)
            metadata_path = root / "metadata.json"
            metadata_path.write_text(json.dumps(self.metadata("f" * 40)), encoding="utf-8")

            result = self.run_resolver(
                root, "-MetadataPath", str(metadata_path), "-ArchivePath", str(archive)
            )
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("tarball SHA1 mismatch", result.stderr)

    def test_verified_offline_cache_and_tamper_detection(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.create_project(root)
            cache = root / "cache"
            cache.mkdir()
            archive = cache / "com.unity.ai.assistant-2.17.0-pre.1.tgz"
            sha1 = self.create_archive(archive)
            metadata_text = json.dumps(self.metadata(sha1), separators=(",", ":"))
            metadata_path = cache / "registry-metadata.json"
            metadata_path.write_text(metadata_text, encoding="utf-8")
            (cache / "registry-metadata.sha256").write_text(
                hashlib.sha256(metadata_path.read_bytes()).hexdigest() + "\n", encoding="utf-8"
            )

            result = self.run_resolver(root, "-CacheDirectory", str(cache), "-Offline")
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["metadata_source"], "verified-offline-cache")

            metadata_path.write_text(metadata_text + " ", encoding="utf-8")
            tampered = self.run_resolver(root, "-CacheDirectory", str(cache), "-Offline")
            self.assertNotEqual(tampered.returncode, 0)
            self.assertIn("metadata hash mismatch", tampered.stderr)

    def test_rejects_non_exact_project_version_before_resolution(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            self.create_project(root, "6000.3.20f1")
            result = self.run_resolver(root, "-Offline")
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("requires Unity 6000.3.21f1", result.stderr)


if __name__ == "__main__":
    unittest.main()
