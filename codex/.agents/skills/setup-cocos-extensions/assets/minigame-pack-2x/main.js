'use strict';

// Menu "Build nhanh" cho Cocos Creator 2.x — đóng gói lại build mini-game để
// giảm số file. Bản 3.x nằm ở ../minigame-pack.
//
// KHÁC BIỆT VỀ CÁCH MÓC VÀO BUILD — đọc trước khi sửa:
//
//   3.x: package.json khai báo `contributions.builder = "./hooks.js"`, và
//        builder gọi `onAfterBuild(options, result)`. Có `result.dest`.
//   2.x: KHÔNG có contributions.builder. Package nghe IPC của builder qua
//        `messages`, cụ thể là `builder:build-finished`. Payload của event này
//        lệch nhau giữa các bản vá 2.4, nên ở đây dò `dest`/`buildPath`/
//        `paths.buildDir` rồi mới dùng; không dò ra thì nói thẳng chứ không đoán.
//
// Vì cái móc tự động phụ thuộc vào một event không có hợp đồng ổn định, mục menu
// "Đóng gói lại thư mục build…" luôn tồn tại và là đường đi CHẮC CHẮN đúng:
// nó chỉ cần một thư mục build có game.json, không cần biết gì về builder.

const path = require('path');
const fs = require('fs');
const { packSubpackages, forcePortrait, countFiles, summary, mb } = require('./pack');

const TITLE = 'Mini-game Pack';

// Các nền tảng có khái niệm subpackage. LƯU Ý id: Douyin/TikTok là
// 'bytedance-mini-game', KHÔNG phải 'bytedance'.
const MINIGAME_PLATFORMS = ['wechatgame', 'bytedance-mini-game'];

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
    if (E && typeof E.log === 'function') E.log(`[minigame-pack] ${msg}`);
    else console.log(`[minigame-pack] ${msg}`);
}

function warn(msg) {
    const E = ed();
    if (E && typeof E.warn === 'function') E.warn(`[minigame-pack] ${msg}`);
    else console.warn(`[minigame-pack] ${msg}`);
}

function errlog(msg) {
    const E = ed();
    if (E && typeof E.error === 'function') E.error(`[minigame-pack] ${msg}`);
    else console.error(`[minigame-pack] ${msg}`);
}

function projectRoot() {
    const E = ed();
    const candidates = [
        E && E.Project && E.Project.path,
        E && E.projectInfo && E.projectInfo.path,
        E && E.projectPath,
    ];
    for (const c of candidates) if (typeof c === 'string' && c) return c;
    return process.cwd();
}

function box(kind, message, detail, buttons, cancel) {
    const btns = buttons || ['OK'];
    const opts = {
        type: kind,
        title: TITLE,
        message,
        detail,
        buttons: btns,
        defaultId: 0,
        cancelId: typeof cancel === 'number' ? cancel : btns.length - 1,
        noLink: true,
    };
    const E = ed();
    if (E && E.Dialog && typeof E.Dialog.messageBox === 'function') {
        try {
            const r = E.Dialog.messageBox.call(E.Dialog, opts);
            if (typeof r === 'number') return r;
            if (r && typeof r.response === 'number') return r.response;
        } catch (e) {
            /* thử Electron */
        }
    }
    if (electron && electron.dialog && typeof electron.dialog.showMessageBoxSync === 'function') {
        try {
            return electron.dialog.showMessageBoxSync(opts);
        } catch (e) {
            /* im lặng */
        }
    }
    return -1;
}

// ─── đóng gói ────────────────────────────────────────────────────────────────

/**
 * Đóng gói một thư mục build. Dùng chung cho cả đường tự động và đường thủ công.
 * Luôn log ra Console trước khi mở dialog: dialog có thể không hiện được, kết
 * quả thì không được phép mất.
 *
 * @returns {boolean} true nếu đóng gói xong (kể cả khi không có gì để chuyển)
 */
