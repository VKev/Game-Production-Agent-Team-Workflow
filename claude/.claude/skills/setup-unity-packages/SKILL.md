---
name: setup-unity-packages
description: Inspect, resolve, install, import, repair, and verify the approved Unity 6000.3.21f1 asset and UPM packages used by this portable Codex package. Use during setup-agents when ProBuilder, VFX Graph, glTFast, Cinemachine, VContainer, Burst, Collections, or a registered commercial/custom Unity package is missing, stale, incomplete, or conflicting.
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

- **Editor-closed preparation:** require the exact project to be closed and do not launch Unity, including batch mode. Complete archive inventory/path/hash checks, installed marker and fingerprint inspection, registered mirror checks, independent update confirmation, VContainer release verification, and any allowed temporary candidate download. Read the project's exact Unity version and render-pipeline declarations, resolve every required UPM dependency before mutation, and contribute exact verified specs to the orchestrator's single manifest merge. Generate independent derived archives below `.agent-temp/unity-package-staging/` with one `scripts/prepare_unitypackage.py` batch using at most two workers. Validate the manifest transaction and checkpoint without resolving or compiling it. Mark UPM packages as `pinned (pending Unity resolution)` and asset imports as `pending (editor-ready)`.
- **Live pass:** use the one already-open target Editor first to resolve and compile the complete Phase-A graph, then for archive imports, reloads, and post-import setup. Verify the Phase-A manifest checkpoint before importing anything; do not add or upgrade VContainer, Cinemachine, Burst, Collections, or another manifest-declarable dependency in this process. Preserve vendor import order. Wait for Unity-controlled compilation/reload whenever it blocks the next operation, but do not run a broad console audit or Unity tests after each package. Contribute final lock, compilation, markers, console, and relevant existing-test evidence to the orchestrator's single consolidated pass. A request to close/reopen Unity is an unexpected Phase-A failure, not a normal live step.

On resume, recheck the prepared archive/source identity, skip correct imports, and continue from the first pending package without reopening Unity.

If a registered compatibility profile is authorized after its exact archive has already been imported in the same live setup, do not re-import the whole archive. Require the exact Editor, archive, primary marker, every pre-patch installed file hash, and every profile result hash; then apply only the registered hunks to those package-owned files, refresh once, and verify compilation plus result hashes. An already-patched result is `correct`. A mixture of registered source and result hashes is `repairable` only when every file belongs to the same profile; complete the missing hunks. Any other hash is `ambiguous`. This resume repair is reversible by re-importing the original verified prepared archive, but never do so automatically because a re-import affects the package's full asset tree.

Prepare every known compatibility profile during the editor-closed archive batch, before the first import. `prepare_unitypackage.py` applies exact matching profiles automatically and reuses only a content-addressed sidecar whose archive, Editor, render pipeline, transformer, and profile-manifest hashes still match. This avoids discovering known compiler failures serially in Unity. In the live phase, verify profile result hashes and the newest compile-log segment as soon as the Editor reports idle; do not add fixed multi-minute waits after an exact postcondition already holds. A pending or disconnected wrapper remains unknown until those postconditions are observed, but it does not justify retrying the mutation.

## Workflow

### 1. Resolve and preserve project state

1. Canonicalize the exact Unity project root. Require `Assets/`, `Packages/manifest.json`, and `ProjectSettings/ProjectVersion.txt`.
   Require `m_EditorVersion: 6000.3.21f1` and the matching installed Editor. This portable setup has no old-Editor upgrade or compatibility branch.
2. Resolve this skill beneath `<project-root>/.agents/skills/setup-unity-packages`, or beneath `<project-root>/.claude/skills/setup-unity-packages` when only the Claude bundle was copied. The vendored `.unitypackage` archives are large binaries that exist in exactly one place: prefer `<project-root>/.agents/skills/setup-unity-packages/assets/`, fall back to `<project-root>/.claude/skills/setup-unity-packages/assets/`, and stop with a clear message when neither holds the archives instead of downloading a substitute. Reject a source package path outside its `assets/` directory, except a verified update downloaded to `<project-root>/.agent-temp/unity-package-updates/` by this workflow. Import only a verified source archive that needs no derivation or the exact prepared output below `<project-root>/.agent-temp/unity-package-staging/` whose sidecar proves its source hash and transformations.
3. Record whether Git `HEAD` exists, its SHA, and the staged-path list. Require an empty staged-path list and preserve it. Never stage package imports.

### 2. Verify the bundled allowlist

