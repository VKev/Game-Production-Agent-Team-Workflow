## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/cocos_developer.toml`. Everything below is generated from that file; regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- Skills live at `.claude/skills/<skill>/SKILL.md` (same content as `.agents/skills/`).
- The Better Context project map you traverse is `CLAUDE.md` in this client, written by the same scan that writes `AGENTS.md`. Its root section carries the verified Cocos facts: Creator version, the folder-to-bundle contract, the start scene, and the count of unresolved component types.
- MCP servers come from the project `.mcp.json`: `funplay_cocos` (the Cocos editor server), plus `serena`, `codegraph`, `cocoindex-code`, `blender`, and `video-analyzer` when registered. Tool names are `mcp__funplay_cocos__<tool>`.
- `mcp__funplay_cocos__execute_javascript`, `…__execute_scene_script`, and `…__execute_editor_script` are approval-gated by project policy: ask before each call, keep the code minimal, and never pass `safety_checks: false`.
- The desktop input-simulation tools (`simulate_mouse_click`, `simulate_mouse_drag`, `simulate_key_press`, `simulate_key_combo`, `simulate_preview_input`, `simulate_button_click`) and `capture_desktop_screenshot` are **denied** in `.claude/settings.json`. Do not ask for them to be allowed; use the in-editor captures and the dedicated scene/prefab tools.
- Where the generated text describes a Codex subagent, dispatch a `Task` subagent with the same brief and prohibitions. Where it says "restart Codex", restart the client whose configuration changed.
- Never use the built-in browser, Claude in Chrome, or any other UI automation to drive Cocos Creator. Editor install, extension reload, and opening **Funplay > MCP Server** are user actions.
