---
name: setup-cocoindex-code
description: Check, install, configure, index, and verify Unity-focused CocoIndex Code semantic search plus the local Docling converter for PDF, DOCX, XLSX, and PPTX ingestion, for every AI client bundle present in the repository (Codex user-level TOML and Claude Code project .mcp.json), only after the user explicitly provides a non-empty Voyage API key for the current setup run. Use when preparing a copied agent package, when `ccc`, `docling`, a client's CocoIndex MCP entry, selected embedding model, Unity exclusion policy, document-conversion capability, or project index is missing or stale, or when Voyage is overloaded or rejects a preferred model. Defer without inspecting or changing CocoIndex or Docling when the current-run credential gate is not satisfied.
---

# CocoIndex Code Project Setup

Set up the `cocoindex-code` CLI and MCP wrapper built on the CocoIndex engine. Read [references/sources.md](references/sources.md) before changing installation, embedding, secret, initialization, or MCP behavior.

## Required configuration

- CLI package: slim `cocoindex-code`, installed as a uv tool.
- CLI command: `ccc`.
- Document converter: official `docling`, installed as a separate uv tool so its CLI and dependency graph remain isolated from `cocoindex-code`.
- Guaranteed document inputs: PDF, DOCX, XLSX, and PPTX. Do not claim legacy DOC/XLS/PPT readiness unless LibreOffice is independently present and verified.
- MCP server command: `ccc mcp`, registered as `cocoindex-code` in every client in scope.

## Client scope

The CLI, the credential, the index, and the exclusion policy are shared; only the registration differs per client. After the credential gate is satisfied, register every client bundle present in the repository:

- `.codex/agents/setup_agents.toml` present → user-level Codex `config.toml`.
- `.claude/agents/setup-agents.md` present → project `.mcp.json` plus `enabledMcpjsonServers` in `.claude/settings.json`.

The installed `ccc` release has no client installer subcommand, so both registrations are explicit merges. Never install CocoIndex Code's Claude/Grok plugin, never run `npx skills add`, and never configure a client outside this scope. When the credential gate is not satisfied, no client is touched at all.
- Embedding provider: LiteLLM with Voyage.
- Preferred model order: `voyage/voyage-code-4`, `voyage/voyage-code-4-large`, `voyage/voyage-4`, `voyage/voyage-4-large`, `voyage/voyage-code-3`, `voyage/voyage-context-4`, then `voyage/voyage-3-large`.
- Selection rule: keep a healthy configured candidate; for a new or failed setup, select the first candidate in that order that passes both CocoIndex Code model checks.
- Project exclusion policy: merge the engine's exclusion asset into `.cocoindex_code/settings.yml` without replacing CocoIndex defaults or user-authored patterns — [assets/Unity.exclude-patterns.yml](assets/Unity.exclude-patterns.yml) for a Unity project, [assets/Cocos.exclude-patterns.yml](assets/Cocos.exclude-patterns.yml) for a Cocos Creator project. Detect the kind the same way `setup-agents` does, and never merge both.
- Secret: a non-empty `VOYAGE_API_KEY` explicitly supplied by the user for the current setup run, stored only in the official user-level `~/.cocoindex_code/global_settings.yml` `envs` map after the gate is satisfied.

Treat `ccc init` and both `ccc doctor` model checks as mandatory compatibility gates. A model name in this preference list is a candidate, not proof that Voyage's current text-embedding endpoint or CocoIndex Code supports it. Read [references/sources.md](references/sources.md) for the current public model and endpoint distinctions before changing the list.

## Workflow

