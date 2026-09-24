// TEMPLATE — preview stand-in for the TikTok Mini Games SDK (`TTMinis.game`).
//
// Replaces the publisher-SDK mock (e.g. a fake VNGGamesSDK / FakeAds / ApiMock for
// endpoints that no longer exist) once the game only integrates TikTok. It lets the
// editor preview run the SAME code path as the TikTok app: the game boots on the
// TikTok platform and silent login succeeds with a fake code.
//
// Deliberately NOT faked:
//   - rewarded ads: without an ad unit the platform plays MockAdOverlay anyway;
//   - storage: GameStorage falls back to localStorage when canIUse('setStorageSync')
//     is false, so preview saves stay inspectable in DevTools.
//
// Installed ONLY in editor preview and ONLY when the real SDK is absent, so it can
// never shadow TikTok on a device. Call installFakeTikTok() from the boot prelude
// (main bundle) before anything reads TTMinis.game.

import { PREVIEW } from 'cc/env';

const G = globalThis as any;

export function installFakeTikTok(): void {
    if (G.__fakeTikTokInstalled) return;
    G.__fakeTikTokInstalled = true;
    if (!PREVIEW || (G.TTMinis && G.TTMinis.game)) return;

    const api: any = {
        __mock: true,
        login(opts: any) {
            setTimeout(() => opts && opts.success && opts.success({ code: 'preview-auth-code' }), 0);
        },
        canIUse(name: string) {
            return typeof api[name] === 'function';
        },
    };

    G.TTMinis = { game: api };
    console.log('[fake-tiktok] TTMinis.game stubbed for preview.');
}
