# Build, testing, diagnostics, and profiling

## Contents

1. Editor play modes
2. Content and player builds
3. CI checks
4. Analyze tool
5. Build Layout Report
6. Runtime profiling
7. Test matrix
8. Optimization decision

## 1. Editor play modes

### Use Asset Database

Use for fast iteration. It loads from the Editor Asset Database and does not accurately represent:

- AssetBundle boundaries.
- Remote downloads.
- Catalog behavior.
- Bundle memory overhead.
- Real release timing.
- Missing or stale content builds.

A feature working here is not sufficient evidence that Addressables is configured correctly.

### Simulate Groups

Use when available to inspect projected layout and dependencies without building bundles. Treat it as analysis, not a substitute for a real build.

### Use Existing Build

Use to exercise built bundles and runtime data. Rebuild Addressables content whenever the tested content or settings require it. This is the minimum Editor mode for validating release and bundle behavior.

## 2. Content and player builds

Choose and document whether Addressables content is:

- Built automatically before every player build.
- Built as a separate controlled pipeline step.
- Reused from a verified content artifact.

Automatic builds are convenient but can add large build time and can hide profile mistakes. Separate builds improve control but require CI to reject stale content.

For each platform:

1. Select the target platform before the content build.
2. Select the intended profile.
3. Build or retrieve the compatible Addressables content.
4. Build the player using that content.
5. Verify local content is included and remote content is not accidentally embedded.
6. Test the generated player, not only the Editor.

Do not run Clean Build by habit. Use it to investigate stale cache or when configuration changes require a clean baseline, then record why it was necessary.

## 3. CI checks

Validate before publishing:

- Unity and Addressables versions match the release baseline.
- Active build target and profile are explicit.
- Remote URLs are non-empty and environment-correct.
- Addressable addresses are unique where uniqueness is required.
- No forbidden production secrets are stored in assets.
- Required state file exists for an update build.
- Addressables build succeeds without ignored errors.
- Build artifacts are present and upload paths match catalog paths.
- Build Layout Report is archived for comparison.
- Catalog, hash, bundle, and player versions are recorded together.

## 4. Analyze tool

Run relevant rules before release:

- Check Duplicate Bundle Dependencies.
- Check Resources to Addressable Duplicate Dependencies.
- Check Scene to Addressable Duplicate Dependencies.
- Bundle Layout Preview.

Analyze can be expensive because some rules project or perform a full build. Run it at appropriate checkpoints rather than every code compilation.

Do not apply automatic fixes without review. Duplicate dependencies can be intentional, and multi-object assets can produce misleading fixes.

## 5. Build Layout Report

Enable and inspect the report when changing group layout or investigating size and memory. Review:

- Bundle names and sizes.
- Explicit and implicit assets.
- Dependency chains.
- Duplicated assets.
- Asset contribution to bundle size.
- Reasons assets were included.
- Group and bundle packing results.

Compare reports before and after a layout change. A smaller number of bundles is not automatically better; evaluate player journeys and update cadence.

## 6. Runtime profiling

Use the Addressables Profiler module and Memory Profiler where supported. Observe:

- Asset and bundle reference counts.
- Load and unload timing.
- Peak memory.
- Assets retained after expected release.
- Asset churn across transitions.
- Repeated downloads or catalog checks.
- Large dependency bundles loaded by small requests.
- GC allocations in custom wrapper code.

Remember that the Addressables graph reflects Addressables reference counts, not every internal Unity memory event. Released assets can remain resident until their bundle unloads, and `Resources.UnloadUnusedAssets` can change memory independently of Addressables counters.

Profile a development player on the target device for important decisions. Editor timings and memory are not equivalent to player behavior.

## 7. Test matrix

### Loading

- Local asset on warm and cold start.
- Remote asset on cold cache.
- Cached remote asset.
- Single asset and label set.
- Type mismatch or missing key.
- Slow and failed network.

### Ownership

- Owner destroyed during load.
- Owner disabled and re-enabled.
- Repeated request according to policy.
- Failure handle released.
- Successful handle released exactly once.
- Pool disposed after all instances are destroyed.

### Instantiation

- `InstantiateAsync` success and failure.
- Release by handle and by tracked instance where applicable.
- Manual clones remain valid until prefab handle release.
- No double destroy or double release.

### Scenes

- Additive load and activation.
- Unload through Addressables.
- Transition while load is in progress.
- Persistent owner survives scene changes.

### Remote updates

- Old player with original content.
- Old player after one and several content updates.
- Offline cached startup.
- Missing catalog, hash, or bundle.
- Catalog update before load.
- In-session update strategy if supported.

### Build

- Use Existing Build in Editor.
- Development player.
- Release-like player with production profile against staging content.
- IL2CPP and code stripping when relevant.

## 8. Optimization decision

After correctness:

1. Capture a baseline.
2. Identify the actual bottleneck: download, disk, CPU, memory, requests, build time, or update size.
3. Change one variable: grouping, compression, preload, cache, bundle mode, or wrapper allocation.
4. Repeat the same workload.
5. Keep the change only if the measured gain and product value justify the added complexity.

Do not create a custom caching layer, custom provider, or elaborate reference-count service to optimize an unmeasured concern.
