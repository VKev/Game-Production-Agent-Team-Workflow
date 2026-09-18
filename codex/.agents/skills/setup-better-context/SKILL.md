---
name: setup-better-context
description: Check, install, repair, initialize, and verify VKev/Better-Context 1.7+ plus its companion Unity Editor package for Roslyn-backed C# intelligence, Unity runtime, FBX, texture/Sprite importer, subasset, and component queries, and project-local hierarchical instruction maps written from one scan into every client's instruction file (AGENTS.md for Codex, CLAUDE.md for Claude Code). Use when preparing a copied Codex agent package, when better-context-unity is missing, stale, installed from another source, lacks required Editor/Unity/FBX/summary/call-graph capabilities, or when a Unity project needs fresh navigation maps for one or both clients.
---

# Better Context Project Setup

Install the custom Better Context Unity CLI from the user's Git repository and create its marker-managed project maps. Read [references/sources.md](references/sources.md) before changing the Git source, uv command, or capability checks.

## Required state

- Package and command: `better-context-unity`.
- Minimum compatible version: `1.8.0` (the release that added the Cocos Creator project kind; `1.7.0` added multi-client `map_files` / `--map-file`).
- Approved source: `git+https://github.com/VKev/Better-Context.git@main`.
- Companion package: `com.vkev.better-context.editor`, installed from the same repository with `?path=/unity-package/com.vkev.better-context.editor` and pinned to the accepted release tag or exact commit.
- C# analyzer prerequisite: .NET SDK 8 or newer for Roslyn symbol resolution.
- Project cache: `.better-context/`.
- Project scan policy: `.ctxignore`.
- Project tool configuration: `.ctx.json`, whose `map_files` array selects the instruction files the managed block is written into.
- Optional summary store: `.ctx-summaries.json`.
- Managed map markers: `<!-- better-context-unity:begin -->` and `<!-- better-context-unity:end -->`.
- Supported map file names: `AGENTS.md` (Codex-style agents) and `CLAUDE.md` (Claude Code). No other name is accepted by the CLI.

## Client scope

Better Context is a local CLI, not an MCP server, so no client registration exists. The client-specific part is which instruction file carries the managed map block. Select it from the bundles present in the repository:

- `.codex/agents/setup_agents.toml` present → `AGENTS.md`.
- `.claude/agents/setup-agents.md` present → `CLAUDE.md`.
- Both present → both names, in one `map_files` list.

One scan writes every selected file, so the clients cannot drift apart. Never run a second scan per client, never hand-copy a managed block from one file into another, and never point the Claude map at a different `--max-depth`, summary set, or ignore policy.

## Workflow

1. Resolve and canonicalize the exact target project root. Record whether `HEAD` exists, its SHA, and the staged-path list. Stop if the index is already non-empty.
2. Require the root `.gitignore` to ignore `.better-context/`, `.ctxignore`, `.ctx.json`, `.ctx-summaries.json`, and Markdown files, and confirm none is tracked. When orchestrated by `setup-agents`, `setup-unity-gitignore` owns these rules and must complete first.
3. Resolve `uv` before invoking it:
   - If `uv --version` succeeds, reuse it.
   - If it is missing or cannot start, follow the official standalone installation command in [references/sources.md](references/sources.md) once.
   - If installation succeeds but the current process cannot resolve uv, add only the installer-reported directory to the current process PATH and retry once.
4. Inspect the installed tool without modifying it:
   - Resolve `better-context-unity` first.
   - When it resolves, run `better-context-unity --version`, top-level `--help`, `agents --help`, `editor --help`, `unity --help`, and `graph --help`.
   - Run `uv tool list --show-version-specifiers` and require the `better-context-unity` tool to reference `github.com/VKev/Better-Context`.
   - Require version `1.8.0` or newer, a `cocos` subcommand exposing `list`, `show`, and `components`, `agents --help` to expose `--summary`, `--remove-summary`, and `--map-file` (with `AGENTS.md` and `CLAUDE.md` as its accepted values), `editor --help` to expose `install`, `status`, and `sync`, `unity --help` to expose `list`, `show`, `components`, and `bindings`, and `graph --help` to expose dependency and call graph kinds.
   - Resolve `dotnet --version` and require an SDK major version of at least 8 before accepting Roslyn-backed C# analysis. A missing or older SDK leaves C# dependency/call verification incomplete even when the Python CLI works.
   - Treat the installation as correct only when the command, minimum version, Git source, summary flags, `--map-file` support, Editor bridge commands, Unity queries, call-graph option, and .NET prerequisite all pass.
