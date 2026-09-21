'use strict';

// Nén thư mục build mini-game thành .zip ĐÚNG HÌNH DẠNG để upload.
//
//     node tools/zip-minigame.js [thư-mục-build] [file-zip]
//
// Hai thứ file này lo, và cả hai đều đã cắn một lần rồi:
//
// 1. KHÔNG bọc thêm thư mục. Nền tảng tìm game.json ở NGAY GỐC archive. Nén
//    bằng menu chuột phải của Windows ("Send to > Compressed folder") thì được
//    bytedance.zip chứa bytedance/game.json — tầng 2 — và client không thấy
//    entry point. Ở đây zip nội dung CỦA thư mục, không zip chính thư mục.
//
// 2. Dấu phân cách "/". Đặc tả ZIP bắt buộc "/", nhưng trên Windows cả
//    Compress-Archive của PowerShell 5.1 lẫn ZipFile.CreateFromDirectory của
//    .NET Framework đều ghi "\" (chúng dùng Path.DirectorySeparatorChar). Bộ
//    giải nén nào đúng đặc tả sẽ coi "\" là một phần của TÊN FILE chứ không
//    phải thư mục — ra một gói phẳng với những cái tên như
//    "subpackages\framework\game.js", và không có game.js nào ở đúng chỗ.
//    Đã thử và dính: 271/271 entry sai. Nên tự ghi container ZIP ở đây, luôn "/".
//
// Chạy cổng kiểm tra trước khi nén: không có lý do gì để tạo ra một file zip
// mà ta đã biết là nền tảng sẽ từ chối.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { spawnSync } = require('child_process');

// node zip-minigame.js <build-dir> [out.zip] [source-dir]
const BUILD = path.resolve(process.argv[2] || '.');
const OUT = path.resolve(process.argv[3] || (BUILD.replace(/[\\/]+$/, '') + '.zip'));
const SOURCE = process.argv[4] || '';

function die(msg) {
    console.error('\n✘ ' + msg);
    process.exit(1);
}

if (!fs.existsSync(path.join(BUILD, 'game.json'))) {
    die('Không thấy game.json trong ' + BUILD + ' — đây có phải thư mục build mini-game?');
}

// ─── 1. cổng kiểm tra ────────────────────────────────────────────────────────
for (const checker of ['check-minigame-package.js', 'check-minigame-globals.js']) {
    const script = path.join(__dirname, checker);
    if (!fs.existsSync(script)) continue;
    const args = [script, BUILD];
    if (checker === 'check-minigame-globals.js' && SOURCE) args.push(SOURCE);
    const gate = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (gate.status !== 0) {
        die('Gói build chưa đạt (' + checker + ') — xem bên trên. Không nén.');
    }
}

// ─── 2. nén ──────────────────────────────────────────────────────────────────
if (fs.existsSync(OUT)) fs.unlinkSync(OUT);

const CRC_TABLE = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
}

/** mtime → (giờ, ngày) kiểu DOS. Ngoài khoảng 1980–2107 thì kẹp về 1980. */
function dosTime(d) {
    const y = d.getFullYear();
    if (y < 1980) return { time: 0, date: (1 << 5) | 1 };
    return {
        time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
        date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
    };
}

/** Mọi đường dẫn trong archive: tương đối với BUILD, luôn "/". Thư mục có "/" cuối. */
function collect(dir, prefix, out) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
        const abs = path.join(dir, e.name);
        const rel = prefix + e.name;
        if (e.isDirectory()) {
            out.push({ name: rel + '/', dir: true, abs });
            collect(abs, rel + '/', out);
        } else {
            out.push({ name: rel, dir: false, abs });
        }
    }
    return out;
}

const entries = collect(BUILD, '', []);
const chunks = [];
const central = [];
let offset = 0;

for (const e of entries) {
    const nameBuf = Buffer.from(e.name, 'utf8');
    const raw = e.dir ? Buffer.alloc(0) : fs.readFileSync(e.abs);
    const { time, date } = dosTime(fs.statSync(e.abs).mtime);

    let method = 0;
    let data = raw;
    if (!e.dir && raw.length) {
        const deflated = zlib.deflateRawSync(raw, { level: 9 });
        if (deflated.length < raw.length) { method = 8; data = deflated; }
    }
    const crc = crc32(raw);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);        // version needed
    local.writeUInt16LE(0x0800, 6);    // bit 11: tên entry là UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);           // version made by
    cd.writeUInt16LE(20, 6);           // version needed
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(time, 12);
    cd.writeUInt16LE(date, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt32LE(e.dir ? 0x10 : 0, 38); // thuộc tính ngoài: cờ directory của DOS
    cd.writeUInt32LE(offset, 42);
    central.push(cd, nameBuf);

    offset += local.length + nameBuf.length + data.length;
}

const centralBuf = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0);
end.writeUInt16LE(entries.length, 8);
end.writeUInt16LE(entries.length, 10);
end.writeUInt32LE(centralBuf.length, 12);
end.writeUInt32LE(offset, 16);

fs.writeFileSync(OUT, Buffer.concat([...chunks, centralBuf, end]));

// ─── 3. kiểm lại chính file vừa tạo ──────────────────────────────────────────
//
// Đọc central directory của zip: đếm entry, lấy tên, không cần thư viện ngoài.
const buf = fs.readFileSync(OUT);
const EOCD = 0x06054b50;
let eocd = -1;
for (let i = buf.length - 22; i >= 0 && i > buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
}
if (eocd < 0) die('File zip tạo ra không đọc được central directory.');

const count = buf.readUInt16LE(eocd + 10);
let off = buf.readUInt32LE(eocd + 16);
const names = [];
for (let i = 0; i < count; i++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) break;
    const nLen = buf.readUInt16LE(off + 28);
    const eLen = buf.readUInt16LE(off + 30);
    const cLen = buf.readUInt16LE(off + 32);
    names.push(buf.toString('utf8', off + 46, off + 46 + nLen));
    off += 46 + nLen + eLen + cLen;
}

const problems = [];
if (!names.includes('game.json')) {
    const nested = names.find((n) => n.endsWith('/game.json'));
    problems.push(nested
        ? 'game.json nằm ở "' + nested + '" chứ không phải gốc archive'
        : 'archive không có game.json');
}
for (const need of ['game.js', 'project.config.json']) {
    if (!names.includes(need)) problems.push('thiếu ' + need + ' ở gốc archive');
}
const backslash = names.filter((n) => n.includes('\\'));
if (backslash.length) problems.push(backslash.length + ' entry dùng "\\" thay vì "/"');

if (problems.length) {
    for (const p of problems) console.error('  ✘ ' + p);
    die('File zip sai hình dạng.');
}

const mb = (b) => (b / 1024 / 1024).toFixed(2) + ' MB';
console.log('\n✔ ' + OUT);
console.log('  ' + names.length + ' entry, ' + mb(fs.statSync(OUT).size) + ' (nén)');
console.log('  gốc archive: ' + names.filter((n) => !n.includes('/')).sort().join(', '));
