'use strict';

// Menu "Dev nhanh" trên thanh menu Editor: xoá cache, xoá save game, refresh
// asset, mở preview. Xem README.md để biết mỗi mục đụng vào đâu.

const path = require('path');
const { shell, dialog, session } = require('electron');
const cache = require('./cache');

const TITLE = 'Dev nhanh';
const PAGE = 'dev-tools.html'; // nằm ở preview-template/, server preview phục vụ tại gốc

function projectRoot() {
    return (Editor && Editor.Project && Editor.Project.path) || process.cwd();
}

/** Cổng preview do package `server` cấp; mặc định Cocos là 7456. */
async function previewOrigin() {
    let port = 7456;
    try {
        const p = await Editor.Message.request('server', 'query-port');
        if (p) port = p;
    } catch (e) {
        /* server chưa sẵn sàng — dùng cổng mặc định */
    }
    return `http://localhost:${port}`;
}

// ─── hộp thoại ────────────────────────────────────────────────────────────────
// Editor.Dialog trong tiến trình extension đôi khi ném "[Window] parameter error"
// (đã gặp ở minigame-pack). Luôn log ra Console trước, rồi thử Editor.Dialog và
// rơi xuống dialog Electron. Với hộp thoại xác nhận thì FAIL-CLOSED: không hỏi
// được nghĩa là không xoá.

/**
 * @param {number} [cancel] nút ứng với Esc; mặc định là nút cuối.
 * @returns {Promise<number>} chỉ số nút, hoặc -1 nếu không hỏi được.
 */
async function ask(message, detail, buttons, kind, cancel) {
    const cancelId = typeof cancel === 'number' ? cancel : buttons.length - 1;
    try {
        // .call: đừng tách hàm khỏi Editor.Dialog, nó dùng `this`.
        const fn = kind === 'warn' ? Editor.Dialog.warn : Editor.Dialog.info;
        const r = await fn.call(Editor.Dialog, message, {
            title: TITLE, detail, buttons, default: 0, cancel: cancelId,
        });
        if (r && typeof r.response === 'number') return r.response;
    } catch (e) {
        /* thử Electron */
    }
    try {
        const r = await dialog.showMessageBox({
            type: kind === 'warn' ? 'warning' : 'info',
            message,
            detail,
            buttons,
            defaultId: 0,
            cancelId,
        });
        if (r && typeof r.response === 'number') return r.response;
    } catch (e) {
        console.error(`[dev-tools] không mở được hộp thoại: ${(e && e.message) || e}`);
    }
    return -1;
}

/** @returns {Promise<boolean>} true nếu người dùng bấm nút đầu tiên. */
async function confirmDanger(message, detail, okLabel) {
    console.warn(`[dev-tools] hỏi xác nhận: ${message}\n${detail}`);
    return (await ask(message, detail, [okLabel, 'Huỷ'], 'warn')) === 0;
}

async function info(message, detail, buttons, cancel) {
    console.log(`[dev-tools] ${message}\n${detail}`);
    return ask(message, detail, buttons || ['OK'], 'info', cancel);
}

// ─── xoá cache trên đĩa ───────────────────────────────────────────────────────

/** Còn build đang chạy thì xoá build/ giữa chừng sẽ hỏng output. */
async function builderBusy() {
    try {
        const t = await Editor.Message.request('builder', 'query-tasks-info');
        if (t && t.free === false) return true;
        const q = (t && t.queue) || {};
        return Object.values(q).some((x) => x.state === 'processing' || x.state === 'waiting');
    } catch (e) {
        return false;
    }
}

/**
 * Xoá một hoặc nhiều nhóm trong cache.TARGETS, có xác nhận và báo cáo.
 * @param {string[]} keys khoá của cache.TARGETS
 * @param {string} heading tiêu đề hộp thoại xác nhận
 */
