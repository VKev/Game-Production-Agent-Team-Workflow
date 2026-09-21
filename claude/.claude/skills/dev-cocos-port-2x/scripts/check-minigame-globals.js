'use strict';

// Tìm global TRÌNH DUYỆT mà runtime mini-game không có.
//
//     node check-minigame-globals.js <build-dir> [source-dir]
//
//     build-dir   thư mục build mini-game (phải có adapter-min.js)
//     source-dir  thư mục script của project, mặc định <build-dir>/../../assets
//
// Vì sao cần cổng riêng: adapter của Cocos chỉ dựng lại MỘT PHẦN môi trường
// trình duyệt. URLSearchParams, URL, TextDecoder, Blob… là API WHATWG — không
// thuộc ECMAScript, nên engine JS trần không có sẵn và adapter cũng không dựng.
// Dùng tới là ReferenceError.
//
// Đây là hạng lỗi CHỈ HIỆN TRÊN MỘT HỆ:
//   - preview trong Editor / devtools: Chromium thật → có đủ → chạy ngon
//   - runtime chạy trong ngữ cảnh WebKit: nhiều cái có sẵn → vẫn ngon
//   - runtime V8 trần: không có → ném
// Nên nó ra thành "iOS chạy, Android không mở được" (hoặc ngược lại).
//
// Nếu chỗ ném nằm trong onLoad của scene khởi động thì scene không nạp xong,
// game không chạy, và không có một dòng log nào.
//
// Danh sách "adapter có gì" đọc THẲNG từ adapter-min.js, không chép tay.

const fs = require('fs');
const path = require('path');

const BUILD = path.resolve(process.argv[2] || '.');
const SOURCE = path.resolve(process.argv[3] || path.join(BUILD, '..', '..', 'assets'));
const ADAPTER = path.join(BUILD, 'adapter-min.js');

// Global của TRÌNH DUYỆT, không phải ECMAScript.
const BROWSER_GLOBALS = [
    'URLSearchParams', 'URL', 'TextDecoder', 'TextEncoder', 'Blob', 'File',
    'FormData', 'Headers', 'Request', 'Response', 'AbortController', 'Event',
    'CustomEvent', 'MutationObserver', 'IntersectionObserver', 'ResizeObserver',
    'Worker', 'SharedWorker', 'BroadcastChannel', 'indexedDB', 'structuredClone',
    'queueMicrotask', 'btoa', 'atob', 'alert', 'confirm', 'prompt', 'matchMedia',
    'getComputedStyle', 'history', 'sessionStorage', 'crypto', 'caches', 'fetch',
];

// Lớp mock của project tự định nghĩa mấy cái này trước khi engine boot.
// Sửa cho khớp project nếu lớp mock khác.
const SUPPLIED_BY_MOCKS = ['fetch'];

if (!fs.existsSync(ADAPTER)) {
    console.error('Không thấy ' + ADAPTER);
    console.error('Cách dùng: node check-minigame-globals.js <build-dir> [source-dir]');
    process.exit(2);
}

