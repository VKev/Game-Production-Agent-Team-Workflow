'use strict';

// Test cho bản Cocos Creator 2.x của extension dev-tools. Chạy bằng node thuần,
// KHÔNG cần mở Editor và KHÔNG cần một project thật:
//
//     node packages/dev-tools/test.js
//
// Đây là công cụ xoá file thật nên đường xoá phải có test. `Editor` và
// `electron` được thay bằng bản giả, mọi thao tác file diễn ra trong một project
// giả dưới os.tmpdir() — không bao giờ đụng project thật.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

const SRC = __dirname;
const FIXTURE = path.join(os.tmpdir(), `dev-tools-2x-test-${process.pid}`);

let pass = 0;
let fail = 0;

function group(name) {
    console.log(`\n${name}`);
}
function check(name, cond, extra) {
    if (cond) {
        pass++;
        console.log(`  ✔ ${name}`);
    } else {
        fail++;
        console.log(`  ✘ ${name}${extra ? `\n      ${extra}` : ''}`);
    }
}

// ─── bản giả của electron ────────────────────────────────────────────────────
// main.js `require('electron')` ở top-level, nên phải chặn trước khi nạp nó.

const electronStub = {
    _calls: [],
    _boxResult: 0,
    shell: {
        openExternal(url) {
            electronStub._calls.push(['openExternal', url]);
            return Promise.resolve();
        },
        openPath(p) {
            electronStub._calls.push(['openPath', p]);
        },
    },
    dialog: {
        showMessageBoxSync(opts) {
            electronStub._calls.push(['messageBox', opts.message]);
            return electronStub._boxResult;
        },
    },
    session: {
        defaultSession: {
            clearStorageData(opts) {
                electronStub._calls.push(['clearStorageData', opts.origin]);
            },
        },
    },
};

const realLoad = Module._load;
Module._load = function (request, parent, isMain) {
    if (request === 'electron') return electronStub;
    return realLoad.apply(this, arguments);
};

// ─── bản giả của Editor 2.x ──────────────────────────────────────────────────

function makeEditor(root, opts) {
    const o = opts || {};
    const calls = [];
    const E = {
        _calls: calls,
        log: (m) => calls.push(['log', m]),
        warn: (m) => calls.push(['warn', m]),
        error: (m) => calls.push(['error', m]),
        assetdb: {
            refresh(url, cb) {
                calls.push(['refresh', url]);
                if (cb) cb(null);
            },
        },
    };
    if (o.projectShape === 'projectInfo') E.projectInfo = { path: root };
    else if (o.projectShape === 'projectPath') E.projectPath = root;
    else E.Project = { path: root };

    if (o.dialog !== false) {
        E.Dialog = {
            messageBox(options) {
                calls.push(['dialog', options.message]);
                if (o.dialogThrows) throw new Error('[Window] parameter error');
                return typeof o.answer === 'number' ? o.answer : 0;
            },
        };
    }
    return E;
}

// Nạp module sau khi đã cài stub.
const cache = require('./cache');
const main = require('./main');

// ─── fixture ─────────────────────────────────────────────────────────────────

function makeProject() {
    fs.rmSync(FIXTURE, { recursive: true, force: true });
    const mk = (rel, bytes) => {
        const p = path.join(FIXTURE, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, Buffer.alloc(bytes, 1));
    };
    mk('library/imports/a.json', 100);
    mk('library/imports/b.json', 200);
    mk('temp/x.tmp', 50);
    mk('build/wechatgame/game.json', 300);
    mk('local/settings.json', 40);
    mk('assets/scripts/Game.js', 10);
    mk('settings/project.json', 10);
    fs.writeFileSync(path.join(FIXTURE, 'project.json'), '{"version":"2.4.14"}');
    return FIXTURE;
}

// ══ 1. package.json ↔ main.js ════════════════════════════════════════════════
// Hợp đồng dễ vỡ nhất của extension 2.x: menu khai báo "dev-tools:<msg>", còn
// Editor dispatch vào messages["<msg>"]. Lệch một chữ là menu item chết lặng.

