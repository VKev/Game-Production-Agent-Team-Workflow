# Official sources

- CocoIndex incremental engine: https://github.com/cocoindex-io/cocoindex
- CocoIndex Code CLI, MCP server, configuration, and Codex command: https://github.com/cocoindex-io/cocoindex-code
- Official CocoIndex Code skill: https://github.com/cocoindex-io/cocoindex-code/blob/main/skills/ccc/SKILL.md
- Official setup and management reference: https://github.com/cocoindex-io/cocoindex-code/blob/main/skills/ccc/references/management.md
- Official settings reference: https://github.com/cocoindex-io/cocoindex-code/blob/main/skills/ccc/references/settings.md
- Current settings defaults: https://github.com/cocoindex-io/cocoindex-code/blob/main/src/cocoindex_code/settings.py
- Current include/exclude and `.gitignore` matcher: https://github.com/cocoindex-io/cocoindex-code/blob/main/src/cocoindex_code/file_walk.py
- Voyage embedding model list: https://docs.voyageai.com/docs/embeddings
- Voyage contextualized chunk embeddings: https://docs.voyageai.com/docs/contextualized-chunk-embeddings
- Voyage rate limits: https://docs.voyageai.com/docs/rate-limits

Checked on 2026-08-09. `cocoindex-code` is the supported code-search wrapper built on CocoIndex. It installs the `ccc` CLI, exposes semantic `search` through `ccc mcp`, supports C#, and initializes cloud embeddings non-interactively with `ccc init --litellm-model MODEL`. The Codex registration documented by the project is `codex mcp add cocoindex-code -- ccc mcp`.

The requested preference order is `voyage-code-4`, `voyage-code-4-large`, `voyage-4`, `voyage-4-large`, `voyage-code-3`, `voyage-context-4`, then `voyage-3-large`, all with the LiteLLM `voyage/` prefix. As checked on 2026-08-09, Voyage publicly lists `voyage-4`, `voyage-4-large`, `voyage-code-3`, and legacy `voyage-3-large` on its text-embedding endpoint. It does not publicly list `voyage-code-4` or `voyage-code-4-large`. `voyage-context-4` is documented for the separate contextualized-embeddings endpoint, so ordinary LiteLLM/CocoIndex compatibility must not be assumed. Treat every entry as a candidate and require both live `ccc doctor` model checks before selection.

Fallback is only for a model-specific availability or capacity failure. Do not change models for invalid credentials, billing or hard-quota errors, malformed configuration, network trust failures, or project ambiguity. A healthy configured fallback remains selected on later idempotent runs; do not probe higher candidates and force needless re-indexing.

CocoIndex Code project settings use `include_patterns` and `exclude_patterns` with globset semantics. Current defaults include C#, Markdown, plain text, JSON, XML, YAML, and TOML; defaults exclude hidden directories and common dependency/build folders but do not include Unity-specific generated roots. Its current file walker applies these patterns together with root and nested `.gitignore` files. Merge the portable Unity exclusions from `assets/Unity.exclude-patterns.yml`, retain useful source under `Assets/` and embedded `Packages/`, and run `ccc doctor` plus incremental `ccc index` after a settings change.
