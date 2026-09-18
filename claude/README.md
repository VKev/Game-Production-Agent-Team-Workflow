# Claude Code project bundle

Copy this folder's contents into a Unity or Cocos Creator project root and Claude Code has the
same agents, skills, MCP servers, hooks, and policies the `codex/` bundle gives
Codex.

```bash
# from the repository that holds this bundle
cp -rf claude/. /path/to/GameProject/
```

On Windows PowerShell:

```powershell
Copy-Item -Recurse -Force .\claude\* -Destination D:\path\to\GameProject\
Copy-Item -Force .\claude\.mcp.json -Destination D:\path\to\GameProject\
```

Then open the project in Claude Code and ask the `setup-agents` agent to run.
It installs and verifies every tool and reports one state per component.

## What is in here

| Path | Purpose |
|---|---|
| `.claude/agents/*.md` | `setup-agents`, `tech-lead`, `unity-developer`, `cocos-developer`. Generated from `codex/.codex/agents/*.toml`, so both clients run the same logic. |
| `.claude/skills/**` | The shared skill library (`dev-unity-*`, `dev-cocos-*`, `setup-*`, `threejs-*`, …), generated from `codex/.agents/skills/**`. |
| `.claude/settings.json` | MCP enable list, permission policy (approval gates plus the video-analyzer deny list), and Serena's hooks. Beads' `SessionStart` hook and CodeGraph's `UserPromptSubmit` hook are deliberately absent: their own installers write them during setup, so shipping them here would create duplicates. |
| `.mcp.json` | Project MCP servers: `serena`, `codegraph`, `cocoindex-code`, `blender`, `video-analyzer`. The engine server is added by setup once its address is known — `unity_mcp` (resolved relay path) or `funplay_cocos` (the port the Cocos editor extension reports). |
| `CLAUDE.md` | Starter project instructions. Setup appends marker-managed blocks (Beads, Serena, Better Context) to it. |

## Which engine

The bundle covers Unity 6000.3.21f1 and Cocos Creator 3.8. `setup-agents` detects
the engine from the project markers and runs only that engine's phases: Unity gets
the Assistant/Unity MCP relay, UPM packages, ZLinq and the asset packages; Cocos
gets the `funplay-cocos-mcp` editor extension and its gate policy. Everything else
— Beads, Serena, Better Context, CodeGraph, CocoIndex, Blender, video analyzer — is
the same for both.

## Before it all works

Copying files registers the tools; it does not install them. `setup-agents`
owns the installs and the verification, but these are the prerequisites it
cannot invent:

- **`CLAUDE.md` already exists in the target project** → merge by hand or let
  `setup-agents` do it. Do not overwrite a project's own instructions.
- **`.mcp.json` / `.claude/settings.json` already exist** → same: merge the
  entries, keep unrelated servers, hooks, and permissions.
- **Unity MCP** needs the official relay from `com.unity.ai.assistant`, one
  Unity restart, and an approval in **Project Settings > AI > Pending
  Connections**. `setup-unity-mcp` runs `scripts/upsert_claude_unity_mcp.ps1`
  to write the entry with the resolved relay path.
- **Cocos MCP** needs the `funplay-cocos-mcp` extension installed in the project
  and **Cocos Creator open** — the MCP server is embedded in the editor, so nothing
  live works while it is closed. The port is per project; setup reads it from
  `funplay-cocos-mcp.config.json` rather than assuming `8765`.
- **Blender MCP** needs the Blender add-on from `https://lab.blender.org/`
  installed and enabled by you, and `BLENDER_MCP_PORT` in `.mcp.json` must match
  the add-on's port (the default is `9876`).
- **CocoIndex Code** stays inert until you supply a Voyage API key for that
  setup run and `ccc init` succeeds.
- **Vendored Unity asset packages** (`*.unitypackage`, ~450 MB) are not
  duplicated here. They live in `codex/.agents/skills/setup-unity-packages/assets/`;
  copy that folder too if you need the asset-import step.

## Dual-client parity

Both bundles configure every client the repository carries — `setup-agents`
detects them from `.codex/agents/setup_agents.toml` and
`.claude/agents/setup-agents.md`. A tool added for one client is added for the
other, with the same command and the same exposure or approval policy.

Three asymmetries are upstream limitations, and setup reports them instead of
faking parity:

| Tool | Codex | Claude Code |
|---|---|---|
| Beads hooks | four native hooks (`SessionStart`, `UserPromptSubmit`, `PreCompact`, `PostCompact`) via `bd codex-hook` | one `SessionStart` hook via `bd prime --hook-json`; no `bd claude-hook` exists |
| CodeGraph install | user-level only (`--location=local` is refused for Codex) | project-level (`--target=claude --location=local`) |
| Video Analyzer | transcript tools removed from the exposed list | transcript tools visible but denied by permission rule |

## Regenerating

`.claude/agents/**` and `.claude/skills/**` are generated. Edit
`codex/.codex/agents/*.toml`, `codex/.agents/skills/**`, or
`tools/claude-preambles/*.md`, then run:

```bash
uv run --no-project python tools/build_claude_bundle.py
```

`--check` reports drift without writing, which is what to run before committing.
The static files in this folder (`.mcp.json`, `.claude/settings.json`,
`CLAUDE.md`, this README) are hand-maintained and never overwritten by the
builder.
