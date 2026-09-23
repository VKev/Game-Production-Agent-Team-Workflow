// Regression test for the offline runtime layer's install order.
//
//   node .migration/tools/test-boot-prelude.js
//
// In 2.4 ApiMock/FakeAds/FakeAnalytics/MobileAdapter were plugin scripts: the .meta
// carried isPlugin + loadPluginInWeb + loadPluginInNative, so they ran before the
// engine booted, in a fixed order. As ES modules nothing reproduces that on its own,
// so assets/mock/BootPrelude.ts owns the order and every entry point calls it.
//
// What this pins down:
//   1. all four install, and in the declared order;
//   2. ApiMock wraps the REAL transport, not FakeAds' — it has to run first;
//   3. bootPrelude() is idempotent, because a second pass would make ApiMock wrap
//      its own mock and quietly break every request;
//   4. the globals the game reads are actually there afterwards.

const fs = require('fs');
const { compileToEsm, runHarness } = require('./lib/esm-harness');

const out = compileToEsm([
    'assets/mock/BootPrelude.ts',
    'assets/mock/ApiMock.ts',
    'assets/mock/FakeAds.ts',
    'assets/mock/FakeAnalytics.ts',
    'assets/mock/MobileAdapter.ts',
]);

const harness = `
// A bare browser-ish host: fetch and XMLHttpRequest exist so ApiMock has something
// real to wrap, and there is no document, so MobileAdapter takes its DOM-less path.
const REAL_FETCH = function realFetch() {};
class REAL_XHR {}

// The mocks bind , not  — the mini-game runtime has no
// window binding, so fix-window-global.js converted them. Install the fixtures on
// globalThis itself or the installers write somewhere this test cannot see.
const w = globalThis;
w.fetch = REAL_FETCH;
w.XMLHttpRequest = REAL_XHR;
w.location = { href: 'https://example.test/', hostname: 'example.test', search: '' };

const installOrder = [];
const realLog = console.log;
console.log = function (...args) {
    const line = String(args[0] ?? '');
    const m = line.match(/^\\[(fake-analytics|api-mock|fake-ads|mobile-adapter)\\]/);
    if (m) installOrder.push(m[1]);
};

const { bootPrelude } = await import('./BootPrelude.js');
const fetchAfterFirst = w.fetch;
bootPrelude(); // second call: must be a no-op
console.log = realLog;

const checks = [];
const check = (name, ok, detail) => checks.push([name, ok, detail]);

check('all four installed', installOrder.length === 4, 'saw: ' + (installOrder.join(' -> ') || '(none)'));
check(
    'ApiMock runs before FakeAds',
    installOrder.indexOf('api-mock') !== -1 && installOrder.indexOf('api-mock') < installOrder.indexOf('fake-ads'),
    installOrder.join(' -> '),
);
check(
    'FakeAnalytics runs first',
    installOrder[0] === 'fake-analytics',
    'first was ' + installOrder[0],
);
check('fetch was wrapped', w.fetch !== REAL_FETCH && typeof w.fetch === 'function', typeof w.fetch);
check('XMLHttpRequest was wrapped', w.XMLHttpRequest !== REAL_XHR && typeof w.XMLHttpRequest === 'function', typeof w.XMLHttpRequest);
check('bootPrelude is idempotent', w.fetch === fetchAfterFirst, 'fetch identity ' + (w.fetch === fetchAfterFirst ? 'stable' : 'CHANGED — double-wrapped'));
check('ThinkingAnalyticsAPI available', typeof w.ThinkingAnalyticsAPI === 'function', typeof w.ThinkingAnalyticsAPI);
check('VNGGamesSDK available', !!w.VNGGamesSDK && !!w.VNGGamesSDK.Ads, w.VNGGamesSDK ? 'with Ads' : 'missing');
check('adIsRealdy set', w.adIsRealdy === true, String(w.adIsRealdy));
check('__apiMockReport exposed', typeof w.__apiMockReport === 'function', typeof w.__apiMockReport);
check('__fakeAdsReport exposed', typeof w.__fakeAdsReport === 'function', typeof w.__fakeAdsReport);

// The platform constructors only ever do \`typeof w.ThinkingAnalyticsAPI === 'function'\`
// and \`new w.ThinkingAnalyticsAPI(cfg)\`; construct it here so a stub that cannot be
// constructed fails this test rather than the game.
try {
    const ta = new w.ThinkingAnalyticsAPI({ appId: 'test', serverUrl: 'https://example.test' });
    check('ThinkingAnalyticsAPI constructs', !!ta && typeof ta.track === 'function', ta ? 'has track()' : 'null');
} catch (e) {
    check('ThinkingAnalyticsAPI constructs', false, e.message);
}

console.log('--- boot prelude ---');
for (const [n, ok, d] of checks) console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + n.padEnd(34) + d);

const failed = checks.filter((c) => !c[1]);
console.log('\\n' + (failed.length ? 'FAIL: ' + failed.length + ' check(s)' : 'PASS: ' + checks.length + ' checks'));
process.exit(failed.length ? 1 : 0);
`;

const code = runHarness(out, harness);
fs.rmSync(out, { recursive: true, force: true });
process.exit(code);
