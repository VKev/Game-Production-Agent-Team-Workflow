'use strict';

// Menu "Dev nhanh" cho Cocos Creator 2.x: xoá cache, xoá save game, refresh
// asset, mở preview. Bản 3.x của extension này nằm ở ../dev-tools.
//
// Khác biệt so với bản 3.x — đọc trước khi sửa:
//
//  · 2.x nạp extension từ `packages/<name>/`, khai báo menu bằng `main-menu`
//    trong package.json, và gọi vào `module.exports.messages` với KHOÁ KHÔNG
//    có tiền tố package (`'cache-report'`, không phải `'dev-tools:cache-report'`).
//    3.x thì dùng `extensions/`, `contributions.menu` và `methods`.
//  · 2.x không có `Editor.Message.request(...)`. Tương đương gần nhất là
//    `Editor.assetdb` và `Editor.Ipc`.
//  · 2.x không có `profiles/`; cấu hình cục bộ nằm trong `local/` (xem cache.js).
//  · Không có mục "mở bảng Dev": trang `dev-tools.html` là tài sản của một
//    project 3.x cụ thể (preview-template/), không phải của extension, nên bản
//    2.x không giả vờ rằng nó tồn tại.
//
// Mọi API Editor đều được dò qua nhiều tên gọi: bề mặt 2.4.x lệch nhau giữa các
// bản vá, và một menu item chết lặng thì tệ hơn một dòng log nói rõ vì sao.

const path = require('path');
const cache = require('./cache');

const TITLE = 'Dev nhanh';
const DEFAULT_PREVIEW_PORT = 7456;

// electron chỉ có trong tiến trình Editor. Yêu cầu mềm để `node main.js` và
// test chạy được ngoài Editor.
let electron = null;
try {
    electron = require('electron');
} catch (e) {
    /* ngoài Editor */
}

// ─── lớp tương thích Editor 2.x ──────────────────────────────────────────────

function ed() {
    return typeof Editor !== 'undefined' ? Editor : null;
}

function log(msg) {
    const E = ed();
    if (E && typeof E.log === 'function') E.log(`[dev-tools] ${msg}`);
    else console.log(`[dev-tools] ${msg}`);
}

function warn(msg) {
    const E = ed();
    if (E && typeof E.warn === 'function') E.warn(`[dev-tools] ${msg}`);
    else console.warn(`[dev-tools] ${msg}`);
}

function errlog(msg) {
    const E = ed();
    if (E && typeof E.error === 'function') E.error(`[dev-tools] ${msg}`);
    else console.error(`[dev-tools] ${msg}`);
}

/** Gốc project. 2.4.x đã từng đặt giá trị này ở ba chỗ khác nhau. */
function projectRoot() {
    const E = ed();
    const candidates = [
        E && E.Project && E.Project.path,
        E && E.projectInfo && E.projectInfo.path,
        E && E.projectPath,
        E && E.remote && E.remote.projectPath,
    ];
    for (const c of candidates) {
        if (typeof c === 'string' && c) return c;
    }
    return process.cwd();
}

/**
 * Cổng preview. 2.x không có `Editor.Message.request('server','query-port')`;
 * cổng nằm trong profile và mặc định là 7456.
 */
function previewOrigin() {
    let port = DEFAULT_PREVIEW_PORT;
    const E = ed();
    try {
        const p =
            (E && E.remote && E.remote.Preview && E.remote.Preview.previewPort) ||
            (E && E.Profile && typeof E.Profile.load === 'function'
                ? E.Profile.load('profile://local/settings.json').data
                    && E.Profile.load('profile://local/settings.json').data['preview-port']
                : null);
        if (p) port = p;
    } catch (e) {
        /* chưa sẵn sàng — dùng mặc định */
    }
    return `http://localhost:${port}`;
}

// ─── hộp thoại ────────────────────────────────────────────────────────────────
// Với hộp thoại xác nhận thì FAIL-CLOSED: không hỏi được nghĩa là không xoá.
// Luôn log ra Console trước để kết quả không bao giờ biến mất cùng cái dialog.

