# Groups, bundles, dependencies, and memory

## Contents

1. Group design dimensions
2. Bundle modes
3. Dependency behavior
4. Duplicate dependencies
5. Bundle-size trade-offs
6. Memory and churn
7. Compression and schema settings
8. Practical layout review

## 1. Group design dimensions

An Addressables group is a build and configuration boundary. Design groups using several dimensions together:

- Local or remote delivery.
- Static or frequently updated content.
- Shared runtime lifetime.
- Content commonly requested together.
- Platform, locale, quality, or region variant.
- Compression and provider settings.
- Update restriction policy.

A project folder is not automatically a good group. A gameplay feature can span several groups when its boot-critical, optional, and remotely updated content have different delivery rules.

## 2. Bundle modes

The Content Packing & Loading schema can pack group entries in different ways.

### Pack Together

Prefer when assets:

- Are usually downloaded and loaded together.
- Share a lifetime.
- Change at a similar cadence.
- Benefit from fewer bundle requests and lower per-bundle metadata overhead.

Cost: changing or loading one part can require the whole bundle.

### Pack Separately

Prefer when entries:

- Are independently optional.
- Have unrelated lifetimes.
- Need granular updates or downloads.
- Are individually large enough to justify a bundle.

Cost: many bundles increase catalog entries, requests, TypeTree and table metadata, and operational complexity.

### Pack Together By Label

Prefer when a carefully governed label combination represents a real delivery or lifetime boundary. Avoid using it with uncontrolled labels because label changes can unexpectedly reshape bundles and invalidate update assumptions.

## 3. Dependency behavior

Addressables builds implicit dependencies into bundles. At runtime, dependency relationships operate at the bundle level:

- Loading one asset loads its bundle.
- If that bundle depends on another bundle, the dependency bundle can load even when the selected asset does not directly use every item in it.
- A complex shared prefab, material, texture, shader, animation, or ScriptableObject can create broad dependency chains.

Keep cross-bundle dependencies intentional. Use the Build Layout Report to trace why a bundle is loaded.

## 4. Duplicate dependencies

A non-Addressable dependency referenced by explicit assets in different bundles can be copied into each bundle. Similar duplication can occur between:

- Addressables and `Resources`.
- Addressables and built-in scenes.
- Multiple Addressable groups.
- Local and remote content layouts.

Potential fixes:

- Make the shared dependency explicitly Addressable in a shared group.
- Move dependent assets into one bundle when they share a lifetime.
- Remove a direct reference from a built-in scene and load through `AssetReference`.
- Keep duplication when the content is mutually exclusive and separation improves user download or memory behavior.

Do not automatically run a fix and accept its output. Unity's duplicate-dependency analysis can report edge cases, including sub-objects from one multi-object source asset. Review the result and the real usage pattern.

## 5. Bundle-size trade-offs

### Fewer, larger bundles

Benefits:

- Fewer file requests.
- Lower bundle metadata overhead.
- Fewer catalogs and bundle headers in memory.
- Better compression opportunities in some content sets.

Costs:

- Larger minimum download.
- Larger update when one item changes.
- More assets retained until the bundle can unload.
- Higher peak memory for content with unrelated lifetimes.

### More, smaller bundles

Benefits:

- Granular download and update.
- Easier unloading of unrelated assets.
- Lower peak memory for independently used content.

Costs:

- More requests and files.
- More per-bundle TypeTree, table-of-contents, preload, and provider overhead.
- More dependency edges and operational complexity.

Do not optimize bundle count by intuition. Compare actual target-device memory, request behavior, and update size.

## 6. Memory and churn

Addressables reference counts assets and bundles. Important consequences:

- Releasing an asset does not guarantee immediate memory reclamation.
- Unity cannot normally unload only one asset from a still-loaded bundle.
- `Resources.UnloadUnusedAssets` can reclaim released assets but is slow and should be reserved for deliberate transition points such as loading screens.
- Releasing the last asset in a shared dependency bundle and immediately loading another dependent asset causes asset churn.

Reduce churn by aligning lifetime boundaries, preloading the next content set before releasing the previous one when memory permits, or keeping a small shared dependency lease across the transition.

## 7. Compression and schema settings

Treat compression, CRC, provider, timeout, retry, and cache settings as platform-sensitive decisions.

- LZ4 generally favors runtime access and cached loading.
- LZMA can reduce transfer size but adds decompression work.
- Uncompressed bundles can improve some local read cases but increase storage and transfer size.
- Disabling TypeTrees can reduce overhead but creates compatibility risk for remote content and code or Unity-version changes.

Do not change TypeTree or compression settings globally without a controlled build, compatibility plan, and target-device comparison.

## 8. Practical layout review

For each important asset or scene, inspect:

1. Explicit group and bundle.
2. Implicit dependencies.
3. Duplicate dependencies.
4. Total bundle chain loaded with it.
5. Local versus remote path.
6. Bundle size on disk.
7. Runtime memory after load.
8. Memory after release and transition.
9. Update size after changing one representative asset.
10. Number of network requests on a cold cache.

A good layout minimizes the total cost for actual player journeys, not only one isolated asset load.
