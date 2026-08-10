---
name: dev-unity-project-context
description: Navigate and maintain Unity project context with Better Context as the preferred first orientation while treating AGENTS.md as a lossy summary rather than a complete index. Fall back to CodeGraph for paths, symbols, relationships, and current source, and to CocoIndex Code for semantic discovery whenever maps omit, collapse, or fail to locate the target. Refresh managed maps after edits. Use when understanding, locating, editing, or reorganizing project-owned Unity code and assets; do not use for tool installation or repository bootstrap alone.
---

# Unity Project Context and Retrieval

Establish the smallest reliable context before implementation. Inspect Better Context first when it is available, but treat every `AGENTS.md` as token-bounded, selective, and potentially incomplete. A missing file, symbol, feature, dependency, or keyword in a map is never evidence that it does not exist. Continue through CodeGraph, CocoIndex, or direct repository evidence until the task has a reliable foothold. Use Serena only after retrieval identifies an exact edit target.

## Trigger boundary

Load this skill for project navigation, code understanding, implementation, refactoring, or structural changes. Do not trigger it solely for Git initialization, `.gitignore` repair, external-tool installation, or agent bootstrap; the `setup-*` skills own those workflows.

## Establish project context

1. Resolve the canonical repository root.
2. Inspect `better-context-unity`, the managed root `AGENTS.md`, and `.better-context/` state first. When saved Better Context state exists, run `better-context-unity --root <repository-root> verify` once before relying on a map or manifest query.
3. If verification reports missing or stale managed state and project writes are authorized, run `better-context-unity --root <repository-root> agents` once and verify again. For a read-only task, preserve the repository and record that saved context is unavailable or stale.
4. Classify the target before retrieval:
   - **Mapped:** follow only child-map links emitted by the current `AGENTS.md`, reading the healthy chain from root to the nearest applicable map.
   - **Collapsed or bounded:** when a parent map lists or folds an art/runtime path but emits no child link, treat that parent as the terminal map. Do not require one `AGENTS.md` per physical folder.
   - **Unmapped or unlisted fallback:** when no applicable map exists, the applicable map does not mention the requested target, Better Context is unavailable/stale, or the target lies outside managed coverage, do not invent a chain, constrain retrieval to the map, or block CodeGraph/CocoIndex. Record the fallback and anchor retrieval to the user's path, a known symbol, a Better Context query result, an index result, or exact filesystem evidence when possible.
5. When the root map is healthy, read it and use its ownership boundaries, folder purposes, project facts, key files, public API, dependencies, calls, cycles, and Unity runtime summary to select the smallest plausible branch.
6. Read each linked child map that applies, narrowing until the chain reaches the target or a terminal collapsed/boundary map. Do not require maps that the parent does not advertise.
7. Record the retrieval scope as mapped paths when a chain exists. For an unmapped fallback, derive a bounded scope from the user's target, a concrete search result, or exact repository evidence; expand only when new evidence requires it.
8. If a map lookup does not yield the requested file, symbol, behavior, or feature, continue automatically: use CodeGraph for known names and structural relationships, CocoIndex for meaning or unknown names, and direct inspection when an index is unavailable or inconclusive. A map miss must not terminate retrieval or justify a `not found` conclusion.

Treat maps as preferred navigation and ownership evidence, not proof of current implementation behavior and not an access-control boundary for CodeGraph or CocoIndex. Verify candidate source and relationships after discovery.

## Use Better Context static queries

Use a fresh manifest before these read-only queries. Stop when they provide enough exact evidence; do not automatically repeat the same question in another index.

- `file <path>`: declared C# types and members for one known file.
- `deps <path>`: named dependencies and dependents with resolved symbols and source lines.
- `unity list [--kind KIND]`: discover scenes, prefabs, ScriptableObjects, Animator assets, clips, materials, meshes, and FBX models.
- `unity show <project-relative-asset> [--depth 2|-1]`: inspect serialized hierarchy, components, scripts, Animator topology, named references, and FBX node/mesh/material/skeleton/clip/importer facts.
- `unity bindings [--asset PATH] [--type TYPE] [--method METHOD]`: inspect resolved and unresolved persistent UnityEvents.
- `focus <path>`: build a bounded static neighborhood around a known file.
- `graph --kind dependency|call`: export project dependency or resolved function-call evidence.
- `optimize --budget <tokens> --task <task>`: select context for a large bounded task.

