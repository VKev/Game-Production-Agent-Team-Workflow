from __future__ import annotations

import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


SCRIPT = Path(__file__).parents[1] / "scripts" / "inspect_serena_state.py"


class SerenaInspectorTests(unittest.TestCase):
    def run_inspector(self, root: Path, serena: Path, codex: Path, hooks: Path) -> dict:
        result = subprocess.run(
            [sys.executable, str(SCRIPT), "--project-root", str(root), "--serena-config", str(serena),
             "--codex-config", str(codex), "--hooks", str(hooks)],
            text=True, capture_output=True, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return json.loads(result.stdout)

    def test_correct_state_and_duplicate_free_hooks(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "AGENTS.md").write_text("<!-- setup-serena:start -->\ntext\n<!-- setup-serena:end -->\n", encoding="utf-8")
            serena = root / "serena.yml"
            serena.write_text("web_dashboard: true\nweb_dashboard_interface: tray_manager\n", encoding="utf-8")
            codex = root / "config.toml"
            codex.write_text('[mcp_servers.serena]\ncommand="serena"\nargs=["start-mcp-server","--project-from-cwd","--context=codex"]\n', encoding="utf-8")
            hooks = root / "hooks.json"
            hooks.write_text(json.dumps({"hooks": {
                "PreToolUse": [{"matcher": "Bash", "hooks": [{"type": "command", "command": "serena-hooks remind --client=codex"}]}],
                "SessionStart": [{"matcher": "startup|resume", "hooks": [{"type": "command", "command": "serena-hooks activate --client=codex"}]}],
            }}), encoding="utf-8")
            self.assertEqual(self.run_inspector(root, serena, codex, hooks)["status"], "correct")

    def test_duplicate_dashboard_key_is_incorrect(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "AGENTS.md").write_text("", encoding="utf-8")
            serena = root / "serena.yml"
            serena.write_text("web_dashboard: true\nweb_dashboard: true\nweb_dashboard_interface: tray_manager\n", encoding="utf-8")
            codex = root / "config.toml"
            codex.write_text("", encoding="utf-8")
            hooks = root / "hooks.json"
            hooks.write_text("{}", encoding="utf-8")
            payload = self.run_inspector(root, serena, codex, hooks)
            self.assertEqual(payload["status"], "incorrect")
            self.assertEqual(payload["serena_config"]["duplicate_top_level_keys"], ["web_dashboard"])


if __name__ == "__main__":
    unittest.main()
