---
name: setup-unity-packages
description: Inspect, update, install, import, repair, and verify the approved Unity asset and UPM packages used by this portable Codex package. Use during setup-agents bootstrap when VContainer, Cinemachine, or any registered commercial or custom Unity package is missing, stale, incomplete, or conflicts with an installed build.
---

# Unity Asset Package Setup

Install only packages registered in [references/package-registry.md](references/package-registry.md). Read that registry and [references/sources.md](references/sources.md) completely before checking remote versions, dependencies, installed state, or imports.

## State model

Classify every package independently:

- `correct`: installed version or registered fingerprint and all required markers match; skip mutation and verify.
- `missing`: no package-specific root or marker exists; select the newest verified source and import once.
- `repairable`: the primary version/fingerprint matches, but another marker is missing or package-owned code cannot load; re-import that exact build once.
- `incorrect`: a strictly newer, independently confirmed update exists and passes all archive and identity checks; import that verified candidate.
- `ambiguous`: version, ownership, shared-vendor files, or identity disagree; stop that package before import.

Never use “folder exists” as the only success test.

## Setup-agents phase contract

When orchestrated by `setup-agents`:

- **Editor-closed preparation:** require the exact project to be closed. Complete archive inventory/path/hash checks, installed marker and fingerprint inspection, registered mirror checks, independent update confirmation, VContainer release verification, and any allowed temporary candidate download. Read the project's exact Unity version and render-pipeline declarations, then generate every required derived archive below `.agent-temp/unity-package-staging/` with `scripts/prepare_unitypackage.py`. Do not launch Unity or batch mode, query Unity Package Manager, modify a Unity dependency, import an archive, run post-import setup, compile, or test. Mark every required Unity-owned action as `pending (editor-ready)`.
- **Live pass:** use the one already-open target Editor for all UPM dependency work, archive imports, reloads, and post-import setup. Resolve independent compatible UPM additions before mutation and submit them in the smallest safe `Client.AddAndRemove` batch. Preserve dependency and vendor import order. Wait for Unity-controlled compilation/reload whenever it blocks the next operation, but do not run a broad console audit or Unity tests after each package. Contribute final compilation, markers, console, and relevant existing-test evidence to the orchestrator's single consolidated pass.

On resume, recheck the prepared archive/source identity, skip correct imports, and continue from the first pending package without reopening Unity.

## Workflow

### 1. Resolve and preserve project state

