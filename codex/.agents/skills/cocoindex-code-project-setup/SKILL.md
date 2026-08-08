---
name: cocoindex-code-project-setup
description: Check, install, configure, index, and verify CocoIndex Code semantic search for Codex using Voyage embeddings. Use when preparing a copied Codex agent package, when `ccc`, its Codex MCP entry, or the project index is missing or stale, or when setup must request a Voyage API key and defer safely if none is provided.
---

# CocoIndex Code Project Setup

Set up the `cocoindex-code` CLI and MCP wrapper built on the CocoIndex engine. Read [references/sources.md](references/sources.md) before changing installation, embedding, secret, initialization, or MCP behavior.

## Required configuration

- CLI package: slim `cocoindex-code`, installed as a uv tool.
- CLI command: `ccc`.
- Codex MCP server: `ccc mcp`, registered as `cocoindex-code`.
- Embedding provider: LiteLLM with Voyage.
- Requested default model: `voyage/voyage-code-4`.
- Secret: `VOYAGE_API_KEY`, stored only in the official user-level `~/.cocoindex_code/global_settings.yml` `envs` map when the user authorizes setup.

Voyage's current public model list documents `voyage-code-3`, not `voyage-code-4`. Keep the requested code-4 default, but treat `ccc init` and `ccc doctor` as mandatory compatibility gates. Never silently substitute code-3 or another model.

## Workflow

1. Resolve the exact project root and inspect the current state without exposing secrets:
   - `ccc version` and `uv tool list`.
   - Presence and structure, but never the value, of `VOYAGE_API_KEY` in the current environment or `~/.cocoindex_code/global_settings.yml`.
   - The configured provider and model.
   - `<project-root>/.cocoindex_code/settings.yml`, `ccc status`, and `ccc doctor` when existing configuration is runnable.
   - The Codex MCP entry for `cocoindex-code`.
2. If the CLI, code-4 configuration, credential, project index, diagnostics, and MCP entry are already correct, skip setup and do not ask for the key again.
3. If setup or repair is required, ask once before installing or changing CocoIndex Code:

   `CocoIndex Code needs a Voyage API key. It will be stored in the user-level ~/.cocoindex_code/global_settings.yml, never in this project. Provide VOYAGE_API_KEY, confirm reuse of the existing saved key, or reply "skip" to defer CocoIndex setup.`

   If a different user-global embedding model already exists, disclose that code-4 will replace it and other CocoIndex Code projects may require re-indexing.
4. If the user provides no key, gives an empty value, or chooses `skip`, make no CocoIndex installation, configuration, MCP, index, or secret changes. Continue the other setup components and report CocoIndex as deferred, not failed.
5. Handle the accepted secret without disclosure:
   - Never echo, log, quote, summarize, hash, or include it in a command argument, report, project file, Codex TOML, Git diff, or temporary project file.
   - Put it only in the current process environment while running setup.
   - Persist it only in the official user-level CocoIndex Code settings so `ccc mcp` can use it after Codex restarts.
   - Back up an existing settings file outside the project before modifying it; treat that backup as secret-bearing.
6. Require a working `uv` command. When orchestrated by `setup-agents`, run this skill after `serena-project-setup`, which owns uv installation. If uv is still unavailable, follow only that skill's official uv installation procedure before continuing.
7. Resolve `ccc` before invoking it:
   - If `ccc version` succeeds and `cocoindex-code` appears in `uv tool list`, skip installation.
   - If missing, run `uv tool install cocoindex-code` once. Use the slim cloud-provider package; do not install the approximately 1 GB local-embedding extra.
   - If the uv tool is registered but `ccc` is absent from PATH, resolve `uv tool dir --bin`, add only that directory to the current process PATH, and retry once instead of reinstalling.
8. Before project initialization, require `.cocoindex_code/` to be effectively ignored and absent from `git ls-files`. Record `HEAD` and the staged-path list; stop if the index is non-empty.
9. From the exact project root, set `VOYAGE_API_KEY` only in the current process and run:

   `ccc init --litellm-model voyage/voyage-code-4`

   Do not use `-f` to bypass parent-root ambiguity. Stop if `ccc` resolves another project root.
10. Merge the accepted key into the user-level `envs` map without changing unrelated YAML. Treat the embedding configuration as correct only when it selects LiteLLM and `voyage/voyage-code-4`. Preserve or add Voyage's asymmetric retrieval parameters when supported: document input for indexing and query input for searches. Stop on duplicate or structurally ambiguous YAML keys instead of rewriting the file wholesale.
11. Run `ccc doctor` from the project root before indexing. It must pass global settings, daemon, indexing-model, query-model, and project file-matching checks. If code-4 is rejected or any model check fails:
   - Do not fall back to another model.
   - Do not register the MCP server or build the index.
   - Restore pre-existing user settings from the secret-bearing backup.
   - Remove only global or project settings created by the current failed attempt, after resolving their exact paths, and report what was rolled back.
   - Leave the installed CLI in place and report CocoIndex as deferred because the requested model is unavailable or invalid.
12. Run `ccc index` to build or incrementally update the project index. Allow a bounded ten-minute initial-index budget, surface progress at least once per minute, and treat a timeout as incomplete. Verify with `ccc status` and one narrow semantic query. Inspect its result locally and report only pass/fail; do not reproduce source snippets in the setup report.
13. Resolve the active Codex home from `CODEX_HOME`, falling back to `~/.codex`, and back up its configuration outside the project. Treat the MCP integration as correct only when `cocoindex-code` launches `ccc` with the single argument `mcp`:
   - If missing and the Codex CLI works, run `codex mcp add cocoindex-code -- ccc mcp` once.
   - If the Codex CLI cannot launch, merge only the equivalent documented MCP entry into the active TOML.
   - If an entry exists but is stale, repair only that entry and preserve unrelated servers.
14. Verify `ccc version`, redacted global settings structure, the exact requested model, successful `ccc doctor`, healthy `ccc status`, the Codex MCP command, `.cocoindex_code/` ignore/untracked behavior, unchanged Claude configuration, unchanged `HEAD`, and an empty staged-path list. Report that Codex must restart before the MCP tool is available.

## Boundaries

- Configure Codex only. Never install CocoIndex Code's Claude/Grok plugin, run `npx skills add`, or configure another client.
- Never store `VOYAGE_API_KEY` in the repository, `.env`, Codex config, shell history, response text, logs, or generated agent files.
- Never print the user-level settings file after it contains a secret.
- Never substitute `voyage-code-3`, `voyage-4`, or another model for the requested `voyage-code-4` default.
- Never run `ccc reset`, delete an existing index, or replace global settings automatically.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim CocoIndex is ready until the credential, model, doctor, index, MCP, secret-location, and Git checks all pass.
