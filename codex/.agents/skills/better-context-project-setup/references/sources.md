# Sources

- Better Context repository and usage: https://github.com/VKev/Better-Context
- Package metadata and CLI entry point: https://raw.githubusercontent.com/VKev/Better-Context/main/pyproject.toml
- uv tool installation guide, including Git sources: https://docs.astral.sh/uv/guides/tools/
- uv CLI reference for `tool install`, `--force`, `--refresh`, `tool list`, and `tool dir`: https://docs.astral.sh/uv/reference/cli/
- Official uv standalone installer: https://docs.astral.sh/uv/getting-started/installation/

The approved persistent installation is:

```text
uv tool install "git+https://github.com/VKev/Better-Context.git@main"
```

Use `--force --refresh` only to repair an incorrect, broken, or capability-stale installation. Better Context is a local CLI; it does not add an MCP server or require a Codex restart.
