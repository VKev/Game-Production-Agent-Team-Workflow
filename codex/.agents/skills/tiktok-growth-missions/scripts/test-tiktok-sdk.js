// Gate for the TikTok Minis wrappers (silent-login + rewarded-ad).
//
//   node <tools>/test-tiktok-sdk.js
//
// Copy scripts/ vao mot thu muc nam DUNG 2 cap duoi goc project (vd
// .migration/tools/), vi lib/esm-harness.js suy ra goc project bang
// path.resolve(__dirname, '..', '..', '..'). Can typescript trong node_modules.
//
// Doi 3 duong dan duoi day neu project dat wrapper o thu muc khac assets/scripts.
//
// These are the two capabilities TikTok statically scans the uploaded package for,
// and neither `tsc --noEmit` nor the editor's diagnostics can see any of what
// follows: the code compiles identically whether the callback contract is right or
// wrong. TikTokApi/TikTokLogin/TikTokAds import nothing from 'cc', which is exactly
// what lets Node evaluate the real modules against a fake host.
//
// What this pins down:
//   1. outside TikTok (no TTMinis) nothing throws and nothing is granted — preview,
//      web and the ByteDance build all take this path;
//   2. an app older than 41.0.0 (canIUse false) degrades instead of crashing;
//   3. login() calls the LITERAL `login` and keeps the AuthorizationCode;
//   4. login() is idempotent per session but retries after a failure;
//   5. with no AdUnitId, isAvailable() is false — this is what lets the game
//      fall back to the mock ad before a placement is approved;
//   6. with an AdUnitId, the ad instance is created ONCE and reused;
//   7. reward is granted only on isEnded === true;
//   8. onClose + onError for the same play resolve the callback ONCE, so a player
//      cannot collect two rewards from one ad;
//   9. GameStorage (only when assets/scripts/GameStorage.ts exists) saves through
//      TTMinis storage inside TikTok, falls back to localStorage outside (and when
//      canIUse is false), maps a missing key to null, survives a throwing host,
//      and migrates old localStorage saves ONCE without overwriting.

const fs = require('fs');
const path = require('path');
const { PROJECT, compileToEsm, runHarness } = require('./lib/esm-harness');

const WITH_STORAGE = fs.existsSync(path.join(PROJECT, 'assets/scripts/GameStorage.ts'));
const out = compileToEsm([
    'assets/scripts/TikTokApi.ts',
    'assets/scripts/TikTokLogin.ts',
    'assets/scripts/TikTokAds.ts',
    ...(WITH_STORAGE ? ['assets/scripts/GameStorage.ts'] : []),
]);

// Case 6-8 need a configured ad unit. AdUnitId is a module-level const on purpose
// (see TikTokAds.ts), so the only honest way to test the configured build is to
// compile a second copy with the ID filled in — the same one-line edit shipping
// will make.
const adsJs = path.join(out, 'TikTokAds.js');
fs.writeFileSync(
    path.join(out, 'TikTokAdsConfigured.js'),
    fs.readFileSync(adsJs, 'utf8')
        .replace(`const AdUnitId = '';`, `const AdUnitId = 'test_placement_id';`)
        .replace(`from './TikTokApi.js'`, `from './TikTokApi.js'`),
);
if (!fs.readFileSync(path.join(out, 'TikTokAdsConfigured.js'), 'utf8').includes('test_placement_id')) {
    console.error('FAIL: could not inject a test AdUnitId — did the const in TikTokAds.ts change shape?');
    process.exit(2);
}

