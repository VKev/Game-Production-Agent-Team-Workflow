---
name: dev-unity-project-context
description: Navigate and maintain Unity project context with mandatory Better Context orientation before CodeGraph, including Editor-backed asset evidence, while treating AGENTS.md as a lossy summary rather than a complete index. Use CocoIndex independently for broad semantic discovery, then use CodeGraph only after Better Context identifies a concrete region or symbol. Refresh managed maps after edits. Use when understanding, locating, editing, or reorganizing project-owned Unity code, assets, or supporting documents.
---

# Unity Project Context and Retrieval

Establish the smallest reliable context before implementation. Better Context is mandatory and first: inspect its root map/query surface, then traverse linked maps toward the likely target. Maps are token-bounded and omission is never evidence of absence. CocoIndex can search broadly when names are unknown. CodeGraph is allowed only after Better Context has identified a concrete region, path, route, type, or symbol; do not use CodeGraph as an unmapped first search. Use Serena only after retrieval identifies an exact edit target.

## Trigger boundary

Load this skill for project navigation, code understanding, implementation, refactoring, or structural changes. Do not trigger it solely for Git initialization, `.gitignore` repair, external-tool installation, or agent bootstrap; the `setup-*` skills own those workflows.

## Establish project context

1. Resolve the canonical repository root.
2. Inspect `better-context-unity`, the managed root `AGENTS.md`, and `.better-context/` state first. When saved Better Context state exists, run `better-context-unity --root <repository-root> verify` once before relying on a map or manifest query.
   - Run `better-context-unity --root <repository-root> editor status` when importer settings, Sprite subassets, package component types, or other Editor-derived facts affect the task. `verify` and Editor snapshot freshness are separate checks.
3. If verification reports missing or stale managed state and project writes are authorized, run `better-context-unity --root <repository-root> agents` once and verify again. For a read-only task, preserve the repository and record that saved context is unavailable or stale.
4. Classify the target before retrieval:
   - **Mapped:** follow only child-map links emitted by the current `AGENTS.md`, reading the healthy chain from root to the nearest applicable map.
   - **Collapsed or bounded:** when a parent map lists or folds an art/runtime path but emits no child link, treat that parent as the terminal map. Do not require one `AGENTS.md` per physical folder.
   - **Unmapped or unlisted fallback:** do not infer absence. Use CocoIndex or bounded direct search to discover candidates. Read any applicable Better Context map/query for a selected candidate before CodeGraph. If Better Context remains unavailable or cannot establish a region/symbol, keep CodeGraph pending and continue with direct evidence.
5. When the root map is healthy, read it and use its ownership boundaries, folder purposes, project facts, key files, public API, dependencies, calls, cycles, and Unity runtime summary to select the smallest plausible branch.
6. Read each linked child map that applies, narrowing until the chain reaches the target or a terminal collapsed/boundary map. Do not require maps that the parent does not advertise.
7. Record the retrieval scope as mapped paths when a chain exists. For an unmapped fallback, derive a bounded scope from the user's target, a concrete search result, or exact repository evidence; expand only when new evidence requires it.
8. If a map lookup does not yield the target, use CocoIndex for semantic discovery or bounded direct search. Feed concrete candidates back through Better Context; only then use CodeGraph for relationships. A map miss never proves absence.

Treat maps as navigation evidence, not proof of behavior. They do not limit CocoIndex scope, but Better Context must establish the foothold supplied to CodeGraph.

## Use Better Context static queries

Use a fresh manifest before these read-only queries. Stop when they provide enough exact evidence; do not automatically repeat the same question in another index.

- `file <path>`: declared C# types and members for one known file.
- `deps <path>`: named dependencies and dependents with resolved symbols and source lines.
- `unity list [--kind KIND]`: discover scenes, prefabs, ScriptableObjects, Animator assets, clips, materials, meshes, FBX models, textures, Sprite atlases, shaders, audio clips, and video clips.
- `unity show <project-relative-asset> [--depth 2|-1]`: inspect serialized hierarchy, exact components and scripts, Animator topology, named references, FBX facts, texture/audio/video importer settings, and Sprite subassets/local IDs.
- `unity components [--asset PATH] [--type TYPE] [--object PATH]`: inspect exact resolved component types, enabled state, bounded fields, and named object references.
- `unity bindings [--asset PATH] [--type TYPE] [--method METHOD]`: inspect resolved and unresolved persistent UnityEvents.
- `editor status`: inspect companion package and snapshot freshness without launching Unity or regenerating context.
- `focus <path>`: build a bounded static neighborhood around a known file.
- `graph --kind dependency|call`: export project dependency or resolved function-call evidence.
- `optimize --budget <tokens> --task <task>`: select context for a large bounded task.

