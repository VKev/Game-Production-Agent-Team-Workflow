---
name: dev-unity-assembly-definitions
description: Design, migrate, configure, debug, and review Unity Assembly Definition and Assembly Definition Reference boundaries. Use for .asmdef or .asmref files, Assembly-CSharp decomposition, compile-time isolation, module dependency graphs, cyclic assembly references, Auto Referenced, Override References, Use GUIDs, Root Namespace, No Engine References, Define Constraints, Version Defines, runtime versus Editor assemblies, test assemblies, package assemblies, and platform-specific compilation.
---

# Unity Assembly Definitions

Treat assemblies as enforced ownership and dependency boundaries. Improve iteration time only as a measured consequence of a sound graph; do not split folders mechanically or promise faster compilation without evidence.

## Required workflow

1. **Establish the exact project context.**
   - Read project instructions and identify the Unity version from `ProjectSettings/ProjectVersion.txt`.
   - Inspect installed packages, every relevant `.asmdef` and `.asmref`, their `.meta` files, script locations, `Editor` folders, tests, plugins, platform restrictions, and predefined-assembly code that must still interoperate.
   - Determine the assembly that owns each affected script with Unity's Assembly Information Inspector or `CompilationPipeline` APIs when live Editor access is available.
   - Do not edit Unity-generated `.csproj` or solution files.

2. **Model the current graph before changing it.**
   - List each assembly, its responsibility, owner, direct custom-assembly references, precompiled plugin references, supported platforms, conditional defines, and consumers.
   - Identify code still in `Assembly-CSharp` or other predefined assemblies.
   - Mark cycles, sideways feature dependencies, catch-all `Common` modules, Editor-to-runtime leaks, platform leaks, and assemblies that always change together.
   - Read `references/dependency-graph-and-migration.md`.

3. **Choose boundaries by responsibility and change.**
   - Prefer cohesive modules with one owner and a stable public surface.
   - Point dependencies toward stable contracts and low-level capabilities.
   - Keep assemblies coarse enough to be meaningful. Do not create one per folder, namespace, class type, or small script cluster.
   - If two groups always change together and need mutual knowledge, keep them together unless a genuine contract can separate them.
   - Treat the graph as acyclic and direct: a consumer must explicitly reference every custom assembly whose types it uses.

4. **Record the intended graph.**

   ```text
   Assembly:
   Owns:
   Public surface:
   Direct custom references:
   Precompiled plugin references:
   Consumers:
   Runtime, Editor, test, or platform scope:
   Auto Referenced decision:
   Conditional compilation decision:
   Migration order:
   Verification:
   ```

5. **Migrate incrementally.**
   - Capture a clean compile, tests, target-platform build, and representative script-change timing before the first boundary.
   - Start with a self-contained or low-level stable dependency. A custom assembly cannot reference `Assembly-CSharp`, while predefined assemblies can consume an auto-referenced custom assembly; this normally makes bottom-up migration safest.
   - Add one boundary at a time, add only required direct references, wait for compilation, and repair errors before continuing.
   - Preserve `.meta` files and GUIDs. Prefer GUID-backed Assembly Definition references when assets may be renamed.
   - Use an `.asmref` when scripts must join an existing assembly from a non-child folder and moving the folder would violate meaningful asset ownership. Do not use `.asmref` to hide an incoherent layout.
   - When an `.asmdef` contains an `Editor` subfolder, create or route that code to an Editor-only assembly; the special-folder fallback no longer protects it automatically.
   - Use the installed Test Framework's UI-generated assembly as the version-appropriate baseline for tests rather than copying a schema blindly.

6. **Configure properties precisely.**
   - Read `references/asmdef-and-asmref-settings.md` before changing Inspector or JSON properties.
   - `Auto Referenced` controls whether predefined project assemblies automatically reference this custom assembly. It does not control build inclusion.
   - `Override References` filters precompiled plugin DLL references only. It does not replace custom Assembly Definition references, Unity module references, or every dependency.
   - Use platform filters, define constraints, and version defines only for real compile-time availability; verify every supported configuration where the assembly may disappear.

