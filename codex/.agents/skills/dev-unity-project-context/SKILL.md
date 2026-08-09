---
name: dev-unity-project-context
description: Navigate and maintain Unity project context, route source discovery through Better Context, CodeGraph, CocoIndex Code, direct tools, and Serena, and refresh hierarchical AGENTS.md maps after structural changes. Use when understanding, locating, editing, or reorganizing project-owned Unity code and assets; do not use for tool installation or repository bootstrap alone.
---

# Unity Project Context and Retrieval

Establish the smallest reliable context before implementation. Use project maps for orientation, indexed tools for source discovery, Serena for source edits, and direct tools only where they add evidence or provide a fallback.

## Trigger boundary

Load this skill for project navigation, code understanding, implementation, refactoring, or structural changes. Do not trigger it solely for Git initialization, `.gitignore` repair, external-tool installation, or agent bootstrap; the `setup-*` skills own those workflows.

## Establish project context

1. Resolve the canonical repository root.
2. Read the applicable `AGENTS.md` chain from the root to the target folder before editing there.
3. When `better-context-unity` and its root marker plus `.better-context/` state exist, run `better-context-unity --root <repository-root> verify` once.
4. If maps are missing or stale and project writes are authorized, run `better-context-unity --root <repository-root> agents` once and read the refreshed maps.
5. For a read-only task, do not mutate the repository merely to refresh context. Use existing maps and the retrieval fallbacks below.
6. If Better Context is unavailable, continue without it. Do not install, upgrade, or reconfigure it; `setup-agents` and `setup-better-context` own setup.

Treat maps as navigation aids, not proof of current implementation behavior. When a documented path is stale, verify the filesystem or indexed source before relying on it.

## Route source retrieval

Before searching, ask internally whether the task already provides a known symbol, class, file, API route, dependency, caller/callee relationship, execution flow, or refactor target.

### Known foothold: CodeGraph first

Use `codegraph_explore` when CodeGraph and the current project's `.codegraph/` index are available. Prefer its source, relationships, call paths, and blast-radius result over repeating the same question with CocoIndex, grep, Serena, or another broad read loop.

Use CodeGraph first for questions such as fixing a named method, tracing a known route, explaining a caller/callee relationship, or assessing what a known change can break.

### Unknown identifier: CocoIndex then CodeGraph

Use CocoIndex Code semantic `search` when the task describes intent, business behavior, or similar functionality but the implementation names are unknown. Treat its results as candidate paths and symbols, then give those concrete footholds to CodeGraph to establish actual relationships.

Use this sequence for prompts such as “where do we upgrade free users?” or “find code similar to address normalization.” Do not treat vector similarity as call-graph proof.

### Deliberate dual retrieval

Use both systems intentionally for broad refactors, duplicate-functionality discovery, and security-sensitive investigations where both recall and structural certainty matter. Do not automatically run Better Context, CocoIndex, CodeGraph, grep, ripgrep, Serena reads, and direct reads for every task.

### Direct-tool scope

Use built-in read/search tools for:

- Unity scenes, prefabs, assets, and serialized YAML when live Unity MCP is unavailable or exact text inspection is required.
- Configuration, documentation, unsupported languages, and exact post-edit reads.
- Targeted literal or high-recall checks.
- Any case where the relevant index is unavailable, uninitialized, pending, stale, or returns no useful foothold.

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

After project-owned files, folders, or durable responsibilities change, refresh Better Context once before handoff when its managed maps already exist. Never edit generated table rows by hand.

Add an optional summary only when a verified, stable responsibility description materially improves future navigation:

```powershell
better-context-unity --root <repository-root> agents `
  --summary 'Assets/Scripts/Combat=Runtime combat systems.' `
  --summary 'Assets/Scripts/Combat/DamageSystem.cs=Calculates and applies character damage.'
```

Use project-relative paths. Keep summaries factual, durable, and at most 240 characters. Never include secrets, temporary task notes, guesses, full method lists, or detailed call flows. Do not summarize every file or folder. Use `--remove-summary <path>` when a stored summary becomes incorrect.

If Better Context is unavailable, preserve existing `AGENTS.md` content and report stale navigation state rather than inventing or replacing generated maps.

## Reference loading

Read [sources.md](references/sources.md) only when Unity folder ownership, package structure, assembly boundaries, or `.meta` behavior affects the navigation decision.

## Completion check

Before handoff, verify that:

1. The applicable `AGENTS.md` chain was read.
2. Retrieval stopped once sufficient current evidence was obtained.
3. Source edits used Serena or the built-in editor, not a retrieval-only tool.
4. Compilation, tests, and Unity behavior were verified independently of index results.
5. Managed maps were refreshed after relevant structural changes, or their pending state was reported.
