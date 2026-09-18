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