Use `unity show`, `unity components`, or `unity bindings` before raw YAML, `.meta`, image/media, or FBX inspection for supported facts. Treat fresh Editor snapshot facts as Unity-authoritative for importer settings, subasset identity, and `MonoScript.GetClass`; treat offline YAML/FBX parsing as structural evidence. If `editor status` reports a missing, stale, corrupt, or unavailable snapshot, do not infer that an importer setting, Sprite, or package component is absent. Fall back to exact `.meta`/asset evidence or live Unity inspection and state the coverage gap. For FBX, use the Unity Editor when evaluated animation, avatar baking, or final import behavior matters. A successful `verify` proves saved manifest freshness, not Editor snapshot freshness, compiler correctness, runtime behavior, or test success.

## Route source retrieval

Ask whether the task provides a known symbol, class, file, API route, dependency, caller/callee relationship, execution flow, or refactor target, or instead needs semantic discovery by intent.

### No-result escalation contract

Treat `AGENTS.md` as orientation, never as an exhaustive file, symbol, asset, or feature catalog. When the requested target is absent from a map or a map-selected search returns no useful result:

1. Continue outside the mapped branch; do not ask for another `AGENTS.md` and do not infer absence.
2. With a known path, filename, type, member, or relationship, query Better Context first and use CodeGraph only after it confirms a relevant foothold. With only intent or business meaning, query CocoIndex first.
3. If semantic retrieval yields a candidate, route it through Better Context before CodeGraph. If no foothold emerges, perform a bounded exact filesystem/source search; do not bypass the CodeGraph gate.
4. Use a CocoIndex candidate as a CodeGraph foothold when call paths, ownership, inheritance, or blast radius matter. Use CodeGraph source/names to refine a CocoIndex query when terminology is uncertain.
5. If an index is missing, stale, pending, or unavailable, say so and continue with CocoIndex/direct tools. Better Context coverage is a CodeGraph precondition, not an access gate for repository reading.

Only report that code or an asset does not exist after checking current repository evidence at the appropriate breadth. State which retrieval surfaces were unavailable or inconclusive.

### Known foothold: Better Context then CodeGraph when needed

Use `codegraph_explore` only after Better Context identifies the relevant map region, file, type, route, or symbol and `.codegraph/` is available. Name that concrete foothold in the query.

For a named method, class, file, caller/callee question, or blast-radius assessment, consult the applicable map and `deps`/`focus`/call-graph evidence first. Use CodeGraph for deeper call paths, relationships, or blast radius only from that established foothold. When Better Context cannot establish one, do not call CodeGraph.

`codegraph_explore` accepts a natural-language question, symbol names, file paths, or a useful combination. Prefer queries anchored by concrete names, for example `PlayerJumpController.cs Jump How does jump input reach vertical velocity?`. A file name asks CodeGraph to return current line-numbered source from that file; a function, method, or class name anchors symbol and relationship lookup; a question states which flow, callers, callees, or impact matters.

CodeGraph is graph-oriented rather than embedding-based semantic search. It extracts symbols and edges from syntax trees, stores them in a local SQLite graph with FTS5 full-text search, resolves calls/imports/inheritance, and expands the matching footholds into source, call paths, and blast radius. Use CocoIndex when meaning is known but names are not.

### Semantic discovery: CocoIndex whenever needed

Use CocoIndex Code semantic `search` whenever the task describes intent, business behavior, concepts, or similar functionality and exact implementation names are unknown or uncertain. Its scope is independent of `AGENTS.md`: search the repository broadly when needed, or set `paths` only when another piece of evidence makes a narrower search useful. Do not narrow CocoIndex merely because Better Context selected one branch.

For a request such as “find the file related to jumper,” inspect Better Context first, then use CocoIndex across the relevant project scope when “jumper” may be described under an unexpected identifier. Treat its results as candidate files and symbols. If structural relationships are needed, route the selected candidate through the applicable map chain or Better Context `file`, `deps`, or `focus`; use CodeGraph only after that query establishes the foothold. If Better Context still cannot establish one, keep CodeGraph pending and use direct evidence. Do not treat vector similarity as call-graph proof.

### Document semantic discovery: extract, then index

Do not send raw PDF, DOCX, XLS/XLSX, PPTX, or other binary containers to CodeGraph or `ccc`. CocoIndex Code reads matched files as decoded text and skips undecodable content; a custom chunker receives text only after decoding, so adding a binary extension or chunker does not make the container parseable. Use the locally installed Docling converter to turn supported documents into Markdown before semantic indexing.

Choose the smallest useful route:

- For one known document, exact page/layout inspection, spreadsheet formulas, tracked changes, comments, images, or other format-specific facts, use the available PDF, document, spreadsheet, or presentation reader directly. The indexing overhead adds no value.
- For semantic discovery across several documents, unknown terminology, repeated questions, or cross-format comparison, convert each source with Docling, build a derived text corpus, and search that corpus with CocoIndex Code.
- For a durable shared document index, design a dedicated CocoIndex pipeline around Docling's Python API and explicit target state. Treat that as separate setup work; do not silently turn the project code index into a document pipeline.

Build an ad hoc document corpus as follows:

