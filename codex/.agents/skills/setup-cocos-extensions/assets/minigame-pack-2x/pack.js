'use strict';

// minigame-pack (Cocos Creator 2.x) — hậu xử lý thư mục build mini-game để
// GIẢM SỐ FILE. Bản 3.x nằm ở ../minigame-pack.
//
// Ý tưởng giống hệt bản 3.x: Cocos chỉ cho chọn MỘT compressionType cho mỗi
// bundle, nên build kiểu "gộp JSON" rồi TỰ chuyển bundle xuống subpackage:
//   assets/<name>/  →  subpackages/<name>/
//   index.js        →  game.js      (WeChat/Douyin yêu cầu entry tên game.js)
//   game.json       +  { subpackages: [{ name, root }] }
//   settings        +  subpackages: [name]
//
// KHÁC BIỆT THẬT SỰ so với 3.x — đây là lý do file này tồn tại:
//
//   3.x ghi engine settings ra `src/settings.json` (JSON thuần).
//   2.x ghi ra `src/settings.js`, một file JS gán `window._CCSettings = {...};`
//   và danh sách subpackage nằm ở `settings.subpackages` chứ không phải
//   `settings.assets.subpackages`.
//
// Bê nguyên bản 3.x sang 2.x thì nó không thấy `src/settings.json`, ném lỗi và
// dừng — hoặc tệ hơn, nếu ai đó "sửa" bằng cách bỏ qua bước settings thì gói
// build ra vẫn chạy được trên máy dev (bundle còn trong gói chính) và chỉ chết
// khi lên nền tảng thật. Nên ở đây: DÒ cả hai hình dạng, và TỪ CHỐI RÕ RÀNG khi
// không nhận ra hình dạng nào, thay vì ghi bừa.
//
// Chạy tay:  node packages/minigame-pack/pack.js build/wechatgame [bundle...]

const fs = require('fs');
const path = require('path');
const vm = require('vm');

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

// ─── engine settings: 2.x (settings.js) và 3.x (settings.json) ───────────────

/**
 * Đọc engine settings của thư mục build, nhận cả hai hình dạng.
 *
 * @returns {{kind:'js'|'json', file:string, data:object}}
 * @throws nếu không tìm thấy hoặc không parse được — KHÔNG đoán bừa.
 */
function readSettings(buildDir) {
  const jsonPath = path.join(buildDir, 'src', 'settings.json');
  if (fs.existsSync(jsonPath)) {
    return { kind: 'json', file: jsonPath, data: readJson(jsonPath) };
  }

  const jsPath = path.join(buildDir, 'src', 'settings.js');
  if (fs.existsSync(jsPath)) {
    const text = fs.readFileSync(jsPath, 'utf8');
    return { kind: 'js', file: jsPath, data: parseSettingsJs(text, jsPath) };
  }

  throw new Error(
    `Không thấy engine settings trong ${buildDir}: thiếu cả src/settings.json (3.x) lẫn src/settings.js (2.x). `
    + 'Đây có phải thư mục build mini-game không?',
  );
}

/**
 * Bóc object ra khỏi `window._CCSettings = {...};`.
 *
 * Thử JSON.parse trước (2.4 sinh file bằng JSON.stringify nên thường hợp lệ),
 * rơi xuống chạy trong vm sandbox khi đó là object literal của JS (có key không
 * trích dẫn, dấu phẩy thừa...). Sandbox chỉ có `window`, không có require/fs,
 * và đây là file do chính Cocos sinh ra trong thư mục build của người dùng.
 */
function parseSettingsJs(text, file) {
  const m = text.match(/window\._CCSettings\s*=\s*([\s\S]*?);?\s*$/);
  if (!m) throw new Error(`${file}: không nhận ra dạng "window._CCSettings = {...}"`);
  const literal = m[1].trim();
  try {
    return JSON.parse(literal);
  } catch (e) {
    /* không phải JSON thuần — thử vm */
  }
  try {
    const sandbox = { window: {} };
    vm.createContext(sandbox);
    vm.runInContext(`window._CCSettings = ${literal};`, sandbox, { timeout: 5000 });
    const data = sandbox.window._CCSettings;
    if (!data || typeof data !== 'object') throw new Error('kết quả không phải object');
    return data;
  } catch (e) {
    throw new Error(`${file}: không parse được _CCSettings — ${(e && e.message) || e}`);
  }
}

function writeSettings(s) {
  if (s.kind === 'json') {
    // Giữ nguyên thói quen của bản 3.x: ghi compact, không format.
    fs.writeFileSync(s.file, JSON.stringify(s.data));
    return;
  }
  fs.writeFileSync(s.file, `window._CCSettings = ${JSON.stringify(s.data)};`);
}

