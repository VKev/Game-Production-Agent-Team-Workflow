## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/browser_game_fetcher.toml`. Regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- It is the per-game worker of `research-browser-game-batch`; the orchestrator dispatches one instance per game with the `Task` tool and reads back the structured JSON status.
- `<skills-dir>` resolves to `.claude/skills/` in this bundle (or `.agents/skills/` when the Codex bundle is also present).
- Stay inside the assigned game folder. Batch-level files (`plan.json`, `batch.jsonl`, `BATCH-REPORT.md`) belong to the orchestrator.