1. Inventory `assets/*.unitypackage`. Require exactly the ten registered filenames; reject symlinks, missing files, alternate locations, unregistered archives, and hash mismatches.
2. Inspect each archive without extracting into the project. Every `pathname` must be relative, traversal-free, and beneath `Assets/`.
3. Confirm the primary identity marker and required paths from the registry. Treat the exact archive hash as the bundled build identity.
4. Read `ProjectSettings/ProjectVersion.txt` and `Packages/manifest.json`. Classify the active package context as Built-in, URP, HDRP, or ambiguous. Both URP and HDRP declarations, an unreadable project version, or a package whose declared minimum/maximum Unity version excludes the current Editor is `ambiguous`; stop before import.
5. For every registered archive whose archive root differs from its canonical root, or whose exact hash has a compatibility profile for this Unity version, run:

   `<verified-python> scripts/prepare_unitypackage.py --project-root <project-root> --archive <verified-archive-1> --archive <verified-archive-2> --jobs 2 --strip-incompatible-demos`

   Resolve `<verified-python>` before use. On Windows prefer the Codex bundled runtime when available, otherwise `uv run --no-project python`; never trust a stale bare `python` from PATH. Set process-local UTF-8. Use one archive argument when only one derivation is needed. Put every independent layout/profile transform in the same batch. For a batch, require `status=batch-prepared`, zero failures, and one result per requested archive. For every result require the expected source SHA-256, canonical root, exact compatibility file/hunk counts, and a matching sidecar. Run the command again only when its content fingerprint changed; otherwise require `reused=true`. Never edit the bundled archive. Do not raise `--jobs` above two merely because more CPU cores exist; these transformations contend for the same disk and large compressed archives dominate throughput.

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

During `setup-agents`, resolve the complete dependency set while the project is closed and contribute it to the orchestrator's single manifest merge. Do not launch Unity or edit `packages-lock.json`; the one Phase-B Editor session resolves and compiles the pinned graph. Outside orchestration, a live `Client.AddAndRemove` batch remains allowed when this skill runs standalone.

- VContainer is an approved first-class UPM package, not a bundled asset archive. Run `scripts/check_vcontainer_release.ps1` and require `Status=verified-stable`. The script resolves `releases/latest`, rejects drafts/prereleases/non-numeric tags, confirms the tag in official Git, and requires the tagged `VContainer/Assets/VContainer/package.json` to declare both `jp.hadashikick.vcontainer` and the identical version. If the script is unavailable, perform those same checks without weakening them. Do not trust an API tag alone.
- Inspect the existing VContainer declaration and lock entry while the project is closed. If absent, or older and sourced from the official repository/OpenUPM, contribute `https://github.com/hadashiA/VContainer.git?path=VContainer/Assets/VContainer#<verified-tag>` from the checker. If the same version is already installed from the official repository or OpenUPM, preserve it. Treat a newer version, embedded/local package, fork, dirty Git source, downgrade, or unresolved dependency conflict as `ambiguous`; do not replace it automatically. In a standalone live run, the same verified URL may be submitted through Package Manager.
- Resolve ProBuilder, glTFast, Cinemachine, Burst, and Collections with `scripts/resolve_unity_registry_packages.ps1`, using the exact project root and exact matching `Unity.exe`. Require `status=verified-compatible-set` and `cross_package_constraints_verified=true`. Select the highest verified stable exact-patch-compatible version and pin it exactly. Do not preserve an obsolete package major or substitute another Editor's version.
- Resolve `com.unity.visualeffectgraph` through the same script but require `selection_policy=matching-editor-catalog`; the exact Unity 6.3 Editor catalog is authoritative for the 17.3 core package line. Never select the public registry's stale `latest` tag. Installing VFX Graph does not change Built-in/URP/HDRP.
- Technie Collider Creator 2 requires `com.unity.burst >= 1.8.0` and `com.unity.collections >= 2.5.7`. Pass those floors and the installed healthy majors to the resolver, then require a coherent result in which selected dependencies satisfy one another. Contribute exact versions to the Phase-A manifest map. Never pair arbitrary latest versions or select a candidate solely because its major/minor Unity label matches; the exact Unity patch floor must pass.
- Deduplicate by package id against `com.unity.ai.assistant` and dependencies contributed by `setup-unity-mcp`. A disagreement is `ambiguous`; do not let last-writer-wins choose the version. Build the required evidence object described in [references/package-registry.md](references/package-registry.md), then feed it and the complete map to `scripts/apply_unity_63_manifest.py` so `com.coplaydev.unity-mcp` is removed and all required packages are written in one atomic transaction. Preserve unrelated entries and never hand-edit the lock file.
- Do not run `scripts/stabilize_unity_package_graph.ps1` during orchestrated Phase A. Validate manifest JSON, the complete exact-version map, before/after hashes, archive evidence, and rollback state without launching Unity.
- In the live pass, require the Phase-A manifest hash/spec map to match, wait for Unity's single package-resolution/compile pass, then record and verify the resulting lock hash. Verify package IDs, exact sources/versions, VContainer assemblies, `CinemachineBrain`, generation-appropriate camera type, and Burst/Collections availability. If a manifest-declarable dependency is missing or stale, stop as `Phase A incomplete`; do not submit `Client.Add`, `Client.AddAndRemove`, or ask for a planned interactive restart.
- Feel integrations are conditional through asmdef version defines. Cinemachine and VFX Graph are installed by independent first-class rules above. Do not let Feel select versions or force a render-pipeline migration; activate only supported integrations needed by the project.
- Optimizers' Progressive Culling dependencies (`mathematics`, `jobs`, `collections`, and `burst`) are optional. Do not install them unless the project explicitly enables that feature.

