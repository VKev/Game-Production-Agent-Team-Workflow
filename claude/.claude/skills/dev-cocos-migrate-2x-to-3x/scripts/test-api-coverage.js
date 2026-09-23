// Every backend call the game can make must hit an ApiMock fixture.
//
//   node .migration/tools/test-api-coverage.js
//
// GD4's acceptance is "unplug the network, play a full loop, and __apiMockReport()
// prints no 'no fixture for' line". Playing a full loop by hand checks whatever the
// tester happened to touch; this drives the real matcher over every endpoint found in
// the source, so a route nobody exercised manually still fails the build.
//
// It runs the REAL ApiMock module — not a copy of its rules — so the test cannot
// drift from the code it guards.
//
// The endpoint list is derived from the source; when a new call is added, add it here
// too, otherwise this test happily passes while the game breaks offline.

const fs = require('fs');
const { compileToEsm, runHarness } = require('./lib/esm-harness');

// [url, mustBeMocked, description]
const ENDPOINTS = [
    ['https://game.zuiqiangyingyu.net/common/is/is', true, 'framework is_enable'],
    ['common/is/v2/is?a=1', true, 'ChallengeHttp.getCountry (relative path, no leading slash)'],
    ['https://op-data.zuiqiangyingyu.net/common/game/share_list', true, 'share list'],
    ['common/common/time', true, 'server time (TimeManage reads data.data.time)'],
    ['common/tt/session/sign_in', true, 'TikTok login (index reads data.data.openid)'],
    ['common/kuaishou/login', true, 'Kuaishou login'],
    ['common/app-track/click', true, 'click tracking'],
    ['common/user-op/op-merge-report', true, 'event queue report'],
    ['common/rank/set-score', true, 'rank write'],
    ['common/rank/rank_play_20260922', true, 'rank incr'],
    ['http://timor.tech/api/holiday/info/2026-09-22', true, 'holiday lookup'],
    ['https://fastgame.choingay.vn/api/get-profile', true, 'VNG profile'],
    ['https://fastgame.choingay.vn/api/update-user', true, 'VNG update user'],
    ['https://fastgame.choingay.vn/api/end-game?score=1234', true, 'VNG end game'],
    ['https://fastgame.choingay.vn/api/v1/rank/global', true, 'VNG ranking'],
    ['https://fastgame.choingay.vn/api/get-new-level', true, 'VNG new level'],
    // Not an API call: the SDK loader script must NOT be swallowed by the API mock,
    // or FakeAds' own <script> interception never sees it.
    ['https://cdn.choingay.vn/js/vnggamessdk-mini-v3.js', false, 'SDK script (must pass through)'],
];

// Shapes the game dereferences directly; a wrong shape is a TypeError at runtime.
const SHAPES = [
    ['common/tt/session/sign_in', 'data.openid', 'framework/index reads t.data.data.openid'],
    ['common/common/time', 'data.time', 'TimeManage reads e.data.data.time'],
    ['common/is/v2/is?a=1', 'data.info.province', 'ChallengeHttp.getCountry reads data.info.province'],
    ['https://fastgame.choingay.vn/api/get-profile', 'data.maxScore', 'VNG profile'],
];

const out = compileToEsm(['assets/mock/ApiMock.ts']);

const harness = `
const REAL_FETCH = function passthrough() { return Promise.resolve({ __passthrough: true }); };
const w = globalThis;
w.fetch = REAL_FETCH;
w.XMLHttpRequest = class {};
w.location = { href: 'https://fastgame.choingay.vn/', hostname: 'fastgame.choingay.vn', search: '' };

const warns = [];
const realWarn = console.warn.bind(console);
console.warn = (...a) => { warns.push(String(a[0] || '')); };
const realLog = console.log.bind(console);
console.log = () => {};

const { installApiMock } = await import('./ApiMock.js');
installApiMock();

const ENDPOINTS = ${JSON.stringify(ENDPOINTS)};
const SHAPES = ${JSON.stringify(SHAPES)};
const checks = [];
const bodies = {};

for (const [url, mustMock, desc] of ENDPOINTS) {
    let res, err = null;
    try { res = await w.fetch(url); } catch (e) { err = e.message; }
    const passedThrough = !!(res && res.__passthrough);
    const mocked = !err && !passedThrough;
    if (mustMock) {
        checks.push(['mocked : ' + desc, mocked, mocked ? 'ok' : (err || 'fell through to the real network')]);
        if (mocked && typeof res.json === 'function') { try { bodies[url] = await res.json(); } catch (e) {} }
    } else {
        checks.push(['passes through : ' + desc, passedThrough, passedThrough ? 'ok' : 'WAS swallowed by the API mock']);
    }
}

const dig = (o, path) => path.split('.').reduce((a, k) => (a == null ? a : a[k]), o);
for (const [url, path, desc] of SHAPES) {
    const v = dig(bodies[url], path);
    checks.push(['shape  : ' + path + ' (' + desc + ')', v !== undefined && v !== null, JSON.stringify(v)]);
}

const misses = warns.filter((x) => x.indexOf('no fixture for') !== -1);
checks.push(['no "no fixture for" warnings', misses.length === 0, misses.join(' | ') || 'none']);

console.log = realLog;
console.warn = realWarn;
console.log('--- api fixture coverage ---');
for (const [n, ok, d] of checks) console.log('  ' + (ok ? 'ok  ' : 'FAIL') + '  ' + n.padEnd(62) + d);
const failed = checks.filter((c) => !c[1]);
console.log('');
console.log(failed.length ? 'FAIL: ' + failed.length + ' of ' + checks.length : 'PASS: ' + checks.length + ' checks');
process.exit(failed.length ? 1 : 0);
`;

const code = runHarness(out, harness);
fs.rmSync(out, { recursive: true, force: true });
process.exit(code);