/**
 * @returns {number} chỉ số nút, hoặc -1 nếu không hỏi được.
 */
function ask(message, detail, buttons, kind, cancel) {
    const cancelId = typeof cancel === 'number' ? cancel : buttons.length - 1;
    const opts = {
        type: kind === 'warn' ? 'warning' : 'info',
        title: TITLE,
        message,
        detail,
        buttons,
        defaultId: 0,
        cancelId,
        noLink: true,
    };

    const E = ed();
    // 2.x: Editor.Dialog.messageBox trả thẳng chỉ số nút (đồng bộ).
    if (E && E.Dialog && typeof E.Dialog.messageBox === 'function') {
        try {
            const r = E.Dialog.messageBox.call(E.Dialog, opts);
            if (typeof r === 'number') return r;
            if (r && typeof r.response === 'number') return r.response;
        } catch (e) {
            /* thử Electron */
        }
    }
    if (electron && electron.dialog) {
        try {
            if (typeof electron.dialog.showMessageBoxSync === 'function') {
                const r = electron.dialog.showMessageBoxSync(opts);
                if (typeof r === 'number') return r;
            }
        } catch (e) {
            /* rơi xuống dưới */
        }
    }
    errlog(`không mở được hộp thoại: "${message}"`);
    return -1;
}

/** @returns {boolean} true nếu người dùng bấm nút đầu tiên. */
function confirmDanger(message, detail, okLabel) {
    warn(`hỏi xác nhận: ${message}\n${detail}`);
    return ask(message, detail, [okLabel, 'Huỷ'], 'warn') === 0;
}

function info(message, detail, buttons, cancel) {
    log(`${message}\n${detail}`);
    return ask(message, detail, buttons || ['OK'], 'info', cancel);
}

// ─── xoá cache trên đĩa ───────────────────────────────────────────────────────

/**
 * Xoá một hoặc nhiều nhóm trong cache.TARGETS, có xác nhận và báo cáo.
 * @param {string[]} keys khoá của cache.TARGETS
 * @param {string} heading tiêu đề hộp thoại xác nhận
 */
async function clearTargets(keys, heading) {
    const root = projectRoot();
    const groups = keys.map((k) => cache.TARGETS[k]);
    const dirs = groups.reduce((a, g) => a.concat(g.dirs), []);
    const needRestart = groups.some((g) => g.restart);

    const present = dirs
        .map((rel) => Object.assign({ rel }, cache.measure(path.join(root, rel))))
        .filter((r) => r.exists);
    if (!present.length) {
        info('Không có gì để xoá', `${dirs.map((d) => `${d}/`).join(', ')} — chưa tồn tại.`);
        return;
    }

    const totalBytes = present.reduce((a, r) => a + r.bytes, 0);
    const detail = [
        root,
        '',
        ...present.map((r) => `• ${r.rel}/ — ${r.files} file / ${cache.human(r.bytes)}`),
        '',
        ...groups.map((g) => `${g.label}: ${g.detail}`),
        '',
        needRestart ? '⚠ Xong phải KHỞI ĐỘNG LẠI Editor.' : 'Không cần khởi động lại Editor.',
    ].join('\n');

    if (!confirmDanger(`${heading} — thu hồi ${cache.human(totalBytes)}?`, detail, 'Xoá')) return;

    const res = cache.clear(root, dirs);
    // Xoá thật ở nền. Nếu Editor tắt giữa chừng, load() lần sau dọn nốt.
    cache.emptyTrash(root).catch(() => {});

    const lines = [
        ...res.cleared.map((c) => `✔ ${c.rel}/ — ${c.files} file / ${cache.human(c.bytes)}`),
        ...res.errors.map((e) => `✘ ${e.rel}/ — ${e.message}`),
    ];
    if (res.errors.length) {
        info('Xoá xong (có lỗi)', lines.join('\n'));
        return;
    }

    log(`đã thu hồi ${cache.human(res.bytes)} (${res.files} file)`);
    if (!needRestart) {
        info(`Đã thu hồi ${cache.human(res.bytes)}`, lines.join('\n'));
        return;
    }

    const r = ask(
        `Đã thu hồi ${cache.human(res.bytes)} — cần khởi động lại Editor`,
        [...lines, '', 'Mở lại project, Cocos sẽ import lại từ đầu (mất vài phút).'].join('\n'),
        ['Thoát Editor ngay', 'Để tôi tự thoát'],
        'info',
    );
    if (r === 0) quitEditor();
}

