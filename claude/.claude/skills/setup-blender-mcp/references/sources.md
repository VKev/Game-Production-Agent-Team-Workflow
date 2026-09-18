# Official sources

- Blender MCP repository (Blender Labs, canonical): https://projects.blender.org/lab/blender_mcp
- Server install command and add-on prerequisite: https://projects.blender.org/lab/blender_mcp/src/branch/main/mcp/README.md
- Component overview, data flow, and tool list: https://projects.blender.org/lab/blender_mcp/src/branch/main/readme.md
- Product documentation: https://www.blender.org/lab/mcp-server/
- Blender Lab extensions repository (add-on source): https://lab.blender.org/
- Issue tracker: https://projects.blender.org/lab/blender_mcp/issues

Checked on 2026-09-18.

The repository holds two components. `addon/blender_mcp_addon/` is the Blender
extension that executes requests inside Blender and owns the host/port/auto-start
preferences; `mcp/` is the Python package that installs the `blender-mcp` entry
point and is launched by the MCP client over stdio.

The documented server install is
`pip install git+https://projects.blender.org/lab/blender_mcp.git#subdirectory=mcp`.
This package set installs it through uv instead, to reuse the uv installation
`setup-serena` already established and to keep the tool visible in `uv tool list`:
`uv tool install "git+https://projects.blender.org/lab/blender_mcp.git#subdirectory=mcp"`.

Verified server interface (`blender-mcp --help`): `--transport {stdio,http}`,
`--host`, `--port`. The `--host`/`--port` flags apply to the HTTP transport only
and are irrelevant to a local stdio client registration.

Verified environment variables read by the server:

- `BLENDER_MCP_HOST` — add-on socket host, default `127.0.0.1`
  (`mcp/blmcp/tools_helpers/connection.py`).
- `BLENDER_MCP_PORT` — add-on socket port, default `9876`
  (`addon/blender_mcp_addon/mcp_to_blender_server.py` defines the same default).
- `BLENDER_PATH` — Blender executable used by the `*_for_cli` background tools,
  default `blender` from PATH (`mcp/blmcp/tools_helpers/blender_cli.py`).

Tools that execute arbitrary Python inside Blender — `execute_blender_code` and
`execute_blender_code_for_cli` — are the reason both clients keep a per-tool
approval gate: Codex `approval_mode = "approve"`, Claude Code `permissions.ask`.

Name collision warning: unrelated third-party projects publish a `blender-mcp`
package under the same command name. Only the Blender Labs repository above is
in scope for this package set.
