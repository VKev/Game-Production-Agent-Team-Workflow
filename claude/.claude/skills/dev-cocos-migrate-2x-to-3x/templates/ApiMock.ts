// ApiMock.ts (Cocos Creator 3.8.x) — replay recorded API responses.
//
// Why: the ported game has no backend. Every request must answer from the
// fixtures captured by research-browser-game-mirror, or the game stalls on a pending promise.
//
// Setup:
//   1. Copy <mirror>/api-mock/client/api-mock-client.js into <script-root>/vendor/.
//   2. Copy <mirror>/api-mock/index.inline.json into
//      <resources-root>/apimock/index.inline.json (inline bodies work on native too).
//   3. Put this component on a node in the FIRST scene. executionOrder(-10000)
//      makes it install before any other script can fire a request.
//
// <script-root>/<resources-root> are this project's real folders, from
// scripts/probe-cocos-layout.js — they are NOT always assets/scripts and
// assets/resources. The script root must be in a bundle that loads at boot,
// or the fetch patch lands after the first request.

import { _decorator, Component, JsonAsset, assetManager, AssetManager, director, log, error } from 'cc';
import './vendor/api-mock-client'; // side effect: defines globalThis.__installApiMock

const { ccclass, executionOrder } = _decorator;

declare const globalThis: any;

@ccclass('ApiMock')
@executionOrder(-10000)
export class ApiMock extends Component {
    static installed = false;

    /**
     * Where the fixture index lives. Defaults to the `resources` bundle, but a
     * project without an assets/resources folder must set these to its own
     * bundle before the first scene loads — probe-cocos-layout.js reports which
     * bundles exist.
     */
    static bundle = 'resources';
    static fixturePath = 'apimock/index.inline';

    onLoad() {
        director.addPersistRootNode(this.node);
        ApiMock.install();
    }

    /** Installs the interceptor. Safe to call twice. */
    static install(done?: (err: Error | null) => void) {
        if (ApiMock.installed) {
            done?.(null);
            return;
        }
        const read = (bundle: AssetManager.Bundle) => {
            bundle.load(ApiMock.fixturePath, JsonAsset, (err, asset) => {
                if (err) {
                    error('[ApiMock] fixtures missing:', err);
                    done?.(err);
                    return;
                }
                const index = (asset as JsonAsset).json as any;
                globalThis.__installApiMock({ index });
                ApiMock.installed = true;
                log('[ApiMock] installed:', (index.entries || []).length, 'fixtures');
                done?.(null);
            });
        };

        // The bundle may not be loaded yet when the fixtures live outside `resources`.
        const loaded = assetManager.getBundle(ApiMock.bundle);
        if (loaded) {
            read(loaded);
            return;
        }
        assetManager.loadBundle(ApiMock.bundle, (err, bundle) => {
            if (err) {
                error('[ApiMock] bundle', ApiMock.bundle, 'failed:', err);
                done?.(err);
                return;
            }
            read(bundle);
        });
    }
}