function adapterGlobals() {
    const s = fs.readFileSync(ADAPTER, 'utf8');
    const names = new Set();
    for (const m of s.matchAll(/Object\.defineProperty\(n,"([A-Za-z_$][\w$]*)"/g)) names.add(m[1]);
    for (const m of s.matchAll(/(?:^|[,;{])n\.([A-Za-z_$][\w$]*)\s*=/g)) names.add(m[1]);
    for (const t of s.match(/\{[A-Za-z$_][\w$]*:!0(?:,[A-Za-z$_][\w$]*:!0){3,}\}/g) || []) {
        for (const m of t.matchAll(/([A-Za-z_$][\w$]*):!0/g)) names.add(m[1]);
    }
    return names;
}

/** Bỏ chuỗi và chú thích, để "URL" trong một comment không bị tính là lời gọi. */
function stripNoise(src) {
    return src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
        .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
        .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
        .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

function walkJs(dir, out, skipLib) {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) {
            if (skipLib && (e.name === 'lib' || e.name === 'vendor' || e.name === 'node_modules')) continue;
            walkJs(p, out, skipLib);
        } else if (e.name.endsWith('.js')) out.push(p);
    }
    return out;
}

const uses = (code, g) =>
    new RegExp('(?:^|[^\\w.$])(?:new\\s+)?' + g + '\\s*[(.]').test(code);

/**
 * Global chỉ xuất hiện trong thư viện bên thứ ba.
 *
 * jszip/FileSaver dò tính năng có try/catch bọc, hoặc chỉ chạm tới global ở
 * đường code game không bao giờ gọi. Bundle đã minify thì không phân biệt nổi
 * "trong try/catch" hay không → global nào trong source CHỈ thấy ở lib/ thì bỏ
 * qua khi soi bundle. Vẫn bắt được nếu code game bắt đầu dùng nó.
 */
function libOnlyGlobals() {
    const inLib = new Set();
    for (const name of ['lib', 'vendor']) {
        for (const dir of [path.join(SOURCE, 'scripts', name), path.join(SOURCE, 'Script', name)]) {
            for (const f of walkJs(dir, [], false)) {
                const code = stripNoise(fs.readFileSync(f, 'utf8'));
                for (const g of BROWSER_GLOBALS) if (uses(code, g)) inLib.add(g);
            }
        }
    }
    return inLib;
}

/** Bundle đã build — đây mới là thứ thật sự lên máy người chơi. */
function builtBundles() {
    const out = [];
    for (const rel of ['assets/main/index.js', 'assets/internal/index.js']) {
        const p = path.join(BUILD, rel);
        if (fs.existsSync(p)) out.push(p);
    }
    const sub = path.join(BUILD, 'subpackages');
    if (fs.existsSync(sub)) {
        for (const name of fs.readdirSync(sub)) {
            const p = path.join(sub, name, 'game.js');
            if (fs.existsSync(p)) out.push(p);
        }
    }
    const assets = path.join(BUILD, 'assets');
    if (fs.existsSync(assets)) {
        for (const name of fs.readdirSync(assets)) {
            const p = path.join(assets, name, 'index.js');
            if (fs.existsSync(p) && !out.includes(p)) out.push(p);
        }
    }
    return out;
}

const provided = adapterGlobals();
for (const n of SUPPLIED_BY_MOCKS) provided.add(n);

const sourceFiles = walkJs(SOURCE, [], true);
const bundleFiles = builtBundles();
const isBundle = new Set(bundleFiles);
const libOnly = libOnlyGlobals();
const findings = [];

for (const file of sourceFiles.concat(bundleFiles)) {
    const code = stripNoise(fs.readFileSync(file, 'utf8'));
    const rel = path.relative(process.cwd(), file).replace(/\\/g, '/');
    for (const g of BROWSER_GLOBALS) {
        if (provided.has(g)) continue;
        // `typeof X` ở đâu đó trong file = tác giả đã lường trước chuyện vắng mặt
        if (new RegExp('typeof\\s+(?:window\\.)?' + g + '\\b').test(code)) continue;
        if (isBundle.has(file) && libOnly.has(g)) continue;
        if (!uses(code, g)) continue;
        findings.push({ rel, g });
    }
}

console.log('\nminigame · global trình duyệt');
console.log('  adapter dựng ' + provided.size + ' global; đã soi '
    + (sourceFiles.length + bundleFiles.length) + ' file'
    + (bundleFiles.length ? ' (gồm ' + bundleFiles.length + ' bundle đã build)' : '') + '\n');

if (!findings.length) {
    console.log('  ✔ không dùng global nào ngoài những gì runtime có');
    console.log('\nkhông có vấn đề');
    process.exit(0);
}

for (const f of findings) {
    console.log('  ✘ ' + f.rel + ' dùng ' + f.g + ' — runtime mini-game không có global này');
}
console.log('\n' + findings.length + ' chỗ sẽ ném ReferenceError trên runtime không phải trình duyệt');
console.log('Nhắc: sửa source xong PHẢI build lại — bundle mới là thứ lên máy người chơi.');
process.exit(1);
