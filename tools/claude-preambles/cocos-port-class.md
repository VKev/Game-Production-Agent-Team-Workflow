## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/cocos_port_class.toml`. Regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- `MODE=recon` handles exactly one class per dispatch and may be fanned out with several parallel `Task` calls. `MODE=port` takes a **whole wave** in one dispatch and must not be fanned out per class — `dev-cocos-migrate-2x-to-3x`'s `plan-port-waves.js` produces those waves.
- Paths come from the caller or from the layout JSON the caller passes; the agent never infers a project's folder names.
- `<skills-dir>` resolves to `.claude/skills/` in this bundle (or `.agents/skills/` when the Codex bundle is also present).
- Each instance touches only the files it was handed. Shared files, project config, scenes, and prefabs stay with the orchestrator — see `lead-agent-pool`'s Cocos parallel-safety reference.
