# Sources

## Official UPM packages

- [Assistant / official Unity MCP 2.17](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.17/manual/index.html): official MCP package line; exact version comes from verified registry metadata.
- [ProBuilder 6.1](https://docs.unity3d.com/Packages/com.unity.probuilder@6.1/manual/index.html): geometry package documentation.
- [Visual Effect Graph 17.3](https://docs.unity3d.com/Packages/com.unity.visualeffectgraph@17.3/manual/index.html): Unity 6.3 core package line.
- [glTFast 6.19](https://docs.unity3d.com/Packages/com.unity.cloud.gltfast@6.19/manual/index.html): import/runtime loading documentation.
- [VContainer official repository](https://github.com/hadashiA/VContainer): tagged Git package source and release verification.
- [Cinemachine 3.1 manual](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/index.html): official package concepts and current 3.1 documentation stream.
- [Install and upgrade Cinemachine](https://docs.unity3d.com/Packages/com.unity.cinemachine@3.1/manual/InstallationAndUpgrade.html): Package Manager installation and upgrade guidance.
- [Unity 6.3 Package Manager API](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PackageManager.Client.html): package inspection and supported live operations.
- [Unity 6.3 project dependencies](https://docs.unity3d.com/6000.3/Documentation/Manual/upm-dependencies.html): manifest and lock roles.
- [Unity 6.3 Git dependencies](https://docs.unity3d.com/6000.3/Documentation/Manual/upm-git.html): Git URL, revision, and `?path=` syntax.
- [Burst 1.8 manual](https://docs.unity3d.com/ja/Packages/com.unity.burst%401.8/manual/index.html): changing or updating the Burst package requires closing and restarting the Editor. Therefore setup consumes this boundary in an editor-closed process before interactive handoff.
- [Burst 1.8 changelog](https://docs.unity3d.com/ja/Packages/com.unity.burst%401.8/changelog/CHANGELOG.html): official package revision history used with registry metadata when diagnosing native-package changes.

During standalone live setup, use Unity's compatible-version list rather than a hard-coded online Cinemachine version. During `setup-agents`, query official package metadata and the exact installed Editor catalog with `scripts/resolve_unity_registry_packages.ps1`; it applies the full Unity patch floor before the Editor is opened. The installed package documentation remains authoritative for its exact major and minor API.

## VContainer

- [Official VContainer repository](https://github.com/hadashiA/VContainer): authoritative Git source and releases.
- [Official VContainer installation guide](https://vcontainer.hadashikick.jp/getting-started/installation): preferred OpenUPM method, official tagged Git URL format, manual package option, and supported Unity floor.
- [Official package manifest](https://raw.githubusercontent.com/hadashiA/VContainer/master/VContainer/Assets/VContainer/package.json): package ID and current source version; verify the tagged copy rather than `master` when installing.
- [GitHub latest release API](https://api.github.com/repos/hadashiA/VContainer/releases/latest): candidate stable tag discovery. Confirm the tag and tagged manifest independently before installation.

## Unity import and verification

- [Unity 6.3 Editor command-line arguments](https://docs.unity3d.com/6000.3/Documentation/Manual/EditorCommandLineArguments.html): batch-mode and project constraints.
- [Unity 6.3 `AssetDatabase.ImportPackage`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AssetDatabase.ImportPackage.html): non-interactive import.
- [Unity 6.3 `Client.AddAndRemove`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/PackageManager.Client.AddAndRemove.html): package graph operations; setup uses the editor-closed manifest transaction instead.
- [Unity 6.3 `AssetDatabase.StartAssetEditing`](https://docs.unity3d.com/6000.3/Documentation/ScriptReference/AssetDatabase.StartAssetEditing.html): do not wrap `.unitypackage` imports.
- [Official Unity MCP overview](https://docs.unity3d.com/Packages/com.unity.ai.assistant@2.17/manual/integration/unity-mcp-overview.html): live Editor route used after Phase A has pinned and validated the complete package graph.

`scripts/stabilize_unity_package_graph.ps1` is retained only as an explicit recovery diagnostic. The orchestrated setup never calls it: Phase A launches no Unity process, and the one user-opened Phase-B Editor resolves and compiles the complete pinned graph.

## Package identity and current-version checks

- [Odin Inspector tutorials](https://odininspector.com/tutorials/) and [patch notes](https://odininspector.com/patch-notes): publisher sources for features and version confirmation.
- [DOTween Pro documentation and changelog](https://dotween.demigiant.com/pro.php): publisher source confirming Pro version `1.0.430` and required Setup DOTween workflow.
- [Feel documentation](https://feel-docs.moremountains.com/) and [Feel on Unity Asset Store](https://marketplace.unity.com/packages/tools/particles-effects/feel-183370): publisher/marketplace sources. If their displayed versions disagree, do not auto-update from a mirror.
- [Unity 6 `Object.FindObjectsByType`](https://docs.unity3d.com/6000.0/Documentation/ScriptReference/Object.FindObjectsByType.html): the supported overloads require an explicit `FindObjectsSortMode`, with `FindObjectsInactive` retained when inactive objects are requested. This API evidence supports the exact Feel 6.0 compatibility profile; the registered archive and file hashes remain the mutation authority.
- [Final IK online manual](http://www.root-motion.com/finalikdox/html/page1.html) and [official tutorial playlist](https://www.youtube.com/playlist?list=PLVxSIA1OaTOu8Nos3CalXbJ2DrKnntMv6): links embedded by RootMotion in the bundled readme.
- [Legs Animator manual](https://filipmoeglich.pl/download/Legs%20Animator%20-%20User%20Manual.pdf) and [Unity Asset Store listing](https://marketplace.unity.com/packages/tools/animation/legs-animator-154245).
- [Optimizers manual](https://www.filipmoeglich.pl/download/Optimizers%20-%20User%20Manual.pdf) and [Unity Asset Store listing](https://marketplace.unity.com/packages/tools/utilities/optimizers-122247).
- [Spine Animator manual](https://www.filipmoeglich.pl/download/Spine%20Animator%20User%20Manual.pdf).
- [Tail Animator manual](https://filipmoeglich.pl/download/Tail%20Animator%20Manual.pdf).
- [Retarget Pro documentation](https://kinemation.gitbook.io/retarget-pro) and [official tutorial](https://www.youtube.com/watch?v=JsmqTLGm_1Q).
- [Technie](https://technie.dev/) and [Technie Collider Creator 2 on Unity Asset Store](https://marketplace.unity.com/packages/tools/physics/technie-collider-creator-2-217070).

## Mirror API

- [Yandex Disk REST API - public resources](https://yandex.com/dev/disk-api/doc/en/reference/public): metadata and download-link API for public resources. Treat its filename, hash, and timestamps as mirror metadata only.

The bundled archives and their embedded readmes/manuals are the primary evidence for installed build identity. Do not copy or redistribute their manuals or source outside the user's project.
