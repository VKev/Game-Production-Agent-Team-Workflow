## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/cocos_port_triage.toml`. Regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- Dispatch it with the `Task` tool and **wait for it** (not in the background): it hands back a play-test checklist that a human has to tick, which is a gate no agent can pass on its own.
- `<skills-dir>` resolves to `.claude/skills/` in this bundle (or `.agents/skills/` when the Codex bundle is also present).
- It measures and decides only. Porting classes belongs to `cocos-port-class`; building scenes belongs to the Cocos MCP tools.
