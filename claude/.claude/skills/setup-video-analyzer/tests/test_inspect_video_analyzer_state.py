from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "inspect_video_analyzer_state.py"


class VideoInspectorTests(unittest.TestCase):
    def test_exact_safe_table(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            config = Path(directory) / "config.toml"
            config.write_text(
                '[mcp_servers.video-analyzer]\ncommand="npx"\nargs=["-y","mcp-video-analyzer@latest"]\n'
                'enabled_tools=["get_metadata","get_frames","get_frame_at","get_frame_burst"]\n'
                'disabled_tools=["analyze_video","analyze_videos","get_transcript","analyze_moment"]\n'
                'startup_timeout_sec=60\ntool_timeout_sec=300\n[mcp_servers.video-analyzer.env]\n'
                'TWELVELABS_API_KEY=""\nOPENAI_API_KEY=""\nWHISPER_HF_MODEL=""\n', encoding="utf-8"
            )
            result = subprocess.run(
                [sys.executable, str(SCRIPT), "--config", str(config), "--expected-version", "1.2.3", "--reported-version", "v1.2.3"],
                text=True, capture_output=True, check=False,
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(json.loads(result.stdout)["status"], "correct")


if __name__ == "__main__":
    unittest.main()
