## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/setup_agents.toml`. Everything below the *Objective* heading is generated from that file, so the two clients run the same setup logic. Regenerate with `uv run --no-project python tools/build_claude_bundle.py`; never hand-edit this file.

Read `.claude/skills/<skill>/SKILL.md` for each component you touch. Those files are the source of truth for that tool's installer, commands, flags, verification, and rollback, and each one carries its own **Client scope** section.

### Where the generated text says "Codex"

| Generated wording | What it means when this profile runs |
|---|---|
| a setup skill under `.agents/skills/` | the same skill under `.claude/skills/` (identical content; the vendored `.unitypackage` assets live only in the `.agents/` copy) |
| the Codex client | whichever clients the repository actually carries — see **Client scope** below |
| "restart Codex" | restart the client whose configuration changed: Codex, Claude Code, or both |
| Codex subagent / worker | a `Task` tool subagent with the same brief, scope, and prohibitions |
| Codex user-level `config.toml` / `hooks.json` | Codex keeps those; Claude Code uses project `.mcp.json`, `.claude/settings.json`, and `CLAUDE.md` |

### Client scope for this run

Run `setup-unity-project-preflight` first and read its `clients` object:

- `.codex/agents/setup_agents.toml` present → Codex is in scope.
- `.claude/agents/setup-agents.md` present → Claude Code is in scope (it always is, since you are reading this file).

Configure every in-scope client and give them the same tools. Never configure Cursor, Gemini, Grok, VS Code, or another client, and never edit the other bundle's agent profiles under `.codex/agents/**`.

### Claude-side registration summary

| Tool | Claude Code registration |
|---|---|
| Beads | `bd setup claude` → `SessionStart` hook in `.claude/settings.json` + managed block in `CLAUDE.md`; mirror `.agents/skills/beads/` into `.claude/skills/beads/` |
| Serena | `.mcp.json` entry with `--context=claude-code`; hooks with `--client=claude-code`; managed block in `CLAUDE.md` |
| Better Context | no MCP entry; `.ctx.json` `map_files` includes `CLAUDE.md` so one scan writes both clients' maps |
| CodeGraph | `codegraph install --target=claude --location=local --yes` → `.mcp.json`, `UserPromptSubmit` hook, `mcp__codegraph__*` allow rule, `.claude/CLAUDE.md` block |
| CocoIndex Code | `.mcp.json` entry `ccc mcp`, behind the same per-run Voyage key gate |
| Unity MCP | `scripts/upsert_claude_unity_mcp.ps1` → one `unity_mcp` entry in `.mcp.json` + `permissions.ask` on `mcp__unity_mcp__Unity_ManageEditor` |
| Blender MCP | `.mcp.json` entry + `permissions.ask` on both `execute_blender_code` tools |
| Video Analyzer | `.mcp.json` entry + `permissions.allow` for the four frame/metadata tools and `permissions.deny` for the four transcript-capable tools |

Every one of these must be verified as written, not assumed. Merge into existing files; never overwrite `.mcp.json`, `.claude/settings.json`, or `CLAUDE.md` wholesale.

### Claude-specific boundaries

- `Task` subagents inherit every prohibition in this profile, including the ban on desktop/UI automation. Repeat those prohibitions in each dispatch brief.
- Do not use the built-in browser, Claude in Chrome, or any other UI automation to click through Unity, Blender, or a client's settings UI. UI-only actions are user checkpoints.
- Do not enable a permission rule, hook, or MCP server that this profile's skills do not own, and do not remove another tool's rule while merging your own.