### 5. Classify installed state

Inspect the exact canonical project paths from the registry. Prefer embedded version files/readmes. Where no embedded version exists, compare registered primary fingerprints. A different primary version or hash is `ambiguous`, not repairable.

If the canonical root is absent and one exact registered build exists under its old archive root, classify only its layout as `repairable`. Through the live Editor, move the entire package root with `AssetDatabase.MoveAsset`, apply the registry's deterministic old-root textual replacements, save/refresh once, and verify GUID/meta preservation plus canonical markers. If both roots exist, an old root contains unknown content, or ownership/fingerprints disagree, stop as `ambiguous`; never merge the two trees.

FImpossible packages share vendor helpers. Their package-specific roots are independent, but their shared roots are not. If any FImpossible package must be imported, compare the shared-baseline markers in the registry and use the coherent import order below. Do not import one archive over an unknown third-party or newer shared baseline.

### 6. Import through Unity

Prefer the official `unity_mcp` server after `setup-unity-mcp` is ready:

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

For DOTween, submit the exact prewritten `assets/unity-commands/configure-dotween.cs` through `Unity.RunCommand` after the selected archive has matching fingerprints and Unity has finished its import compilation. Do not probe its API or synthesize another command first. Then submit `assets/unity-commands/verify-dotween.cs` after the resulting reload. Do it even when `DG.DOTweenEditor.EditorUtils.DOTweenSetupRequired()` is already false: in the registered `1.0.430` Editor assembly that method only detects remaining `DOTweenUpgradeManager.*` files and does not verify module selections.

1. Load `DG.DOTweenEditor.UI.DOTweenUtilityWindow.GetDOTweenSettings()`. If it returns null, ensure `Assets/Resources/` exists and create/load `Assets/Resources/DOTweenSettings.asset` through the public `DG.DOTweenEditor.EditorUtils.ConnectToSourceAsset<DG.Tweening.Core.DOTweenSettings>(..., true)` API. Do not create a duplicate when a settings asset already exists in any supported DOTween location.
2. If `settings.modules` is null, assign a new public `DOTweenSettings.ModulesSetup` instance. Then set every field to the effective DOTween module profile registered in `references/package-registry.md`. Detect `TMPro.TMP_Text` from the loaded compilation domain before enabling TextMesh Pro. For a newer verified DOTween build, inspect any non-empty DeAudio or DeUnityExtended integration source and require its compatible dependency before enabling it.
3. Call the public static `DG.DOTweenEditor.UI.DOTweenUtilityWindowModules.ApplyModulesSettings()` method. It applies the stored booleans to DOTween's defines and marks the settings asset dirty.
4. Reproduce the remaining public operations used by the registered DOTween Utility Panel's **Setup DOTween** button, in order:
   - Invoke `DG.DOTweenEditor.ASMDEFManager.ApplyASMDEFSettings()` through exact public-static reflection because the declaring type is internal in `1.0.430`.
   - Set `settings.modules.showPanel = true` and mark the settings asset dirty.
   - Call public `DG.DOTweenEditor.EditorUtils.DeleteLegacyNoModulesDOTweenFiles()`.
   - Invoke `DG.DOTweenEditor.DOTweenDefines.RemoveAllLegacy()` through exact public-static reflection because the declaring type is internal.
   - Call public `DG.DOTweenEditor.EditorUtils.DeleteDOTweenUpgradeManagerFiles()`.
