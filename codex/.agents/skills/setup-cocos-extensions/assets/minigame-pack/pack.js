'use strict';

// minigame-pack — hậu xử lý thư mục build mini-game để GIẢM SỐ FILE.
//
// Vì sao cần: Cocos chỉ cho chọn MỘT compressionType cho mỗi bundle.
//   - "subpackage" → bundle nằm ở subpackages/<name>/ (lách trần 4MB gói chính)
//     nhưng KHÔNG gộp JSON → mỗi asset 1 file .json (ở đây: 1434 file).
//   - "merge_all_json" → gộp toàn bộ JSON còn 1 pack (còn ~10 file .json)
//     nhưng bundle nằm trong gói chính assets/<name>/ → vỡ trần 4MB.
// Script này build kiểu merge_all_json rồi TỰ chuyển bundle sang subpackage:
//   assets/<name>/  →  subpackages/<name>/
//   index.js        →  game.js            (WeChat/Douyin yêu cầu entry tên game.js)
//   game.json       +  { subpackages: [{ name, root }] }
//   src/settings.json + assets.subpackages = [name]
// Runtime engine (platforms/minigame/common/engine/AssetManager.js) đọc đúng
// settings.assets.subpackages → loadSubpackage(name) → tải subpackages/<name>/config.json
// và set base = "subpackages/<name>/", nên layout sau khi chuyển là hợp lệ.
//
// Chạy tay:  node extensions/minigame-pack/pack.js build/wechat-merged2 [bundle...]

const fs = require('fs');
const path = require('path');

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, `${JSON.stringify(data, null, 4)}\n`);
}

function countFiles(dir) {
  if (!fs.existsSync(dir)) return { files: 0, bytes: 0 };
  let files = 0;
  let bytes = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      const r = countFiles(p);
      files += r.files; bytes += r.bytes;
    } else {
      files += 1; bytes += fs.statSync(p).size;
    }
  }
  return { files, bytes };
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;

/**
 * Chuyển các bundle đã build kiểu merge_all_json thành subpackage của mini-game.
 * Idempotent: chạy lại trên thư mục đã đóng gói thì bỏ qua.
 *
 * @param {string} buildDir  thư mục build (chứa game.json)
 * @param {string[]} bundles tên bundle cần đưa xuống subpackage (mặc định: mọi
 *                           bundle trong assets/ trừ internal & main)
 * @returns {{moved: string[], skipped: string[], stats: object}}
 */
function packSubpackages(buildDir, bundles) {
  const gameJsonPath = path.join(buildDir, 'game.json');
  const settingsPath = path.join(buildDir, 'src', 'settings.json');
  if (!fs.existsSync(gameJsonPath)) throw new Error(`Không thấy game.json trong ${buildDir} — đây có phải thư mục build mini-game?`);
  if (!fs.existsSync(settingsPath)) throw new Error(`Không thấy src/settings.json trong ${buildDir}`);

  const assetsDir = path.join(buildDir, 'assets');
  const subDir = path.join(buildDir, 'subpackages');

  let names = bundles && bundles.length ? bundles.slice() : null;
  if (!names) {
    names = fs.existsSync(assetsDir)
      ? fs.readdirSync(assetsDir, { withFileTypes: true })
        .filter((e) => e.isDirectory() && e.name !== 'internal' && e.name !== 'main')
        .map((e) => e.name)
      : [];
  }

  const before = countFiles(buildDir);
  const moved = [];
  const skipped = [];

  for (const name of names) {
    const src = path.join(assetsDir, name);
    const dst = path.join(subDir, name);
    if (!fs.existsSync(src)) {
      // đã đóng gói từ trước → không coi là lỗi
      skipped.push(`${name} (không có assets/${name}${fs.existsSync(dst) ? ', đã là subpackage' : ''})`);
      continue;
    }
    if (fs.existsSync(dst)) fs.rmSync(dst, { recursive: true, force: true });
    fs.mkdirSync(subDir, { recursive: true });
    fs.renameSync(src, dst);

    // WeChat/Douyin nạp subpackage bằng cách chạy <root>/game.js.
    // Bundle thường build ra index.js (hoặc index.<md5>.js khi bật MD5 Cache).
    for (const f of fs.readdirSync(dst)) {
      if (/^index(\.[0-9a-f]+)?\.js$/.test(f)) {
        fs.renameSync(path.join(dst, f), path.join(dst, f.replace(/^index/, 'game')));
      }
    }
    moved.push(name);
  }

  // game.json — khai báo subpackage cho nền tảng
  const gameJson = readJson(gameJsonPath);
  const list = Array.isArray(gameJson.subpackages) ? gameJson.subpackages : [];
  for (const name of names) {
    if (!fs.existsSync(path.join(subDir, name))) continue;
    const root = `subpackages/${name}/`;
    const found = list.find((x) => x && x.name === name);
    if (found) found.root = root;
    else list.push({ name, root });
  }
  if (list.length) gameJson.subpackages = list;
  writeJson(gameJsonPath, gameJson);

  // src/settings.json — engine đọc assets.subpackages để biết bundle nào là subpackage
  const settings = readJson(settingsPath);
  settings.assets = settings.assets || {};
  const sp = new Set(settings.assets.subpackages || []);
  for (const name of names) {
    if (fs.existsSync(path.join(subDir, name))) sp.add(name);
  }
  settings.assets.subpackages = [...sp];
  fs.writeFileSync(settingsPath, JSON.stringify(settings));

  const after = countFiles(buildDir);
  const mainPkg = {
    files: after.files - countFiles(subDir).files,
    bytes: after.bytes - countFiles(subDir).bytes,
  };
  const stats = {
    totalFiles: after.files,
    totalBytes: after.bytes,
    mainFiles: mainPkg.files,
    mainBytes: mainPkg.bytes,
    subFiles: countFiles(subDir).files,
    subBytes: countFiles(subDir).bytes,
    beforeFiles: before.files,
  };
  return { moved, skipped, stats };
}