1. Canonicalize the exact Unity project root. Require `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
2. Resolve this skill beneath `<project-root>/.agents/skills/setup-unity-packages`. Reject a source package path outside its `assets/` directory, except a verified update downloaded to `<project-root>/.agent-temp/unity-package-updates/` by this workflow. Import only a verified source archive that needs no derivation or the exact prepared output below `<project-root>/.agent-temp/unity-package-staging/` whose sidecar proves its source hash and transformations.
3. Record whether Git `HEAD` exists, its SHA, and the staged-path list. Require an empty staged-path list and preserve it. Never stage package imports.

### 2. Verify the bundled allowlist

1. Inventory `assets/*.unitypackage`. Require exactly the ten registered filenames; reject symlinks, missing files, alternate locations, unregistered archives, and hash mismatches.
2. Inspect each archive without extracting into the project. Every `pathname` must be relative, traversal-free, and beneath `Assets/`.
3. Confirm the primary identity marker and required paths from the registry. Treat the exact archive hash as the bundled build identity.
4. Read `ProjectSettings/ProjectVersion.txt` and `Packages/manifest.json`. Classify the active package context as Built-in, URP, HDRP, or ambiguous. Both URP and HDRP declarations, an unreadable project version, or a package whose declared minimum/maximum Unity version excludes the current Editor is `ambiguous`; stop before import.
5. For every registered archive whose archive root differs from its canonical root, or whose exact hash has a compatibility profile for this Unity version, run:

   `python scripts/prepare_unitypackage.py --project-root <project-root> --archive <verified-archive> --strip-incompatible-demos`

   Require `status=prepared`, the expected source SHA-256, canonical root, compatibility profile count, and a matching sidecar. Run the command again only when its source, project Unity version, render-pipeline declaration, script, or patch manifest changed. Never edit the bundled archive.

### 3. Check user-authorized update sources

Run this check before selecting an archive for a missing, repairable, or older installed package. The Yandex folders are user-provided mirrors, not independent proof that a build is authentic or the publisher's latest release.

1. Run `scripts/check_package_sources.ps1` from this skill and parse its JSON. It queries the registered Yandex public-resources links, selects version/date candidates deterministically, and omits signed download URLs. If the script cannot run, perform the equivalent API query in memory; do not open a browser, authenticate, or persist a signed URL:
   `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=<url-encoded-public-link>&limit=100`
2. Consider only regular `.unitypackage` files whose normalized product prefix matches the registry. Parse numeric version components from the filename. For equal versions, use an explicit parenthesized release date as the tiebreaker; never use Yandex upload/modified time as a product release date.
3. Compare installed, bundled, and candidate versions:
   - Same API SHA-256 as the bundled archive: use the bundle and skip download.
   - Lower version: ignore it.
   - Same version with a different hash/date, missing version, or unparsable version: mark `ambiguous`; do not replace or import it.
   - Higher version: independently confirm that version from the publisher's official documentation or Unity Asset Store release listing before download. If confirmation is unavailable or contradictory, report `update candidate pending verification`.
4. For a confirmed higher version, use the selected item's temporary `file` URL only in memory. Download to `.agent-temp/unity-package-updates/`, never to `Assets/`, `.agents/`, or Git-tracked product paths. Do not print the signed URL.
5. Require downloaded length and SHA-256 to match Yandex metadata. Re-run archive path safety, product-prefix, primary-marker, and required-marker checks. When an internal version marker exists, require it to agree with the candidate. A filename alone cannot override an internal mismatch.
6. A verified higher candidate still needs a compatible canonical-layout profile and explicit Unity/render-pipeline evidence. If its archive root is already canonical and its source declares compatibility with the current Editor, it may be imported unchanged. Otherwise report `update candidate pending compatibility review`; do not reuse a registered hash profile or apply broad source replacements to the new build. Never rewrite the bundled archive or registry automatically.
7. `RetargetPro.unitypackage` has no registered update mirror. Use only its bundled fingerprint until the user registers a source with a comparable version and identity policy.

If the network or public API is unavailable and the package is missing, the exact verified bundle may still be imported, but report `remote update check pending`. Never describe it as latest.

### 4. Resolve required package dependencies

Use the same live Unity instance and Unity Package Manager; never edit `Packages/manifest.json` or `packages-lock.json` directly. Resolve every independent missing/update spec first. Submit VContainer, Cinemachine, Burst, and Collections additions together through one `UnityEditor.PackageManager.Client.AddAndRemove(addSpecs, Array.Empty<string>())` request when two or more are needed; submit one `Client.Add` only when exactly one is needed. Wait for that package graph to settle once, then verify every resolved source and version. Do not issue one request per package.

- VContainer is an approved first-class UPM package, not a bundled asset archive. Run `scripts/check_vcontainer_release.ps1` and require `Status=verified-stable`. The script resolves `releases/latest`, rejects drafts/prereleases/non-numeric tags, confirms the tag in official Git, and requires the tagged `VContainer/Assets/VContainer/package.json` to declare both `jp.hadashikick.vcontainer` and the identical version. If the script is unavailable, perform those same checks without weakening them. Do not trust an API tag alone.
- Inspect the installed package through `UnityEditor.PackageManager.Client.List`. If absent, or older and already sourced from the official repository/OpenUPM, add the official tagged Git URL `https://github.com/hadashiA/VContainer.git?path=VContainer/Assets/VContainer#<tag>` to the shared request, or use `Client.Add` only when it is the sole addition. Wait once for Package Manager resolution, domain reload, and compilation after the complete request. If the same version is already installed from the official repository or OpenUPM, skip mutation. Treat a newer version, embedded/local package, fork, dirty Git source, downgrade, or unresolved dependency conflict as `ambiguous`; do not replace it automatically.
- Cinemachine is an approved first-class Unity Registry package. Query the live registry with `UnityEditor.PackageManager.Client.Search("com.unity.cinemachine")` and inspect `versions.compatible`; reject prerelease versions and sort stable semantic versions numerically, never lexically. For a missing package, install the highest released stable version compatible with the project's current Unity Editor as `com.unity.cinemachine@<exact-version>`. For an existing healthy Unity Registry package, preserve its major generation and update only to the highest compatible stable version in that same major. Never auto-upgrade Cinemachine 2.x to 3.x: that is a breaking code and serialized-component migration requiring an explicit user task. Treat an unparsable version, local/embed source, fork, newer installed version, incompatible Editor, unknown source, or unresolved major-version conflict as `ambiguous`.
- Resolve Cinemachine with one search request before the shared add batch. After the batch settles, verify package ID, exact resolved version, Unity Registry source, `CinemachineBrain`, and the generation-appropriate camera assembly/type (`CinemachineVirtualCamera` for 2.x or `Unity.Cinemachine.CinemachineCamera` for 3.x). Never edit the manifest or lock file to simulate installation.
- Technie Collider Creator 2 requires compatible `com.unity.burst` `>= 1.8.0` and `com.unity.collections` `>= 2.5.7` because its runtime and editor asmdefs reference `Unity.Burst` and `Unity.Collections`. Resolve only stable entries from each package's live `versions.compatible` list and include needed specs in the shared batch. Never pair arbitrary latest versions or select a version merely because another project resolved it.
- After the UPM graph settles, compare Burst's native package version with the preflight value and check the package's recovery/restart marker. If Burst changed or asks for native cache recovery, request one immediate Unity restart before asset imports. Resume from the package checkpoint afterward; do not postpone this restart until the final test pass.
- Feel integrations are conditional through asmdef version defines. Cinemachine is installed by its independent first-class rule above; do not let Feel force a Cinemachine major migration. Do not install a render pipeline, Post Processing, VFX Graph, Input System, or TextMesh Pro solely for Feel; activate only integrations already needed by the project.
- Optimizers' Progressive Culling dependencies (`mathematics`, `jobs`, `collections`, and `burst`) are optional. Do not install them unless the project explicitly enables that feature.

### 5. Classify installed state

Inspect the exact canonical project paths from the registry. Prefer embedded version files/readmes. Where no embedded version exists, compare registered primary fingerprints. A different primary version or hash is `ambiguous`, not repairable.

If the canonical root is absent and one exact registered build exists under its old archive root, classify only its layout as `repairable`. Through the live Editor, move the entire package root with `AssetDatabase.MoveAsset`, apply the registry's deterministic old-root textual replacements, save/refresh once, and verify GUID/meta preservation plus canonical markers. If both roots exist, an old root contains unknown content, or ownership/fingerprints disagree, stop as `ambiguous`; never merge the two trees.

FImpossible packages share vendor helpers. Their package-specific roots are independent, but their shared roots are not. If any FImpossible package must be imported, compare the shared-baseline markers in the registry and use the coherent import order below. Do not import one archive over an unknown third-party or newer shared baseline.

### 6. Import through Unity

Prefer live Coplay Unity MCP after `setup-unity-mcp` is ready:

1. Read `dev-unity-mcp`, confirm the intended Editor instance, wait until it is not compiling/updating, and require `execute_code` from `scripting_ext`.
2. Persist an `import-requested` checkpoint containing the source hash, prepared-output hash, and package marker before calling `UnityEditor.AssetDatabase.ImportPackage(packagePath, false)` with safety checks enabled and the canonical verified prepared path.
3. Treat a disconnected or interrupted MCP call as an unknown import result, not a failed import. Reconnect after domain reload, wait for compilation, and check the registered markers plus Unity's package-import events. Retry once only when those checks prove the import never completed; never reissue solely because the tool call lost its response.
4. Import archives serially in the registered order, but do not wrap `ImportPackage` in `AssetDatabase.StartAssetEditing`, disable auto-refresh, or lock reload assemblies. Prepared sources should compile without emergency vendor edits, allowing Unity to perform each required reload normally.

When importing all FImpossible packages, or restoring their shared baseline, use this exact order:

1. `Optimizers.unitypackage`
2. `SpinalAnimator.unitypackage`
3. `TailAnimator.unitypackage`
4. `LegsAnimator.unitypackage`

The last import establishes the registered shared-helper baseline. After importing any subset, repair that baseline only by re-importing the exact registered Legs Animator build when its package-specific version already matches. Never hand-merge vendor source files.

When this skill runs standalone, Unity's CLI fallback is allowed only when no Editor has the project open and the matching Editor executable is unambiguous. Run bounded `-batchmode -quit -projectPath <root> -importPackage <archive> -logFile <outside-project-log>`. During `setup-agents`, never use this fallback: preparation leaves imports `pending (editor-ready)`, and the live pass reports `pending Unity package import` when MCP is unavailable rather than starting a second Editor.

### 7. Run required post-import setup

For DOTween, perform this idempotent Editor-side configuration after the selected archive has matching fingerprints and Unity has finished its import compilation. Do it even when `DG.DOTweenEditor.EditorUtils.DOTweenSetupRequired()` is already false: in the registered `1.0.430` Editor assembly that method only detects remaining `DOTweenUpgradeManager.*` files and does not verify module selections.

1. Load `DG.DOTweenEditor.UI.DOTweenUtilityWindow.GetDOTweenSettings()`. If it returns null, ensure `Assets/Resources/` exists and create/load `Assets/Resources/DOTweenSettings.asset` through the public `DG.DOTweenEditor.EditorUtils.ConnectToSourceAsset<DG.Tweening.Core.DOTweenSettings>(..., true)` API. Do not create a duplicate when a settings asset already exists in any supported DOTween location.
2. If `settings.modules` is null, assign a new public `DOTweenSettings.ModulesSetup` instance. Then set every field to the effective DOTween module profile registered in `references/package-registry.md`. Detect `TMPro.TMP_Text` from the loaded compilation domain before enabling TextMesh Pro. For a newer verified DOTween build, inspect any non-empty DeAudio or DeUnityExtended integration source and require its compatible dependency before enabling it.
3. Call the public static `DG.DOTweenEditor.UI.DOTweenUtilityWindowModules.ApplyModulesSettings()` method. It applies the stored booleans to DOTween's defines and marks the settings asset dirty.
4. Reproduce the remaining public operations used by the registered DOTween Utility Panel's **Setup DOTween** button, in order:
   - Invoke `DG.DOTweenEditor.ASMDEFManager.ApplyASMDEFSettings()` through exact public-static reflection because the declaring type is internal in `1.0.430`.
   - Set `settings.modules.showPanel = true` and mark the settings asset dirty.
   - Call public `DG.DOTweenEditor.EditorUtils.DeleteLegacyNoModulesDOTweenFiles()`.
   - Invoke `DG.DOTweenEditor.DOTweenDefines.RemoveAllLegacy()` through exact public-static reflection because the declaring type is internal.
   - Call public `DG.DOTweenEditor.EditorUtils.DeleteDOTweenUpgradeManagerFiles()`.
5. Reflection is permitted only for those two named public, static, zero-argument methods on the exact `DOTweenEditor` assembly. Require one matching type and method, reject overload or assembly ambiguity, and never invoke non-public members. If a newer verified DOTween build changes the types or signatures, leave `pending DOTween setup API review` instead of guessing.
6. Save assets, refresh once, and wait through the resulting compilation/domain reload. Reconnect to the same Editor and verify the settings asset is unique, every effective module boolean matches the registry, `modules.showPanel` is true, required module files/defines and ASMDEF state agree with the settings, `DOTweenSetupRequired()` is false, and no new DOTween/module compile error exists.

If any setup step fails, report the exact failed operation and leave `pending DOTween setup`; do not open the interactive Utility Panel automatically, click GUI controls, edit Demigiant source, or repeat the whole package import.

Matching DOTween fingerprints with a missing settings asset, a mismatched module profile, or leftover setup artifacts is `repairable` configuration. Run only this setup sequence; do not re-import the already-correct archive.

### 8. Verify and report

For every package, collect the broad compilation/console/test evidence during the `setup-agents` consolidated final pass rather than repeating it per import:

- For VContainer, verify `jp.hadashikick.vcontainer`, its resolved stable version, official source/revision, assembly availability, package resolution, and compilation.
- For Cinemachine, verify `com.unity.cinemachine`, the selected compatible stable version, Unity Registry source, preserved major-generation policy, generation-appropriate assemblies/types, package resolution, domain reload, and compilation.
- For DOTween Pro, verify its registered fingerprints, unique settings asset, effective module profile, panel state, setup-required state, matching defines/ASMDEF state, and clean post-setup compilation.
- Verify the installed version/fingerprint, required markers, and narrow import root.
- Verify that every registered custom asset root is below `Assets/Plugins/` and that none of the old top-level vendor roots remains. Verify each prepared sidecar's source/output hash and applied compatibility count.
- Verify required assemblies and scripts compile in the actual project, with no new package-attributable console error.
- For FImpossible, verify package-specific versions plus the shared-helper baseline.
- For Technie, verify Burst/Collections resolution before its assemblies compile.
- Preserve the package archive, Git `HEAD`, and empty staged list.
- Report `skipped`, `created`, `repaired`, `pending`, or `blocked`, including archive/candidate hash, version evidence, import route, dependency state, compilation evidence, conflicts, and remote-check result.
- If the Unity test wrapper times out after Test Runner has emitted `RunFinished` and a completed result XML, treat the XML as the test authority, report the wrapper timeout as a transport false negative, and do not rerun the suite solely for that timeout.

An import request, successful download, or structurally valid archive is not proof that the package is ready.

## Boundaries

- Never download from an unregistered link, trust a mirror filename alone, expose a signed URL, or bypass publisher-version confirmation.
- Never overwrite an installed different build, delete package-owned project content, or merge vendor code by hand.
- Never patch an unknown archive, apply a compatibility profile when either archive/file hash differs, or import a package whose Unity/render-pipeline compatibility is unresolved.
- Never disable Unity MCP safety checks, open an interactive import dialog, edit Unity-generated project files, or alter scenes/prefabs as setup.
- During `setup-agents`, never launch Unity or batch mode in preparation, open a second Editor in the live pass, or run repeated broad test passes between package imports.
- Never configure another AI client or run `git add`, `git commit`, `git push`, or any history/index mutation.