5. Install or repair the CLI only when required:
   - Missing: `uv tool install "git+https://github.com/VKev/Better-Context.git@main"`.
   - Wrong source, old version, broken command, or missing summary, map-file, Editor, Unity, or call-graph capabilities: `uv tool install --force --refresh "git+https://github.com/VKev/Better-Context.git@main"`.
   - Do not reinstall or contact the network when the existing installation already passes every check.
6. Resolve the CLI again. If uv installed it but the command is not on PATH, resolve `uv tool dir --bin`, add only that directory to the current process PATH, and retry once. Stop if the command still cannot run.
7. Install or repair the companion package when it is missing or points elsewhere. Resolve an immutable accepted release tag or exact Better Context commit, then run `better-context-unity --root <project-root> editor install --revision <tag-or-commit>`. Preserve unrelated manifest entries and never hand-edit `Packages/packages-lock.json`.
8. Record the selected map files in `.ctx.json` so every later refresh — including one triggered from the Unity Editor companion package or by `dev-unity-project-context` — writes the same set without extra flags. Parse the existing file, preserve every unrelated key, and set only `map_files`:

   ```json
   { "map_files": ["AGENTS.md", "CLAUDE.md"] }
   ```

   Use exactly the names the client scope selected: a single-client repository keeps a single-element array. Stop on invalid JSON, a duplicate key, or a non-array `map_files` instead of rewriting the file. Confirm the root `.gitignore` ignores `.ctx.json` and that it is untracked. `--map-file` stays available for a one-off run, but configuration is the durable place for this choice.
9. Merge this managed vendor block into root `.ctxignore`, preserving every user-authored pattern and placing the block after any negation that would re-include these exact roots:

   ```text
   # setup-agents:vendor-context:begin
   .agent-temp/
   Assets/AgentSetupZLinqProbe/
   *.csproj
   *.sln
   *.slnx
   **/AGENTS.md.meta
   **/CLAUDE.md.meta
   Assets/Plugins/Demigiant/
   Assets/Plugins/Sirenix/
   Assets/Plugins/RootMotion/
   Assets/Plugins/Feel/
   Assets/Plugins/FImpossible Creations/
   Assets/Plugins/KINEMATION/
   Assets/Plugins/Technie/
   Assets/Plugins/Roslyn/
   Packages/nuget-packages/InstalledPackages/
   # setup-agents:vendor-context:end
   ```

   The solution/project files and generated `AGENTS.md.meta` / `CLAUDE.md.meta` files are Unity/IDE side effects rather than navigation source; ignoring them prevents a cleaned compile probe or map generation from immediately invalidating the new map. The remaining entries are registered third-party or generated dependency roots, not project-owned `Assets/Plugins` code. Never replace them with a broad `Assets/Plugins/` or `Packages/` rule. Verify the installed matcher reports these generated patterns, every registered root, and `.agent-temp/` ignored while `Assets/Plugins/Game/Probe.cs` and project-owned embedded-package code remain eligible.
10. Before regeneration, repair only stale Better Context output beneath those exact vendor/generated roots. For each `AGENTS.md` **and** `CLAUDE.md` containing this tool's managed markers, remove only the managed block; delete the file only when nothing but whitespace remains. Preserve handwritten content and never touch an unmarked file. Remove a paired `.meta` only when its exact map file was deleted and the meta is untracked/generated.
11. Inspect project map and Editor snapshot state:
   - Run `better-context-unity --root <project-root> editor status`. A fresh snapshot must match the exact Unity version, bridge version, source fingerprint, and package-lock hash.
   - If the snapshot is missing or stale and Unity is open, run `editor sync --mode open`; otherwise allow `editor sync --mode batch` only with the exact Unity version. `auto` must prefer the open Editor and must never launch a second Editor for an already-open project.
   - On Windows, Better Context `1.6.0` from approved source commit `b81b4ea595ecc8053f8bdefb9482b7b8227d05c8` has a registered `os.kill(pid, 0)` liveness defect. If and only if the standard open sync incorrectly says the target is closed while `Library/EditorInstance.json` identifies the live exact-version Editor, run `uv run --no-project python <skill>/scripts/sync_open_editor_snapshot.py --project-root <project-root>`. The fallback is source-hash gated, verifies the recorded PID/version/path against the live Windows process image, calls Better Context's own open snapshot routine, and never launches Unity. An unknown module hash or identity mismatch is `ambiguous` and blocks the fallback.
   - If Editor APIs are unavailable and `unity_editor_required` is false, preserve the explicit offline coverage warning. If required is true, stop instead of using stale Editor data.
   - If `.better-context/manifest.json`, `.better-context/staleness.json`, and the root managed marker exist, run `better-context-unity --root <project-root> verify`.
   - If verification succeeds, skip generation.
   - When orchestrated by `setup-agents` and live Unity package imports are still pending, configure the ignore policy but defer a missing first map or stale refresh until the single post-import refresh. Preserve an already healthy map.
   - Otherwise, if maps are missing or verification reports stale state, require that all temporary compile probes and Unity package/post-import mutations have already finished and been cleaned, then run `better-context-unity --root <project-root> agents` once with no summaries.
   - Allow a bounded ten-minute budget for the first Unity scan and report progress at least once per minute. A timeout is incomplete setup, not success.