5. The prewritten command's exact public-member binding is the registered `1.0.430` implementation. Require one matching type and method, reject overload or assembly ambiguity, and never invoke non-public members. If a newer verified DOTween build changes the types or signatures, leave `pending DOTween setup API review` instead of guessing or performing live reflection discovery.
6. Save assets, refresh once, and wait through the resulting compilation/domain reload. Reconnect to the same Editor and verify the settings asset is unique, every effective module boolean matches the registry, `modules.showPanel` is true, required module files/defines and ASMDEF state agree with the settings, `DOTweenSetupRequired()` is false, and no new DOTween/module compile error exists.

If any setup step fails, report the exact failed operation and leave `pending DOTween setup`; do not open the interactive Utility Panel automatically, click GUI controls, edit Demigiant source, or repeat the whole package import.

Matching DOTween fingerprints with a missing settings asset, a mismatched module profile, or leftover setup artifacts is `repairable` configuration. Run only this setup sequence; do not re-import the already-correct archive.

### 8. Verify and report

For every package, collect the broad compilation/console/test evidence during the `setup-agents` consolidated final pass rather than repeating it per import:

- For VContainer, verify `jp.hadashikick.vcontainer`, its resolved stable version, official source/revision, assembly availability, package resolution, and compilation.
- For Cinemachine, verify `com.unity.cinemachine`, the selected highest compatible stable version, Unity Registry source, Cinemachine 3 assemblies/types, package resolution, domain reload, and compilation.
- For ProBuilder, VFX Graph, and glTFast, verify exact lock versions, package assemblies, representative APIs, and the package-specific acceptance from their `dev-unity-*` skills. VFX Graph remains installed without changing the render pipeline.
- For DOTween Pro, verify its registered fingerprints, unique settings asset, effective module profile, panel state, setup-required state, matching defines/ASMDEF state, and clean post-setup compilation.
- Verify the installed version/fingerprint, required markers, narrow import root, and every registered compatibility result hash.
- Verify that every registered custom asset root is below `Assets/Plugins/` and that none of the old top-level vendor roots remains. Verify each prepared sidecar's source/output hash and applied compatibility count.
- Verify required assemblies and scripts compile in the actual project, with no new package-attributable console error.
- For FImpossible, verify package-specific versions plus the shared-helper baseline.
- For Technie, verify Burst/Collections resolution before its assemblies compile.
- Preserve the package archive, Git `HEAD`, and empty staged list.
- Report `skipped`, `created`, `repaired`, `pending`, or `blocked`, including archive/candidate hash, version evidence, import route, dependency state, compilation evidence, conflicts, and remote-check result.
- If the Unity test wrapper times out after Test Runner has emitted `RunFinished` and a completed result XML, treat the XML as the test authority, report the wrapper timeout as a transport false negative, and do not rerun the suite solely for that timeout.
- For compile probes that reference plugin/package assemblies, use a temporary real Unity project assembly and clean it completely afterward. Do not use `Unity.RunCommand`'s dynamic compiler for those probes; its reference set can omit non-auto-referenced assemblies and produce false failures.

An import request, successful download, or structurally valid archive is not proof that the package is ready.

## Boundaries

- Never download from an unregistered link, trust a mirror filename alone, expose a signed URL, or bypass publisher-version confirmation.
- Never overwrite an installed different build, delete package-owned project content, or merge vendor code by hand.
- Never patch an unknown archive, apply a compatibility profile when either archive/file hash differs, or import a package whose Unity/render-pipeline compatibility is unresolved.
- Never disable Unity MCP safety checks, open an interactive import dialog, edit Unity-generated project files, or alter scenes/prefabs as setup.
- During `setup-agents`, Phase A launches no Unity process. Parallelize only independent archive preparation and read-only metadata audits; never parallelize archive imports, compilation gates, shared-helper package order, or post-import setup. Never open a second Editor in the live pass, mutate manifest-declarable UPM packages live, or run repeated broad test passes between package imports.
- Never use Computer Use, UI automation, simulated input, or coordinate clicking for imports, DOTween setup, recovery, or verification. Use official MCP/Editor APIs and deterministic helpers; checkpoint and ask the user when an unavoidable UI-only decision exists.
- Never configure another AI client or run `git add`, `git commit`, `git push`, or any history/index mutation.
