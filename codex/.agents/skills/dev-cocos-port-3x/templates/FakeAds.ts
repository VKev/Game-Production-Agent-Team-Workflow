// FakeAds.ts (Cocos Creator 3.8.x) — every ad completes, reward always granted.
// A rewarded ad first plays MockAdOverlay (black screen, ~3 s countdown) so a tester
// sees where the game shows ads; then the reward is granted.
//
// Why: a ported build has no ad inventory. The original SDK call either 404s or
// never fires its close callback, so "watch ad -> get reward" dies there.
//
// Setup: copy <mirror>/api-mock/client/fake-ads-client.js into
// assets/scripts/vendor/, then route every ad call through this class.

import './vendor/fake-ads-client'; // side effect: defines globalThis.FakeAds
import { MockAdOverlay } from './MockAdOverlay';

declare const globalThis: any;

export class FakeAds {
    /** Resolves true when the ad was "watched" — always, after the mock overlay. */
    static showRewarded(placement = 'default'): Promise<boolean> {
        return new Promise((resolve) => {
            MockAdOverlay.show(() => {
                globalThis.FakeAds.showRewarded(placement).then(resolve);
            });
        });
    }

    static showInterstitial(placement = 'default'): Promise<boolean> {
        return globalThis.FakeAds.showInterstitial(placement);
    }

    static isReady(): boolean {
        return true;
    }
}

// Porting pattern — keep the reward branch, drop the failure branch:
//
//   // before (original SDK)
//   sdk.rewardVideo({ onClose: (res) => { if (res.isEnded) this.grant(); } });
//
//   // after
//   FakeAds.showRewarded('double_coin').then(() => this.grant());