const code = runHarness(out, `
import { ttGame, canUseTikTok } from './TikTokApi.js';
import { TikTokLogin } from './TikTokLogin.js';
import { TikTokAds } from './TikTokAds.js';
import { TikTokAds as ConfiguredAds } from './TikTokAdsConfigured.js';
const { GameStorage } = ${WITH_STORAGE} ? await import('./GameStorage.js') : {};

let failures = 0;
const check = (ok, what) => {
    console.log((ok ? '  ok   ' : '  FAIL ') + what);
    if (!ok) failures++;
};

// ── 1. outside TikTok ────────────────────────────────────────────────────────
delete globalThis.TTMinis;
check(ttGame() === null, 'ttGame() is null with no TTMinis');
check(canUseTikTok('login') === false, 'canUseTikTok false with no TTMinis');
TikTokLogin.login();
check(TikTokLogin.authCode === '', 'login() outside TikTok is a no-op, no throw');
let granted = null;
TikTokAds.show((isEnded) => { granted = isEnded; });
check(granted === false, 'ads outside TikTok resolve false (no silent grant)');
check(TikTokAds.isAvailable() === false, 'isAvailable false with no AdUnitId');

// ── 2. app older than 41.0.0 ─────────────────────────────────────────────────
let oldCalled = false;
globalThis.TTMinis = { game: {
    canIUse: () => false,
    login: () => { oldCalled = true; },
    createRewardedVideoAd: () => { oldCalled = true; return {}; },
} };
TikTokLogin.login();
granted = null;
ConfiguredAds.show((isEnded) => { granted = isEnded; });
check(oldCalled === false, 'canIUse false blocks the call instead of throwing');
check(granted === false, 'old app grants nothing');

// ── 3-4. silent login ────────────────────────────────────────────────────────
let loginCalls = 0;
let failNext = true;
globalThis.TTMinis = { game: {
    canIUse: () => true,
    login: (opts) => {
        loginCalls++;
        if (failNext) { failNext = false; opts.fail({ errMsg: 'network' }); return; }
        opts.success({ code: 'AUTHCODE-123456' });
    },
} };
TikTokLogin.login();
check(loginCalls === 1 && TikTokLogin.authCode === '', 'a failed login keeps authCode empty');
TikTokLogin.login();
check(loginCalls === 2, 'login retries after a failure');
check(TikTokLogin.authCode === 'AUTHCODE-123456', 'authCode kept on success');
TikTokLogin.login();
check(loginCalls === 2, 'login is idempotent once it has succeeded');

// ── 5-8. rewarded ad ─────────────────────────────────────────────────────────
let created = 0;
let closeCb = null;
let errorCb = null;
let shows = 0;
let lastAdUnitId = null;
globalThis.TTMinis = { game: {
    canIUse: () => true,
    createRewardedVideoAd: (opts) => {
        created++;
        lastAdUnitId = opts && opts.adUnitId;
        return {
            onClose: (cb) => { closeCb = cb; },
            onError: (cb) => { errorCb = cb; },
            show: () => Promise.resolve(),
        };
    },
} };

check(TikTokAds.isAvailable() === false, 'empty AdUnitId still unavailable in TikTok');
check(ConfiguredAds.isAvailable() === true, 'configured AdUnitId is available');

granted = null;
ConfiguredAds.show((isEnded) => { granted = isEnded; });
check(created === 1 && lastAdUnitId === 'test_placement_id', 'ad created once with the configured id');
check(granted === null, 'no reward before the ad closes');
closeCb({ isEnded: true, count: 1 });
check(granted === true, 'reward granted on isEnded true');

// 8. a second resolution for the SAME play must not fire again.
granted = null;
errorCb({ errMsg: 'late error for the same play' });
check(granted === null, 'onError after onClose does not double-resolve');

// 6. reuse, not recreate.
granted = null;
ConfiguredAds.show((isEnded) => { granted = isEnded; });
check(created === 1, 'instance reused on the next play (docs: do not recreate)');

// 7. closing early grants nothing.
closeCb({ isEnded: false });
check(granted === false, 'closing early grants nothing');

// error path
granted = null;
ConfiguredAds.show((isEnded) => { granted = isEnded; });
errorCb({ errMsg: 'no fill' });
check(granted === false, 'ad error grants nothing');

// ── 9. progress storage ──────────────────────────────────────────────────────
if (GameStorage) {
    const fakeLocal = (init) => {
        const m = new Map(Object.entries(init || {}));
        return {
            get length() { return m.size; },
            key: (i) => [...m.keys()][i] ?? null,
            getItem: (k) => (m.has(k) ? m.get(k) : null),
            setItem: (k, v) => m.set(k, String(v)),
            removeItem: (k) => m.delete(k),
        };
    };
    const fakeTT = (canUse = true) => {
        const m = new Map();
        return { _m: m, game: {
            canIUse: () => canUse,
            // real SDK: missing key -> null (some builds return '')
            getStorageSync: (k) => (m.has(k) ? m.get(k) : ''),
            setStorageSync: (k, v) => m.set(k, v),
            removeStorageSync: (k) => m.delete(k),
        } };
    };

    delete globalThis.TTMinis;
    globalThis.localStorage = fakeLocal();
    GameStorage.setItem('save_coin', '50');
    check(globalThis.localStorage.getItem('save_coin') === '50', 'storage: outside TikTok writes localStorage');
    check(GameStorage.getItem('save_coin') === '50' && GameStorage.getItem('nope') === null, 'storage: localStorage read, missing key -> null');

    let tt = fakeTT();
    globalThis.TTMinis = tt;
    globalThis.localStorage = fakeLocal();
    GameStorage.setItem('save_coin', 120);
    check(tt._m.get('save_coin') === '120' && globalThis.localStorage.getItem('save_coin') === null,
        'storage: inside TikTok writes TTMinis storage (as string), not localStorage');
    check(GameStorage.getItem('save_coin') === '120', 'storage: reads back from TTMinis storage');
    check(GameStorage.getItem('never_set') === null, "storage: TikTok '' for a missing key maps to null");
    GameStorage.removeItem('save_coin');
    check(GameStorage.getItem('save_coin') === null, 'storage: removeItem clears the TikTok key');

    tt = fakeTT(false);
    globalThis.TTMinis = tt;
    globalThis.localStorage = fakeLocal();
    GameStorage.setItem('k', 'v');
    check(tt._m.size === 0 && globalThis.localStorage.getItem('k') === 'v', 'storage: canIUse false falls back to localStorage');

    globalThis.TTMinis = { game: { canIUse: () => true,
        getStorageSync: () => { throw new Error('boom'); },
        setStorageSync: () => { throw new Error('boom'); } } };
    let threw = false;
    try { GameStorage.setItem('a', '1'); GameStorage.getItem('a'); } catch (e) { threw = true; }
    check(!threw, 'storage: a throwing host never crashes the game');

    tt = fakeTT();
    globalThis.TTMinis = tt;
    globalThis.localStorage = fakeLocal({ save_coin: '77', save_level: '3', other_app: 'x' });
    tt._m.set('save_level', '9'); // newer value already in TikTok storage
    GameStorage.migrateFromLocalStorage('save_');
    check(tt._m.get('save_coin') === '77', 'storage: migration copies old localStorage saves');
    check(tt._m.get('save_level') === '9', 'storage: migration never overwrites an existing TikTok key');
    check(!tt._m.has('other_app'), 'storage: migration only copies the given prefix');
    globalThis.localStorage.setItem('save_coin', '999');
    GameStorage.migrateFromLocalStorage('save_');
    check(tt._m.get('save_coin') === '77', 'storage: migration runs only once');
} else {
    console.log('  skip storage checks (assets/scripts/GameStorage.ts not in this project)');
}

console.log(failures === 0 ? '\\nPASS' : '\\nFAIL: ' + failures + ' check(s)');
process.exit(failures === 0 ? 0 : 1);
`);

fs.rmSync(out, { recursive: true, force: true });
process.exit(code);
