'use strict';

// Test cho extension dev-tools. Chạy bằng node thuần, KHÔNG cần mở Editor:
//
//     node extensions/dev-tools/test.js
//
// Đây là công cụ xoá file thật nên đường xoá phải có test. `Editor` và
// `electron` được thay bằng bản giả, mọi thao tác file diễn ra trong một
// project giả dưới os.tmpdir() — không bao giờ đụng project thật.

const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const SRC = __dirname;
const PROJECT = path.resolve(SRC, '..', '..');
const FIXTURE = path.join(os.tmpdir(), 'dev-tools-test-' + process.pid);

let pass = 0;
let fail = 0;

function group(name) { console.log(`\n${name}`); }
function check(name, cond, extra) {
    if (cond) { pass++; console.log(`  ✔ ${name}`); }
    else { fail++; console.log(`  ✘ ${name}${extra ? '\n      ' + extra : ''}`); }
}
/** browser.js log ra Console rất nhiều — nuốt đi cho output test sạch. */
function silence() {
    const o = console.log;
    const w = console.warn;
    console.log = console.warn = () => {};
    return () => { console.log = o; console.warn = w; };
}

// ══ 1. preview-template/dev-tools.html ═══════════════════════════════════════
// Chạy <script> của trang trong DOM giả, kiểm reset() bỏ đúng khoá nào.

function pageSuite() {
    const html = fs.readFileSync(path.join(PROJECT, 'preview-template/dev-tools.html'), 'utf8');
    const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

    function makeStorage(init) {
        const map = new Map(Object.entries(init || {}));
        return {
            get length() { return map.size; },
            key: (i) => [...map.keys()][i],
            getItem: (k) => (map.has(k) ? map.get(k) : null),
            setItem: (k, v) => map.set(k, String(v)),
            removeItem: (k) => map.delete(k),
            clear: () => map.clear(),
            _dump: () => Object.fromEntries(map),
        };
    }
    function fakeEl() {
        const el = {
            textContent: '', innerHTML: '', className: '', style: {}, value: '', type: '', placeholder: '',
            onclick: null, onchange: null, children: [],
            appendChild(c) { el.children.push(c); return c; },
            querySelectorAll: () => [],
            setAttribute() {}, getAttribute: () => null,
        };
        return el;
    }
    function run(initial, search) {
        const els = {};
        const sandbox = {
            console,
            localStorage: makeStorage(initial),
            sessionStorage: makeStorage({}),
            location: { origin: 'http://localhost:7456', search, pathname: '/dev-tools.html', href: '' },
            history: { replaceState() {} },
            confirm: () => true,
            navigator: {},
            document: {
                getElementById: (id) => (els[id] = els[id] || fakeEl()),
                createElement: () => fakeEl(),
            },
        };
        sandbox.window = sandbox;
        vm.createContext(sandbox);
        vm.runInContext(code, sandbox, { filename: 'dev-tools.html' });
        return { storage: sandbox.localStorage._dump(), log: els.log ? els.log.textContent : '' };
    }

    // Trạng thái sau khi chơi: id tài khoản + cây dữ liệu + cài đặt + cờ debug.
    const SAVED = {
        userId: 'userId1738300000000_42',
        'userId1738300000000_42': '{"money":9999,"chapter":7}',
        default_menu: 'MainMenu',
        recent_uuid: 'abc-123',
        HotUpdateConfig: '{"init":1}',
        BGM_VOLUME: '0.6', SE_VOLUME: '1', VIBRATE: '1', PERSONAL_ADS: '0',
        DEBUG_MODE: '1', DEBUG_MAP: '3', DEBUG_GAME_SPEED: '2',
    };

    group('trang dev · auto=reset — giữ cài đặt, bỏ tiến độ');
    {
        const r = run(SAVED, '?auto=reset');
        const left = Object.keys(r.storage).sort();
        check('giữ đúng 7 khoá cài đặt/debug', left.length === 7, 'còn: ' + left.join(', '));
        check('giữ BGM_VOLUME', r.storage.BGM_VOLUME === '0.6');
        check('giữ cả 3 cờ debug', r.storage.DEBUG_MODE === '1' && r.storage.DEBUG_MAP === '3' && r.storage.DEBUG_GAME_SPEED === '2');
        check('bỏ userId + cây dữ liệu người chơi', !r.storage.userId && !r.storage['userId1738300000000_42']);
        check('bỏ default_menu / recent_uuid / HotUpdateConfig',
            !r.storage.default_menu && !r.storage.recent_uuid && !r.storage.HotUpdateConfig);
        check('log báo bỏ 5 khoá', /bỏ 5 khoá/.test(r.log), r.log.split('\n')[0]);
    }

    group('trang dev · auto=wipe — xoá sạch');
    {
        const r = run(SAVED, '?auto=wipe');
        check('localStorage rỗng', Object.keys(r.storage).length === 0, JSON.stringify(r.storage));
        check('log báo 12 khoá', /12 khoá/.test(r.log), r.log.split('\n')[0]);
    }

    group('trang dev · không có query');
    {
        const r = run(SAVED, '');
        check('không đụng gì', Object.keys(r.storage).length === 12);
        check('không hiện log', r.log === '');
    }

    group('trang dev · biên');
    {
        const empty = run({}, '?auto=reset');
        check('storage rỗng vẫn chạy', Object.keys(empty.storage).length === 0 && /Không có tiến độ nào/.test(empty.log));
        const onlySettings = run({ BGM_VOLUME: '1', DEBUG_MODE: '1' }, '?auto=reset');
        check('chỉ có cài đặt → không bỏ nhầm', Object.keys(onlySettings.storage).length === 2, JSON.stringify(onlySettings.storage));
    }
}

