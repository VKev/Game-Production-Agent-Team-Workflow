# Editor, tests, packages, and platforms

## Contents

- Editor code
- Test assemblies
- Packages
- Platforms and optional integrations

## Editor code

Unity normally sends scripts in `Editor` folders to a predefined Editor assembly. Once a parent folder contains an `.asmdef`, that fallback changes: descendant Editor scripts can join the parent's custom assembly unless a nested `.asmdef` or `.asmref` assigns them elsewhere.

Use this direction:

```text
Feature.Editor -> Feature.Runtime
Feature.Runtime -X-> Feature.Editor
```

For each Editor boundary:

- include only the `Editor` platform;
- reference the exact runtime assembly the tools inspect or author;
- keep `UnityEditor` APIs out of runtime source, even behind a namespace convention;
- use `.asmref` when distributed Editor folders intentionally belong to one Editor tool assembly;
- compile and inspect a representative Editor script's Assembly Information.

## Test assemblies

Test assembly schema varies with Unity and Test Framework versions. Prefer the installed Test Runner's **Create a new Test Assembly Folder** command, inspect the generated `.asmdef`, and use it as the local baseline.

Current Unity documentation describes test assemblies through references to `nunit.framework.dll`, `UnityEngine.TestRunner`, and `UnityEditor.TestRunner`. Package documentation also shows `optionalUnityReferences: ["TestAssemblies"]` in supported layouts. Do not hardcode one representation across versions; verify what the installed package generates.

Keep the ownership strict:

- Edit Mode tests may reference the runtime assembly and, when testing Editor tools, its Editor assembly; target `Editor`.
- Play Mode or Player tests reference runtime assemblies only and must use platform-compatible APIs.
- `UnityEditor.TestRunner` is for Edit Mode tests, not runtime Player tests.
- Test code belongs only in test assemblies; Unity excludes test assemblies from ordinary Player builds.
- For package tests, verify whether the package must be added to the project's `testables` manifest list.

Run both discovery and execution. An assembly that compiles but is absent from Test Runner is not verified.

## Packages

For reusable packages, normally separate:

```text
Runtime/<Company>.<Package>.asmdef
Editor/<Company>.<Package>.Editor.asmdef
Tests/Runtime/<Company>.<Package>.Tests.asmdef
Tests/Editor/<Company>.<Package>.Editor.Tests.asmdef
```

This layout is a package convention, not a command to restructure every project feature. Use stable assembly names, explicit package/custom references, and GUID references where the assets and metadata travel together. Treat moving public types between assemblies or changing assembly availability as a compatibility change.

## Platforms and optional integrations

An assembly excluded by platform, define, or package version is absent, not merely empty. Every consumer must also be absent or avoid referencing it in that configuration.

Before release, exercise the matrix that matters:

- Editor with the active development platform;
- each supported Player target affected by platform filters;
- optional package present and absent;
- each relevant define-constraint outcome;
- Mono and IL2CPP when backend-specific symbols or plugins are involved;
- managed stripping/AOT builds when reflection discovers types across assemblies.

Prefer a small adapter assembly for an optional package integration. Keep the core module available without the package, gate the adapter with a Version Define or Define Constraint, and ensure no unconditional consumer references the missing adapter.
