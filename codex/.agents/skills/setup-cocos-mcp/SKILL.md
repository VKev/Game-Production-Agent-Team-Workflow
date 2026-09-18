---
name: setup-cocos-mcp
description: Install, verify, and register the official FunplayAI funplay-cocos-mcp editor extension for a Cocos Creator 3.8 project and every AI client bundle present in the repository (Codex TOML and Claude Code .mcp.json), with the code-execution and desktop-input tools gated client-side. Use when preparing a copied agent package in a Cocos project, when the extension or its client registration is missing or stale, or when the MCP server is unreachable.
---

# Cocos MCP Setup

`funplay-cocos-mcp` is an **editor extension**, not a standalone server: it embeds a streamable-HTTP MCP endpoint inside Cocos Creator. Nothing works while the editor is closed, and no client configuration can change that. Read [references/sources.md](references/sources.md) before changing install, version, port, or registration behavior.

```text
MCP client  <= HTTP =>  funplay-cocos-mcp (inside Cocos Creator)  =>  editor + scene
```

## Client scope

Configure only the client bundles present in the repository, and configure every one of them:

- `.codex/agents/setup_agents.toml` present → Codex (user-level `config.toml`).
- `.claude/agents/setup-agents.md` present → Claude Code (project `.mcp.json` plus `.claude/settings.json`).

Both entries must point at the same resolved URL and carry the same tool policy. Never configure Cursor, Trae, Kiro, VS Code, or another client, and never use the extension panel's one-click configurator for a client outside this scope.

## Required state

- Extension: `funplay-cocos-mcp` under `<project>/extensions/`, or installed for all projects under `%USERPROFILE%\.CocosCreator\builtin-extensions\<Creator version>\funplay-cocos-mcp`.
- Project config: `funplay-cocos-mcp.config.json` at the project root — the authoritative source for host, port, tool profile, and safety checks.
- Server id in every client: `funplay_cocos`.
- Transport: streamable HTTP at the port the project config declares. Current builds derive a stable per-project port in `20000–29999`; older projects keep `8765`. **Read the port; never hardcode it.**
- `execute_javascript` safety checks: enabled.

## Workflow

1. Run `setup-cocos-project-preflight` first and read its `cocos_mcp` section: extension path and version, config path, host, port, tool profile, safety-check state, reachability, and live tool count. Do not re-derive any of that by hand.
2. Resolve the installed extension version and compare it with the latest official release:
   - Releases live at `https://github.com/FunplayAI/funplay-cocos-mcp/releases`, each publishing `Funplay.CocosMcp.v<version>.zip` plus `SHA256SUMS.txt`.
   - Treat an older installed version as `incorrect` only when the user wants the update; an older working extension is not a setup failure. Record both versions either way.
3. Install or repair the extension only when it is missing or the user asked for the update, using one official route and no other:
   - Cocos Store page `https://store.cocos.com/app/detail/8913` (user action in the editor), or
   - the release zip, verified against `SHA256SUMS.txt` before extraction, unpacked into `<project>/extensions/funplay-cocos-mcp`, or
   - `git clone https://github.com/FunplayAI/funplay-cocos-mcp.git extensions/funplay-cocos-mcp`.
   Never install from a fork or mirror, never patch the extension's files, and never delete an existing extension folder to force a clean install — back it up first and report the path.
4. After any install or update, the editor must reload extensions. That is a user action: ask, then wait for preflight to report `reachable`.
5. Read `funplay-cocos-mcp.config.json` and record `host`, `port`, `toolProfile`, `enabledToolCategories`, and `executeJavascriptSafetyChecks`. If the file does not exist, the extension has never run in this project: ask the user to open **Funplay > MCP Server** once so it is created with the project's real port. Do not hand-write this file.
6. Verify the endpoint with two bounded read-only requests before touching any client config:
   - `GET http://<host>:<port>/health` must return 200.
   - `GET http://<host>:<port>/tools` must return the live tool list; record the count and names.