// ══ 2. browser.js ════════════════════════════════════════════════════════════
// Nạp module thật với Editor/electron giả và một project root giả.

async function browserSuite() {
    const calls = { openExternal: [], openPath: [], sessionClear: [], quit: 0, dialogs: [] };
    const electronStub = {
        shell: {
            openExternal: async (u) => { calls.openExternal.push(u); },
            openPath: (p) => { calls.openPath.push(p); },
        },
        dialog: { showMessageBox: async () => { throw new Error('không dùng dialog Electron trong test'); } },
        session: { defaultSession: { clearStorageData: async (o) => { calls.sessionClear.push(o); } } },
    };
    const origLoad = Module._load;
    Module._load = function (req) {
        if (req === 'electron') return electronStub;
        return origLoad.apply(this, arguments);
    };

    let answers = [];
    let builderFree = true;
    global.Editor = {
        Project: { path: FIXTURE },
        App: { quit: () => { calls.quit++; } },
        Dialog: {
            info(m, o) { return this._ask('info', m, o); },
            warn(m, o) { return this._ask('warn', m, o); },
            _ask(kind, message, opts) {
                calls.dialogs.push({ kind, message, detail: opts.detail, buttons: opts.buttons, cancel: opts.cancel });
                return Promise.resolve({ response: answers.length ? answers.shift() : 0 });
            },
        },
        Message: {
            request: async (pkg, msg) => {
                if (pkg === 'server' && msg === 'query-port') return 7456;
                if (pkg === 'builder' && msg === 'query-tasks-info') return { free: builderFree, queue: {} };
                if (pkg === 'asset-db' && msg === 'refresh-asset') return true;
                throw new Error(`unexpected ${pkg}/${msg}`);
            },
        },
    };

    function resetFixture() {
        fs.rmSync(FIXTURE, { recursive: true, force: true });
        for (const d of ['library/imports', 'temp/programming', 'build/web-mobile', 'profiles/v2', 'assets/scripts', 'settings/v2']) {
            fs.mkdirSync(path.join(FIXTURE, d), { recursive: true });
            fs.writeFileSync(path.join(FIXTURE, d, 'f.bin'), 'x'.repeat(1024));
        }
    }
    const dirs = () => fs.readdirSync(FIXTURE).sort().join(',');
    const has = (p) => fs.existsSync(path.join(FIXTURE, p));
    function fresh(as) {
        resetFixture();
        calls.dialogs = []; calls.quit = 0; calls.openExternal = []; calls.openPath = []; calls.sessionClear = [];
        answers = as;
    }

    for (const f of ['browser.js', 'cache.js']) delete require.cache[require.resolve(path.join(SRC, f))];
    const mod = require(path.join(SRC, 'browser.js'));

    group('xoá cache · huỷ ở hộp thoại xác nhận');
    {
        fresh([1]);
        const un = silence(); await mod.methods.clearEditorCache(); un();
        check('không xoá gì', dirs() === 'assets,build,library,profiles,settings,temp', dirs());
        check('đúng 1 hộp thoại, kiểu warn, nút [Xoá, Huỷ]',
            calls.dialogs.length === 1 && calls.dialogs[0].kind === 'warn' && calls.dialogs[0].buttons.join('|') === 'Xoá|Huỷ');
        check('detail liệt kê từng thư mục + cảnh báo restart',
            /library\/ — 1 file/.test(calls.dialogs[0].detail) && /temp\/ — 1 file/.test(calls.dialogs[0].detail)
            && /KHỞI ĐỘNG LẠI/.test(calls.dialogs[0].detail));
    }

    group('xoá cache Editor · đồng ý');
    {
        fresh([0, 0]);
        const un = silence(); await mod.methods.clearEditorCache(); un();
        check('library/ + temp/ đã đi', !has('library') && !has('temp'));
        check('assets/ + settings/ nguyên vẹn', has('assets/scripts/f.bin') && has('settings/v2/f.bin'));
        check('build/ + profiles/ không bị đụng', has('build') && has('profiles'));
        check('có hỏi thoát Editor', /khởi động lại Editor/.test(calls.dialogs[1].message), calls.dialogs[1].message);
        check('bấm "Thoát Editor ngay" → gọi quit()', calls.quit === 1);

        fresh([0, 1]);
        const un2 = silence(); await mod.methods.clearEditorCache(); un2();
        check('bấm "Để tôi tự thoát" → không quit', calls.quit === 0);
    }

    group('xoá build/');
    {
        fresh([0]); builderFree = false;
        const un = silence(); await mod.methods.clearBuild(); un();
        builderFree = true;
        check('đang build thì chặn, build/ còn nguyên', has('build/web-mobile/f.bin') && /Đang có build chạy/.test(calls.dialogs[0].message));

        fresh([0]);
        const un2 = silence(); await mod.methods.clearBuild(); un2();
        check('build/ đã đi', !has('build'));
        check('không đòi khởi động lại Editor',
            calls.quit === 0 && /Không cần khởi động lại/.test(calls.dialogs[0].detail));
    }

    group('xoá TẤT CẢ');
    {
        fresh([0, 1]);
        const un = silence(); await mod.methods.clearAll(); un();
        check('5 thư mục cache đi ngay (rename)',
            ['library', 'temp', 'build', 'profiles', 'local'].every((d) => !has(d)), dirs());
        check('assets/ + settings/ nguyên vẹn', has('assets/scripts/f.bin') && has('settings/v2/f.bin'));
        check('báo cáo gộp 4 thư mục có thật',
            (calls.dialogs[0].detail.match(/• \w+\/ — /g) || []).length === 4, calls.dialogs[0].detail);
        await new Promise((r) => setTimeout(r, 300));
        check('rác nền dọn xong → chỉ còn assets + settings', dirs() === 'assets,settings', dirs());
    }

    group('không có gì để xoá');
    {
        fresh([0]);
        fs.rmSync(path.join(FIXTURE, 'build'), { recursive: true, force: true });
        const un = silence(); await mod.methods.clearBuild(); un();
        check('báo rồi thôi, đúng 1 hộp thoại',
            calls.dialogs.length === 1 && /Không có gì để xoá/.test(calls.dialogs[0].message), calls.dialogs[0].message);
    }

    group('xoá save game');
    {
        fresh([2]);
        const un = silence(); await mod.methods.clearSave(); un();
        check('huỷ → không mở trình duyệt, không đụng phiên Editor',
            calls.openExternal.length === 0 && calls.sessionClear.length === 0);

        fresh([0]);
        const un2 = silence(); await mod.methods.clearSave(); un2();
        check('reset → mở ?auto=reset', calls.openExternal[0] === 'http://localhost:7456/dev-tools.html?auto=reset', calls.openExternal[0]);
        check('reset → KHÔNG đụng phiên Electron', calls.sessionClear.length === 0);

        fresh([1]);
        const un3 = silence(); await mod.methods.clearSave(); un3();
        check('wipe → mở ?auto=wipe', calls.openExternal[0] === 'http://localhost:7456/dev-tools.html?auto=wipe', calls.openExternal[0]);
        check('wipe → xoá phiên Electron cho localhost + 127.0.0.1',
            calls.sessionClear.map((c) => c.origin).join(',') === 'http://localhost:7456,http://127.0.0.1:7456',
            JSON.stringify(calls.sessionClear.map((c) => c.origin)));
        check('wipe → có storages localstorage', calls.sessionClear[0].storages.includes('localstorage'));
    }

    group('báo cáo dung lượng');
    {
        fresh([0]);
        const un = silence(); await mod.methods.cacheReport(); un();
        check('Esc trỏ về "Đóng", không mở Finder', calls.dialogs[0].cancel === 0 && calls.openPath.length === 0);
        check('có dòng TỔNG', /TỔNG/.test(calls.dialogs[0].detail));
    }

    group('load() dọn rác còn sót từ lần trước');
    {
        resetFixture();
        fs.mkdirSync(path.join(FIXTURE, '.dev-tools-trash', 'library-123'), { recursive: true });
        fs.writeFileSync(path.join(FIXTURE, '.dev-tools-trash', 'library-123', 'old.bin'), 'x');
        const un = silence(); mod.load(); await new Promise((r) => setTimeout(r, 300)); un();
        check('.dev-tools-trash đã sạch', !has('.dev-tools-trash'));
    }

    Module._load = origLoad;
    fs.rmSync(FIXTURE, { recursive: true, force: true });
}