function manifestSuite() {
    group('package.json ↔ main.js · mọi menu item có handler');
    const pkg = JSON.parse(fs.readFileSync(path.join(SRC, 'package.json'), 'utf8'));
    const menu = pkg['main-menu'] || {};
    const handlers = Object.keys(main.messages);

    check('dùng định dạng 2.x (main-menu, không phải contributions)', !!pkg['main-menu'] && !pkg.contributions);
    check('main trỏ tới main.js', pkg.main === 'main.js');
    check('khai báo giới hạn engine 2.x', /2\./.test(pkg['cocos-creator'] || ''));

    const entries = Object.entries(menu);
    check('có menu item', entries.length > 0);
    for (const [label, def] of entries) {
        const msg = def.message || '';
        const prefixed = msg.startsWith(`${pkg.name}:`);
        const bare = msg.slice(pkg.name.length + 1);
        check(`"${label.split('/').pop()}" → ${msg}`, prefixed && handlers.includes(bare),
            prefixed ? `messages thiếu khoá "${bare}"` : `message phải bắt đầu bằng "${pkg.name}:"`);
    }

    // Chiều ngược lại: handler thừa là code chết.
    const used = entries.map(([, d]) => (d.message || '').slice(pkg.name.length + 1));
    for (const h of handlers) {
        check(`handler "${h}" có menu item dùng tới`, used.includes(h));
    }
}

// ══ 2. cache.js ══════════════════════════════════════════════════════════════

function cacheSuite() {
    const root = makeProject();

    group('cache.js · measure/report');
    const lib = cache.measure(path.join(root, 'library'));
    check('library: 2 file / 300 B', lib.exists && lib.files === 2 && lib.bytes === 300,
        JSON.stringify(lib));
    check('thư mục không tồn tại → exists:false', cache.measure(path.join(root, 'profiles')).exists === false);

    const rep = cache.report(root);
    check('report liệt kê đúng 4 thư mục 2.x', rep.rows.length === 4,
        rep.rows.map((r) => r.rel).join(','));
    check('report KHÔNG có profiles/ (đó là 3.x)', !rep.rows.some((r) => r.rel === 'profiles'));
    check('có local/ (cấu hình cục bộ của 2.x)', rep.rows.some((r) => r.rel === 'local'));
    check('tổng = 690 B', rep.total.bytes === 690, String(rep.total.bytes));

    group('cache.js · CLEARABLE là danh sách trắng');
    check('assets không nằm trong CLEARABLE', !cache.CLEARABLE.includes('assets'));
    check('settings không nằm trong CLEARABLE', !cache.CLEARABLE.includes('settings'));
    check('packages không nằm trong CLEARABLE', !cache.CLEARABLE.includes('packages'));
    let threw = false;
    try {
        cache.trash(root, 'assets');
    } catch (e) {
        threw = true;
    }
    check('trash("assets") ném lỗi', threw);
    check('assets/ còn nguyên', fs.existsSync(path.join(root, 'assets/scripts/Game.js')));

    group('cache.js · clear() gom lỗi thay vì nổ giữa chừng');
    {
        const r = cache.clear(root, ['library', 'assets']);
        check('library/ xoá được', r.cleared.length === 1 && r.cleared[0].rel === 'library');
        check('assets/ bị từ chối và ghi vào errors', r.errors.length === 1 && r.errors[0].rel === 'assets');
        check('assets/ còn nguyên trên đĩa', fs.existsSync(path.join(root, 'assets/scripts/Game.js')));
        check('library/ đã rời khỏi tầm nhìn Editor', !fs.existsSync(path.join(root, 'library')));
        check('rác nằm trong .dev-tools-trash', fs.existsSync(path.join(root, cache.TRASH_DIR)));
    }

    group('cache.js · emptyTrash dọn sạch');
    return cache.emptyTrash(root).then((n) => {
        check('đã dọn ít nhất 1 mục', n >= 1, String(n));
        check('thư mục rác biến mất', !fs.existsSync(path.join(root, cache.TRASH_DIR)));

        group('cache.js · human()');
        check('0 B', cache.human(0) === '0 B');
        check('512 B', cache.human(512) === '512 B');
        check('1.0 KB', cache.human(1024) === '1.0 KB');
        check('1.5 MB', cache.human(1024 * 1024 * 1.5) === '1.5 MB');
    });
}

