// TEMPLATE — Platform facade after cleaning: TikTok + Dev only.
//
// Replaces the ported multi-platform switch (WeChat, QQ, OPPO, VIVO, Huawei,
// Kuaishou, Alipay, native Android/iOS...) with the one platform the game ships to.
// Every rewarded ad in the game still goes through platform.showRewardAds(cb), so
// the dozen call sites stay untouched; only their callback contract matters:
//
//   cb(0)  watched to the end -> grant the reward
//   cb(1)  closed early or failed -> no reward, no error toast
//   (keep any other code the call sites already toast on, e.g. -3 "no ad yet")
//
// Needs, in the MAIN bundle: TikTokApi.ts / TikTokAds.ts (skill tiktok-growth-missions)
// and MockAdOverlay.ts (skill dev-cocos-port-3x). A framework/game bundle may import
// main-bundle modules; the reverse direction breaks the boot.
//
// TODO(project): point the import paths at where those files live, and adapt the
// `sound` import to the project's audio manager (getMute/setMute).

import { game } from 'cc';
import { canUseTikTok, ttGame } from '../scripts/TikTokApi';
import { TikTokAds } from '../scripts/TikTokAds';
import { MockAdOverlay } from '../scripts/MockAdOverlay';
import { sound } from './Sound';

/** Inside the TikTok app (or the preview stand-in). */
class TikTokPlatform {
    showRewardAds(cb: (code: number) => void) {
        // No approved ad unit yet (TikTokAds.AdUnitId empty): play the mock ad, which
        // always rewards, so a test build uploaded to TikTok is still playable.
        if (!TikTokAds.isAvailable()) {
            MockAdOverlay.show(() => cb(0));
            return;
        }
        game.pause(); // gameplay must not run behind the ad
        TikTokAds.show((isEnded: boolean) => {
            game.resume();
            cb(isEnded ? 0 : 1);
        });
    }

    vibrateShort() {
        canUseTikTok('vibrateShort') && ttGame().vibrateShort({});
    }
}

/** Anywhere else (editor preview without the stand-in, desktop browser). */
class DevPlatform {
    showRewardAds(cb: (code: number) => void) {
        MockAdOverlay.show(() => cb(0));
    }

    vibrateShort() {}
}

class Platform {
    pt: TikTokPlatform | DevPlatform = null;

    init() {
        if (this.pt) return;
        this.pt = ttGame() ? new TikTokPlatform() : new DevPlatform();
        console.log('[platform] ' + (this.pt instanceof TikTokPlatform ? 'tiktok' : 'dev'));
    }

    showRewardAds(cb: (code: number) => void) {
        this.init();
        // Mute music and sounds while the ad plays, restore afterwards.
        const wasMuted = sound.getMute();
        sound.setMute(true);
        this.pt.showRewardAds((code: number) => {
            sound.setMute(wasMuted);
            cb(code);
        });
    }

    vibrateShort() {
        this.init();
        this.pt.vibrateShort();
    }
}

export const platform = new Platform();