7. **Handle runtime, Editor, tests, packages, and platforms explicitly.**
   - Read `references/editor-tests-packages-and-platforms.md`.
   - Runtime assemblies must never depend on Editor-only assemblies.
   - Editor assemblies should target `Editor` and may reference runtime assemblies.
   - Test assemblies should reference only the runtime or Editor assemblies under test and use the installed Test Framework's generated configuration.
   - Package assemblies should follow package Runtime, Editor, and Tests ownership rather than relying on project predefined assemblies.

8. **Verify the result as architecture and as performance.**
   - Read `references/verification.md`.
   - Confirm a clean Editor compile, zero new Console errors, Edit Mode and Play Mode tests, and real Player builds for affected platform/define combinations.
   - Confirm each affected script's owning assembly and inspect the final graph for cycles and accidental references.
   - Measure representative edits before and after. Report assembly compilation separately from domain reload and asset import; an assembly split does not remove those other costs.

## Dependency rules

- Keep the graph acyclic. Resolve a cycle by moving a narrow contract or stable data type downward, inverting a dependency behind an owned interface, or merging code that is actually one responsibility.
- Do not create a global `Core`, `Shared`, or `Common` dumping ground merely to break cycles.
- Do not make runtime code reference Editor code.
- Do not depend on predefined assemblies from a custom assembly; Unity disallows it.
- Do not assume a custom assembly receives another custom assembly's dependencies transitively.
- Do not disable `Auto Referenced` while required consumers still live in predefined assemblies.
- Do not enable `Override References` as a general isolation switch; it affects precompiled plugins only.
- Do not add a boundary solely because a folder exists.

## Typical graph

```text
<Company>.Foundation                 no project-feature dependencies
          ^
          |
<Company>.Gameplay.Contracts        stable feature-facing contracts/data
          ^                  ^
          |                  |
<Company>.Gameplay       <Company>.UI
          ^                  ^
          |                  |
<Company>.Gameplay.Editor  <Company>.UI.Editor

Tests reference the exact runtime or Editor assembly under test.
Runtime never points upward to Editor, UI, or tests.
```

This is a directional example, not a mandatory folder template. Prefer fewer assemblies when the project is small or the responsibilities are inseparable.

## Failure diagnosis

- **Type or namespace disappeared after adding an `.asmdef`:** identify the script's new owner, add the missing direct custom reference, or continue the bottom-up migration. Do not try to reference `Assembly-CSharp` from the custom assembly.
- **Cyclic reference:** inspect responsibility direction; extract a minimal stable contract, invert one edge, or merge the mutually dependent code.
- **Editor API fails in a runtime assembly:** move the code under an Editor-only `.asmdef` or `.asmref`, then point Editor to runtime rather than runtime to Editor.
- **Plugin types disappeared after enabling Override References:** add the exact precompiled DLL under Assembly References or disable the override when explicit filtering has no payoff.
- **Predefined code cannot see a custom assembly:** confirm `Auto Referenced`; predefined assemblies cannot add explicit references.
- **Assembly absent only on a target:** inspect platform filters, define constraints, version defines, plugin compatibility, and all consumers compiled for that target.
- **Compile time did not improve:** inspect fan-out, assemblies recompiled per edit, domain reload, package/plugin recompilation, and micro-assembly overhead before changing the graph again.

## Related skills

- Use `dev-unity-gameplay-architecture` to choose the broader feature and ownership architecture that the assembly graph should enforce.
- Use `dev-unity-project-context` for project navigation, source edits, and managed context refreshes.
- Use `dev-unity-clean-code-principles` when extracting contracts or refactoring dependency direction.
- Use `dev-unity-performance-profiling` when compile-time or iteration-speed improvements are a material claim.
- Use `research-video-caption-analysis` before treating a YouTube tutorial as evidence.

## Reference loading guide

- Read `references/dependency-graph-and-migration.md` for boundary selection, bottom-up migration, `.asmref` use, and cycle repair.
- Read `references/asmdef-and-asmref-settings.md` for exact Inspector and JSON semantics.
- Read `references/editor-tests-packages-and-platforms.md` for special folders, tests, packages, and conditional assemblies.
- Read `references/verification.md` before completing a migration or claiming iteration-time improvement.
- Read `references/sources.md` to validate guidance against the analyzed video and primary Unity documentation.