function summary(stats) {
  return [
    `tổng ${stats.totalFiles} file / ${mb(stats.totalBytes)}`,
    `gói chính ${stats.mainFiles} file / ${mb(stats.mainBytes)}`,
    `subpackage ${stats.subFiles} file / ${mb(stats.subBytes)}`,
  ].join(' — ');
}

/**
 * Ghim `deviceOrientation: "portrait"` trong game.json của bản build mini-game.
 *
 * Giá trị này do dropdown "Device Orientation" của panel Build sinh ra, mà lựa
 * chọn đó KHÔNG nằm trong repo: profiles/v2/packages/builder.json chỉ giữ
 * splash/texture/bundle, còn taskMap thì browser.js xoá sau mỗi lần build. Nên
 * ai lỡ đổi dropdown một lần là ra bản landscape mà không có gì trong git nói
 * lên điều đó. Vá ở đây thì hướng máy thuộc về repo, không thuộc về trạng thái
 * UI trên máy người build.
 *
 * ⚠ PHẢI gọi SAU `packSubpackages`: hàm đó ghi đè game.json để khai báo
 * subpackages. Sửa trước là mất trắng. Và chỉ đụng đúng MỘT khoá — phần còn lại
 * đọc lên ghi xuống nguyên vẹn — để không đá vào danh sách subpackages vừa sinh.
 *
 * @param {string} buildDir thư mục build (chứa game.json)
 * @returns {boolean} true nếu đã phải sửa
 */
function forcePortrait(buildDir) {
  const p = path.join(buildDir, 'game.json');
  if (!fs.existsSync(p)) return false;
  const game = readJson(p);
  if (game.deviceOrientation === 'portrait') return false;
  console.warn(`[minigame-pack] deviceOrientation = "${game.deviceOrientation}" → ép về "portrait"`);
  game.deviceOrientation = 'portrait';
  writeJson(p, game);
  return true;
}

module.exports = { packSubpackages, forcePortrait, countFiles, summary, mb };

if (require.main === module) {
  const [, , dir, ...rest] = process.argv;
  if (!dir) {
    console.error('Cách dùng: node extensions/minigame-pack/pack.js <thư-mục-build> [tên-bundle...]');
    process.exit(1);
  }
  const r = packSubpackages(path.resolve(dir), rest);
  forcePortrait(path.resolve(dir));
  console.log(`[minigame-pack] đã chuyển: ${r.moved.join(', ') || '(không có)'}`);
  if (r.skipped.length) console.log(`[minigame-pack] bỏ qua: ${r.skipped.join(', ')}`);
  console.log(`[minigame-pack] ${summary(r.stats)}`);
}
