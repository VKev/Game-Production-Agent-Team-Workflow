# Cocos Parallel Safety

Subagents in one task share a filesystem. In a Cocos Creator project the shared,
racy resources are the serialized JSON layer, the asset database, and the single
editor process — not a compilation domain.

## Usually safe to parallelize

- Read-only investigation of different subsystems.
- Edits to disjoint `.ts` files behind already-stable interfaces.
- Engine-free tests and static checkers authored in disjoint files.
- Documentation or Bead analysis that does not touch the same generated map.

## Require an explicit lock or serialize

- The same `.ts` file, its `.meta`, or a shared data table.
- Any `.scene`, `.prefab`, `.anim`, `.mtl`, or `.meta` file. The editor and the MCP
  tools rewrite these **wholesale**: two writers do not merge, the last one wins and
  the other's work disappears without a conflict marker.
- `assets/*/` directory `.meta` files — they carry the bundle contract
  (`isBundle`, `bundleName`); a rename or a bundle change is a project-wide lock.
- `settings/v2/packages/*.json` (start scene, builder/subpackage configuration),
  `tsconfig.json`, and `package.json`.
- `assets/scripts/bootstrap.ts` or whatever module owns side-effect import order.
  Two workers appending lines to it produce a merge that compiles and runs in the
  wrong order.
- Localization tables and shared event/save contracts until they are stable.
- The Cocos MCP connection itself: one editor, one open scene. Any Bead that opens
  a scene, saves a scene, refreshes assets, runs a preview, or builds takes the
  **exclusive editor lane**.
- Setup tools, indexes, user-level MCP configuration, and extension installation.

## Dispatch check

Before running two Beads together, prove all of the following:

1. Their owned paths do not overlap, including `.meta` siblings.
2. Neither needs the editor lane, or exactly one does.
3. Neither changes a bundle name, the start scene, or bootstrap import order.
4. Each names the gate that will prove it done, and those gates do not contend for
   the editor at the same moment.

If ownership becomes ambiguous, pause one lane and update the graph before more
edits occur.

## Serialize at the end

The final sequence is always single-lane: refresh assets once, refresh Better
Context once, run the type check and the project's checkers, then the platform
build with its boot chain. Do not overlap a build with any worker that writes to
`assets/`.