1. Apply the credential gate before any CocoIndex inspection or command:
   - If the current setup interaction already contains a non-empty key explicitly provided by the user, accept it without asking again.
   - Otherwise ask once: `CocoIndex Code requires a Voyage API key. Provide a non-empty VOYAGE_API_KEY for this setup run, or reply "skip" to leave CocoIndex untouched.`
   - Accept only a non-empty key explicitly provided by the user for the current run.
   - Do not search the process environment or user-level settings for a reusable key, and do not offer reuse of a previously saved key. Discovery is not current-run authorization.
   - If the response is absent, empty, or `skip`, stop this skill immediately. Do not invoke `uv`, `ccc`, `docling`, or `codex mcp`; do not inspect CocoIndex or Docling state; do not install either CLI; do not create or modify `.cocoindex_code/`; do not change user-level settings, MCP configuration, or indexes. Report `deferred: Voyage API key not provided for this run` and reveal nothing about whether a saved key exists.
2. After accepting the key, resolve the exact project root and inspect the current state without exposing secrets:
   - `ccc version` and `uv tool list`.
   - `docling --version` and the option surface of `docling convert --help` when Docling is already installed.
   - Structure, but never the value, of the user-level CocoIndex settings required to persist the newly accepted key.
   - The configured provider and model.
   - `<project-root>/.cocoindex_code/settings.yml`, including its include patterns, Unity exclusions, language overrides, chunkers, and file-size policy; then `ccc status` and `ccc doctor` when existing configuration is runnable.
   - Each in-scope client's MCP entry for `cocoindex-code`.
3. If both CLIs, credential, project index, Unity exclusion policy, diagnostics, MCP entry, and a currently configured candidate are healthy, persist the accepted key only if required, keep that model, skip other mutations, and do not probe higher-priority candidates. Stable idempotence takes priority over opportunistic model churn.
4. If setup or repair is required and a different user-global embedding model already exists, disclose that setup will select from the approved preference chain and other CocoIndex Code projects may require re-indexing. Do not reveal the existing credential state.
5. Handle the accepted secret without disclosure:
   - Never echo, log, quote, summarize, hash, or include it in a command argument, report, project file, client configuration (`config.toml`, `.mcp.json`, `.claude/settings.json`), Git diff, or temporary project file.
   - Put it only in the current process environment while running setup.
   - Persist it only in the official user-level CocoIndex Code settings so `ccc mcp` can use it after any client restarts. Both clients launch the same `ccc mcp` process and read the same stored credential; never duplicate the key into a client configuration.
   - Back up an existing settings file outside the project before modifying it; treat that backup as secret-bearing.
6. Require a working `uv` command. When orchestrated by `setup-agents`, run this skill after `setup-serena`, which owns uv installation. If uv is still unavailable, follow only that skill's official uv installation procedure before continuing.
7. Resolve `ccc` before invoking it:
   - If `ccc version` succeeds and `cocoindex-code` appears in `uv tool list`, skip installation.
   - If missing, run `uv tool install cocoindex-code` once. Use the slim cloud-provider package; do not install the approximately 1 GB local-embedding extra.
   - If the uv tool is registered but `ccc` is absent from PATH, resolve `uv tool dir --bin`, add only that directory to the current process PATH, and retry once instead of reinstalling.
   - Resolve Docling independently. If `docling --version` succeeds and `docling` appears in `uv tool list`, preserve it without upgrading. If missing, run `uv tool install docling` once. If its tool is registered but the executable is absent from PATH, resolve `uv tool dir --bin`, add only that directory to the current process PATH, and retry once.
   - Keep Docling in its own uv tool environment. Do not inject it into the `cocoindex-code` environment, use `--with-executables-from`, mutate a uv tool environment with pip, or replace a healthy Docling install merely to chase the latest version.
   - Verify `docling convert --help` exposes PDF, DOCX, XLSX, and PPTX inputs plus Markdown output, `--output`, `--device`, `--document-timeout`, `--abort-on-error`, `--enable-remote-services`, and `--allow-external-plugins`. Do not download models or convert user documents during setup; first-use model retrieval belongs to an authorized document task.
