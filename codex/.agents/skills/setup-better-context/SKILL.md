---
name: setup-better-context
description: Check, install, repair, initialize, and verify VKev/Better-Context for project-local hierarchical AGENTS.md maps. Use when preparing a copied Codex agent package, when better-context-unity is missing or was installed from another source, when its optional summary flags are unavailable, or when a Unity project needs fresh navigation maps.
---

# Better Context Project Setup

Install the custom Better Context Unity CLI from the user's Git repository and create its marker-managed project maps. Read [references/sources.md](references/sources.md) before changing the Git source, uv command, or capability checks.

## Required state

- Package and command: `better-context-unity`.
- Approved source: `git+https://github.com/VKev/Better-Context.git@main`.
- Project cache: `.better-context/`.
- Optional summary store: `.ctx-summaries.json`.
- Managed map markers: `<!-- better-context-unity:begin -->` and `<!-- better-context-unity:end -->`.

## Workflow

1. Resolve and canonicalize the exact target project root. Record whether `HEAD` exists, its SHA, and the staged-path list. Stop if the index is already non-empty.
2. Require the root `.gitignore` to ignore `.better-context/`, `.ctx-summaries.json`, and Markdown files, and confirm none is tracked. When orchestrated by `setup-agents`, `setup-unity-gitignore` owns these rules and must complete first.
3. Resolve `uv` before invoking it:
   - If `uv --version` succeeds, reuse it.
   - If it is missing or cannot start, follow the official standalone installation command in [references/sources.md](references/sources.md) once.
   - If installation succeeds but the current process cannot resolve uv, add only the installer-reported directory to the current process PATH and retry once.
4. Inspect the installed tool without modifying it:
   - Resolve `better-context-unity` first.
   - When it resolves, run `better-context-unity --version` and `better-context-unity agents --help`.
   - Run `uv tool list --show-version-specifiers` and require the `better-context-unity` tool to reference `github.com/VKev/Better-Context`.
   - Treat the installation as correct only when the command works, the Git source is correct, and `agents --help` exposes both `--summary` and `--remove-summary`.
5. Install or repair only when required:
   - Missing: `uv tool install "git+https://github.com/VKev/Better-Context.git@main"`.
   - Wrong source, broken command, or missing summary capabilities: `uv tool install --force --refresh "git+https://github.com/VKev/Better-Context.git@main"`.
   - Do not reinstall or contact the network when the existing installation already passes every check.
6. Resolve the CLI again. If uv installed it but the command is not on PATH, resolve `uv tool dir --bin`, add only that directory to the current process PATH, and retry once. Stop if the command still cannot run.
7. Inspect project map state:
   - If `.better-context/manifest.json`, `.better-context/staleness.json`, and the root managed marker exist, run `better-context-unity --root <project-root> verify`.
   - If verification succeeds, skip generation.
   - If maps are missing or verification reports stale state, run `better-context-unity --root <project-root> agents` once with no summaries.
   - Allow a bounded ten-minute budget for the first Unity scan and report progress at least once per minute. A timeout is incomplete setup, not success.
8. Verify the command, version, exact Git source, summary flags, fresh project state, root managed marker, effective ignore behavior, unchanged `HEAD`, and empty staged-path list. Better Context is a local CLI and needs no MCP registration or Codex restart.

## Runtime handoff

After setup, `dev-unity-project-context` owns map verification, navigation, refreshes, and optional summaries. This setup skill must leave summaries untouched and must not duplicate runtime retrieval policy.

## Boundaries

- Install only from `VKev/Better-Context` with the exact Git requirement above. Do not substitute PyPI, the upstream repository, a mirror, or an editable checkout.
- Do not install uv again when a working uv is already available.
- Do not add summaries during project setup. Summary authoring is an optional runtime decision after source verification.
- Keep each summary stable, factual, project-relative, and at most 240 characters. Never include secrets, transient task notes, speculative behavior, full method lists, or detailed call flows.
- Do not summarize every file or folder. Leave the map structural when a summary adds no durable navigation value.
- Never overwrite handwritten `AGENTS.md` content, edit content inside the managed block manually, or run `clean` automatically.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion when the source, executable, capability, map, ignore, or Git checks are incomplete.
