---
name: setup-better-context
description: Check, install, repair, initialize, and verify VKev/Better-Context 1.5+ for Roslyn-backed C# intelligence, Unity runtime and FBX model queries, and project-local hierarchical AGENTS.md maps. Use when preparing a copied Codex agent package, when better-context-unity is missing, stale, installed from another source, lacks required Unity/FBX/summary/call-graph capabilities, or when a Unity project needs fresh navigation maps.
---

# Better Context Project Setup

Install the custom Better Context Unity CLI from the user's Git repository and create its marker-managed project maps. Read [references/sources.md](references/sources.md) before changing the Git source, uv command, or capability checks.

## Required state

- Package and command: `better-context-unity`.
- Minimum compatible version: `1.5.0`.
- Approved source: `git+https://github.com/VKev/Better-Context.git@main`.
- C# analyzer prerequisite: .NET SDK 8 or newer for Roslyn symbol resolution.
- Project cache: `.better-context/`.
- Project scan policy: `.ctxignore`.
- Optional summary store: `.ctx-summaries.json`.
- Managed map markers: `<!-- better-context-unity:begin -->` and `<!-- better-context-unity:end -->`.

## Workflow

1. Resolve and canonicalize the exact target project root. Record whether `HEAD` exists, its SHA, and the staged-path list. Stop if the index is already non-empty.
2. Require the root `.gitignore` to ignore `.better-context/`, `.ctxignore`, `.ctx-summaries.json`, and Markdown files, and confirm none is tracked. When orchestrated by `setup-agents`, `setup-unity-gitignore` owns these rules and must complete first.
3. Resolve `uv` before invoking it:
   - If `uv --version` succeeds, reuse it.
   - If it is missing or cannot start, follow the official standalone installation command in [references/sources.md](references/sources.md) once.
   - If installation succeeds but the current process cannot resolve uv, add only the installer-reported directory to the current process PATH and retry once.
4. Inspect the installed tool without modifying it:
   - Resolve `better-context-unity` first.
   - When it resolves, run `better-context-unity --version`, top-level `--help`, `agents --help`, `unity --help`, and `graph --help`.
   - Run `uv tool list --show-version-specifiers` and require the `better-context-unity` tool to reference `github.com/VKev/Better-Context`.
   - Require version `1.5.0` or newer, `agents --help` to expose `--summary` and `--remove-summary`, `unity --help` to expose `list`, `show`, and `bindings`, and `graph --help` to expose dependency and call graph kinds.
   - Resolve `dotnet --version` and require an SDK major version of at least 8 before accepting Roslyn-backed C# analysis. A missing or older SDK leaves C# dependency/call verification incomplete even when the Python CLI works.
   - Treat the installation as correct only when the command, minimum version, Git source, summary flags, Unity queries, call-graph option, and .NET prerequisite all pass.
5. Install or repair only when required:
   - Missing: `uv tool install "git+https://github.com/VKev/Better-Context.git@main"`.
   - Wrong source, old version, broken command, or missing summary, Unity, or call-graph capabilities: `uv tool install --force --refresh "git+https://github.com/VKev/Better-Context.git@main"`.
   - Do not reinstall or contact the network when the existing installation already passes every check.
6. Resolve the CLI again. If uv installed it but the command is not on PATH, resolve `uv tool dir --bin`, add only that directory to the current process PATH, and retry once. Stop if the command still cannot run.
7. Merge this managed vendor block into root `.ctxignore`, preserving every user-authored pattern and placing the block after any negation that would re-include these exact roots:

   ```text
   # setup-agents:vendor-context:begin
   Assets/Plugins/Demigiant/
   Assets/Plugins/Sirenix/
   Assets/Plugins/RootMotion/
   Assets/Plugins/Feel/
   Assets/Plugins/FImpossible Creations/
   Assets/Plugins/KINEMATION/
   Assets/Plugins/Technie/
   Assets/Plugins/Roslyn/
   # setup-agents:vendor-context:end
   ```

   These are registered third-party roots, not project-owned `Assets/Plugins` code. Never replace them with a broad `Assets/Plugins/` rule. Verify the installed matcher reports every registered root ignored and a project-owned probe such as `Assets/Plugins/Game/Probe.cs` eligible.
