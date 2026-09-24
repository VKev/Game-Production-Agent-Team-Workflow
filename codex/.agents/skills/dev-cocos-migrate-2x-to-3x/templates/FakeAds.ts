// FakeAds.ts (Cocos Creator 3.8.x) — every ad completes, reward always granted.
// A rewarded ad first plays MockAdOverlay (black screen, ~3 s countdown) so a tester
// sees where the game shows ads; then the reward is granted.
//
// Why: a ported build has no ad inventory. The original SDK call either 404s or
// never fires its close callback, so "watch ad -> get reward" dies there.
//
// Setup: copy <mirror>/api-mock/client/fake-ads-client.js into
// <script-root>/vendor/ (the project's real script root — see
// scripts/probe-cocos-layout.js), then route every ad call through this class.
//
// Watch for the second ad layer: a publisher SDK often calls the platform's own
// showRewardAds() after ITS callback succeeds, and that inner call is what hangs
// on cc.game.pause(). Replacing the host factory (tt/wx.createRewardedVideoAd)
// covers both layers — see dev-cocos-port-2x/references/shims-and-mobile.md.

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