7. Register Codex when its bundle is present. Back up the active Codex `config.toml` outside the project, then merge only this entry:

   ```toml
   [mcp_servers.funplay_cocos]
   url = "http://127.0.0.1:<port>/"
   enabled = true
   disabled_tools = [
     "simulate_mouse_click", "simulate_mouse_drag", "simulate_key_press",
     "simulate_key_combo", "simulate_preview_input", "simulate_button_click",
     "capture_desktop_screenshot",
   ]

   [mcp_servers.funplay_cocos.tools.execute_javascript]
   approval_mode = "approve"

   [mcp_servers.funplay_cocos.tools.execute_scene_script]
   approval_mode = "approve"

   [mcp_servers.funplay_cocos.tools.execute_editor_script]
   approval_mode = "approve"
   ```

8. Register Claude Code when its bundle is present. Merge into the project `.mcp.json`, preserving unrelated servers:

   ```json
   { "mcpServers": { "funplay_cocos": { "type": "http", "url": "http://127.0.0.1:<port>/" } } }
   ```

   Then merge the matching policy into `.claude/settings.json`, because `.mcp.json` has no tool filter and the extension itself states it has **no approval toggle of its own**:

   ```json
   {
     "enabledMcpjsonServers": ["funplay_cocos"],
     "permissions": {
       "allow": ["mcp__funplay_cocos__*"],
       "ask": [
         "mcp__funplay_cocos__execute_javascript",
         "mcp__funplay_cocos__execute_scene_script",
         "mcp__funplay_cocos__execute_editor_script"
       ],
       "deny": [
         "mcp__funplay_cocos__simulate_mouse_click",
         "mcp__funplay_cocos__simulate_mouse_drag",
         "mcp__funplay_cocos__simulate_key_press",
         "mcp__funplay_cocos__simulate_key_combo",
         "mcp__funplay_cocos__simulate_preview_input",
         "mcp__funplay_cocos__simulate_button_click",
         "mcp__funplay_cocos__capture_desktop_screenshot"
       ]
     }
   }
   ```

   Claude evaluates `deny` before `ask` before `allow`, so the broad allow entry cannot re-enable a gated or denied tool.
9. Keep the two clients identical: same URL, same three approval-gated execution tools, same denied input-simulation and desktop-capture tools. A difference is a parity defect, not a preference.
10. Ask for one restart of each client whose configuration changed, then verify live: the client lists `funplay_cocos`, a read-only call such as `get_project_info` succeeds, and one execution tool prompts for approval instead of running silently.
11. Report per client: extension version and install route, resolved URL, tool profile and live tool count, the gated and denied tool lists, whether the editor was reachable, and which clients must restart.

## Known asymmetry

Codex can remove the input-simulation tools from the exposed list with `disabled_tools`; Claude Code cannot filter a server's tool list, so the same tools stay visible and are refused by a `deny` rule instead. Verify the Claude side by confirming the deny rules exist, not by expecting the names to disappear. This mirrors the Video Analyzer asymmetry documented in `setup-video-analyzer`.

## Boundaries

- Install only from the Cocos Store listing, the official GitHub releases, or the official Git repository. The npm `funplay-cocos-mcp` package is only the optional stdio bridge to an already-running editor server; it is not a replacement for the extension and is out of scope unless the user asks for it.
- Never launch, focus, or close Cocos Creator, and never automate its UI. Extension install, extension reload, and opening **Funplay > MCP Server** are user actions at a checkpoint.
- Never call the MCP input-simulation or desktop-capture tools from setup, and never remove their deny/disable rules; this package set prohibits desktop automation regardless of which transport offers it.
- Keep `executeJavascriptSafetyChecks` enabled and never pass `safety_checks: false` from setup. The upstream docs call the checks a guardrail, not a sandbox.
- Never hardcode port `8765`, never scan for the port, and never write `funplay-cocos-mcp.config.json` by hand; the extension owns it.
- Never edit, patch, or vendor-fork the extension's files, and never delete the extension folder without a recorded backup.
- Never overwrite `config.toml`, `.mcp.json`, or `.claude/settings.json` wholesale; merge the exact entries this skill owns and keep unrelated servers, hooks, and permissions intact.
- Do not report live-ready from configuration alone: an unreachable editor means `restart-ready` or `pending user action`, never `created` and verified.
- Use at most one normal invocation and one retry after a relevant repair, with a 60-second diagnostic budget and a 180-second download budget.
