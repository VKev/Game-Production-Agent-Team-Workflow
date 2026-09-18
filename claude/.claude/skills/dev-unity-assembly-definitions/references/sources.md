# Sources and video synthesis

Accessed 2026-08-10 unless noted otherwise.

## Analyzed video

- [Unity Assembly Definitions Explained (Architecture, Not Just Compile Times)](https://www.youtube.com/watch?v=OqKEaiQrDHY), git-amend, published 2026-02-22. Analysis used YouTube's automatic English captions (`en-orig`) and targeted frames from the `.asmref`, Assembly Definition settings, and Test Runner demonstrations.

Useful guidance retained from the video:

- assembly boundaries should follow responsibility, stability, and change patterns rather than script-type folders;
- dependency direction matters more than a prescribed folder template;
- avoid both one giant assembly and many micro-assemblies;
- `.asmref` can attach a non-child folder to an existing assembly without moving its assets;
- parent `.asmdef` assets require explicit handling of descendant Editor folders;
- the Assembly Information Inspector helps verify ownership;
- test assemblies and assembly settings are part of the architecture, not afterthoughts;
- migrate incrementally and let compiler failures expose accidental coupling.

Correction applied:

- The video's explanation of **Override References** is too broad. Unity's documentation specifies that it selects which **precompiled plugin assemblies** the custom assembly references. It does not require manually listing every custom assembly or replace all default Unity references.

Additional qualifications added through research:

- custom assemblies cannot reference predefined assemblies, which makes bottom-up migration from self-contained dependencies important;
- predefined assemblies can see only auto-referenced custom assemblies and cannot add explicit references;
- `Auto Referenced` does not control build inclusion;
- `Use GUIDs` is inferred from stored reference form rather than serialized as a separate JSON property;
- test assembly representation is version-sensitive, so the installed Test Runner-generated asset is safer than a copied universal JSON template;
- compile-time improvement must be measured separately from domain reload and other Editor work.

## Primary Unity documentation

- [Introduction to assemblies in Unity](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definitions-intro.html) — default assemblies, folder ownership, dependency-directed compilation, Assembly Information, and the Editor-folder caveat.
- [Creating assembly assets](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definitions-creating.html) — `.asmdef`, `.asmref`, platform, Editor, and test assembly creation.
- [Referencing assemblies](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definitions-referencing.html) — automatic references, prohibited predefined/custom directions, cycles, GUIDs, and precompiled plugin references.
- [Assembly Definition Inspector reference](https://docs.unity3d.com/6000.3/Documentation/Manual/class-AssemblyDefinitionImporter.html) — exact General, reference, platform, Define Constraint, Version Define, and Root Namespace semantics.
- [Assembly Definition Reference Inspector reference](https://docs.unity3d.com/6000.3/Documentation/Manual/class-AssemblyDefinitionReferenceImporter.html) — target selection for `.asmref` assets.
- [Assembly Definition file format](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definition-file-format.html) — JSON fields, GUID/name forms, platform-array exclusivity, and `.asmref` JSON.
- [Conditionally including an assembly](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definition-includes.html) — constraints and package/module version expressions.
- [Assembly metadata and compilation details](https://docs.unity3d.com/6000.3/Documentation/Manual/assembly-definition-metadata.html) — compiled assembly metadata and dependency information.
- [Assembly definitions and packages](https://docs.unity3d.com/Manual/cus-asmdef.html) — Runtime, Editor, and test assembly conventions for packages.
- [Adding tests to a package](https://docs.unity3d.com/Manual/cus-tests.html) — package test layout, test assembly fields, and `testables` behavior.
- [Test assembly workflow](https://docs.unity3d.com/Packages/com.unity.test-framework@2.0/manual/workflow-create-test-assembly.html) — Test Runner-generated assembly creation and Edit Mode versus Play Mode targeting.
- [CompilationPipeline](https://docs.unity3d.com/ScriptReference/Compilation.CompilationPipeline.html) and [compilationFinished](https://docs.unity3d.com/ScriptReference/Compilation.CompilationPipeline-compilationFinished.html) — assembly ownership/define inspection and compilation measurement events.
