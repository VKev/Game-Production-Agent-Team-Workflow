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

## Workflow

### 1. Resolve and preserve project state

1. Canonicalize the exact Unity project root. Require `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
2. Resolve this skill beneath `<project-root>/.agents/skills/setup-unity-packages`. Reject a package path outside its `assets/` directory, except a verified update downloaded to `<project-root>/.agent-temp/unity-package-updates/` by this workflow.
3. Record whether Git `HEAD` exists, its SHA, and the staged-path list. Require an empty staged-path list and preserve it. Never stage package imports.

### 2. Verify the bundled allowlist

1. Inventory `assets/*.unitypackage`. Require exactly the ten registered filenames; reject symlinks, missing files, alternate locations, unregistered archives, and hash mismatches.
2. Inspect each archive without extracting into the project. Every `pathname` must be relative, traversal-free, and beneath `Assets/`.
3. Confirm the primary identity marker and required paths from the registry. Treat the exact archive hash as the bundled build identity.

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
6. Import the verified temporary candidate without rewriting the bundled archive or registry. If any check fails, discard only that exact temporary file and keep the package pending. Never promote a candidate by editing this skill automatically.
7. `RetargetPro.unitypackage` has no registered update mirror. Use only its bundled fingerprint until the user registers a source with a comparable version and identity policy.

If the network or public API is unavailable and the package is missing, the exact verified bundle may still be imported, but report `remote update check pending`. Never describe it as latest.

### 4. Resolve required package dependencies

Use the same live Unity instance and Unity Package Manager; never edit `Packages/manifest.json` or `packages-lock.json` directly.

- VContainer is an approved first-class UPM package, not a bundled asset archive. Run `scripts/check_vcontainer_release.ps1` and require `Status=verified-stable`. The script resolves `releases/latest`, rejects drafts/prereleases/non-numeric tags, confirms the tag in official Git, and requires the tagged `VContainer/Assets/VContainer/package.json` to declare both `jp.hadashikick.vcontainer` and the identical version. If the script is unavailable, perform those same checks without weakening them. Do not trust an API tag alone.
- Inspect the installed package through `UnityEditor.PackageManager.Client.List`. If absent, or older and already sourced from the official repository/OpenUPM, install or update it through `Client.Add` using the official tagged Git URL `https://github.com/hadashiA/VContainer.git?path=VContainer/Assets/VContainer#<tag>`. Wait for Package Manager resolution, domain reload, and compilation. If the same version is already installed from the official repository or OpenUPM, skip mutation. Treat a newer version, embedded/local package, fork, dirty Git source, downgrade, or unresolved dependency conflict as `ambiguous`; do not replace it automatically.
- Cinemachine is an approved first-class Unity Registry package. Query the live registry with `UnityEditor.PackageManager.Client.Search("com.unity.cinemachine")` and inspect `versions.compatible`; reject prerelease versions and sort stable semantic versions numerically, never lexically. For a missing package, install the highest released stable version compatible with the project's current Unity Editor as `com.unity.cinemachine@<exact-version>`. For an existing healthy Unity Registry package, preserve its major generation and update only to the highest compatible stable version in that same major. Never auto-upgrade Cinemachine 2.x to 3.x: that is a breaking code and serialized-component migration requiring an explicit user task. Treat an unparsable version, local/embed source, fork, newer installed version, incompatible Editor, unknown source, or unresolved major-version conflict as `ambiguous`.
- Perform Cinemachine search/add requests one at a time. Wait for Package Manager resolution, domain reload, and compilation, then verify package ID, exact resolved version, Unity Registry source, `CinemachineBrain`, and the generation-appropriate camera assembly/type (`CinemachineVirtualCamera` for 2.x or `Unity.Cinemachine.CinemachineCamera` for 3.x). Never edit the manifest or lock file to simulate installation.
- Technie Collider Creator 2 requires compatible `com.unity.burst` `>= 1.8.0` and `com.unity.collections` `>= 2.5.7` because its runtime and editor asmdefs reference `Unity.Burst` and `Unity.Collections`. If absent or too old, install the latest version compatible with the project's Unity Editor through `UnityEditor.PackageManager.Client.Add`, one request at a time, then wait for resolution, reload, and compilation.
- Feel integrations are conditional through asmdef version defines. Cinemachine is installed by its independent first-class rule above; do not let Feel force a Cinemachine major migration. Do not install a render pipeline, Post Processing, VFX Graph, Input System, or TextMesh Pro solely for Feel; activate only integrations already needed by the project.
- Optimizers' Progressive Culling dependencies (`mathematics`, `jobs`, `collections`, and `burst`) are optional. Do not install them unless the project explicitly enables that feature.

### 5. Classify installed state

Inspect the exact project paths from the registry. Prefer embedded version files/readmes. Where no embedded version exists, compare registered primary fingerprints. A different primary version or hash is `ambiguous`, not repairable.

FImpossible packages share vendor helpers. Their package-specific roots are independent, but their shared roots are not. If any FImpossible package must be imported, compare the shared-baseline markers in the registry and use the coherent import order below. Do not import one archive over an unknown third-party or newer shared baseline.

### 6. Import through Unity

Prefer live Coplay Unity MCP after `setup-unity-mcp` is ready:

1. Read `dev-unity-mcp`, confirm the intended Editor instance, wait until it is not compiling/updating, and require `execute_code` from `scripting_ext`.
2. Call only `UnityEditor.AssetDatabase.ImportPackage(packagePath, false)` with safety checks enabled and a canonical verified package path.
3. Treat the call as an import request. Reconnect after domain reload and wait for compilation before checking markers.

When importing all FImpossible packages, or restoring their shared baseline, use this exact order:

1. `Optimizers.unitypackage`
2. `SpinalAnimator.unitypackage`
3. `TailAnimator.unitypackage`
4. `LegsAnimator.unitypackage`

The last import establishes the registered shared-helper baseline. After importing any subset, repair that baseline only by re-importing the exact registered Legs Animator build when its package-specific version already matches. Never hand-merge vendor source files.

Use Unity's CLI fallback only when no Editor has the project open and the matching Editor executable is unambiguous. Run bounded `-batchmode -quit -projectPath <root> -importPackage <archive> -logFile <outside-project-log>`. If the project is open but MCP is unavailable, report `pending Unity package import` rather than starting a second Editor.

### 7. Run required post-import setup

For DOTween, after reload and matching fingerprints, evaluate `DG.DOTweenEditor.EditorUtils.DOTweenSetupRequired()`. If true, invoke the public zero-argument setup APIs:

- `DG.DOTweenEditor.UI.DOTweenUtilityWindowModules.ApplyModulesSettings()`
- `DG.DOTweenEditor.ASMDEFManager.ApplyASMDEFSettings()`
- `DG.DOTweenEditor.DOTweenDefines.RefreshAll()`

Refresh, wait through reload, and check again. If it still reports required, leave `pending DOTween setup` and direct the user to the Utility Panel; do not use private reflection.

### 8. Verify and report

For every package:

- For VContainer, verify `jp.hadashikick.vcontainer`, its resolved stable version, official source/revision, assembly availability, package resolution, and compilation.
- For Cinemachine, verify `com.unity.cinemachine`, the selected compatible stable version, Unity Registry source, preserved major-generation policy, generation-appropriate assemblies/types, package resolution, domain reload, and compilation.
- Verify the installed version/fingerprint, required markers, and narrow import root.
- Verify required assemblies and scripts compile in the actual project, with no new package-attributable console error.
- For FImpossible, verify package-specific versions plus the shared-helper baseline.
- For Technie, verify Burst/Collections resolution before its assemblies compile.
- Preserve the package archive, Git `HEAD`, and empty staged list.
- Report `skipped`, `created`, `repaired`, `pending`, or `blocked`, including archive/candidate hash, version evidence, import route, dependency state, compilation evidence, conflicts, and remote-check result.

An import request, successful download, or structurally valid archive is not proof that the package is ready.

## Boundaries

- Never download from an unregistered link, trust a mirror filename alone, expose a signed URL, or bypass publisher-version confirmation.
- Never overwrite an installed different build, delete package-owned project content, or merge vendor code by hand.
- Never disable Unity MCP safety checks, open an interactive import dialog, edit Unity-generated project files, or alter scenes/prefabs as setup.
- Never configure another AI client or run `git add`, `git commit`, `git push`, or any history/index mutation.
