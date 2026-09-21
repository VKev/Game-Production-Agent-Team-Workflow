'use strict';

// Đo và xoá các thư mục cache của project. Không đụng tới Editor API để test
// được bằng node thuần (xem cuối file: chạy `node cache.js <projectRoot>`).

const fs = require('fs');
const path = require('path');

// Rác trung gian. KHÔNG xoá thẳng library/ hay temp/ khi Editor đang mở: asset-db
// vẫn giữ handle và vẫn ghi tiếp, xoá nửa chừng để lại cây thư mục vỡ và Editor
// nổ giữa lúc import. Đổi tên (rename) là thao tác nguyên tử, ăn đứt thư mục ra
// khỏi tầm nhìn của Editor ngay lập tức; xoá thật làm sau ở nền hoặc lần load kế.
// Phải nằm CÙNG Ổ ĐĨA với thư mục nguồn nên đặt ngay trong project root.
const TRASH_DIR = '.dev-tools-trash';

// Chỉ những thư mục này mới được phép xoá. Mọi thứ khác — nhất là assets/ và
// settings/ (cấu hình project dùng chung, có trong git) — không bao giờ đụng tới.
const CLEARABLE = ['library', 'temp', 'build', 'profiles', 'local'];

const TARGETS = {
    editor: {
        label: 'Cache Editor',
        dirs: ['library', 'temp'],
        restart: true,
        detail: 'Cache import asset + file biên dịch tạm. Cocos dựng lại toàn bộ ở lần mở sau (lâu vài phút).',
    },
    build: {
        label: 'Thư mục build',
        dirs: ['build'],
        restart: false,
        detail: 'Output của mọi nền tảng đã build. Xoá để build sạch, không lẫn file cũ.',
    },
    config: {
        label: 'Cấu hình cục bộ',
        dirs: ['profiles', 'local'],
        restart: true,
        detail: 'Layout Editor, cấu hình preview, preset build cục bộ. MẤT các tuỳ chỉnh riêng của máy này (settings/ dùng chung thì không đụng).',
    },
};

function walk(dir, acc) {
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (e) {
        return acc; // không đọc được thì coi như rỗng, đừng làm hỏng cả báo cáo
    }
    for (const e of entries) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            walk(p, acc);
        } else if (e.isFile()) {
            acc.files++;
            try {
                acc.bytes += fs.statSync(p).size;
            } catch (err) {
                /* file biến mất giữa readdir và stat — Editor vẫn đang ghi */
            }
        }
    }
    return acc;
}

/** @returns {{exists: boolean, files: number, bytes: number}} */
function measure(dir) {
    if (!fs.existsSync(dir)) return { exists: false, files: 0, bytes: 0 };
    const acc = walk(dir, { files: 0, bytes: 0 });
    return { exists: true, files: acc.files, bytes: acc.bytes };
}

function human(bytes) {
    if (!bytes) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    let n = bytes;
    while (n >= 1024 && i < units.length - 1) {
        n /= 1024;
        i++;
    }
    return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Báo cáo dung lượng từng thư mục cache + tổng. */
function report(root) {
    const rows = CLEARABLE.map((rel) => ({ rel, ...measure(path.join(root, rel)) }));
    const trash = measure(path.join(root, TRASH_DIR));
    if (trash.exists) rows.push({ rel: `${TRASH_DIR} (chờ xoá)`, ...trash });
    const total = rows.reduce(
        (a, r) => ({ files: a.files + r.files, bytes: a.bytes + r.bytes }),
        { files: 0, bytes: 0 },
    );
    return { rows, total };
}

/**
 * Đẩy một thư mục vào rác bằng rename. Trả về đường dẫn rác, hoặc null nếu
 * thư mục không tồn tại.
 * @throws nếu rel không nằm trong CLEARABLE, hoặc rename thất bại.
 */
function trash(root, rel) {
    if (!CLEARABLE.includes(rel)) throw new Error(`không được phép xoá "${rel}"`);
    const src = path.join(root, rel);
    if (!fs.existsSync(src)) return null;

    const trashRoot = path.join(root, TRASH_DIR);
    fs.mkdirSync(trashRoot, { recursive: true });
    const dest = path.join(trashRoot, `${rel}-${Date.now()}`);
    fs.renameSync(src, dest);
    return dest;
}

/**
 * Đo rồi đẩy vào rác một nhóm thư mục.
 * Lỗi ở một thư mục không chặn các thư mục còn lại — gom vào `errors`.
 */
function clear(root, dirs) {
    const cleared = [];
    const errors = [];
    let files = 0;
    let bytes = 0;
    for (const rel of dirs) {
        const m = measure(path.join(root, rel));
        if (!m.exists) continue;
        try {
            trash(root, rel);
            cleared.push({ rel, files: m.files, bytes: m.bytes });
            files += m.files;
            bytes += m.bytes;
        } catch (e) {
            errors.push({ rel, message: String((e && e.message) || e) });
        }
    }
    return { cleared, errors, files, bytes };
}

/** Xoá thật nội dung thư mục rác. Gọi ở nền, hoặc ở load() lần sau. */
async function emptyTrash(root) {
    const trashRoot = path.join(root, TRASH_DIR);
    if (!fs.existsSync(trashRoot)) return 0;
    let removed = 0;
    let names = [];
    try {
        names = fs.readdirSync(trashRoot);
    } catch (e) {
        return 0;
    }
    for (const name of names) {
        try {
            await fs.promises.rm(path.join(trashRoot, name), { recursive: true, force: true });
            removed++;
        } catch (e) {
            /* còn handle đang mở — để lần load sau dọn nốt */
        }
    }
    try {
        fs.rmdirSync(trashRoot);
    } catch (e) {
        /* chưa rỗng thì giữ lại */
    }
    return removed;
}

module.exports = { TARGETS, TRASH_DIR, CLEARABLE, measure, human, report, trash, clear, emptyTrash };

// Chạy trực tiếp để xem báo cáo mà không cần mở Editor:
//   node extensions/dev-tools/cache.js
if (require.main === module) {
    const root = process.argv[2] || path.resolve(__dirname, '..', '..');
    const r = report(root);
    console.log(root);
    for (const row of r.rows) {
        console.log(`  ${row.rel.padEnd(24)} ${String(row.files).padStart(7)} file  ${human(row.bytes).padStart(10)}`);
    }
    console.log(`  ${'TỔNG'.padEnd(24)} ${String(r.total.files).padStart(7)} file  ${human(r.total.bytes).padStart(10)}`);
}
