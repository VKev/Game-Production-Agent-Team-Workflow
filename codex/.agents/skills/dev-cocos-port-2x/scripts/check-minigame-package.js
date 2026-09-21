'use strict';

// Đối chiếu một thư mục build mini-game với thứ nền tảng thật sự kiểm.
//
//     node check-minigame-package.js <build-dir>
//
// Ba thứ, và cả ba đều KHÔNG báo lỗi lúc build:
//
//   1. trần dung lượng  → nền tảng từ chối lúc upload / lúc mở
//   2. require() chết ở tầng gói → gói mang require tĩnh trỏ vào file không có
//   3. cú pháp ES6 trong file nền tảng tự nạp → base library cũ parse không nổi
//
// Triệu chứng chung: "Không thể mở… Đã xảy ra lỗi." — không log, không crash
// report, và simulator của IDE không bao giờ tái hiện được.
//
// Trần theo TikTok Mini Games Technical Overview (engine không phải Unity):
// https://developers.tiktok.com/docs/en/mini-games-technical-overview

const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;
const LIMIT_MAIN = 4 * MB;
const LIMIT_SUBPACKAGE = 4 * MB;
const LIMIT_TOTAL = 30 * MB;

// Ba file nền tảng tự resolve, KHÔNG đi qua shim require của bundle.
const LOADERS = ['game.js', 'main.js', 'ccRequire.js'];

const BUILD = path.resolve(process.argv[2] || '.');

if (!fs.existsSync(path.join(BUILD, 'game.json'))) {
    console.error('Không thấy game.json trong ' + BUILD);
    console.error('Cách dùng: node check-minigame-package.js <build-dir>');
    process.exit(2);
}

const mb = (b) => (b / MB).toFixed(2) + ' MB';

function bytesIn(dir, skip) {
    let total = 0;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (skip && skip(p)) continue;
        total += e.isDirectory() ? bytesIn(p, skip) : fs.statSync(p).size;
    }
    return total;
}

function biggestFiles(dir, n) {
    const out = [];
    (function walk(d) {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) walk(p);
            else out.push({ p: path.relative(BUILD, p), size: fs.statSync(p).size });
        }
    })(dir);
    return out.sort((a, b) => b.size - a.size).slice(0, n);
}

let fail = 0;
function check(name, size, limit) {
    const ok = size <= limit;
    if (!ok) fail++;
    console.log('  ' + (ok ? '✔' : '✘') + ' ' + name.padEnd(22)
        + mb(size).padStart(9) + '   / ' + mb(limit));
}

// ── 1. trần dung lượng ──────────────────────────────────────────────────────
const subRoot = path.join(BUILD, 'subpackages');
const hasSub = fs.existsSync(subRoot);

console.log('\nminigame · trần dung lượng (' + BUILD + ')');
const mainBytes = bytesIn(BUILD, (p) => p === subRoot);
check('gói chính', mainBytes, LIMIT_MAIN);

let subTotal = 0;
if (hasSub) {
    for (const name of fs.readdirSync(subRoot)) {
        const dir = path.join(subRoot, name);
        if (!fs.statSync(dir).isDirectory()) continue;
        const size = bytesIn(dir);
        subTotal += size;
        check('subpackage ' + name, size, LIMIT_SUBPACKAGE);
    }
}
check('tổng cả gói', mainBytes + subTotal, LIMIT_TOTAL);
const sizeFail = fail;

// ── 2. require() chết ───────────────────────────────────────────────────────
//
// Chỉ soi ba file loader. KHÔNG soi bundle đã minify: trong đó require("Tên")
// là tên module của browserify, không phải đường dẫn.
console.log('\nminigame · require() ở tầng gói');
const RE_REQUIRE = /require\(\s*'([^']+)'\s*\)|require\(\s*"([^"]+)"\s*\)/g;
const dead = [];
for (const rel of LOADERS) {
    const file = path.join(BUILD, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = RE_REQUIRE.exec(src)) !== null) {
        const spec = m[1] || m[2];
        if (!spec.includes('/') && !spec.endsWith('.js')) continue; // tên module thuần
        const base = spec.startsWith('.') ? path.dirname(file) : BUILD;
        const target = path.resolve(base, spec);
        if (fs.existsSync(target) || fs.existsSync(target + '.js')) continue;
        dead.push({ file: rel, spec });
    }
}
if (dead.length) {
    fail++;
    for (const d of dead) {
        console.log("  ✘ " + d.file + " → require('" + d.spec + "') — file không có trong gói");
    }
    console.log('      Bundle đã chuyển xuống subpackages/ mà moduleMap chưa được dọn.');
} else {
    console.log('  ✔ ' + LOADERS.join(' / ') + ' không có require chết');
}

// ── 3. cú pháp ES6 ──────────────────────────────────────────────────────────
console.log('\nminigame · cú pháp ES5 ở tầng gói');
const ES6 = [
    ['let/const', /(^|[^\w.$])(let|const)\s+[A-Za-z_$]/m],
    ['arrow function', /=>/],
    ['template literal', /`/],
];
const es6 = [];
for (const rel of LOADERS) {
    const file = path.join(BUILD, rel);
    if (!fs.existsSync(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    for (const [label, re] of ES6) if (re.test(src)) es6.push({ file: rel, label });
}
if (es6.length) {
    fail++;
    for (const e of es6) console.log('  ✘ ' + e.file + ' còn ' + e.label);
    console.log('      "es6": true trong project.config.json CHỈ transpile khi upload qua devtools.');
} else {
    console.log('  ✔ ' + LOADERS.join(' / ') + ' là ES5');
}

if (sizeFail) {
    console.log('\nFile lớn nhất:');
    for (const f of biggestFiles(BUILD, 8)) {
        console.log('  ' + mb(f.size).padStart(9) + '  ' + f.p);
    }
}

console.log('\n' + (fail ? fail + ' hạng mục KHÔNG ĐẠT' : 'tất cả đạt'));
process.exit(fail ? 1 : 0);