// ══ 3. cache.js — hàng rào an toàn ═══════════════════════════════════════════

function cacheSuite() {
    const cache = require(path.join(SRC, 'cache.js'));
    const root = path.join(FIXTURE, 'guard');
    fs.rmSync(root, { recursive: true, force: true });
    for (const d of ['library', 'assets', 'settings', 'node_modules']) {
        fs.mkdirSync(path.join(root, d), { recursive: true });
        fs.writeFileSync(path.join(root, d, 'f.bin'), 'x');
    }

    group('cache.js · chỉ xoá thư mục trong danh sách trắng');
    for (const forbidden of ['assets', 'settings', 'node_modules', '..', '.']) {
        let threw = false;
        try { cache.trash(root, forbidden); } catch (e) { threw = /không được phép/.test(e.message); }
        check(`chặn trash("${forbidden}")`, threw);
    }
    check('assets/ vẫn còn sau khi bị từ chối', fs.existsSync(path.join(root, 'assets/f.bin')));

    group('cache.js · clear() gom lỗi thay vì nổ giữa chừng');
    {
        const r = cache.clear(root, ['library', 'assets']);
        check('library/ xoá được', r.cleared.length === 1 && r.cleared[0].rel === 'library');
        check('assets/ bị từ chối và ghi vào errors', r.errors.length === 1 && r.errors[0].rel === 'assets');
        check('assets/ còn nguyên trên đĩa', fs.existsSync(path.join(root, 'assets/f.bin')));
    }

    group('cache.js · human()');
    check('0 B', cache.human(0) === '0 B');
    check('512 B', cache.human(512) === '512 B');
    check('1.0 KB', cache.human(1024) === '1.0 KB');
    check('1.5 MB', cache.human(1024 * 1024 * 1.5) === '1.5 MB');

    fs.rmSync(FIXTURE, { recursive: true, force: true });
}

(async () => {
    pageSuite();
    await browserSuite();
    cacheSuite();
    console.log(`\n${pass} pass, ${fail} fail`);
    process.exit(fail ? 1 : 0);
})();