1. Confirm that temporary writes are authorized. Place the corpus in an ignored task-scoped directory such as `<repository>/.agent-temp/cocoindex-documents/<scope>/`. Because the main code index normally excludes hidden directories, initialize and query a separate `ccc` project at the corpus root instead of weakening the main project's exclusions.
2. Require `docling --version` and `docling convert --help` to succeed. If Docling is unavailable or lacks the required format, do not install it during ordinary project work; use the matching format-specific reader or hand off to `setup-cocoindex-code` for repair. The setup guarantees modern PDF, DOCX, XLSX, and PPTX conversion, not legacy DOC/XLS/PPT conversion that requires LibreOffice.
3. Convert one source per uniquely named derivative directory to avoid same-stem collisions:

   ```powershell
   docling convert <source-file> --to md --output <derivative-directory> `
     --abort-on-error --device cpu --image-export-mode placeholder `
     --no-enable-remote-services --no-allow-external-plugins `
     --document-timeout 600
   ```

   Keep OCR and table extraction enabled unless the task has a verified reason to change them. The command runs document processing locally; first use may download official model artifacts, but it must not upload source content or enable a remote service.
4. Add provenance to each UTF-8 Markdown derivative or a colocated manifest: original project-relative path when possible, source SHA-256, source format, Docling version, conversion options, and any available page, sheet, slide, section, or record markers. Never overwrite or rename the originals. Treat Docling Markdown as semantic text, not a lossless representation of every formula, annotation, image, or layout fact.
5. Before embedding, check whether the configured CocoIndex model is local or remote. Do not send secrets, personal data, confidential documents, or protected content to a remote embedding provider without the user's authorization.
6. From the corpus root, run `ccc init` only when its own `.cocoindex_code/` state is absent, then `ccc index`. Query with `ccc search <query> --refresh --json`, narrowing by derivative path only when useful.
7. Treat semantic hits as candidates. Reopen the original file with its format-aware reader before asserting layout, formulas, calculated values, annotations, images, signatures, OCR accuracy, or other information that conversion may omit or distort.
8. Keep the derived corpus only while it has reuse value. Remove it only when cleanup is authorized, and never delete the source documents as part of index cleanup.

### Deliberate dual retrieval

Use both systems intentionally for broad refactors, duplicate-functionality discovery, and security-sensitive investigations. CocoIndex may discover candidates across map branches; CodeGraph verifies selected candidates only after Better Context establishes their applicable region or symbol. Do not repeat an identical CodeGraph question in CocoIndex unless independent semantic recall serves a distinct purpose.

### Direct-tool scope

Use built-in read/search tools for:

- Unity scenes, prefabs, assets, serialized YAML, and model files when `unity show`/`unity bindings` cannot answer, serialization is unsupported or unresolved, live Unity MCP is unavailable, or exact text/binary inspection is required.
- Configuration, documentation, unsupported languages, and exact post-edit reads.
- Known document files whose format-specific reader can answer directly without building a semantic corpus.
- Targeted literal or high-recall checks when exact text or non-code assets matter.
- Cases where an index is unavailable, pending, stale, or returns no useful foothold.

Pass a direct-tool or CocoIndex candidate to CodeGraph only after Better Context establishes its applicable region or symbol. If no map applies, try Better Context `file`, `deps`, or `focus`; otherwise keep CodeGraph pending and use direct evidence.

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

After any project-owned file or asset mutation that Better Context indexes, refresh Better Context once before handoff when its managed maps already exist. Batch this after the task's edits; do not regenerate after every individual write. `agents` may ask the open Editor for a fresh snapshot or launch the exact project Unity version in batch mode when the companion package is installed. Never hand-edit the Editor snapshot or generated table rows. If the refresh falls back offline, preserve the warning and do not claim Editor-backed importer/component coverage.

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

Read [sources.md](references/sources.md) when Unity folder ownership, package structure, assembly boundaries, `.meta` behavior, document extraction, or current CodeGraph/CocoIndex behavior affects the navigation decision.

## Completion check

Before handoff, verify that:

1. Better Context was inspected first when available and any missing or stale state was reported without blocking valid unmapped retrieval.
2. Every CodeGraph call used a concrete region or symbol established by Better Context; no unmapped CodeGraph-first fallback occurred.
3. Better Context `deps`, `unity`, `focus`, or graph queries were used before duplicating static evidence when they applied.
4. CocoIndex was used whenever semantic retrieval materially helped, with scope chosen from retrieval needs rather than imposed by the map hierarchy; both indexes were attempted before any genuine `not found` conclusion when available.
5. Any binary or structured document searched semantically was converted with a format-aware reader into a separate provenance-preserving corpus; sensitive-content authorization and original-file verification were handled explicitly.
6. Retrieval stopped once sufficient current evidence was obtained.
7. Source edits used Serena or the built-in editor, not a retrieval-only tool.
8. Compilation, tests, and Unity behavior were verified independently of map or index results.
9. Every project-owned path mutated by this task was checked against `.ctx-summaries.json`; stale summaries were removed, changed responsibilities were updated, and unrelated dirty paths were left alone.
10. Managed maps were refreshed once after the task's mutations and reverified, or the handoff was reported incomplete.
