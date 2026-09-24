# Agents-Tu-Build

Portable, copy-and-go agent packages for game projects — Unity `6000.3.21f1`,
Cocos Creator `3.8`, and Cocos Creator `2.4` — one bundle per AI client, built
from one shared source.

| Folder | Copy into a project root to get |
|---|---|
| `codex/` | Codex: `.codex/agents/*.toml` profiles + the shared skill library at `.agents/skills/` (including the vendored `*.unitypackage` archives). |
| `claude/` | Claude Code: `.claude/agents/*.md` profiles, `.claude/skills/`, `.claude/settings.json`, `.mcp.json`, and a starter `CLAUDE.md`. See [`claude/README.md`](claude/README.md). |
| `tools/` | The generator that builds the Claude bundle from the Codex one, plus the hand-written Claude preambles. |

Slash commands ship as `codex/.codex/prompts/*.md` (the canonical copy) and are
generated into `claude/.claude/commands/*.md`. Claude Code reads project commands
straight from the copied bundle; **Codex only reads prompts from `~/.codex/prompts/`**,
so copy them there once:

```bash
mkdir -p ~/.codex/prompts && cp codex/.codex/prompts/*.md ~/.codex/prompts/
```

Codex documents custom prompts as deprecated in favour of skills, so the skills
themselves remain the primary surface for both clients.

Copy one bundle for a single-client project, or both for the dual-client setup.
Then ask the `setup-agents` agent to run: it installs, registers, and verifies
every tool and reports one state per component.

## Engines

`setup-agents` detects the engine from authored project markers and runs only that
engine's phases:

| Engine | Detected from | Engine-specific skills |
|---|---|---|
| Unity `6000.3.21f1` | `Assets/` + `ProjectSettings/ProjectVersion.txt` | `setup-unity-*` (preflight, gitignore, MCP relay, packages, ZLinq), `dev-unity-*` (60 skills) |
| Cocos Creator `3.8` | `assets/` + `package.json` with `creator.version` | `setup-cocos-*` (preflight, gitignore, extensions, funplay MCP), `dev-cocos-*` (11 skills) |
| Cocos Creator `2.4` | `assets/` + root `project.json` with a `2.x` version | `setup-cocos-*` (preflight, gitignore, extensions), `dev-cocos-*` |

Unity is checked first, because a Unity project can carry Node tooling and
`Assets/` also answers to `assets/` on a case-insensitive filesystem. Everything
else in the package set is engine-neutral.

Inside Cocos, the major line changes only two things. **Editor extensions**: the
package set vendors both builds of `dev-tools` (quick-dev menu) and
`minigame-pack` (mini-game subpackage packer), and installs the 3.x build into
`extensions/` or the 2.x build into `packages/`, because the two extension
systems share no loading contract. **MCP**: `funplay-cocos-mcp` is Creator 3.x
only, so a 2.x project registers no MCP entry and never waits for an editor —
its whole setup is editor-independent.

For Cocos 3.x the editor MCP server is `funplay-cocos-mcp`, an extension embedded
in Cocos Creator: it exists only while the editor is open, its port is per project,
and its three code-execution tools are approval-gated in both clients while its
desktop input-simulation and desktop-capture tools are denied outright.

Better Context covers both lines, with measured limits on 2.x: maps and JS
symbols work, `.prefab` files parse, but `.fire` scenes are never parsed and the
`cocos` queries need a root `package.json` that a stock 2.x project does not have.
`setup-better-context` reports the coverage level rather than implying more.

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
| Cocos MCP | `[mcp_servers.funplay_cocos]` + per-tool approval + `disabled_tools` | `.mcp.json` HTTP entry + `permissions.ask` / `permissions.deny` |
| Blender MCP | `[mcp_servers.blender]` + per-tool approval | `.mcp.json` entry + `permissions.ask` on both code-execution tools |
| Video Analyzer | `enabled_tools`/`disabled_tools` | `permissions.allow`/`permissions.deny` |

Three asymmetries are upstream limitations that setup reports instead of faking:
Beads gives Claude one `SessionStart` hook against Codex's four native hooks,
CodeGraph refuses `--location=local` for Codex, and Claude Code cannot filter a
server's tool list, so transcript-capable video tools are denied rather than
hidden.

## Browser-game fetch and port pipeline

Six skills cover acquiring a live browser game, rebuilding it as a Cocos
project and cleaning it for the one platform it ships to, with three agents for
the parallel parts:

| Skill | In → out | Command |
|---|---|---|
| `research-browser-game-mirror` | game URL (any engine) → offline mirror + API fixtures | `/research-browser-game-mirror` |
| `research-browser-game-batch` | list of Cocos games → one folder each, with status and resume | `/research-browser-game-batch` |
| `dev-cocos-port-2x` | Cocos 2.x build → runnable Creator 2.4.x project | `/dev-cocos-port-2x` |
| `dev-cocos-port-3x` | Cocos 3.x build → runnable Creator 3.8 TypeScript project | `/dev-cocos-port-3x` |
| `dev-cocos-migrate-2x-to-3x` | Creator 2.x project with source → 3.8 project | `/dev-cocos-migrate-2x-to-3x` |
| `dev-cocos-clean-3x-minigame` | ported 3.x project → only the shipping platform (TikTok) left, still playable | `/dev-cocos-clean-3x-minigame` |

Agents: `browser-game-fetcher` (batch worker), `cocos-port-triage` (GO/NO-GO gate,
run it synchronously), `cocos-port-class` (one class per dispatch, fan out).

Prerequisites beyond the usual set: Node 22+ for the `.mjs` scripts, `python3` for
the local-run and extraction scripts, a Chrome/Chromium for runtime capture, the
`funplay_cocos` MCP for 3.x scene work, and optionally `oxipng`. `setup-game-toolchain`
installs the `python3` and `oxipng` halves; Node comes from `setup-video-analyzer`
and the Cocos MCP from `setup-cocos-mcp`.

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
requires `1.8.0` or newer — 1.7.0 added multi-client map files, 1.8.0 added the
Cocos Creator project kind and its `cocos list|show|components` commands.
`Blender MCP` comes from Blender's own
[`lab/blender_mcp`](https://projects.blender.org/lab/blender_mcp) — not the
similarly named third-party packages. `Cocos MCP` is
[`FunplayAI/funplay-cocos-mcp`](https://github.com/FunplayAI/funplay-cocos-mcp),
installed as a Cocos Creator extension rather than as a standalone server.
