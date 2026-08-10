# Sources

- Better Context repository and usage: https://github.com/VKev/Better-Context
- Package metadata and CLI entry point: https://raw.githubusercontent.com/VKev/Better-Context/main/pyproject.toml
- Project ignore implementation: https://github.com/VKev/Better-Context/blob/main/src/better_context/ignore.py
- Roslyn helper project: https://github.com/VKev/Better-Context/tree/main/src/better_context/roslyn_helper
- Unity runtime analyzer and query contract: https://github.com/VKev/Better-Context/blob/main/README.md#generated-agentsmd-intelligence
- uv tool installation guide, including Git sources: https://docs.astral.sh/uv/guides/tools/
- uv CLI reference for `tool install`, `--force`, `--refresh`, `tool list`, and `tool dir`: https://docs.astral.sh/uv/reference/cli/
- Official uv standalone installer: https://docs.astral.sh/uv/getting-started/installation/

The approved persistent installation is:

```text
uv tool install "git+https://github.com/VKev/Better-Context.git@main"
```

Use `--force --refresh` only to repair an incorrect, broken, old, or capability-stale installation. Better Context is a local CLI; it does not add an MCP server or require a Codex restart. Version `1.5.0` adds direct zero-dependency binary/ASCII FBX structure plus Unity `ModelImporter` rig, avatar, clip, skeleton, mesh, and material facts to the existing Roslyn and Unity runtime queries. It requires a .NET 8+ SDK for Roslyn analysis. Continue using exact registered vendor roots rather than excluding all of `Assets/Plugins`.