function packDir(dir, { quiet } = {}) {
    let res;
    try {
        res = packSubpackages(dir);
        forcePortrait(dir);
    } catch (e) {
        const msg = String((e && e.message) || e);
        errlog(`đóng gói lỗi: ${msg}`);
        if (!quiet) box('error', 'Đóng gói lỗi', `${dir}\n\n${msg}`);
        return false;
    }

    const kind = res.settingsKind === 'js' ? 'src/settings.js (2.x)' : 'src/settings.json (3.x)';
    const detail = [
        dir,
        `engine settings: ${kind}`,
        `đã chuyển: ${res.moved.join(', ') || '(không có)'}`,
        res.skipped.length ? `bỏ qua: ${res.skipped.join(', ')}` : null,
        summary(res.stats),
    ].filter(Boolean).join('\n');
    log(detail);

    if (res.stats.mainBytes > 4 * 1024 * 1024) {
        warn(`CẢNH BÁO: gói chính ${mb(res.stats.mainBytes)} > trần 4 MB`);
    }
    if (!quiet) {
        const r = box('info', 'Đóng gói xong', detail, ['Mở thư mục', 'Đóng'], 1);
        if (r === 0) openPath(dir);
    }
    return true;
}

function openPath(p) {
    if (!electron || !electron.shell) {
        log(`thư mục: ${p}`);
        return;
    }
    const shell = electron.shell;
    if (typeof shell.openPath === 'function') shell.openPath(p);
    else if (typeof shell.openItem === 'function') shell.openItem(p);
    else log(`thư mục: ${p}`);
}

/** Chọn thư mục build bằng dialog, rồi đóng gói. */
function packExisting() {
    if (!electron || !electron.dialog || typeof electron.dialog.showOpenDialogSync !== 'function') {
        box('warning', 'Không mở được hộp chọn thư mục',
            'Chạy tay thay thế:\n  node packages/minigame-pack/pack.js <thư-mục-build>');
        return;
    }
    const picked = electron.dialog.showOpenDialogSync({
        title: 'Chọn thư mục build mini-game (chứa game.json)',
        defaultPath: path.join(projectRoot(), 'build'),
        properties: ['openDirectory'],
    });
    if (!picked || !picked.length) return;
    const dir = picked[0];
    if (!fs.existsSync(path.join(dir, 'game.json'))) {
        box('warning', 'Không phải thư mục build mini-game', `Thiếu game.json trong:\n${dir}`);
        return;
    }
    packDir(dir);
}

/**
 * Dò thư mục build ra khỏi payload của `builder:build-finished`.
 * 2.4.x đã từng đặt nó ở vài khoá khác nhau; không dò ra thì trả null.
 */
function resolveBuildDir(payload) {
    if (!payload) return null;
    const direct = [
        payload.dest,
        payload.buildPath,
        payload.paths && payload.paths.buildDir,
        payload.options && payload.options.buildPath,
        payload.result && payload.result.dest,
    ];
    for (const c of direct) {
        if (typeof c === 'string' && c && fs.existsSync(path.join(c, 'game.json'))) return c;
    }
    return null;
}

function platformOf(payload) {
    if (!payload) return null;
    return payload.platform || (payload.options && payload.options.platform) || null;
}

/** Mở panel Build của Editor — đường build chính thống của 2.x. */
function openBuildPanel() {
    const E = ed();
    if (E && E.Panel && typeof E.Panel.open === 'function') {
        try {
            E.Panel.open('builder');
            log('đã mở panel Build. Build xong, extension tự đóng gói (hoặc dùng mục "Đóng gói lại…").');
            return;
        } catch (e) {
            /* rơi xuống dưới */
        }
    }
    box('info', 'Mở panel Build bằng tay',
        'Không mở được panel tự động.\nVào menu Project → Build… rồi build như bình thường.');
}

// ─── đăng ký với Editor 2.x ──────────────────────────────────────────────────

module.exports = {
    load() {},
    unload() {},

    messages: {
        'open-build-panel': openBuildPanel,
        'pack-existing': packExisting,

        /**
         * Móc tự động sau mỗi build. 2.x phát event này tới các package; nếu bản
         * Editor đang dùng không phát, mục menu thủ công vẫn là đường đi đúng.
         */
        'builder:build-finished'(event, payload) {
            const platform = platformOf(payload);
            if (platform && !MINIGAME_PLATFORMS.includes(platform)) return;

            const dir = resolveBuildDir(payload);
            if (!dir) {
                warn('build xong nhưng không dò được thư mục build từ event — '
                    + 'dùng menu "Build nhanh → Đóng gói lại thư mục build mini-game…".');
                return;
            }
            log(`build xong (${platform || 'không rõ nền tảng'}) → đóng gói ${dir}`);
            packDir(dir, { quiet: true });
        },
    },

    _internal: { packDir, resolveBuildDir, platformOf, projectRoot, MINIGAME_PLATFORMS },
};
