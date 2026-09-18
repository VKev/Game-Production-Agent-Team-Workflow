## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/unity_developer.toml`. Everything below is generated from that file; regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- Skills live at `.claude/skills/<skill>/SKILL.md` (same content as `.agents/skills/`). The vendored `.unitypackage` archives exist only under `.agents/skills/setup-unity-packages/assets/`.
- The Better Context project map you traverse is `CLAUDE.md` in this client, written by the same scan that writes `AGENTS.md`; treat both as one map with one refresh.
- MCP servers come from the project `.mcp.json`: `serena`, `codegraph`, `cocoindex-code`, `unity_mcp`, `blender`, and `video-analyzer` when registered. Tool names are `mcp__<server>__<tool>`.
- `mcp__unity_mcp__Unity_ManageEditor`, `mcp__blender__execute_blender_code`, and `mcp__blender__execute_blender_code_for_cli` are approval-gated by project policy. Ask before each call and keep it minimal; do not try to widen a permission rule to avoid the prompt.
- Where the generated text says "restart Codex", restart the client whose configuration changed. Where it describes a Codex subagent, dispatch a `Task` subagent with the same brief and prohibitions.
- Never use the built-in browser, Claude in Chrome, or any other UI automation to drive Unity, Blender, or a settings UI. UI-only actions are user checkpoints.