async function clearTargets(keys, heading) {
    const root = projectRoot();
    const groups = keys.map((k) => cache.TARGETS[k]);
    const dirs = groups.flatMap((g) => g.dirs);
    const needRestart = groups.some((g) => g.restart);

    if (dirs.includes('build') && (await builderBusy())) {
        await info('Đang có build chạy', 'Chờ build xong rồi xoá, không thì output hỏng.');
        return;
    }

    const present = dirs
        .map((rel) => ({ rel, ...cache.measure(path.join(root, rel)) }))
        .filter((r) => r.exists);
    if (!present.length) {
        await info('Không có gì để xoá', `${dirs.map((d) => `${d}/`).join(', ')} — chưa tồn tại.`);
        return;
    }

    const totalBytes = present.reduce((a, r) => a + r.bytes, 0);
    const totalFiles = present.reduce((a, r) => a + r.files, 0);
    const detail = [
        root,
        '',
        ...present.map((r) => `• ${r.rel}/ — ${r.files} file / ${cache.human(r.bytes)}`),
        '',
        ...groups.map((g) => `${g.label}: ${g.detail}`),
        '',
        needRestart ? '⚠ Xong phải KHỞI ĐỘNG LẠI Editor.' : 'Không cần khởi động lại Editor.',
    ].join('\n');

    if (!(await confirmDanger(`${heading} — thu hồi ${cache.human(totalBytes)}?`, detail, 'Xoá'))) return;

    const res = cache.clear(root, dirs);
    // Xoá thật ở nền. Nếu Editor tắt giữa chừng, load() lần sau dọn nốt.
    cache.emptyTrash(root).catch(() => {});

    const lines = [
        ...res.cleared.map((c) => `✔ ${c.rel}/ — ${c.files} file / ${cache.human(c.bytes)}`),
        ...res.errors.map((e) => `✘ ${e.rel}/ — ${e.message}`),
    ];
    if (res.errors.length) {
        await info('Xoá xong (có lỗi)', lines.join('\n'));
        return;
    }

    console.log(`[dev-tools] đã thu hồi ${cache.human(res.bytes)} (${res.files} file)`);
    if (!needRestart) {
        await info(`Đã thu hồi ${cache.human(res.bytes)}`, lines.join('\n'));
        return;
    }

    const r = await ask(
        `Đã thu hồi ${cache.human(res.bytes)} — cần khởi động lại Editor`,
        [...lines, '', 'Mở lại project, Cocos sẽ import lại từ đầu (mất vài phút).'].join('\n'),
        ['Thoát Editor ngay', 'Để tôi tự thoát'],
        'info',
    );
    if (r === 0) {
        try {
            Editor.App.quit();
        } catch (e) {
            console.error(`[dev-tools] không thoát được Editor: ${(e && e.message) || e}`);
        }
    }
}

// ─── save game / localStorage ─────────────────────────────────────────────────

/**
 * localStorage của preview nằm ở HAI nơi tách biệt:
 *  · trình duyệt ngoài (Preview → browser)  → chỉ trang dev-tools.html chạy
 *    cùng origin mới xoá được, nên ta mở nó ra;
 *  · phiên Electron của Editor (Game view / cửa sổ preview nội bộ) → xoá bằng
 *    session.clearStorageData.
 * Một nút bấm không với tới cả hai, nên làm cả hai và nói rõ trong hộp thoại.
 */
async function clearSave() {
    const origin = await previewOrigin();
    const choice = await ask(
        'Xoá dữ liệu localStorage của preview?',
        [
            origin,
            '',
            'Reset tiến độ: xoá tài khoản, tiền, trang bị, chương đã qua — GIỮ âm lượng,',
            'rung, và cờ DEBUG_MODE / DEBUG_MAP / DEBUG_GAME_SPEED.',
            '',
            'Xoá sạch: bỏ mọi khoá, kể cả cài đặt và cờ debug.',
            '',
            'Cả hai đều mở bảng Dev trong trình duyệt để thao tác đúng origin.',
            'Riêng "Xoá sạch" xoá thêm localStorage của Game view trong Editor.',
        ].join('\n'),
        ['Reset tiến độ (giữ cài đặt)', 'Xoá sạch tất cả', 'Huỷ'],
        'warn',
    );
    if (choice !== 0 && choice !== 1) return;

    const wipe = choice === 1;
    const notes = [];

    if (wipe) {
        for (const o of [origin, origin.replace('localhost', '127.0.0.1')]) {
            try {
                await session.defaultSession.clearStorageData({
                    origin: o,
                    storages: ['localstorage', 'indexdb', 'cachestorage', 'serviceworkers'],
                });
                notes.push(`✔ phiên Editor: đã xoá ${o}`);
            } catch (e) {
                notes.push(`✘ phiên Editor (${o}): ${(e && e.message) || e}`);
            }
        }
    }

    const url = `${origin}/${PAGE}?auto=${wipe ? 'wipe' : 'reset'}`;
    try {
        await shell.openExternal(url);
        notes.push(`✔ đã mở ${url}`);
    } catch (e) {
        notes.push(`✘ không mở được trình duyệt: ${(e && e.message) || e}`);
        notes.push(`   Mở tay: ${url}`);
    }
    await info(wipe ? 'Đã xoá sạch localStorage' : 'Đã reset tiến độ', notes.join('\n'));
}

// ─── tiện ích khác ────────────────────────────────────────────────────────────

// ─── bảng lệnh cho Game Design ────────────────────────────────────────────────

