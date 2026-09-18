## Claude Code adaptation

This profile is the Claude Code build of `codex/.codex/agents/tech_lead.toml`. Everything below is generated from that file; regenerate with `uv run --no-project python tools/build_claude_bundle.py` instead of editing here.

- Skills live at `.claude/skills/<skill>/SKILL.md` (same content as `.agents/skills/`).
- The Better Context project map you traverse is `CLAUDE.md` in this client, refreshed from the same scan that writes `AGENTS.md`. Root-to-target traversal, omission rules, and refresh policy are unchanged.
- Where the generated text says "Codex subagent", dispatch a `Task` subagent with the same brief, scope, and prohibitions.
- Where it says "restart Codex", restart the client whose configuration changed.
- Beads (`bd`) is the durable tracker in both clients and reads the same `.beads/` workspace; never substitute TodoWrite or a Markdown checklist for durable project work.
