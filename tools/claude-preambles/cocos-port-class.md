## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/cocos_port_class.toml`. Regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- It handles exactly one class per dispatch, so fan it out with several parallel `Task` calls rather than asking one instance for a batch.
- `<skills-dir>` resolves to `.claude/skills/` in this bundle (or `.agents/skills/` when the Codex bundle is also present).
- Each instance touches only its own class file. Shared files, scenes, and prefabs stay with the orchestrator — see `lead-agent-pool`'s Cocos parallel-safety reference.
