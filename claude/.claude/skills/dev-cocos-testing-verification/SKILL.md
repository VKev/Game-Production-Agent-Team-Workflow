---
name: dev-cocos-testing-verification
description: Decide what actually verifies a change in a Cocos Creator 3.8 project — which gates are real, how to test engine-free logic with Node and vm, static checkers for serialized and data integrity, MCP validation and diagnostics, and how to report evidence. Use before claiming any Cocos change works, and when adding a test or a checker.
---

# Cocos verification

## The gate hierarchy

| Gate | Command | What it proves |
|---|---|---|
| Type check | `npx tsc --noEmit -p tsconfig.json` | types only, and only for files without `@ts-nocheck`; needs `temp/` from an editor import |
| Engine-free unit tests | `node <test>` loading the real module through `vm` | rules, formulas, ordering — the logic layer |
| Static project checkers | project scripts over `assets/**` | class-id resolution, `MissingScript`, null `@property`, dangling uuids, unregistered data ids |
| MCP validation | `validate_scene`, `validate_prefab_references`, `validate_asset_dependencies`, `run_script_diagnostics` | the serialized layer, live, in the editor |
| Editor preview | Preview button | **not a gate** — runs the open scene with editor tooling |
| **Build** | platform build + boot chain | the only gate that proves the game runs |

Nothing below the build proves the game runs; nothing above the unit tests runs without the editor. Use them together and say which ones you ran.

## Writing engine-free tests

The logic worth testing does not import `cc` at module scope. Load the real module — never a copy of its logic — compile it in memory and run it under `node`:

- Compile the project's own `.ts` with the project's TypeScript and evaluate it in a `vm` context, so the test drifts when the source drifts.
- Provide an escape hatch env var pointing the test at another version of the file; running the suite against the old implementation and seeing it fail is how you learn the test is not hollow.
- For code that must touch a `cc` type, assert against the source text (for example that a cast or a call site exists) rather than pretending a `Component` can be constructed outside the engine.
- Keep a test's fixtures under a temporary directory, never in the live project.

## Static checkers earn their place

A static checker catches the class of defect that types cannot see and that only surfaces for a player who reaches a specific screen:

- every component class-id in every scene/prefab resolves to a script;
- no duplicate `@ccclass` registrations;
- every id referenced by a data table is registered somewhere;
- no dangling uuid references;
- `@property` fields that are null, listed deliberately with a justification for each.

Write them to exit non-zero, run them before every build, and keep their numbers reproducible: **every number in a report ships with the command that produced it**, or it is labelled a guess.

## Reporting

State exactly which gates ran and what they said. "Type check clean, 51 extension tests pass, build completed, boot chain reached the first screen" is a report. "Should work" is not. If a gate was skipped — no device, editor closed, build not run — say so rather than implying coverage.

## Boundaries

- Never call a change verified because the type check passed.
- Never call a change verified because preview looked right.
- Never duplicate production logic into a test fixture; load the real module.
- Never write test artifacts into the live project directory.
- Never adjust a checker's threshold or allowlist to make a red gate green without saying why in the same change.
- Never report a measurement without the command that produced it.


## What the built-in gates are blind to

`tsc --noEmit`, `validate_scene`, `validate_prefab_references` and
`run_script_diagnostics` between them cover types and references. On a 2.x→3.8
port the expensive bugs live in two layers none of them touch:

- **asset import** — 9-slice `capInsets` and `trimType` are stored on the
  sprite-frame `.meta`, not on the Sprite component. A re-import silently resets
  them and every `SLICED` sprite renders stretched. The prefab data is correct, so
  a prefab-level checker cannot see it.
- **serialisation** — node `_layer`, `cc.PrefabInfo` linkage, `Label` defaults and
  `Widget.alignMode` enum values are all plain fields nobody validates.

So on a port, the real gate is a **data checker that compares the two projects**:
dump the 2.x asset, dump the 3.x one, diff the fields that matter, and require
zero differences you cannot explain. Examples that earned their keep:
`contentSize` per node, prefab root position, Widget insets, spine animation names
against the bound skeleton, and every cross-bundle import edge.

## A checker that cannot fail is not a checker

After writing one, **break the thing it guards on purpose** and confirm it goes
red, then restore. This has already caught a checker that silently passed because
the script meant to break the code matched `\n` while the file used CRLF, so it
changed nothing and the "negative test" proved only that the file was unchanged.

Verify the sabotage actually applied, not just that the test ran.

## Prefer a test that can run outside the engine

A module chain that does not import `cc` can be compiled to **real ESM** and
evaluated in Node against a fake host — which is how an engine-boot-order bug can
be reproduced in a second instead of on a device. It must be ESM: CommonJS
evaluates in source order and hides exactly the hoisting bug you are hunting.

Keep those chains free of `cc` imports on purpose; it is what makes them testable.
