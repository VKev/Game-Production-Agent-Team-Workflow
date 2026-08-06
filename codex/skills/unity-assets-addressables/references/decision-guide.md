# Asset-management decision guide

## Contents

1. Decision questions
2. Mechanism comparison
3. Addressables adoption checklist
4. Key and reference selection
5. Service and API boundaries
6. Migration rules

## 1. Decision questions

Answer these before choosing a mechanism:

- Must the asset ship in the initial player?
- Is it always needed whenever its owning scene or prefab is loaded?
- Must it be unloaded independently to control memory?
- Is it optional, downloadable, seasonal, regional, or remotely hosted?
- Must content change without publishing a new player?
- Must designers assign it through the Inspector without creating a hard reference?
- Is the asset set large enough that initial build size, startup time, or memory matters?
- Is the team prepared to own profiles, groups, content builds, hosting, versioning, and update testing?

Use Addressables only when one or more of these requirements produce enough value to justify the pipeline and lifecycle complexity.

## 2. Mechanism comparison

| Mechanism | Prefer when | Avoid when |
|---|---|---|
| Direct serialized reference | Asset ships with the player and shares the owner's lifetime | Independent unload, remote delivery, or content update is required |
| `Resources` | Tiny bootstrap, prototype, or legacy compatibility case | Large catalogs, remote delivery, granular updates, predictable build size, or explicit ownership is required |
| Addressables | On-demand load, explicit release, remote content, content updates, streaming scenes, typed soft references, or dependency management is required | Content is fixed, small, always loaded, and direct references are clearer |
| Native AssetBundles | A custom low-level build, encryption, provider, or platform pipeline requires direct control | The requirement can be handled by normal Addressables workflows |
| Platform delivery integration | Google Play Asset Delivery, Apple On-Demand Resources, or another platform system is a release requirement | A normal local or CDN workflow is sufficient |

Addressables is built on AssetBundles. It simplifies location, dependency, catalog, and reference-count management, but it does not remove the need to design bundle layout and lifetime.

## 3. Addressables adoption checklist

Before adding Addressables to a feature, require a concrete answer for at least one of these:

- Reduce initial player download size.
- Delay optional content downloads.
- Unload a large asset set independently.
- Stream additive scenes or world chunks.
- Deliver remote or live content.
- Support differential content updates.
- Replace hard Inspector references with typed soft references.
- Share a content-loading abstraction across local and remote sources.

Do not adopt Addressables only to make code appear more scalable.

## 4. Key and reference selection

### Typed AssetReference

Use for designer-authored fields and type restrictions:

- `AssetReferenceGameObject`
- `AssetReferenceSprite`
- `AssetReferenceTexture`
- Custom `AssetReferenceT<T>` subclasses when the project requires a supported concrete serialized type

Benefits:

- Inspector assignment.
- GUID-backed identity survives file moves and renames.
- Optional validation and type filtering.

Constraints:

- The convenience `AssetReference.LoadAssetAsync` method stores an internal operation and cannot be called again until that load is released.
- For multiple independent owners or repeated loads, pass the `AssetReference` as a key to `Addressables.LoadAssetAsync` and keep each returned handle.
- Assigning an asset to an `AssetReference` can make that asset Addressable and place it in a default group. Review the resulting group instead of accepting it blindly.

### Address string

Use when:

- A runtime system or data file names one asset.
- The project has a stable naming convention.
- Address constants or generated keys prevent scattered literals.

Do not expose raw mutable addresses across many systems without an ownership and naming convention.

### Label

Use when:

- Loading or downloading a set.
- Defining preload groups, localization sets, categories, or variants.
- Querying multiple keys through a merge rule.

Do not call a single-asset API with a label and assume deterministic uniqueness. A label can match multiple assets.

### IResourceLocation

Use when:

- Repeated location lookup is material.
- A custom provider or advanced diagnostic needs locations.
- You need to inspect provider, dependency, or internal ID information.

Do not cache locations across catalog updates without rebuilding or invalidating that cache.

## 5. Service and API boundaries

A feature can call Addressables directly when ownership is local and obvious. Introduce an asset service only when it provides a real boundary, such as:

- Shared lifetime or caching policy.
- Central retry, telemetry, or remote-download UX.
- Swappable test provider.
- Cross-scene ownership.
- Platform-specific delivery provider.
- Consistent typed leases across many features.

Do not create a global `AddressablesManager` that returns raw assets without handles. Prefer one of these contracts:

- Caller owns and releases the returned handle.
- Service owns the handle and returns a lease/disposable token.
- Service owns the asset for a documented scope and exposes read-only access until that scope ends.

Never mix ownership models inside one API.

## 6. Migration rules

When migrating from direct references or `Resources`:

1. Inventory call sites and asset lifetime.
2. Identify assets that are duplicated between built-in scenes, `Resources`, and Addressables.
3. Convert one feature or content slice at a time.
4. Define addresses, labels, groups, and profile paths before mass conversion.
5. Replace direct scene references with `AssetReference` or runtime loading when duplication matters.
6. Add matching release paths before testing memory.
7. Build Addressables content and test with real bundles.
8. Compare player size, download size, load time, and memory before continuing.

Do not delete the original workflow until the new build, remote, failure, and release paths are verified.