/**
 * Mở game preview rồi hiện danh sách lệnh `dev.*`.
 *
 * Vì sao là lệnh Console chứ không phải nút bấm trong Editor: save game đi qua
 * `privacy.encodeFromJson` (mã hoá + md5). Ghi thẳng từ ngoài phải dựng lại
 * thuật toán đó — sai một nhịp là hỏng save. `dev.*` chạy TRONG game nên gọi
 * đúng hàm gốc (`adventure.start`, `net.updateData`…), dữ liệu luôn hợp lệ.
 * Định nghĩa: assets/scripts/dev/DevKit.ts
 */
async function designCheatsheet() {
    const origin = await previewOrigin();
    const r = await ask(
        'Bảng lệnh Dev — mở game rồi bấm F12, gõ dev.help()',
        [
            'MÀN CHƠI',
            '  dev.levels()                bảng chương/màn',
            '  dev.chapter(0)              vào chương 1',
            '  dev.level(0, 3)             chương 1, màn 4',
            '  dev.train()   dev.ball(0)   chế độ khác',
            '',
            'TIỀN & ĐỒ',
            '  dev.wallet()                số dư',
            '  dev.give(DIAMOND, 1000)     cộng vào tài khoản',
            '  dev.giveInRun(GOLD, 500)    cộng trong trận',
            '  dev.equip("machine_gun", 5) đặt số lượng trang bị',
            '',
            'TIẾN ĐỘ',
            '  dev.clearRun()              xoá lượt dang dở',
            '  dev.skipTutorial()          bỏ hướng dẫn',
            '  dev.unlockStage(50)         mở khoá tới màn 50',
            '',
            'DỮ LIỆU CỤC BỘ',
            '  dev.storage()               liệt kê localStorage',
            '  dev.clearStorage()          xoá tiến độ, giữ cài đặt',
            '  dev.clearStorage(true)      xoá sạch',
            '',
            'TRONG TRẬN',
            '  dev.god()   dev.speed(3)   dev.killAll()',
            '',
            `Game: ${origin}`,
        ].join('\n'),
        ['Mở game ngay', 'Đóng'],
        'info',
    );
    if (r !== 0) return;
    try {
        await shell.openExternal(origin);
    } catch (e) {
        await info('Không mở được trình duyệt', `Mở tay: ${origin}`);
    }
}

async function refreshAssets() {
    try {
        await Editor.Message.request('asset-db', 'refresh-asset', 'db://assets');
        console.log('[dev-tools] đã refresh db://assets');
        await info('Đã refresh assets', 'db://assets — Cocos quét lại thay đổi từ ngoài Editor.');
    } catch (e) {
        await info('Refresh assets lỗi', String((e && e.message) || e));
    }
}

async function openDevPage() {
    const url = `${await previewOrigin()}/${PAGE}`;
    console.log(`[dev-tools] mở ${url}`);
    shell.openExternal(url).catch((e) => console.error(`[dev-tools] ${(e && e.message) || e}`));
}

async function openPreview() {
    const url = `${await previewOrigin()}/`;
    console.log(`[dev-tools] mở ${url}`);
    shell.openExternal(url).catch((e) => console.error(`[dev-tools] ${(e && e.message) || e}`));
}

function openProjectDir() {
    shell.openPath(projectRoot());
}

async function cacheReport() {
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
    // cancel = 0: bấm Esc là đóng, không phải mở Finder.
    const r = await info(`Cache đang chiếm ${cache.human(total.bytes)}`, detail, ['Đóng', 'Mở thư mục project'], 0);
    if (r === 1) shell.openPath(root);
}

module.exports = {
    load() {
        // Dọn nốt rác của lần xoá trước (Editor có thể đã tắt giữa chừng).
        cache.emptyTrash(projectRoot()).then((n) => {
            if (n) console.log(`[dev-tools] đã dọn ${n} mục rác cache còn sót`);
        }).catch(() => {});
    },
    unload() {},
    methods: {
        cacheReport,
        clearEditorCache: () => clearTargets(['editor'], 'Xoá cache Editor'),
        clearBuild: () => clearTargets(['build'], 'Xoá thư mục build'),
        clearLocalConfig: () => clearTargets(['config'], 'Xoá cấu hình cục bộ'),
        /*
         * ⚠ KHÔNG gộp 'build' vào đây. build/ là thứ DUY NHẤT KHÔNG tái tạo được
         *   ngay: nó chứa bản serialize của mọi asset đã ship, và đã có lần là
         *   nguồn khôi phục duy nhất khi một prefab nguồn bị hỏng (2026-08-01).
         *   Ai muốn xoá build thì bấm riêng mục "Xoá thư mục build".
         */
        clearAll: () => clearTargets(['editor', 'config'], 'Xoá cache Editor + cấu hình'),
        clearSave,
        designCheatsheet,
        refreshAssets,
        openDevPage,
        openPreview,
        openProjectDir,
    },
};