8. Before project initialization, require `.cocoindex_code/` and Unity-generated roots to be effectively ignored and absent from `git ls-files`. CocoIndex Code's current matcher also honors nested `.gitignore` files, but do not rely on that alone: the project settings must carry the explicit Unity exclusion policy. Record `HEAD` and the staged-path list; stop if the index is non-empty.
9. From the exact project root, set `VOYAGE_API_KEY` only in the current process and initialize with the first preferred candidate:

   `ccc init --litellm-model voyage/voyage-code-4`

   Do not use `-f` to bypass parent-root ambiguity. Stop if `ccc` resolves another project root.
10. Parse `.cocoindex_code/settings.yml`, then merge every entry from [assets/Unity.exclude-patterns.yml](assets/Unity.exclude-patterns.yml) into its `exclude_patterns` list:
   - Preserve CocoIndex Code defaults, user-authored exclusions, `include_patterns`, `language_overrides`, `chunkers`, `max_file_size`, comments when the editor supports them, and every unrelated key. Append only missing exact entries; never replace the list wholesale.
   - Stop on duplicate top-level keys, YAML anchors or merge keys affecting the edited list, a non-list `exclude_patterns`, or another structurally ambiguous file. Back up an existing settings file before editing and restore it if validation fails.
   - Keep project-owned source and dependency metadata matchable: do not exclude general `Assets/**/*.cs`, C# under embedded `Packages/`, `Packages/manifest.json`, `Packages/packages-lock.json`, tests, shaders, or project documentation merely because they live in a Unity project.
   - Exclude Unity cache/build roots, generated content including `Packages/nuget-packages/InstalledPackages/**`, serialized scene/asset formats, generated IDE/project files, and only the exact registered third-party roots from the bundled policy. Never broaden those entries to `Assets/Plugins/**`, `Assets/**`, `Packages/**`, `Tests/**`, `Editor/**`, or `ThirdParty/**`; `Assets/Plugins/Game/Probe.cs` and project-owned embedded packages must remain eligible.
11. Merge the accepted key into the user-level `envs` map without changing unrelated YAML. Treat the embedding configuration as correct only when it selects LiteLLM and one approved candidate. Preserve or add Voyage's asymmetric retrieval parameters when supported: document input for indexing and query input for searches. Set `min_interval_ms` to at least `300` for a new Voyage configuration, or preserve a higher existing value, to reduce avoidable rate-limit pressure. Stop on duplicate or structurally ambiguous YAML keys instead of rewriting the file wholesale.
12. Select and validate the model before indexing:
   - On Windows, set process-local UTF-8 (`PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`) before the first `ccc doctor`, `ccc index`, or diagnostic command. Do not wait for the known legacy-console encoding failure and then rerun the same check. Run `ccc doctor` from the project root and require global settings, daemon, indexing-model, query-model, and project file-matching checks to pass.
   - On an authenticated model-not-found, unsupported-endpoint, HTTP 429, provider overload, or retryable HTTP 5xx result, classify only the failure category, never reproduce a secret-bearing response body. For a transient load failure, honor `Retry-After` up to 60 seconds or make one bounded retry after confirming `min_interval_ms >= 300`.
   - If the retry still fails, update only the backed-up user-level model field to the next candidate in the declared order and run `ccc doctor` again. Never run more than one initial check and one load retry per candidate.
   - Stop instead of falling back on HTTP 401/403, billing or hard-quota failure, invalid credentials, malformed settings, DNS/TLS failure, project-root ambiguity, or an unclassified error. Another model cannot safely repair those conditions.
   - Record each attempted candidate and a sanitized result. The first candidate that passes both indexing and query checks becomes the selected model; report that selection explicitly. If none pass, restore pre-existing user settings, remove only settings created by this attempt after resolving exact paths, leave the CLI installed, and report CocoIndex as deferred.
