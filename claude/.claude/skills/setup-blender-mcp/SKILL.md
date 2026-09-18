---
name: setup-blender-mcp
description: Check, install, register, and verify the official Blender Labs MCP server (blender-mcp) for every AI client bundle present in the repository — Codex user-level TOML and Claude Code project .mcp.json — including its Blender add-on prerequisite, host/port pairing, and per-tool approval for arbitrary Python execution. Use when preparing a copied agent package, when Blender tools are missing from a client, when the MCP server cannot reach Blender, or when code-execution tools must stay approval-gated.
---

# Blender MCP Setup

Install the official Blender MCP server from Blender's own repository, pair it with the Blender add-on that executes requests, and register it for each client bundle that exists in this repository. Read [references/sources.md](references/sources.md) before changing installation or registration behavior.

Blender MCP has two halves that talk over a local TCP socket:

```text
MCP client  <= MCP/stdio =>  blender-mcp  <= TCP socket =>  Blender add-on
```

The server alone answers documentation queries; every scene, screenshot, render, or code tool additionally requires a running Blender with the add-on enabled. Treat "server registered" and "Blender reachable" as two separate states.

## Client scope

Configure only the client bundles present in this repository, and configure every one of them so the Blender tools are available from each:

- `.codex/agents/setup_agents.toml` present → configure Codex (user-level `config.toml`).
- `.claude/agents/setup-agents.md` present → configure Claude Code (project `.mcp.json` plus `.claude/settings.json`).

Never configure Cursor, Gemini, Grok, VS Code, or another client, and never remove or weaken the other client's Blender entry.

## Workflow

1. Resolve the target repository root, but treat uv, the `blender-mcp` tool, and the Blender add-on as user-level installations shared by projects.
2. Reuse the uv installation established by `setup-serena`. Resolve `uv` before invoking it and run `uv --version`; do not reinstall uv merely to refresh PATH.
3. Resolve `blender-mcp` and inspect `uv tool list`:
   - If `blender-mcp` resolves and `blender-mcp --help` succeeds, record the version from `uv tool list` and do not reinstall.
   - If the tool is not registered, install it from the official repository subdirectory:
     `uv tool install "git+https://projects.blender.org/lab/blender_mcp.git#subdirectory=mcp"`
   - If it is registered but not on PATH, resolve `uv tool dir --bin`, refresh only the current process PATH, and retry instead of reinstalling.
   - A local working copy is an acceptable source only when the user supplies its path explicitly for this run; install it with `uv tool install <path>/mcp` and record the resolved source path from `uv tool list` output or the tool receipt.
4. Verify `blender-mcp --help` reports the `--transport {stdio,http}` interface. Every client registration uses default stdio transport; never register the HTTP transport or a bound port for a local client.
5. Establish the Blender add-on state without automating Blender's UI:
   - Ask the user to confirm (or perform) the one-time manual add-on install: add the Blender Lab extensions repository `https://lab.blender.org/` in **Preferences > Get Extensions > Repositories**, then install and enable the MCP add-on.
   - Ask for the add-on preference values in use: host, port, and whether auto-start is enabled. The add-on default port is `9876`.
   - Record `pending user action` when the add-on state cannot be confirmed. Structural registration may still finish.
6. Pair the server with the add-on through environment variables, not flags. The server reads `BLENDER_MCP_HOST` (default `127.0.0.1`) and `BLENDER_MCP_PORT` (default `9876`); set a variable in the client entry only when the add-on uses a non-default value, and then set exactly the value the add-on reports.
7. Set `BLENDER_PATH` in the client entry only when the user explicitly wants the `*_for_cli` background-Blender tools and `blender` is not already resolvable on PATH. Verify the path exists and is the intended Blender executable before writing it.
8. Register Codex when its bundle is present. Back up the active Codex home `config.toml` outside the project first, then merge only this entry, preserving every unrelated value:

   ```toml
   [mcp_servers.blender]
   enabled = true
   command = "blender-mcp"

   [mcp_servers.blender.env]
   BLENDER_MCP_PORT = "9876"

   [mcp_servers.blender.tools.execute_blender_code]
   approval_mode = "approve"

   [mcp_servers.blender.tools.execute_blender_code_for_cli]
   approval_mode = "approve"
   ```

   Omit the `env` table entirely when the add-on uses the defaults.
9. Register Claude Code when its bundle is present:
   - Merge the matching server into the project `.mcp.json`, preserving unrelated servers:

     ```json
     { "mcpServers": { "blender": { "command": "blender-mcp", "env": { "BLENDER_MCP_PORT": "9876" } } } }
     ```

   - Add `blender` to `enabledMcpjsonServers` in `.claude/settings.json` so the copied project bundle works without a manual approval prompt.
   - Mirror Codex's per-tool approval in the same file, because `.mcp.json` has no per-tool field:

     ```json
     {
       "permissions": {
         "ask": [
           "mcp__blender__execute_blender_code",
           "mcp__blender__execute_blender_code_for_cli"
         ]
       }
     }
     ```

   - Keep both entries' command, environment, and approval policy identical across clients; a difference is a parity defect, not a preference.
10. Verify structurally: `blender-mcp --help` succeeds, `uv tool list` shows the tool and its source, each configured client file parses, each holds exactly one `blender` entry with the same command/env, and the two code-execution tools are approval-gated in every configured client. Report `restart-ready` at this point and name each client that must restart.
11. Verify live only when the user confirms Blender is open with the add-on running: make one read-only call (`get_blendfile_summary_path_info` or `get_objects_summary`) and record the result. A refused connection means the add-on is not listening or the port does not match step 6; repair the pairing rather than reinstalling the server.
12. Report one state per client, the installed tool version and source, the add-on/host/port evidence, whether a client restart is required, and whether live verification ran or is pending.

## Boundaries

- Install only from `https://projects.blender.org/lab/blender_mcp.git` (subdirectory `mcp`) or an explicitly supplied local working copy of that repository. The similarly named third-party PyPI/GitHub packages are different projects; never substitute one, and never install a fork or mirror.
- Never install the Blender add-on by automating Blender's UI, editing Blender's extension database, or copying add-on files into a Blender installation. The extensions-repository install is a manual user action at a checkpoint.
- Never launch, focus, or close Blender automatically, and never call Computer Use or another desktop/UI automation tool for any part of this setup.
- Keep `execute_blender_code` and `execute_blender_code_for_cli` approval-gated in every client. They run arbitrary Python inside Blender; removing the gate is out of scope for setup even on request.
- Treat the user's `.blend` files as read-only during setup. Do not save, overwrite, re-render over, or "clean up" a scene to prove the connection works; one read-only summary call is the whole live check.
- Register stdio transport only. Do not enable the HTTP transport, bind a port, or expose the server beyond `127.0.0.1`.
- Never overwrite `config.toml`, `.mcp.json`, or `.claude/settings.json` wholesale; merge the exact entries this skill owns and keep unrelated servers, hooks, and permissions intact.
- Do not create a second `blender` entry under a different name (for example `blender-mcp`) in the same client. Exactly one entry per client, and the other client's entry is never edited from the bundle you are not configuring — except to report a parity gap.
- Do not treat a structurally valid configuration as live. A registered server with no reachable add-on is `restart-ready` or `pending user action`, never `created` and verified.
- Use at most one normal invocation and one retry after a relevant repair, with a 60-second diagnostic budget and a 180-second installer budget. A missing command, stale exit code, or timeout is never success.
