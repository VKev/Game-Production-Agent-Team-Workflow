# Remote content, downloads, catalogs, and updates

## Contents

1. Profiles and environments
2. Remote catalog setup
3. Predownload workflow
4. Runtime catalog updates
5. Content update build workflow
6. Static and dynamic content
7. Cache and storage
8. Failure and offline behavior
9. Release and CI versioning

## 1. Profiles and environments

Use profiles to separate values, not architecture. Common profiles:

- Local development.
- Editor-hosted device test.
- Staging.
- Production.
- Platform-specific production when URLs differ.

Use profile path pairs for build and load paths. Avoid editing group URLs by hand for each release. Verify the active profile in automation before every content build.

Keep local build and load paths at their supported defaults unless the pipeline deliberately copies artifacts into the player. Custom local paths can require manual copying into `StreamingAssets`.

## 2. Remote catalog setup

For normal remote content:

1. Enable **Build Remote Catalog**.
2. Configure remote catalog build and load paths from profile variables.
3. Configure remote groups with matching remote path intent.
4. Build content.
5. Upload the catalog, hash, and bundles while preserving paths and filenames.
6. Verify HTTPS, cache headers, MIME types, redirects, and device access.

The catalog hash lets the runtime decide whether the cached catalog is current. Keep the hash beside the catalog at the expected URL.

Do not embed production secrets in profile values or client code. Addressables does not make downloadable content secret. Use normal backend authorization and platform security where required.

## 3. Predownload workflow

Use predownload when gameplay should not pause for a remote dependency:

1. Call `GetDownloadSizeAsync(key)`.
2. Release the size-operation handle after reading its result.
3. Ask for user consent or show storage and network UX when appropriate.
4. Call `DownloadDependenciesAsync(key or label)`.
5. Report byte-weighted progress with `GetDownloadStatus()`.
6. Check success or failure.
7. Release the download-operation handle.

Assign a deliberate label such as `preload-chapter-02` to a bounded set. Do not create one global preload label that downloads the entire catalog unless that is the product requirement.

Downloaded bundles are cached; predownload does not keep their assets loaded in memory.

## 4. Runtime catalog updates

Prefer catalog updates during startup or a controlled loading screen before loading related bundles.

`UpdateCatalogs` blocks other Addressables requests while it runs. Updating after old bundles are loaded can create conflicts with updated bundle versions.

Choose one strategy:

- Update catalogs before loading Addressable content.
- Unload related content before an in-session update.
- Enable Unique Bundle IDs only when in-session coexistence is required and its larger memory, build, and update costs are accepted.

After a catalog update, invalidate cached locations, custom load caches, and assumptions tied to the old catalog.

## 5. Content update build workflow

For a published full build that supports remote updates:

1. Create and test the full Addressables content build.
2. Publish the player, catalog, hash, and remote bundles as one compatible release.
3. Archive the generated `addressables_content_state.bin` for that published release.
4. Branch or tag the content configuration used for the release.
5. Make content-only changes without incompatible code or serialization changes.
6. Run **Check for Content Update Restrictions** or let the update build run it according to settings.
7. Run **Update a Previous Build** using the archived state file.
8. Test old installed clients against the update.
9. Upload new catalog, hash, and changed bundles without deleting bundles still referenced by active clients.

Use the original full release's state file for subsequent updates to that player generation. A new full player/content release creates a new baseline and a new state file.

## 6. Static and dynamic content

Classify content before the full release:

- **Static / Prevent Updates**: large or stable content expected not to change often. Changed assets can be moved into new update groups so unchanged bundles remain reusable.
- **Dynamic / updates allowed**: frequently changed content. A change can rebuild the containing bundle, so keep these bundles reasonably small and coherent.

All local content should be treated as static for content-update planning because installed local bundles cannot be replaced independently of the player.

Do not change update-restriction settings after release and expect a safe incremental update. Make such schema changes as part of a new full build.

## 7. Cache and storage

Define:

- Cold-cache behavior.
- Required free disk space.
- Cache retention policy.
- Version rollback behavior.
- Whether old bundles can be removed after catalog update.
- User-facing clear-download option.

Use `ClearDependencyCacheAsync` only with deliberate UX and ownership. Clearing cached bundles does not unload assets already held in memory.

Keep CDN cache behavior compatible with immutable hashed bundle names. Be cautious when overwriting catalog or hash files because intermediate CDN states can expose mismatched versions.

## 8. Failure and offline behavior

Test:

- No network at first launch.
- Cached catalog and cached bundles available.
- Catalog available but one bundle missing.
- Timeout and slow connection.
- Interrupted download and subsequent retry or restart.
- HTTP error and invalid certificate.
- Insufficient storage.
- Corrupt or mismatched content.
- Server rollback.

Define whether the application:

- Continues with built-in content.
- Uses cached remote content.
- Blocks at a download gate.
- Offers retry.
- Disables an optional feature.
- Requires a player update.

Do not let optional content failure break boot-critical local gameplay unless the product requirement demands it.

## 9. Release and CI versioning

A reproducible content build records:

- Git commit or content revision.
- Unity editor version, including patch.
- Addressables package version.
- Build target.
- Active profile.
- Player version or catalog version override.
- Addressables settings and group configuration.
- Output artifact hashes.
- `addressables_content_state.bin` path.
- CDN release or badge identifier.

Fail CI when the requested profile, build target, remote URL, or state-file baseline is missing. Never silently fall back to production paths from a developer machine.