function quitEditor() {
    const E = ed();
    const fns = [E && E.App && E.App.quit, E && E.quit, electron && electron.app && electron.app.quit];
    for (const fn of fns) {
        if (typeof fn === 'function') {
            try {
                fn.call(fn === (E && E.quit) ? E : undefined);
                return;
            } catch (e) {
                /* thử cách kế */
            }
        }
    }
    errlog('không thoát được Editor — đóng tay giúp mình.');
}

// ─── save game / localStorage ─────────────────────────────────────────────────

/**
 * Xoá localStorage của preview.
 *
 * Bản 3.x mở một trang `dev-tools.html` phục vụ cùng origin để xoá cả
 * localStorage của trình duyệt ngoài. Trang đó thuộc về project 3.x cụ thể chứ
 * không thuộc extension, nên bản 2.x KHÔNG giả vờ có nó: ở đây chỉ xoá được
 * storage trong phiên Electron của Editor (Game view / cửa sổ preview nội bộ),
 * còn trình duyệt ngoài thì nói thẳng là phải tự xoá.
 */
function clearSave() {
    const origin = previewOrigin();
    const choice = ask(
        'Xoá dữ liệu localStorage của preview?',
        [
            origin,
            '',
            'Xoá storage của preview TRONG Editor (Game view / cửa sổ preview).',
            '',
            '⚠ KHÔNG đụng được tới localStorage của trình duyệt ngoài: nó thuộc',
            'origin của trình duyệt đó. Muốn xoá thì mở preview trên trình duyệt,',
            'bấm F12 → Application → Local Storage → xoá, hoặc gõ',
            'localStorage.clear() trong Console.',
        ].join('\n'),
        ['Xoá storage trong Editor', 'Huỷ'],
        'warn',
    );
    if (choice !== 0) return;

    const notes = [];
    const session = electron && electron.session;
    if (!session || !session.defaultSession) {
        notes.push('✘ không lấy được phiên Electron — chạy ngoài Editor?');
    } else {
        for (const o of [origin, origin.replace('localhost', '127.0.0.1')]) {
            try {
                session.defaultSession.clearStorageData({
                    origin: o,
                    storages: ['localstorage', 'indexdb', 'cachestorage', 'serviceworkers'],
                });
                notes.push(`✔ phiên Editor: đã xoá ${o}`);
            } catch (e) {
                notes.push(`✘ phiên Editor (${o}): ${(e && e.message) || e}`);
            }
        }
    }
    notes.push('', `Trình duyệt ngoài: tự xoá tại ${origin} (F12 → localStorage.clear()).`);
    info('Đã xử lý localStorage', notes.join('\n'));
}

// ─── tiện ích khác ────────────────────────────────────────────────────────────

function designCheatsheet() {
    const origin = previewOrigin();
    const r = ask(
        'Bảng lệnh Dev — mở game rồi bấm F12, gõ dev.help()',
        [
            'Các lệnh `dev.*` do CHÍNH PROJECT định nghĩa (thường ở',
            'assets/scripts/dev/), không phải do extension này cung cấp.',
            'Nếu project chưa có DevKit thì `dev` sẽ undefined.',
            '',
            'Gõ dev.help() trong Console của game để xem danh sách thật.',
            '',
            `Game: ${origin}`,
        ].join('\n'),
        ['Mở game ngay', 'Đóng'],
        'info',
    );
    if (r !== 0) return;
    openExternal(origin);
}