12. Validate the generated state without changing project source:
    - Run `better-context-unity --root <project-root> verify`, `better-context-unity --root <project-root> editor status`, `better-context-unity --root <project-root> unity list --limit 1 --format json`, and `better-context-unity --root <project-root> graph --kind call --format json`. An empty Unity asset list or call graph is valid only when the project genuinely has no matching evidence; command/schema failure is not.
    - Parse `.better-context/manifest.json`. Require its generator to report the accepted CLI version and its Unity runtime section to record parsed, unsupported, and error coverage instead of inventing data for unsupported serialization.
    - When project-owned C# files exist, require Roslyn analysis evidence such as `analysis_engine: roslyn`; fallback-only symbol inventory is incomplete setup because C# dependency and call edges are deliberately omitted.
    - When a project-owned `.fbx` exists, run `unity list --kind model`, select one exact project-relative result, and require `unity show <path>` to expose parsed FBX structure and/or Unity `ModelImporter` facts. A path-only map row is not proof of FBX analysis.
    - When a project-owned texture exists and Editor coverage is fresh, run `unity show <path>` and require exact dimensions/importer facts plus Sprite subasset identities when applicable. For a prefab with resolved components, require `unity components --asset <path>` to expose exact type/assembly/boundary without filename guessing.
    - Require zero C# dependency edges to `.meta`, zero graph targets ending in `.meta`, and structured Unity edges to carry Unity/GUID evidence rather than free-text type-name matches.
    - Follow only child-map links emitted by a parent `AGENTS.md`. Do not fail setup merely because a raw art folder, collapsed runtime tree, vendor boundary, or generated boundary has no child map.
13. Verify the command, minimum version, exact Git source, pinned companion package, the `.ctx.json` map selection, fresh Editor snapshot or explicit allowed offline coverage, Roslyn/runtime capabilities, summary flags, `.ctxignore` behavior, fresh project state when generation was due, the root managed marker in every selected map file with identical managed content and self-consistent child/parent links, absence of managed vendor maps, unchanged `HEAD`, and empty staged-path list. Better Context is a local CLI and needs no MCP registration or client restart.

## Runtime handoff

After setup, `dev-unity-project-context` owns map verification, navigation, refreshes, and optional summaries. This setup skill must leave summaries untouched and must not duplicate runtime retrieval policy.

## Boundaries

- Install the CLI and companion package only from `VKev/Better-Context` with the exact Git requirements above. Do not substitute PyPI, the upstream repository, a mirror, or an editable checkout.
- Never delete `Library/EditorInstance.json`, a Unity lock file, or launch batch mode while the exact project is already open. Never accept an executable whose version differs from `ProjectVersion.txt`.
- Never hand-edit `.better-context/editor-snapshot.json`; stale Editor data is invalid evidence and must not be merged.
- Do not install uv again when a working uv is already available.
- Do not add summaries during project setup. Summary authoring is an optional runtime decision after source verification.
- Do not treat `verify` alone as proof that Roslyn, dependency correctness, Unity runtime parsing, compilation, or tests succeeded; it establishes only saved-context freshness.
- Keep each summary stable, factual, project-relative, and at most 240 characters. Never include secrets, transient task notes, speculative behavior, full method lists, or detailed call flows.
- Do not summarize every file or folder. Leave the map structural when a summary adds no durable navigation value.
- Never overwrite handwritten `AGENTS.md` or `CLAUDE.md` content, edit content inside the managed block manually, or run `clean` automatically. `clean` removes the managed block from every recognized map file name, which is why it stays a deliberate user action.
- Never write a client's map by copying, translating, or regenerating the block separately. One `agents` run with the configured `map_files` is the only supported way to keep the clients identical.
- Never run `git add`, `git commit`, `git push`, `git rm --cached`, or another command that changes Git history or the index.
- Do not claim completion when the source, executable, capability, map, ignore, or Git checks are incomplete.
- Never use Computer Use or UI automation to detect, open, focus, or close Unity. Use the standard CLI, the exact source-hash-gated Windows fallback, or ask the user for a manual action.
