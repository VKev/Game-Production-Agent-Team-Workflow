# Official sources

- CocoIndex incremental engine: https://github.com/cocoindex-io/cocoindex
- CocoIndex Code CLI, MCP server, configuration, and Codex command: https://github.com/cocoindex-io/cocoindex-code
- Official CocoIndex Code skill: https://github.com/cocoindex-io/cocoindex-code/blob/main/skills/ccc/SKILL.md
- Official setup and management reference: https://github.com/cocoindex-io/cocoindex-code/blob/main/skills/ccc/references/management.md
- Official settings reference: https://github.com/cocoindex-io/cocoindex-code/blob/main/skills/ccc/references/settings.md
- Voyage embedding model list: https://docs.voyageai.com/docs/embeddings

Checked on 2026-08-08. `cocoindex-code` is the supported code-search wrapper built on CocoIndex. It installs the `ccc` CLI, exposes semantic `search` through `ccc mcp`, supports C#, and initializes cloud embeddings non-interactively with `ccc init --litellm-model MODEL`. The Codex registration documented by the project is `codex mcp add cocoindex-code -- ccc mcp`.

The requested configuration is `voyage/voyage-code-4` with `VOYAGE_API_KEY`. At the check date, CocoIndex Code and Voyage publicly document `voyage/voyage-code-3` as the code-optimized model and do not list `voyage-code-4`. Preserve the user's requested default but require a successful live `ccc doctor` model check; do not silently substitute a documented model.
