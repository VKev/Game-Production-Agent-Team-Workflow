---
name: dev-cocos-project-context
description: Establish and maintain verified project context in a Cocos Creator 3.8 TypeScript project, and route retrieval and editing across Better Context maps and cocos queries, CodeGraph, CocoIndex semantic search, the Cocos MCP editor tools, Serena edits, and direct reads. Use before navigating, understanding, editing, or reorganizing Cocos project code and assets, and whenever a first search returns nothing useful.
---

# Cocos project context and retrieval routing

This is the Cocos peer of `dev-unity-project-context`. The routing policy is the same; the query surface and the failure modes are Cocos-specific.

## Establish project context first

1. Read the root map (`AGENTS.md` for Codex, `CLAUDE.md` for Claude Code; one Better Context scan writes both). It records the Creator version, the **asset-bundle contract**, the start scene, the editor extensions, and where the serialized layer resolves.
2. Traverse root → target folder maps before opening files. Map omission is lossy orientation, never evidence of absence.
3. When the maps are missing or stale, say so and refresh once (`better-context-unity --root <root> agents`) instead of navigating on stale evidence. Never refresh while the Cocos Editor is importing assets.

## Route retrieval

| Need | Tool |
|---|---|
| Where does this feature live; what is in this folder | Better Context maps (root → target) |
| Which scene/prefab uses this script; what components a scene wires | `better-context-unity cocos list`, `cocos show <asset> --depth -1`, `cocos components --type <ClassName>` |
| Who calls this function; blast radius of a change | CodeGraph, only after a map or a `cocos` query produced a concrete path/symbol |
| Unknown terminology, unknown location, business concept | CocoIndex semantic search over the whole project; hand the resulting names back to CodeGraph |
| Live editor state: selection, open scene, node tree, console, build status | Cocos MCP (`dev-cocos-mcp`), never a file read |
| Exact text, small file, or an index is unavailable | direct read/grep |

Stop retrieving as soon as the current evidence answers the question.

## What only the serialized layer can answer

A grep over `assets/**/*.ts` cannot see the half of a Cocos project that lives in JSON:

- A component appears in a scene as `"__type__": "<23-char class-id>"`, compressed from the script's uuid in its `.meta`. Better Context resolves it back to the `.ts` file; a text search cannot.
- `@property` wiring is data, not code. A field can be `null` at runtime with a clean `tsc` and no compile error.
- Asset references are `{"__uuid__": "..."}`, so a texture, prefab, or clip rename is invisible to a code search.
- An unresolved component type in a map means a missing script, a stale class-id, or a duplicate `@ccclass` — it becomes `MissingScript` at runtime. Treat it as a defect to report, never as noise.

## Route editing

- Source edits: Serena for semantic TypeScript edits once the exact target is known; direct edits for small, unambiguous changes.
- Scene, prefab, node, or component changes: the Cocos MCP tools or the editor — never hand-edited `.scene`/`.prefab` JSON. See `dev-cocos-scene-prefab`.
- After editing `.ts` files that scenes bind to, refresh assets in the editor and wait for the `.meta` before any tool resolves uuids.
- After a batch of edits, refresh Better Context once and verify the maps; do not refresh per file.

## Completion check

Before handing off, confirm: the maps you relied on were fresh, every claim about a scene or prefab came from a `cocos` query or an MCP call rather than a guess, unresolved component types were reported, and the final state was validated against the gates in `dev-cocos-testing-verification`.

## Boundaries

- Never present a file-search result as proof about serialized state; scenes and prefabs are the source of truth for wiring.
- Never claim a `@property` is wired without evidence from the scene/prefab or the editor.
- Never edit `.scene`, `.prefab`, `.anim`, or `.meta` files as text to "fix" a reference.
- Never delete `library/` or `temp/` to force a re-index as part of navigation.
- Never treat a clean `npx tsc --noEmit` as proof that the project runs; the gate is a completed build.