function refreshAssets() {
    const E = ed();
    if (!E || !E.assetdb || typeof E.assetdb.refresh !== 'function') {
        info('Refresh assets không khả dụng', 'Không thấy Editor.assetdb.refresh — chạy ngoài Editor?');
        return;
    }
    try {
        E.assetdb.refresh('db://assets', (err) => {
            if (err) {
                info('Refresh assets lỗi', String((err && err.message) || err));
                return;
            }
            log('đã refresh db://assets');
            info('Đã refresh assets', 'db://assets — Cocos quét lại thay đổi từ ngoài Editor.');
        });
    } catch (e) {
        info('Refresh assets lỗi', String((e && e.message) || e));
    }
}

function openExternal(url) {
    if (!electron || !electron.shell) {
        errlog(`không mở được trình duyệt. Mở tay: ${url}`);
        return;
    }
    log(`mở ${url}`);
    try {
        const r = electron.shell.openExternal(url);
        if (r && typeof r.catch === 'function') r.catch((e) => errlog((e && e.message) || e));
    } catch (e) {
        errlog(`${(e && e.message) || e} — mở tay: ${url}`);
    }
}

function openPreview() {
    openExternal(`${previewOrigin()}/`);
}

function openProjectDir() {
    const root = projectRoot();
    if (!electron || !electron.shell) {
        errlog(`không mở được thư mục. Đường dẫn: ${root}`);
        return;
    }
    // openPath là API mới; 2.x có thể chỉ có openItem.
    const shell = electron.shell;
    if (typeof shell.openPath === 'function') shell.openPath(root);
    else if (typeof shell.openItem === 'function') shell.openItem(root);
    else errlog(`không mở được thư mục. Đường dẫn: ${root}`);
}

function cacheReport() {
    const root = projectRoot();
    const { rows, total } = cache.report(root);
    const detail = [
        root,
        '',
        ...rows.map((r) =>
            r.exists
                ? `${r.rel.padEnd(22)} ${String(r.files).padStart(6)} file   ${cache.human(r.bytes)}`
                : `${r.rel.padEnd(22)}      — chưa có`,
        ),
        '',
        `${'TỔNG'.padEnd(22)} ${String(total.files).padStart(6)} file   ${cache.human(total.bytes)}`,
    ].join('\n');
    // cancel = 0: bấm Esc là đóng, không phải mở thư mục.
    const r = info(`Cache đang chiếm ${cache.human(total.bytes)}`, detail, ['Đóng', 'Mở thư mục project'], 0);
    if (r === 1) openProjectDir();
}

// ─── đăng ký với Editor 2.x ───────────────────────────────────────────────────
// Khoá trong `messages` KHÔNG mang tiền tố package — Editor cắt nó ra trước khi
// dispatch. package.json khai báo "dev-tools:cache-report", ở đây là "cache-report".

module.exports = {
    load() {
        // Dọn nốt rác của lần xoá trước (Editor có thể đã tắt giữa chừng).
        cache
            .emptyTrash(projectRoot())
            .then((n) => {
                if (n) log(`đã dọn ${n} mục rác cache còn sót`);
            })
            .catch(() => {});
    },

    unload() {},

    messages: {
        'cache-report': cacheReport,
        'clear-editor-cache': () => clearTargets(['editor'], 'Xoá cache Editor'),
        'clear-build': () => clearTargets(['build'], 'Xoá thư mục build'),
        'clear-local-config': () => clearTargets(['config'], 'Xoá cấu hình cục bộ'),
        /*
         * ⚠ KHÔNG gộp 'build' vào đây. build/ là thứ DUY NHẤT KHÔNG tái tạo được
         *   ngay: nó chứa bản serialize của mọi asset đã ship. Ai muốn xoá build
         *   thì bấm riêng mục "Xoá thư mục build".
         */
        'clear-all': () => clearTargets(['editor', 'config'], 'Xoá cache Editor + cấu hình'),
        'clear-save': clearSave,
        'design-cheatsheet': designCheatsheet,
        'refresh-assets': refreshAssets,
        'open-preview': openPreview,
        'open-project-dir': openProjectDir,
    },

    // Lộ ra để test chạy được mà không cần Editor.
    _internal: { projectRoot, previewOrigin, ask, clearTargets, cacheReport },
};
