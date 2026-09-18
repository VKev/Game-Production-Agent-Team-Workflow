# Agents-Tu-Build

Portable, copy-and-go agent packages for Unity `6000.3.21f1` projects — one per
AI client, built from one shared source.

| Folder | Copy into a project root to get |
|---|---|
| `codex/` | Codex: `.codex/agents/*.toml` profiles + the shared skill library at `.agents/skills/` (including the vendored `*.unitypackage` archives). |
| `claude/` | Claude Code: `.claude/agents/*.md` profiles, `.claude/skills/`, `.claude/settings.json`, `.mcp.json`, and a starter `CLAUDE.md`. See [`claude/README.md`](claude/README.md). |
| `tools/` | The generator that builds the Claude bundle from the Codex one, plus the hand-written Claude preambles. |

Copy one bundle for a single-client project, or both for the dual-client setup.
Then ask the `setup-agents` agent to run: it installs, registers, and verifies
every tool and reports one state per component.

## Tools both clients get

Beads, Serena, Better Context Unity, CodeGraph, CocoIndex Code (behind an
explicit per-run Voyage key), official Unity MCP, Blender MCP, the caption-gated
Video Analyzer, plus the Unity package work (NuGetForUnity, ZLinq, VContainer,
ProBuilder, VFX Graph, glTFast, Cinemachine, Burst, Collections, and the
registered asset packages).

`setup-agents` detects which bundles the repository carries and configures every
one of them, so a tool added for one client is added for the other with the same
command, arguments, and approval policy. Registration differs where the clients
differ:

| Tool | Codex | Claude Code |
|---|---|---|
| Beads | `bd setup codex` → `AGENTS.md` + `.codex/hooks.json` | `bd setup claude` → `CLAUDE.md` + `.claude/settings.json` |
| Serena | user `config.toml`, `--context=codex`, hooks `--client=codex` | `.mcp.json`, `--context=claude-code`, hooks `--client=claude-code` |
| Better Context | managed map block in `AGENTS.md` | same block in `CLAUDE.md`, from the same scan (`map_files` in `.ctx.json`) |
| CodeGraph | `--target=codex --location=global` | `--target=claude --location=local` |
| CocoIndex Code | `codex mcp add cocoindex-code -- ccc mcp` | `.mcp.json` entry `ccc mcp` |
| Unity MCP | `upsert_codex_unity_mcp.ps1`, `approval_mode = "approve"` on `Unity_ManageEditor` | `upsert_claude_unity_mcp.ps1`, `permissions.ask` on the same tool |
| Blender MCP | `[mcp_servers.blender]` + per-tool approval | `.mcp.json` entry + `permissions.ask` on both code-execution tools |
| Video Analyzer | `enabled_tools`/`disabled_tools` | `permissions.allow`/`permissions.deny` |

Three asymmetries are upstream limitations that setup reports instead of faking:
Beads gives Claude one `SessionStart` hook against Codex's four native hooks,
CodeGraph refuses `--location=local` for Codex, and Claude Code cannot filter a
server's tool list, so transcript-capable video tools are denied rather than
hidden.

## Editing the packages

`codex/` is the source of truth. `claude/.claude/agents/**` and
`claude/.claude/skills/**` are generated:

```bash
uv run --no-project python tools/build_claude_bundle.py          # regenerate
uv run --no-project python tools/build_claude_bundle.py --check  # report drift
```

- Change a skill → edit `codex/.agents/skills/<skill>/SKILL.md`, then rebuild.
- Change an agent profile → edit `codex/.codex/agents/<profile>.toml`, then rebuild.
- Change only the Claude-facing framing of a profile → edit
  `tools/claude-preambles/<profile>.md`, then rebuild.
- `claude/.mcp.json`, `claude/.claude/settings.json`, `claude/CLAUDE.md`, and the
  two READMEs are hand-maintained; the builder never overwrites them.

The vendored `*.unitypackage` archives (~450 MB, Git LFS) live only in
`codex/.agents/skills/setup-unity-packages/assets/` and are never duplicated
into the Claude bundle.

## Custom upstreams

`Better Context Unity` is the fork at
[`VKev/Better-Context`](https://github.com/VKev/Better-Context); `setup-better-context`
requires `1.7.0` or newer, the release that added multi-client map files.
`Blender MCP` comes from Blender's own
[`lab/blender_mcp`](https://projects.blender.org/lab/blender_mcp) — not the
similarly named third-party packages.
