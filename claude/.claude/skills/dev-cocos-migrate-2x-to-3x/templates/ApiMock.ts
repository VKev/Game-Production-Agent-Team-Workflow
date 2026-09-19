// ApiMock.ts (Cocos Creator 3.8.x) — replay recorded API responses.
//
// Why: the ported game has no backend. Every request must answer from the
// fixtures captured by research-browser-game-mirror, or the game stalls on a pending promise.
//
// Setup:
//   1. Copy <mirror>/api-mock/client/api-mock-client.js into assets/scripts/vendor/.
//   2. Copy <mirror>/api-mock/index.inline.json into
//      assets/resources/apimock/index.inline.json (inline bodies work on native too).
//   3. Put this component on a node in the FIRST scene. executionOrder(-10000)
//      makes it install before any other script can fire a request.

import { _decorator, Component, JsonAsset, resources, director, log, error } from 'cc';
import './vendor/api-mock-client'; // side effect: defines globalThis.__installApiMock

const { ccclass, executionOrder } = _decorator;

declare const globalThis: any;

@ccclass('ApiMock')
@executionOrder(-10000)
export class ApiMock extends Component {
    static installed = false;

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
        resources.load('apimock/index.inline', JsonAsset, (err, asset) => {
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
    }
}
