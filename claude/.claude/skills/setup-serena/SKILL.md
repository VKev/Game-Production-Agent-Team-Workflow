---
name: setup-serena
description: Check, install, initialize, and verify the official Serena semantic coding toolkit, Windows dashboard tray aggregation, MCP registration and lifecycle hooks for every AI client bundle present in the repository (Codex user-level TOML and Claude Code project .mcp.json), and project activation guidance using uv. Use when preparing a copied agent package, when uv or Serena is missing, when Serena's global initialization or a client integration is absent or incorrect, or when agents must be ready to use Serena after a client restart.
---

# Serena Project Setup

Install Serena from its official distribution, initialize its default language-server backend, and configure every AI client bundle present in this repository. Read [references/sources.md](references/sources.md) before changing installation, MCP, hook, or project-activation behavior.

## Client scope

Steps 1-15 install and initialize Serena itself and configure Codex. Steps 16-21 configure Claude Code. Run the section for each client bundle that exists in the repository, and skip the other:

- `.codex/agents/setup_agents.toml` present -> configure Codex (user-level `config.toml` and `hooks.json`).
- `.claude/agents/setup-agents.md` present -> configure Claude Code (project `.mcp.json` and `.claude/settings.json`).

uv, the `serena-agent` tool, and `~/.serena/serena_config.yml` are shared user-level state: install and initialize them once, then register each client. Never configure Cursor, Gemini, Grok, VS Code, or another client, and never remove the other client's Serena entry.

## Workflow

1. Resolve the target project root, but treat uv, Serena, and the Codex MCP entry as user-level installations shared by projects.
2. Resolve `uv` first (`Get-Command uv -ErrorAction SilentlyContinue` on Windows or `command -v uv` on POSIX) and run `uv --version` only when an executable resolves:
   - If it succeeds, record the version and do not reinstall or upgrade uv.
   - If it fails, install uv with the current official standalone installer:
     - Windows: `powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"`
     - macOS or Linux: `curl -LsSf https://astral.sh/uv/install.sh | sh`
3. Run `uv --version` again. If the installer succeeded but the command is not on the current process PATH, use the user executable directory reported by the installer and refresh only the current process PATH. Retry once and stop if uv still cannot run; do not reinstall or recursively search the filesystem.
4. Resolve `serena` before invoking it, then check `serena --version` and `uv tool list`:
   - If the Serena command works and `serena-agent` is registered, skip installation.
   - If `serena-agent` is not registered, run `uv tool install -p 3.13 serena-agent`.
   - If `serena-agent` is registered but `serena` is not on PATH, locate `uv tool dir --bin`, refresh only the current process PATH, and retry instead of reinstalling.
5. Verify `serena --version` succeeds.
6. Resolve Serena's global configuration at `~/.serena/serena_config.yml` or `%USERPROFILE%\.serena\serena_config.yml`:
   - If the file is absent, run `serena init` and use the default language-server backend.
   - If the file exists and Serena reads it successfully, skip initialization.
   - If Serena reports that it is invalid, preserve a backup outside the project, run `serena init` to repair it, and report the repair.
   - On Windows, parse the valid resulting YAML and treat dashboard aggregation as correct only when `web_dashboard` is `true` and `web_dashboard_interface` is `tray_manager`.
   - If either Windows value is missing or incorrect, back up `serena_config.yml` outside the project and change only those two top-level keys. Preserve comments and every unrelated setting. Stop on duplicate or structurally ambiguous keys instead of rewriting the file wholesale.
   - On non-Windows systems, preserve the existing dashboard interface unless the user explicitly requests another supported value.
7. Resolve the active Codex home from `CODEX_HOME`, falling back to `~/.codex`. Back up its `config.toml` and `hooks.json` outside the project before changing either file. On Windows, create backup directories with `New-Item -ItemType Directory -Path <exact-path>`.
8. Preflight the Codex CLI once. Resolve it before invocation and run `codex --version` in `try`/`catch`:
   - If it starts successfully, record the version and permit `serena setup codex` plus `codex mcp` verification.
   - If it is missing, cannot launch, returns Access Denied or `ResourceUnavailable`, or is an inaccessible Windows Store executable, immediately select the documented manual TOML path. Do not invoke it again and do not inspect WindowsApps, application bundles, executable internals, uv package sources, or WSL.