8. Before regeneration, repair only stale Better Context output beneath those exact vendor roots. For each `AGENTS.md` containing this tool's managed markers, remove only the managed block; delete the file only when nothing but whitespace remains. Preserve handwritten content and never touch an unmarked file. Remove a paired `.meta` only when its exact `AGENTS.md` was deleted and the meta is untracked/generated.
9. Inspect project map state:
   - If `.better-context/manifest.json`, `.better-context/staleness.json`, and the root managed marker exist, run `better-context-unity --root <project-root> verify`.
   - If verification succeeds, skip generation.
   - When orchestrated by `setup-agents` and live Unity package imports are still pending, configure the ignore policy but defer a missing first map or stale refresh until the single post-import refresh. Preserve an already healthy map.
   - Otherwise, if maps are missing or verification reports stale state, run `better-context-unity --root <project-root> agents` once with no summaries.
   - Allow a bounded ten-minute budget for the first Unity scan and report progress at least once per minute. A timeout is incomplete setup, not success.
10. Validate the generated state without changing project source:
    - Run `better-context-unity --root <project-root> verify`, `better-context-unity --root <project-root> unity list --limit 1 --format json`, and `better-context-unity --root <project-root> graph --kind call --format json`. An empty Unity asset list or call graph is valid only when the project genuinely has no matching evidence; command/schema failure is not.
    - Parse `.better-context/manifest.json`. Require its generator to report the accepted CLI version and its Unity runtime section to record parsed, unsupported, and error coverage instead of inventing data for unsupported serialization.
    - When project-owned C# files exist, require Roslyn analysis evidence such as `analysis_engine: roslyn`; fallback-only symbol inventory is incomplete setup because C# dependency and call edges are deliberately omitted.
    - When a project-owned `.fbx` exists, run `unity list --kind model`, select one exact project-relative result, and require `unity show <path>` to expose parsed FBX structure and/or Unity `ModelImporter` facts. A path-only map row is not proof of FBX analysis.
    - Require zero C# dependency edges to `.meta`, zero graph targets ending in `.meta`, and structured Unity edges to carry Unity/GUID evidence rather than free-text type-name matches.
    - Follow only child-map links emitted by a parent `AGENTS.md`. Do not fail setup merely because a raw art folder, collapsed runtime tree, vendor boundary, or generated boundary has no child map.
11. Verify the command, minimum version, exact Git source, Roslyn/runtime capabilities, summary flags, `.ctxignore` behavior, fresh project state when generation was due, root managed marker, absence of managed vendor maps, unchanged `HEAD`, and empty staged-path list. Better Context is a local CLI and needs no MCP registration or Codex restart.

## Runtime handoff

After setup, `dev-unity-project-context` owns map verification, navigation, refreshes, and optional summaries. This setup skill must leave summaries untouched and must not duplicate runtime retrieval policy.

## Boundaries

- Install only from `VKev/Better-Context` with the exact Git requirement above. Do not substitute PyPI, the upstream repository, a mirror, or an editable checkout.
- Do not install uv again when a working uv is already available.
- Do not add summaries during project setup. Summary authoring is an optional runtime decision after source verification.
- Do not treat `verify` alone as proof that Roslyn, dependency correctness, Unity runtime parsing, compilation, or tests succeeded; it establishes only saved-context freshness.
- Keep each summary stable, factual, project-relative, and at most 240 characters. Never include secrets, transient task notes, speculative behavior, full method lists, or detailed call flows.
- Do not summarize every file or folder. Leave the map structural when a summary adds no durable navigation value.
- Never overwrite handwritten `AGENTS.md` content, edit content inside the managed block manually, or run `clean` automatically.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion when the source, executable, capability, map, ignore, or Git checks are incomplete.