// ══ 3. main.js · lớp tương thích ═════════════════════════════════════════════

function mainSuite() {
    const root = makeProject();
    const { projectRoot } = main._internal;

    group('main.js · projectRoot dò được cả ba hình dạng của 2.4.x');
    for (const shape of ['Project', 'projectInfo', 'projectPath']) {
        global.Editor = makeEditor(root, { projectShape: shape });
        check(`Editor.${shape} → đúng root`, projectRoot() === root, projectRoot());
    }
    delete global.Editor;
    check('không có Editor → cwd, không nổ', typeof projectRoot() === 'string');

    group('main.js · ask() fail-closed');
    global.Editor = makeEditor(root, { dialog: false });
    electronStub.dialog.showMessageBoxSync = () => {
        throw new Error('no dialog');
    };
    check('không hỏi được → -1', main._internal.ask('m', 'd', ['OK', 'Huỷ'], 'warn') === -1);
    // khôi phục
    electronStub.dialog.showMessageBoxSync = (opts) => {
        electronStub._calls.push(['messageBox', opts.message]);
        return electronStub._boxResult;
    };

    group('main.js · Editor.Dialog ném lỗi thì rơi xuống Electron');
    global.Editor = makeEditor(root, { dialogThrows: true });
    electronStub._boxResult = 1;
    check('trả về kết quả của Electron', main._internal.ask('m', 'd', ['A', 'B'], 'info') === 1);
    electronStub._boxResult = 0;

    group('main.js · KHÔNG xoá khi người dùng huỷ');
    // answer = 1 → nút "Huỷ"
    global.Editor = makeEditor(root, { answer: 1 });
    return main._internal.clearTargets(['editor'], 'Xoá cache Editor').then(() => {
        check('library/ còn nguyên sau khi huỷ', fs.existsSync(path.join(root, 'library')));
        check('temp/ còn nguyên sau khi huỷ', fs.existsSync(path.join(root, 'temp')));

        group('main.js · xoá khi người dùng đồng ý');
        // answer = 0 → nút đầu ("Xoá"), rồi nút đầu của hộp thoại restart.
        global.Editor = makeEditor(root, { answer: 0 });
        return main._internal.clearTargets(['editor'], 'Xoá cache Editor').then(() => {
            check('library/ đã đi', !fs.existsSync(path.join(root, 'library')));
            check('temp/ đã đi', !fs.existsSync(path.join(root, 'temp')));
            check('build/ KHÔNG bị đụng (nhóm editor không gồm build)', fs.existsSync(path.join(root, 'build')));
            check('assets/ KHÔNG bị đụng', fs.existsSync(path.join(root, 'assets/scripts/Game.js')));
            check('settings/ KHÔNG bị đụng', fs.existsSync(path.join(root, 'settings/project.json')));

            group('main.js · clear-all không bao giờ gồm build/');
            const allDirs = ['editor', 'config'].reduce((a, k) => a.concat(cache.TARGETS[k].dirs), []);
            check('build không nằm trong clear-all', !allDirs.includes('build'), allDirs.join(','));

            delete global.Editor;
            fs.rmSync(FIXTURE, { recursive: true, force: true });
        });
    });
}

// ─── chạy ────────────────────────────────────────────────────────────────────

(async () => {
    manifestSuite();
    await cacheSuite();
    await mainSuite();
    console.log(`\n${pass} pass, ${fail} fail`);
    process.exit(fail ? 1 : 0);
})();