9. Treat the Serena Codex integration as correct only when `[mcp_servers.serena]` launches `serena` with `start-mcp-server`, `--project-from-cwd`, and `--context=codex`:
   - If correct, skip client setup.
   - If missing or stale and the Codex CLI passed step 8, run `serena setup codex` once, then inspect the entry again.
   - If missing or stale and the Codex CLI failed step 8, merge this exact documented entry into `config.toml`, preserving every unrelated value:

     ```toml
     [mcp_servers.serena]
     startup_timeout_sec = 15
     command = "serena"
     args = ["start-mcp-server", "--project-from-cwd", "--context=codex"]
     ```

   - Do not use the manual fallback to conceal a Serena executable, permissions, TOML, or filesystem failure.
10. Parse the resulting Codex TOML and confirm unrelated configuration remains. Hooks are enabled by default in current Codex; use the canonical `[features] hooks = true` only when an existing setting disables them. Do not add the deprecated `codex_hooks` alias.
11. Parse or create the user-level `hooks.json`, then merge these two core Serena handlers without replacing unrelated hooks or adding duplicate handlers:
   - `PreToolUse` with matcher `Bash`: `serena-hooks remind --client=codex`
   - `SessionStart` with matcher `startup|resume`: `serena-hooks activate --client=codex`
12. Add the optional `SessionEnd` handler `serena-hooks cleanup --client=codex` only when the Codex version is known to be 0.145.0 or newer. If the version is older or unknown because the CLI could not launch, omit cleanup and continue; never substitute `Stop`, never configure both, and report the omission without blocking restart-ready Serena.
13. Copy the managed block from [assets/AGENTS.serena.md](assets/AGENTS.serena.md) into the root instruction file of each configured client, after that client's Beads integration is final: `AGENTS.md` for Codex and `CLAUDE.md` for Claude Code.
    - Create the file when absent.
    - Replace only the block between the Serena markers when it is stale.
    - Preserve all Beads and user-authored content outside the markers.
    - Write the same block content to both files; the guidance is client-neutral.
14. Resolve `serena-hooks` before invoking it, then verify `serena --version`, `serena-hooks --help`, the Windows dashboard keys when applicable, the exact MCP entry, both core Serena hook handlers, every version-supported optional hook, and the managed `AGENTS.md` block. If the Codex CLI passed step 8, run one bounded `codex mcp get serena` check. Otherwise, successful YAML/TOML/JSON parsing plus exact structural checks are sufficient for restart-ready status; mark live MCP discovery as pending the required Codex restart.
15. Run `scripts/inspect_serena_state.py` once through the already verified Python 3 runtime and require `status=correct`. Use it instead of inline PowerShell YAML/JSON expressions. Serena `1.6.x` does not expose `serena project list`; never call that command. Project activation is implicit through `--project-from-cwd`, and the supported maintenance subcommands are `create`, `health-check`, `index`, `index-file`, and `is_ignored_path`.

## Claude Code integration

Run these steps only when the Claude bundle is present. Serena's own CLI has no Claude recipe in the installed release, so this registration is explicit and must use values the installed CLI confirms.

16. Verify the context value before writing it. The installed Serena ships one built-in context per client under its `resources/config/contexts/` directory; `claude-code` is the Claude Code context and `codex` is the Codex one. Resolve the list with `serena start-mcp-server --help` plus `scripts/inspect_serena_state.py`, and never invent a value such as `ide-assistant` when no context file of that name exists.
17. Merge exactly one `serena` server into the project `.mcp.json`, preserving unrelated servers:

    ```json
    {
      "mcpServers": {
        "serena": {
          "command": "serena",
          "args": ["start-mcp-server", "--project-from-cwd", "--context=claude-code"]
        }
      }
    }
    ```

    Project activation stays implicit through `--project-from-cwd`, exactly as on the Codex side. Do not add a `--project` path selector and do not create `.serena/project.yml` merely to register the project.
