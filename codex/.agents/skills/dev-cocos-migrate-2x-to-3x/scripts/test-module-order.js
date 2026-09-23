// Regression test for the framework storage chain's module-evaluation order.
//
//   node .migration/tools/test-module-order.js
//
// Params and ReportQueue build their singletons at module-evaluation time, and both
// constructors call LocalStorage.getItem. On a mini-game host there is no
// globalThis.localStorage, so that goes StorageSync -> globalThis.wxapi.getStorageSync. In
// 2.4 the alias was assigned between two require() calls and CommonJS made that
// ordering real; ES modules hoist imports, so the alias has to come from the module
// graph instead (assets/framework/HostAlias.ts). Before that change this test
// printed, for both modules:
//
//   THREW  Cannot read properties of undefined (reading 'getStorageSync')
//
// A browser never reproduces this, because a browser has window.localStorage.

const fs = require('fs');
const { compileToEsm, runHarness } = require('./lib/esm-harness');

const MODULES = ['Params', 'ReportQueue', 'LocalStorage', 'StorageSync', 'HostAlias']
    .map((n) => 'assets/framework/' + n + '.ts');

// Evaluated for their side effects at import time; these are the ones that can throw.
const ENTRIES = ['Params', 'ReportQueue'];

const out = compileToEsm(MODULES);

const harness = `
// A mini-game host: window.tt exists, window.localStorage does NOT. That pairing is
// what sends LocalStorage down the StorageSync path.
const storageCalls = [];
const host = {
    getStorageSync(k) {
        if (this !== host) throw new Error('wrong receiver for getStorageSync — the host object was copied, not aliased');
        storageCalls.push(k);
        return null;
    },
    setStorageSync(k) { storageCalls.push('set:' + k); },
    removeStorageSync(k) { storageCalls.push('remove:' + k); },
};
// The framework binds w = globalThis, not window — the mini-game runtime
// has no window binding, so fix-window-global.js converted every module. Install the
// host on globalThis itself, and leave localStorage undefined: that pairing is what
// sends LocalStorage down the StorageSync path, and a browser never reproduces it.
globalThis.tt = host;
delete globalThis.localStorage;

const results = [];
for (const name of ${JSON.stringify(ENTRIES)}) {
    try {
        await import('./' + name + '.js');
        results.push([name, 'OK', 'globalThis.wxapi was ' + (globalThis.wxapi === undefined ? 'undefined' : 'set')]);
    } catch (e) {
        results.push([name, 'THREW', e.message]);
    }
}

console.log('--- module evaluation ---');
for (const [n, s, d] of results) console.log('  ' + n.padEnd(12) + ' ' + s.padEnd(6) + ' ' + d);
console.log('--- host storage calls ---');
console.log('  ' + (storageCalls.length ? storageCalls.join(', ') : '(none)'));

const failed = results.filter((r) => r[1] === 'THREW');
if (!failed.length && !storageCalls.length) {
    console.log('\\nFAIL: nothing reached the host — the test no longer exercises the storage path');
    process.exit(1);
}
console.log('\\n' + (failed.length ? 'FAIL: ' + failed.length + ' module(s) threw at load' : 'PASS: every module loaded and reached the host'));
process.exit(failed.length ? 1 : 0);
`;

const code = runHarness(out, harness);
fs.rmSync(out, { recursive: true, force: true });
process.exit(code);
