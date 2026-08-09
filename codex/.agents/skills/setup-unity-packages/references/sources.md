# Sources

## VContainer

- [Official VContainer repository](https://github.com/hadashiA/VContainer): authoritative Git source and releases.
- [Official VContainer installation guide](https://vcontainer.hadashikick.jp/getting-started/installation): preferred OpenUPM method, official tagged Git URL format, manual package option, and supported Unity floor.
- [Official package manifest](https://raw.githubusercontent.com/hadashiA/VContainer/master/VContainer/Assets/VContainer/package.json): package ID and current source version; verify the tagged copy rather than `master` when installing.
- [GitHub latest release API](https://api.github.com/repos/hadashiA/VContainer/releases/latest): candidate stable tag discovery. Confirm the tag and tagged manifest independently before installation.

## Unity import and verification

- [Unity Editor command-line arguments](https://docs.unity3d.com/Manual/EditorCommandLineArguments.html): documents `-importPackage` and the single-open-project constraint.
- [Unity `AssetDatabase.ImportPackage`](https://docs.unity3d.com/ScriptReference/AssetDatabase.ImportPackage.html): documents non-interactive import with `interactive: false`.
- [Unity Package Manager scripting API](https://docs.unity3d.com/ScriptReference/PackageManager.Client.Add.html): supported route for adding required UPM dependencies from Editor code.
- [Coplay MCP for Unity `execute_code`](https://github.com/CoplayDev/unity-mcp/blob/main/website/docs/reference/tools/scripting_ext/execute_code.md): live Editor route used for import, dependency requests, and post-import verification.

## Package identity and current-version checks

- [Odin Inspector tutorials](https://odininspector.com/tutorials/) and [patch notes](https://odininspector.com/patch-notes): publisher sources for features and version confirmation.
- [DOTween Pro documentation and changelog](https://dotween.demigiant.com/pro.php): publisher source confirming Pro version `1.0.430` and required Setup DOTween workflow.
- [Feel documentation](https://feel-docs.moremountains.com/) and [Feel on Unity Asset Store](https://marketplace.unity.com/packages/tools/particles-effects/feel-183370): publisher/marketplace sources. If their displayed versions disagree, do not auto-update from a mirror.
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