18. Add `serena` to `enabledMcpjsonServers` in `.claude/settings.json` so a copied project bundle works without a manual approval prompt.
19. Merge Serena's hook handlers into `.claude/settings.json`, using the verified `--client=claude-code` value (`serena-hooks remind --help` lists the accepted client values; `claude-code` is the default, `claude` is not a valid value):
    - `PreToolUse` with matcher `Bash`: `serena-hooks remind --client=claude-code`
    - `SessionStart` with matcher `startup|resume`: `serena-hooks activate --client=claude-code`
    - `SessionEnd`: `serena-hooks cleanup --client=claude-code`
    - Optional, only when the user asks for fewer approval prompts in permissive modes: `PreToolUse` with matcher `mcp__serena__.*`: `serena-hooks auto-approve --client=claude-code`
    Preserve Beads' `SessionStart` hook and every unrelated handler; add handlers, never replace the file or a sibling hook array.
20. Keep the two clients equivalent: same Serena version, same implicit project activation, same `remind`/`activate`/`cleanup` handler set, and only the `--context=`/`--client=` values differing. If Codex omits `cleanup` because its version gate failed, record that asymmetry explicitly instead of silently removing the Claude handler.
21. Verify: `.mcp.json` parses and holds exactly one `serena` entry with the verified context, `.claude/settings.json` parses with every intended handler present once, the managed `CLAUDE.md` block is current, and no Codex file changed. Live MCP discovery stays pending until Claude Code restarts; report `restart-ready` until then.

## Project behavior

Do not create `.serena/project.yml` merely to register a project. Current Serena supports implicit project creation and activation, and the official Codex setup uses `--project-from-cwd`. The managed `AGENTS.md` block must direct agents to activate the canonical repository root and read Serena's instructions before semantic edits. After setup, `dev-unity-project-context` owns retrieval and editing-tool routing. The managed block is mirrored into every configured client's instruction file, so the routing rules are identical in Codex and Claude Code.

## Boundaries

- Install uv only from Astral's official installer and Serena only as the `serena-agent` uv tool.
- Do not clone the Serena repository into the target project.
- Do not reinstall or upgrade working installations.
- Configure only the client bundles detected in the client scope. Do not configure Cursor, Gemini, Grok, VS Code, or another MCP client, and do not delete or rewrite the other bundle's Serena entry.
- Allow only Serena's official user-level Codex MCP entry, the documented project `.mcp.json` entry for Claude Code, and Serena-specific hook handlers. Never overwrite the user's global Codex TOML, `.mcp.json`, or a settings/hook file wholesale.
- Never guess a `--context=` or `--client=` value. Use only values the installed CLI's own help output or shipped context files confirm; `--client=claude` and `--context=ide-assistant` are not valid in the installed release.
- On Windows, change only the top-level `web_dashboard` and `web_dashboard_interface` values required for one aggregated tray icon. Preserve the rest of `serena_config.yml`; do not force `tray_manager` on other operating systems.
- Treat Codex hook trust separately from configuration. If Codex marks new hooks for review, report the one-time `/hooks` review; do not bypass trust. The managed `AGENTS.md` block remains the restart-only activation fallback.
- Do not edit the portable package's templates during target-project setup.
- Do not claim restart-ready Serena until uv, Serena, global initialization, each configured client's MCP entry, supported hooks, and the managed project guidance all verify successfully.
- Do not recursively search the uv environment or inspect WindowsApps, Codex `app.asar`, executable formats, or WSL to work around a failed Codex CLI. Follow the immediate manual MCP fallback in step 8.
- Use at most one normal invocation and one retry after a relevant repair, with a 60-second diagnostic budget and 180-second installer budget. A missing command, stale `$LASTEXITCODE`, timeout, or `ResourceUnavailable` result is never success.
