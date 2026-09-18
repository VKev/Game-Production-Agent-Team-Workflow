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
