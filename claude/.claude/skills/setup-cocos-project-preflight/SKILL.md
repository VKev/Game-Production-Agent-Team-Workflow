---
name: setup-cocos-project-preflight
description: Inspect and classify a Cocos Creator repository (3.x or 2.x), its engine major line, asset-bundle contract, project-local editor extensions, Git/index state, resumable setup checkpoint, client bundles, and — for 3.x only — the embedded funplay-cocos-mcp server, without mutation or UI automation. Use at the start of setup-agents and every resume in a Cocos project to select Phase A, the editor-open checkpoint, the client-restart checkpoint, Phase B, or completed verification without repeating finished work.
---

# Cocos setup preflight

Run one deterministic read-only inspection before loading or mutating any other setup component in a Cocos Creator project. This is the Cocos peer of `setup-unity-project-preflight` and emits the same JSON contract, so `setup-agents` routes both engines through one state machine.

## Workflow

1. Resolve the intended project root. The inspector accepts both Creator lines and refuses anything else rather than guessing:
   - **3.x** — `assets/` plus a `package.json` carrying `creator.version`.
   - **2.x** — `assets/` plus a root `project.json` carrying `version`.
   It reads `creator_major` from whichever it found, and blocks with `unreadable-creator-version` when neither yields a version.
2. Run:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/inspect_cocos_setup_state.ps1 `
     -ProjectRoot <project-root>
   ```

3. Parse the JSON. `clients` reports which agent bundles this repository carries (`codex` from `.codex/agents/setup_agents.toml`, `claude` from `.claude/agents/setup-agents.md`); every setup skill uses it as the client scope. A nonzero exit means the inspector could not establish valid input. A zero-exit result with `recommended_phase=ambiguous` is a classified blocker: report `blockers` and stop mutating.
4. Route exactly once:
   - `phase-a`: run editor-independent setup (ignore rules, Beads, Serena, Better Context, CodeGraph, CocoIndex, Blender, the project-local editor extensions, and — on 3.x only — the Cocos MCP extension install).
   - `await-editor-open`: preserve Phase A and ask the user to open the exact project in Cocos Creator, because the MCP server is embedded in the editor and nothing live can be verified while it is closed. **A 2.x project never routes here** — `supports_mcp` is false, so there is nothing live to wait for and the inspector keeps it in `phase-a`.
   - `pending-client-restart`: preserve state; ask for the one restart of each client whose MCP configuration changed.
   - `phase-b`: resume from the first pending live operation (MCP verification, Better Context refresh, build gates).
   - `verify-complete`: run only the final read-only acceptance pass.
5. Persist the routed phase into the checkpoint the inspector reported (`.agent-temp/setup-checkpoints/setup-agents-cocos.json` by default) together with the project root, `creator_version`, and the `package.json` hash. The inspector marks a checkpoint stale when any of those changed.

## What the report contains

| Section | Meaning |
|---|---|
| `project` | Root, `creator_version`, `package.json`/`settings` hashes, whether `tsconfig.json` and `settings/v2/packages/builder.json` exist, the authored **bundle contract** (folder → `bundleName` read from `assets/*.meta`), and the editor extensions present. |
| `engine` | `creator_major`, `supports_mcp` (3.x and above), `editor_imported_project` (a generated `temp/tsconfig.cocos.json` proves the editor has opened this project at least once), and `editor_reachable`. |
| `cocos_mcp` | `applicable` (false on 2.x, where nothing below is probed), the project `funplay-cocos-mcp.config.json` path, the installed extension path/version, resolved host/port, tool profile, whether `execute_javascript` safety checks are on, reachability, and the live tool count from `GET /tools`. |
| `project.managed_extensions` | For each extension this package set owns (`dev-tools`, `minigame-pack`, `funplay-cocos-mcp`): whether it is installed, at which path, and its declared version. `setup-cocos-extensions` and `setup-cocos-mcp` classify from this instead of re-walking the project. |
| `git` | State, root, `HEAD`, staged paths. A non-empty index blocks setup. |
| `checkpoint` | Path, existence, phase, reusability, and exact stale reasons. |
| `clients` | Which agent bundles this repository carries. |

## Boundaries

- Read-only. The inspector never writes a file, installs anything, launches Cocos Creator, or changes editor state.
- Never probe an MCP port on a 2.x project. The editor MCP extension requires Creator 3.8+, so `cocos_mcp.applicable` is false and the whole section stays empty there.
- Never launch or close the Cocos Editor to make `editor_reachable` true; that is a user action at a checkpoint.
- The only liveness probe is a bounded `GET /health` (and `GET /tools`) against the host/port the project config declares. Never scan ports, never probe a port the project did not configure, and never assume the legacy `8765` default: current extension builds derive a per-project port in the 20000–29999 range.
- A missing `funplay-cocos-mcp.config.json` means the extension has not run in this project yet — report it; do not create the file here (`setup-cocos-mcp` owns it).
- Treat `library/`, `temp/`, `build/`, `local/`, and `profiles/` as regenerable; never inspect them for project facts and never delete them.
- Never report `ready` when a blocker is present, and never invent a phase that the checkpoint and live evidence do not support.
- Never use Computer Use, desktop automation, or the MCP input-simulation tools for any part of this inspection.