Use `unity show` or `unity bindings` before raw YAML or FBX inspection for supported facts. For FBX, treat `ModelImporter` metadata as Unity-authoritative and the zero-dependency FBX parse as structural evidence; use the Unity Editor when evaluated animation, avatar baking, or final import behavior matters. A successful `verify` proves freshness, not compiler correctness, runtime behavior, or test success.

## Route source retrieval

Ask whether the task provides a known symbol, class, file, API route, dependency, caller/callee relationship, execution flow, or refactor target, or instead needs semantic discovery by intent.

### No-result escalation contract

Treat `AGENTS.md` as orientation, never as an exhaustive file, symbol, asset, or feature catalog. When the requested target is absent from a map or a map-selected search returns no useful result:

1. Continue outside the mapped branch; do not ask for another `AGENTS.md` and do not infer absence.
2. With a known path, filename, type, member, or relationship, query CodeGraph first. With only intent or business meaning, query CocoIndex first.
3. If the first index yields no reliable foothold, try the other enabled index. For a genuine `not found` conclusion, attempt both CodeGraph and CocoIndex when both are available, then perform a bounded exact filesystem/source search.
4. Use a CocoIndex candidate as a CodeGraph foothold when call paths, ownership, inheritance, or blast radius matter. Use CodeGraph source/names to refine a CocoIndex query when terminology is uncertain.
5. If an index is missing, stale, pending, or unavailable, say so and continue with the remaining index plus direct tools. Never let index availability or map coverage become an access gate.

Only report that code or an asset does not exist after checking current repository evidence at the appropriate breadth. State which retrieval surfaces were unavailable or inconclusive.

### Known foothold: Better Context then CodeGraph when needed

Use `codegraph_explore` when Better Context evidence is insufficient and the current project's `.codegraph/` index is available. Read the applicable map chain first when one exists; otherwise use the unmapped fallback without blocking. Name a concrete candidate file, path, or symbol whenever available.

For a named method, class, file, caller/callee question, or blast-radius assessment, consult the applicable map and `deps`/`focus`/call-graph evidence first when available. Use CodeGraph for current source, deeper call paths, dynamic-dispatch-sensitive relationships, or blast radius that the static map does not answer. When no map applies, search CodeGraph directly and label the result as unmapped retrieval.

`codegraph_explore` accepts a natural-language question, symbol names, file paths, or a useful combination. Prefer queries anchored by concrete names, for example `PlayerJumpController.cs Jump How does jump input reach vertical velocity?`. A file name asks CodeGraph to return current line-numbered source from that file; a function, method, or class name anchors symbol and relationship lookup; a question states which flow, callers, callees, or impact matters.

CodeGraph is graph-oriented rather than embedding-based semantic search. It extracts symbols and edges from syntax trees, stores them in a local SQLite graph with FTS5 full-text search, resolves calls/imports/inheritance, and expands the matching footholds into source, call paths, and blast radius. Use CocoIndex when meaning is known but names are not.

### Semantic discovery: CocoIndex whenever needed

Use CocoIndex Code semantic `search` whenever the task describes intent, business behavior, concepts, or similar functionality and exact implementation names are unknown or uncertain. Its scope is independent of `AGENTS.md`: search the repository broadly when needed, or set `paths` only when another piece of evidence makes a narrower search useful. Do not narrow CocoIndex merely because Better Context selected one branch.

For a request such as “find the file related to jumper,” inspect Better Context first, then use CocoIndex across the relevant project scope when “jumper” may be described under an unexpected identifier. Treat its results as candidate files and symbols. If structural relationships are needed, read the applicable map chain when it exists, then use CodeGraph; if no map applies, use the selected result as an unmapped CodeGraph foothold. Do not treat vector similarity as call-graph proof.

### Deliberate dual retrieval

Use both systems intentionally for broad refactors, duplicate-functionality discovery, and security-sensitive investigations. CocoIndex may discover candidates across map branches; CodeGraph verifies selected candidates after reading any applicable map or through an explicitly recorded unmapped fallback. Do not repeat an identical CodeGraph question in CocoIndex unless independent semantic recall serves a distinct purpose.

### Direct-tool scope

Use built-in read/search tools for:

- Unity scenes, prefabs, assets, serialized YAML, and model files when `unity show`/`unity bindings` cannot answer, serialization is unsupported or unresolved, live Unity MCP is unavailable, or exact text/binary inspection is required.
- Configuration, documentation, unsupported languages, and exact post-edit reads.
- Targeted literal or high-recall checks when exact text or non-code assets matter.
- Cases where an index is unavailable, pending, stale, or returns no useful foothold.

