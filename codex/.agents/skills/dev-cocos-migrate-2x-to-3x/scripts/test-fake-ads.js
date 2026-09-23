// The offline ad layer must always grant the reward, and must not grant it twice.
//
//   node .migration/tools/test-fake-ads.js
//
// GD4's acceptance says the pause -> show -> close -> resume flow has to stay intact
// and every fake ad pays out. Both layers matter, because the game reaches ads two
// different ways:
//   1. the publisher gateway  — AdsManager.showAd -> VNGGamesSDK.Ads.show(opts),
//      which only rewards when adBreakDone reports breakStatus "viewed";
//   2. the platform API       — ZJTDPlatform -> tt.createRewardedVideoAd -> show(),
//      which rewards on onClose({ isEnded: true }).
// A real ad that never closes leaves cc.game.pause() on screen forever, so "the
// callback always arrives" is the property under test, not "an ad played".
//
// Double-firing is tested on purpose: ZJTDPlatform calls show() both right after
// onLoad and again when the ad is already loaded, and two closes = two rewards.

const fs = require('fs');
const { compileToEsm, runHarness } = require('./lib/esm-harness');

const out = compileToEsm(['assets/mock/FakeAds.ts']);

const harness = `
const w = globalThis;
w.location = { href: 'https://fastgame.choingay.vn/', hostname: 'fastgame.choingay.vn', search: '' };
// FakeAds only patches the platform ad API onto hosts that actually exist, so the
// host has to be present BEFORE install — exactly as it is inside TikTok.
w.tt = {};
const realLog = console.log.bind(console);
console.log = () => {};
const realWarn = console.warn.bind(console);
console.warn = () => {};

const { installFakeAds } = await import('./FakeAds.js');
installFakeAds();
console.log = realLog;
console.warn = realWarn;

const checks = [];
const check = (n, ok, d) => checks.push([n, ok, d]);
const settle = () => new Promise((r) => setTimeout(r, 30));

check('VNGGamesSDK.Ads present', !!(w.VNGGamesSDK && w.VNGGamesSDK.Ads && w.VNGGamesSDK.Ads.show), typeof w.VNGGamesSDK);
check('adIsRealdy is true', w.adIsRealdy === true, String(w.adIsRealdy));

// --- layer 1: publisher gateway -------------------------------------------------
let onReadyFired = false;
w.VNGGamesSDK.Ads.config({ onReady: () => { onReadyFired = true; } });
await settle();
check('Ads.config fires onReady (AdsManager enables ads on it)', onReadyFired, String(onReadyFired));

const seen = [];
let breakStatus = null;
w.VNGGamesSDK.Ads.show({
    type: 'reward',
    beforeAd: () => seen.push('beforeAd'),
    beforeReward: (start) => { seen.push('beforeReward'); if (typeof start === 'function') start(); },
    adViewed: () => seen.push('adViewed'),
    adDismissed: () => seen.push('adDismissed'),
    adBreakDone: (r) => { seen.push('adBreakDone'); breakStatus = r && r.breakStatus; },
    afterAd: () => seen.push('afterAd'),
});
await settle();
check('gateway: reward granted (breakStatus "viewed")', breakStatus === 'viewed', String(breakStatus));
check('gateway: never reports dismissed', seen.indexOf('adDismissed') === -1, seen.join(' -> '));
check('gateway: full lifecycle ran', ['beforeAd', 'beforeReward', 'adViewed', 'adBreakDone', 'afterAd'].every((k) => seen.includes(k)), seen.join(' -> '));

// --- layer 2: platform rewarded video -------------------------------------------
const tt = w.tt;
check('tt.createRewardedVideoAd exists', !!(tt && typeof tt.createRewardedVideoAd === 'function'), typeof (tt && tt.createRewardedVideoAd));

if (tt && tt.createRewardedVideoAd) {
    const ad = tt.createRewardedVideoAd({ adUnitId: 'test-unit' });
    let closes = [];
    let errors = 0;
    ad.onClose((res) => closes.push(res));
    ad.onError(() => errors++);
    await ad.load();
    await settle();
    await ad.show();
    await settle();
    check('platform: onClose fired with isEnded true', closes.length === 1 && closes[0] && closes[0].isEnded === true, JSON.stringify(closes));
    check('platform: no error callback', errors === 0, String(errors));

    // ZJTDPlatform can call show() twice for one ad; that must not pay out twice.
    closes = [];
    await ad.show();
    await ad.show();
    await settle();
    check('platform: double show() pays out once per settle', closes.length === 1, 'closes=' + closes.length);
}

console.log('--- fake ads ---');
for (const [n, ok, d] of checks) console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + n.padEnd(56) + d);
const failed = checks.filter((c) => !c[1]);
console.log('');
console.log(failed.length ? 'FAIL: ' + failed.length + ' of ' + checks.length : 'PASS: ' + checks.length + ' checks');
process.exit(failed.length ? 1 : 0);
`;

const code = runHarness(out, harness);
fs.rmSync(out, { recursive: true, force: true });
process.exit(code);
