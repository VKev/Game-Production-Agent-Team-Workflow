# Claude Code instructions

Starter project instructions for the Claude bundle. Setup tools append their own
marker-managed blocks to this file — Beads (`<!-- BEGIN BEADS INTEGRATION -->`),
Serena, and Better Context Unity (`<!-- better-context-unity:begin -->`). Keep
handwritten guidance outside those markers; regeneration preserves it.

This project also carries the Codex bundle (`AGENTS.md`, `.codex/`, `.agents/`)
when both were copied. Both clients are configured to the same tool set, and
both read the same Beads workspace, the same CodeGraph index, and the same
Better Context scan. `AGENTS.md` is the Codex-facing twin of this file.

## Engine

This bundle serves two engines, and `setup-agents` detects which one this project is:

- **Unity** — `Assets/` + `ProjectSettings/ProjectVersion.txt` (6000.3.21f1).
- **Cocos Creator** — `assets/` + `package.json` with `creator.version` (3.8).

Use the matching agent profile (`unity-developer` or `cocos-developer`) and the
matching skills (`dev-unity-*` / `setup-unity-*`, or `dev-cocos-*` / `setup-cocos-*`).
Beads, Serena, Better Context, CodeGraph, CocoIndex, Blender, and the video analyzer
are engine-neutral.

## Unity Play Mode guard

- Never run Better Context scans, Editor sync, verification, map generation, or
  refresh commands while Unity is in Play Mode or entering Play Mode.
- Exit Play Mode and wait until the Unity Editor is idle first. Do not interrupt
  a gameplay session to refresh project context.

## Beads issue tracker

This project uses **bd (beads)** for durable task tracking.

```bash
bd ready                # find available work
bd show <id>            # view issue details
bd update <id> --claim   # claim work
bd close <id>           # complete work
bd prime                # refresh Beads context
```

Use `bd` for all durable project work — not TodoWrite and not Markdown TODO
lists. Use `bd remember` for persistent project knowledge instead of ad-hoc
memory files. If the Claude-side integration is missing, run `bd setup claude`
once; it merges into `.claude/settings.json` and this file.

## Retrieval routing

1. **Better Context** first: traverse the root-to-target `CLAUDE.md` maps and use
   its C#/Unity queries to find the region or symbol.
2. **CodeGraph** once a concrete path, type, or symbol is known, for
   relationships, call paths, and blast radius.
3. **CocoIndex Code** when the terminology or location is unknown; it searches
   the whole project, then hand the names back to CodeGraph.
4. **Serena** for semantic source edits after the exact targets are known — not
   as the ordinary code reader.
5. Built-in read/search tools whenever an index is unavailable.

## Approval-gated tools

`mcp__unity_mcp__Unity_ManageEditor`, the three Cocos execution tools
(`mcp__funplay_cocos__execute_javascript`, `…__execute_scene_script`,
`…__execute_editor_script`), and both Blender code tools are deliberately gated in
`.claude/settings.json`. Ask before each call and keep it minimal. The Cocos
desktop input-simulation tools and `capture_desktop_screenshot` are denied outright:
this project set does not automate a desktop. The
`video-analyzer` transcript tools are denied by policy: captions or frames only,
never audio transcription.

## Project-local agents and skills

- `.claude/agents/` — `setup-agents`, `tech-lead`, `unity-developer`, and
  `cocos-developer` profiles, generated from the Codex profiles so both clients
  behave the same. Dispatch them with the `Task` tool.
- `.claude/skills/` — the shared skill library. Skills are optional reference
  material: consult the ones that actually apply, not all of them. The vendored
  `.unitypackage` archives live only in `.agents/skills/setup-unity-packages/assets/`.
- `.claude/commands/` — slash commands for the browser-game fetch and Cocos port
  pipeline (`/research-browser-game-mirror`, `/dev-cocos-port-3x`, …).
- `.mcp.json` + `.claude/settings.json` — project MCP servers, their enable list,
  permission policy, and hooks.

## Non-interactive shell commands

**Always use non-interactive flags** so a command cannot hang on a prompt:
`cp -f`, `mv -f`, `rm -f`, `rm -rf`, `cp -rf`, `scp -o BatchMode=yes`,
`ssh -o BatchMode=yes`, `apt-get -y`, `HOMEBREW_NO_AUTO_UPDATE=1 brew ...`.