When a relevant healthy map exists, read it before passing a direct-tool or CocoIndex result to CodeGraph. When no map applies, use the concrete result directly as an unmapped fallback; do not block CodeGraph solely because `AGENTS.md` is absent.

## Route source editing

Serena is optional and is for semantic source edits and refactors, not ordinary code reading or navigation.

After retrieval identifies the exact target:

1. Activate the canonical repository root in Serena unless it is already active.
2. Read Serena's project instructions.
3. Use its symbol-aware editing operations.

If Serena is unavailable, use the built-in editor. Do not install or reconfigure it during development work.

Unity MCP owns live Editor state and Unity-serialized operations; it is not the primary C# search or editing tool. After source edits, use Unity MCP when available to wait for compilation, inspect the console, run relevant Unity tests, and verify scene or visual behavior.

Allow CodeGraph and CocoIndex Code to synchronize before trusting another indexed result. If either reports stale or pending data, perform one exact direct read of the edited file.

## Maintain project maps

After any project-owned file or asset mutation that Better Context indexes, refresh Better Context once before handoff when its managed maps already exist. Batch this after the task's edits; do not regenerate after every individual write. Never edit generated table rows by hand.

Before that refresh, audit optional summaries for the exact project-relative paths added, modified, deleted, renamed, or moved by the current task. Build this touched-path set from the task's own edit record or a before/after snapshot; do not claim unrelated pre-existing dirty-worktree paths. Read `.ctx-summaries.json` when it exists, but change it only through the CLI:

- Keep an existing summary when the durable responsibility remains correct.
- Replace it with `--summary PATH=TEXT` when verified behavior changes its durable responsibility.
- Use `--remove-summary PATH` when the summarized file or folder is deleted or the text is no longer materially useful.
- For a rename or move, remove the old stored path and add the new path only after verifying that the responsibility still applies there.
- For a new path, add no summary unless verified responsibility adds durable navigation value beyond generated code and Unity evidence.

Combine all required removals and updates with the single refresh:

```powershell
better-context-unity --root <repository-root> agents `
  --remove-summary 'Assets/Scripts/OldDamageSystem.cs' `
  --summary 'Assets/Scripts/Combat/DamageSystem.cs=Calculates and applies character damage.'
better-context-unity --root <repository-root> verify
```

If no stored summary is affected, run `agents` without summary flags and then `verify`. If the summary update, refresh, or verification fails, do not edit `.ctx-summaries.json` or managed `AGENTS.md` rows directly; preserve the existing content and report the handoff as incomplete.

Add an optional summary only when a verified, stable responsibility description materially improves future navigation:

```powershell
better-context-unity --root <repository-root> agents `
  --summary 'Assets/Scripts/Combat=Runtime combat systems.' `
  --summary 'Assets/Scripts/Combat/DamageSystem.cs=Calculates and applies character damage.'
```

Use project-relative paths. Keep summaries factual, durable, and at most 240 characters. Never include secrets, temporary task notes, guesses, full method lists, or detailed call flows. Do not summarize every file or folder. Use `--remove-summary <path>` when a stored summary becomes incorrect.

If Better Context becomes unavailable or refresh/verification fails, preserve existing `AGENTS.md` content and report the map state as incomplete. Do not claim retrieval or handoff fully verified.

## Reference loading

Read [sources.md](references/sources.md) when Unity folder ownership, package structure, assembly boundaries, `.meta` behavior, or current CodeGraph/CocoIndex behavior affects the navigation decision.

## Completion check

Before handoff, verify that:

1. Better Context was inspected first when available and any missing or stale state was reported without blocking valid unmapped retrieval.
2. Every CodeGraph call either used helpful map evidence or recorded an unlisted/unmapped fallback anchored to concrete evidence; no map was treated as an access gate.
3. Better Context `deps`, `unity`, `focus`, or graph queries were used before duplicating static evidence when they applied.
4. CocoIndex was used whenever semantic retrieval materially helped, with scope chosen from retrieval needs rather than imposed by the map hierarchy; both indexes were attempted before any genuine `not found` conclusion when available.
5. Retrieval stopped once sufficient current evidence was obtained.
6. Source edits used Serena or the built-in editor, not a retrieval-only tool.
7. Compilation, tests, and Unity behavior were verified independently of map or index results.
8. Every project-owned path mutated by this task was checked against `.ctx-summaries.json`; stale summaries were removed, changed responsibilities were updated, and unrelated dirty paths were left alone.
9. Managed maps were refreshed once after the task's mutations and reverified, or the handoff was reported incomplete.
