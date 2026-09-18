# Official Project Context Sources

Confirm `ProjectSettings/ProjectVersion.txt` before relying on version-sensitive behavior. These links target Unity 6.3 and support project navigation decisions; the repository remains the source of truth for its own folder responsibilities.

- [Special folder names](https://docs.unity3d.com/6000.3/Documentation/Manual/SpecialFolders.html): reserved Unity folders and their engine-defined behavior.
- [Asset metadata](https://docs.unity3d.com/6000.3/Documentation/Manual/AssetMetadata.html): `.meta` files, GUIDs, import settings, and why assets must move with their metadata.
- [Assembly definitions](https://docs.unity3d.com/6000.3/Documentation/Manual/ScriptCompilationAssemblyDefinitionFiles.html): how folder placement and `.asmdef` files determine script compilation boundaries.
- [Project manifest](https://docs.unity3d.com/6000.3/Documentation/Manual/upm-manifestPrj.html): the role of `Packages/manifest.json` in package resolution and configuration.
- [ModelImporter](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/ModelImporter.html): Unity-authoritative FBX/model import settings, clip splits, rig, avatar, mesh, and material controls.
- [Autodesk FBX scene graph](https://help.autodesk.com/cloudhelp/2018/ENU/FBX-Developer-Help/nodes_and_scene_graph/fbx_scenes.html): nodes, meshes, materials, textures, skeletons, and animation organization represented by FBX structural evidence.

Tool behavior:

- [Better Context Unity README](https://github.com/VKev/Better-Context): current Roslyn, Unity runtime, hierarchical map, CLI query, ownership, and refresh contract.
- [CodeGraph README](https://github.com/colbymchenry/codegraph): current `codegraph_explore` query forms, graph internals, MCP surface, and CLI equivalents.
- [CocoIndex Code README](https://github.com/cocoindex-io/cocoindex-code): semantic code search behavior, configured text-file extensions, custom text chunkers, and current usage.
- [CocoIndex PDF quickstart](https://cocoindex.io/docs/getting_started/quickstart/): official format-aware PDF-to-Markdown pipeline using Docling before downstream indexing.
- [CocoIndex core concepts](https://cocoindex.io/docs/programming_guide/core_concepts): source-to-transformation-to-target model for durable document pipelines and incremental refresh.
- [Docling supported formats](https://docling-project.github.io/docling/usage/supported_formats/): current PDF, modern and legacy Office, OpenDocument, markup, image, and export support; legacy Office formats require LibreOffice.
- [Docling CLI reference](https://docling-project.github.io/docling/reference/cli/): local conversion command, Markdown output, OCR/table behavior, CPU selection, timeout, output, plugin, and remote-service controls.