/**
 * Danh sách subpackage nằm ở hai chỗ khác nhau giữa hai đời engine.
 * Trả về mảng tên (tham chiếu tới chỗ thật để ghi lại đúng nơi).
 */
function subpackageNames(s) {
  if (s.kind === 'json') {
    s.data.assets = s.data.assets || {};
    return Array.isArray(s.data.assets.subpackages) ? s.data.assets.subpackages : [];
  }
  return Array.isArray(s.data.subpackages) ? s.data.subpackages : [];
}

function setSubpackageNames(s, names) {
  if (s.kind === 'json') {
    s.data.assets = s.data.assets || {};
    s.data.assets.subpackages = names;
    return;
  }
  s.data.subpackages = names;
}

// ─── đóng gói ────────────────────────────────────────────────────────────────

/**
 * Chuyển các bundle đã build kiểu gộp JSON thành subpackage của mini-game.
 * Idempotent: chạy lại trên thư mục đã đóng gói thì bỏ qua.
 *
 * @param {string} buildDir  thư mục build (chứa game.json)
 * @param {string[]} bundles tên bundle cần đưa xuống subpackage (mặc định: mọi
 *                           bundle trong assets/ trừ internal & main)
 * @returns {{moved: string[], skipped: string[], stats: object, settingsKind: string}}
 */
function packSubpackages(buildDir, bundles) {
  const gameJsonPath = path.join(buildDir, 'game.json');
  if (!fs.existsSync(gameJsonPath)) {
    throw new Error(`Không thấy game.json trong ${buildDir} — đây có phải thư mục build mini-game?`);
  }
  // Ném sớm nếu settings không nhận dạng được: thà dừng trước khi di chuyển file.
  const settings = readSettings(buildDir);

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
    if (fs.existsSync(dst)) rmrfSync(dst);
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

  // game.json — khai báo subpackage cho nền tảng (giống nhau ở 2.x và 3.x)
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

  // engine settings — 2.x: settings.subpackages, 3.x: settings.assets.subpackages
  const sp = new Set(subpackageNames(settings));
  for (const name of names) {
    if (fs.existsSync(path.join(subDir, name))) sp.add(name);
  }
  setSubpackageNames(settings, [...sp]);
  writeSettings(settings);

  const after = countFiles(buildDir);
  const sub = countFiles(subDir);
  const stats = {
    totalFiles: after.files,
    totalBytes: after.bytes,
    mainFiles: after.files - sub.files,
    mainBytes: after.bytes - sub.bytes,
    subFiles: sub.files,
    subBytes: sub.bytes,
    beforeFiles: before.files,
  };
  return { moved, skipped, stats, settingsKind: settings.kind };
}

/** Xoá đệ quy, chạy được trên Node cũ mà Creator 2.4 nhúng. */
function rmrfSync(target) {
  if (typeof fs.rmSync === 'function') {
    fs.rmSync(target, { recursive: true, force: true });
    return;
  }
  try {
    fs.rmdirSync(target, { recursive: true });
  } catch (e) {
    for (const name of fs.readdirSync(target)) {
      const p = path.join(target, name);
      if (fs.lstatSync(p).isDirectory()) rmrfSync(p);
      else fs.unlinkSync(p);
    }
    fs.rmdirSync(target);
  }
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
 * Lựa chọn hướng máy nằm ở UI panel Build trên máy người build, không nằm trong
 * repo — ai lỡ đổi dropdown một lần là ra bản landscape mà git không nói gì.
 * Vá ở đây thì hướng máy thuộc về repo.
 *
 * ⚠ PHẢI gọi SAU `packSubpackages`: hàm đó ghi đè game.json để khai báo
 * subpackages. Sửa trước là mất trắng.
 *
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

module.exports = {
  packSubpackages,
  forcePortrait,
  countFiles,
  summary,
  mb,
  readSettings,
  writeSettings,
  parseSettingsJs,
  subpackageNames,
  setSubpackageNames,
};

if (require.main === module) {
  const [, , dir, ...rest] = process.argv;
  if (!dir) {
    console.error('Cách dùng: node packages/minigame-pack/pack.js <thư-mục-build> [tên-bundle...]');
    process.exit(1);
  }
  const r = packSubpackages(path.resolve(dir), rest);
  forcePortrait(path.resolve(dir));
  console.log(`[minigame-pack] engine settings: ${r.settingsKind === 'js' ? 'src/settings.js (2.x)' : 'src/settings.json (3.x)'}`);
  console.log(`[minigame-pack] đã chuyển: ${r.moved.join(', ') || '(không có)'}`);
  if (r.skipped.length) console.log(`[minigame-pack] bỏ qua: ${r.skipped.join(', ')}`);
  console.log(`[minigame-pack] ${summary(r.stats)}`);
}