13. Run `ccc doctor`, then build or incrementally update the project index. Require the doctor file-matching check to pass after the Unity exclusions are merged. When orchestrated by `setup-agents` and live Unity package imports are still pending, defer a missing first index or a policy-driven refresh until the single post-import refresh; do not embed a temporary pre-import tree. Otherwise run `ccc index`. Allow a bounded ten-minute initial-index budget, surface progress at least once per minute, and treat a timeout as incomplete. If persistent provider load occurs during indexing, apply the same candidate order only when the preflight snapshot proves that no index existed before this setup run; remove or reset only the generated index owned by the current attempt before switching models. Never reset or invalidate a pre-existing index automatically. When indexing was due, verify with `ccc status` and one narrow semantic query. Inspect its result locally and report only pass/fail; do not reproduce source snippets in the setup report.
14. Register each client bundle in scope. Treat an MCP integration as correct only when `cocoindex-code` launches `ccc` with the single argument `mcp`:
   - Codex: resolve the active Codex home from `CODEX_HOME`, falling back to `~/.codex`, and back up its configuration outside the project. If the entry is missing and the Codex CLI works, run `codex mcp add cocoindex-code -- ccc mcp` once; if the CLI cannot launch, merge only the equivalent documented MCP entry into the active TOML.
   - Claude Code: back up `<project-root>/.mcp.json` and `<project-root>/.claude/settings.json` outside the project, then merge exactly this server, preserving unrelated servers:

     ```json
     { "mcpServers": { "cocoindex-code": { "command": "ccc", "args": ["mcp"] } } }
     ```

     Add `cocoindex-code` to `enabledMcpjsonServers` in `.claude/settings.json`, and confirm user-level Claude files stay byte-identical because this registration is project-scope.
   - If an entry exists but is stale, repair only that entry and preserve unrelated servers.
   - Keep both clients' command and arguments identical; a difference is a parity defect.
15. Verify `ccc version`, `docling --version`, the required local Docling conversion flags and modern document formats, redacted global settings structure, the explicitly reported selected candidate, the complete Unity exclusion set, successful `ccc doctor`, healthy `ccc status`, each in-scope client's MCP command, `.cocoindex_code/`, `.mcp.json`, and `.claude/` ignore/untracked behavior, unchanged user-level client configuration, unchanged `HEAD`, and an empty staged-path list. Report exclusion entries added or preserved, confirm that representative `Assets` and embedded `Packages` source remains eligible, and state which clients must restart before the MCP tool is available.

## Boundaries

- Never begin CocoIndex discovery, installation, configuration, MCP registration, diagnostics, or indexing before the current-run credential gate succeeds. A key found in the environment or user-level settings does not satisfy the gate.
- Treat Docling as part of this gated CocoIndex capability. Do not inspect, install, upgrade, or repair it when the gate is deferred.
- Install only the base local Docling CLI. Do not add ASR/audio/video extras, ffmpeg, remote-service configuration, external plugins, VLM enrichments, or model predownloads during setup.
- Configure only the client bundles detected in the client scope. Never install CocoIndex Code's Claude/Grok plugin, run `npx skills add`, or configure another client.
- Never store `VOYAGE_API_KEY` in the repository, `.env`, any client configuration, shell history, response text, logs, or generated agent files.
- Never print the user-level settings file after it contains a secret.
- Never select a model outside the declared preference chain, reorder candidates, or hide a fallback from the report.
- Never assume that `voyage-code-4`, `voyage-code-4-large`, or `voyage-context-4` works through CocoIndex Code without live doctor verification.
- Never weaken the Unity exclusions, index Unity-generated directories through a negation, or exclude the entire `Assets`, `Packages`, test, editor-source, plugin-source, or third-party-source trees. Exact registered vendor roots are the only approved third-party-source exception.
- Never run `ccc reset`, delete a pre-existing index, or replace global settings automatically. Reset generated state only when the preflight snapshot proves the current failed setup attempt created it and a fallback requires a clean index.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim CocoIndex is ready until the credential, model, doctor, index, MCP, secret-location, and Git checks all pass.
