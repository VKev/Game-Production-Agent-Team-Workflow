# Engine and Portal Playbooks

## Contents

1. Cocos Creator
2. Unity WebGL
3. Custom HTML5 engines
4. Portal SDKs
5. CDN and dynamic asset repositories
6. Local server requirements

## 1. Cocos Creator

Identify:

- `src/settings*.js`;
- `assets/*/config.<hash>.json`;
- `subpackages/*/config.<hash>.json`;
- `importBase`, `nativeBase`, `versions.import`, `versions.native`, `uuids`, `packs`, `paths`, and `types`.

For each manifest:

- resolve numeric keys through `uuids`;
- decode 22-character compressed UUIDs to canonical UUID form;
- preserve short pack IDs and already-expanded IDs;
- map every import to `<importBase>/<id[0:2]>/<id>.<hash>.json`;
- locate native files by the `<id>.<hash>` stem;
- probe native extensions using type hints, then a bounded fallback list.

Run `sync-cocos-assets.mjs` until every manifest has zero missing entries. A first-level runtime capture is not sufficient because levels, paintings, audio, and atlases can be lazy.

Check declared bundles in settings against local manifests. If a declared bundle is absent, probe both the playable origin and configured asset server. Treat repeated 404 as an orphan declaration and isolate its entry point.

## 2. Unity WebGL

Identify:

- `Build/*.loader.js`;
- framework JS, WASM, `.data`, and precompressed `.br`/`.gz` variants;
- `StreamingAssets`;
- Addressables settings, `catalog*.json`, hashes, and bundles;
- RemoteLoadPath/CDN configuration.

Preserve compression:

- `.wasm`: `application/wasm`;
- `.wasm.br`: `application/wasm` plus `Content-Encoding: br`;
- `.data.br`: `application/octet-stream` plus `Content-Encoding: br`;
- support byte ranges for large files.

Close every Addressables catalog dependency. If binary patching is unavoidable, back up originals and validate the archive after editing. Prefer localhost allowlists and configuration overrides.

## 3. Custom HTML5 engines

Inspect:

- HTML script/style/image/audio references;
- JSON/CSV level lists;
- spritesheet/atlas pairs;
- dynamically constructed URL prefixes;
- service workers and cache manifests;
- WebAssembly and worker scripts.

Use live Network as the seed, static URL scanning for missed literals, and route coverage for dynamic paths.

## 4. Portal SDKs

Try official local/development mode first. If unavailable and init blocks boot, stub only:

- init readiness;
- safe anonymous/local user placeholder;
- ad lifecycle callbacks;
- analytics/game-event no-ops;
- pause/resume lifecycle.

Do not spoof purchases, entitlements, real accounts, cloud saves, leaderboards, or backend success.

Watch for async starvation: recursively scheduling `Promise.resolve().then(...)` while waiting for a scene can block timers and rendering. Poll scene readiness with a timer or engine scheduler.

## 5. CDN and dynamic asset repositories

CDN discovery sources:

- Cocos `settings.server`;
- Unity RemoteLoadPath;
- absolute URL literals;
- portal SDK loader configuration;
- runtime Network hosts;
- serialized config or level metadata.

For each origin, decide:

- mirror and rewrite/map locally;
- keep online with an explicit allowlist;
- safely stub because it is nonessential telemetry/ads;
- report as unavailable.

Do not classify analytics/API hosts as asset CDNs without checking the request path and initiator.

## 6. Local server requirements

Serve over HTTP with:

- correct MIME;
- correct precompressed content encoding;
- CORS when loaders require it;
- range requests;
- no-cache during debugging;
- optional COOP/COEP only when required.

Never diagnose a `file://` failure as a missing asset problem.

