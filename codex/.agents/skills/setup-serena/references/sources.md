# Official sources

- Serena repository and Quick Start: https://github.com/oraios/serena
- Serena Codex setup implementation: https://github.com/oraios/serena/blob/main/src/serena/config/client_setup.py
- Serena installation: https://oraios.github.io/serena/02-usage/010_installation.html
- Serena Codex client setup: https://oraios.github.io/serena/02-usage/030_clients.html#codex-cli-and-app
- Serena MCP server behavior: https://oraios.github.io/serena/02-usage/020_running.html
- Serena project workflow and activation: https://oraios.github.io/serena/02-usage/040_workflow.html
- Serena dashboard and tray manager: https://oraios.github.io/serena/02-usage/060_dashboard.html
- Codex MCP configuration: https://developers.openai.com/codex/mcp
- Codex lifecycle hooks: https://developers.openai.com/codex/hooks
- uv installation: https://docs.astral.sh/uv/getting-started/installation/
- uv installer behavior: https://docs.astral.sh/uv/reference/installer/

Use the packaged PyPI tool command documented by Serena: `uv tool install -p 3.13 serena-agent`. Do not substitute an outdated Git checkout, marketplace package, or guessed `uv install serena` command. Serena's current `serena setup codex` implementation registers only the MCP server through `codex mcp add`; configure its recommended Codex hooks separately and preserve unrelated user hooks.


## Verified client values (checked 2026-09-18, serena-agent 1.6.1)

Serena ships one built-in context file per client under
`serena/resources/config/contexts/`. The installed release contains
`agent.yml`, `antigravity.yml`, `chatgpt.yml`, `claude-code.yml`,
`codebuddy.yml`, `codex.yml`, `copilot-cli.yml`, `desktop-app.yml`, `ide.yml`,
`jb-ai-assistant.yml`, `jb-copilot-plugin.yml`, `junie.yml`,
`oaicompat-agent.yml`, and `vscode.yml`. There is no `ide-assistant` context:

- Codex -> `--context=codex`
- Claude Code -> `--context=claude-code`

`serena-hooks <command> --help` reports the accepted client values as
`claude-code`, `codebuddy`, `vscode`, and `codex` (default `claude-code`).
`--client=claude` is not valid. Available hook commands are `activate`
(session start), `remind` (PreToolUse), `auto-approve` (PreToolUse, permissive
modes only), and `cleanup` (session end).

Claude Code has no `serena setup claude` equivalent in this release, so its
project `.mcp.json` entry and `.claude/settings.json` hooks are written
explicitly, mirroring the Codex registration.
