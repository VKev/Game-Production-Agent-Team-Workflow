# Official sources

- CodeGraph repository and current Quick Start: https://github.com/colbymchenry/codegraph
- Focused setup guide: https://github.com/colbymchenry/codegraph/blob/main/site/src/content/docs/getting-started/quickstart.md
- Windows standalone installer: https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.ps1
- POSIX standalone installer: https://raw.githubusercontent.com/colbymchenry/codegraph/main/install.sh

Checked on 2026-08-08. The official workflow separates three operations: install the CLI, run `codegraph install` to register an agent client, and run `codegraph init` once per project to create and index `.codegraph/`. The current installer supports an explicit `codex` target, a global location, `--yes` for scripted setup, and `--print-config codex` for a no-write configuration snippet.

Use `codegraph install --target=codex --location=global --yes` so the portable setup never auto-detects or configures Claude or another client. Use `codegraph init` with no flags from the exact project root; current releases build the initial graph in the same step and auto-sync while the MCP server is running.
