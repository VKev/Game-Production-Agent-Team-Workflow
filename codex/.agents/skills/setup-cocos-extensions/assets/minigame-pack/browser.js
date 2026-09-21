'use strict';

// Menu "Build nhanh" → build mini-game (WeChat / Douyin) rồi báo số file.
// Việc đóng gói lại subpackage do hooks.js làm tự động sau mỗi build.

const { shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { countFiles, packSubpackages, forcePortrait, summary, mb } = require('./pack');

function projectRoot() {
  return (Editor && Editor.Project && Editor.Project.path) || process.cwd();
}

async function queryTasks() {
  try { return await Editor.Message.request('builder', 'query-tasks-info'); }
  catch (e) { return null; }
}

async function isBusy() {
  const info = await queryTasks();
  if (info && info.free === false) return true;
  const q = (info && info.queue) || {};
  return Object.values(q).some((t) => t.state === 'processing' || t.state === 'waiting');
}

// Bỏ task cũ cùng platform để builder giữ nguyên outputName (không thêm hậu tố -001).
async function clearPlatformTasks(platform) {
  try {
    const info = await queryTasks();
    const q = (info && info.queue) || {};
    for (const [id, t] of Object.entries(q)) {
      const plat = t.options && t.options.platform;
      if (plat === platform && t.state !== 'processing' && t.state !== 'waiting') {
        try { await Editor.Message.request('builder', 'remove-task', id); } catch (e) { /* ignore */ }
      }
    }
  } catch (e) { /* ignore */ }
}

// Mọi .scene trừ công cụ dev trong assets/editor-tools/.
async function resolveScenes() {
  try {
    const list = await Editor.Message.request('asset-db', 'query-assets', { pattern: 'db://assets/**/*.scene' });
    const skip = `${'editor'}-tools/`;
    const scenes = (list || [])
      .filter((a) => a && a.url && a.uuid && a.url.indexOf(skip) === -1)
      .map((a) => ({ url: a.url, uuid: a.uuid }));
    return scenes.length ? scenes : null;
  } catch (e) { return null; }
}

async function resolveStartScene() {
  try {
    const u = await Editor.Message.request('asset-db', 'query-uuid', 'db://assets/scenes/main.scene');
    if (u) return u;
  } catch (e) { /* ignore */ }
  try { return await Editor.Profile.getProject('project', 'general.startScene'); } catch (e) { return undefined; }
}

async function runBuild(platform, label) {
  if (await isBusy()) {
    Editor.Dialog.warn('Đang có build khác chạy', { title: 'Mini-game Pack', detail: 'Chờ build hiện tại xong rồi bấm lại.' });
    return;
  }
  const outDir = path.join(projectRoot(), 'build', platform);
  const t0 = Date.now();
  const before = await queryTasks();
  const beforeIds = new Set(Object.keys((before && before.queue) || {}));

  await clearPlatformTasks(platform);
  const opts = { platform, outputName: platform, taskName: platform };
  const startScene = await resolveStartScene();
  if (startScene) opts.startScene = startScene;
  const scenes = await resolveScenes();
  if (scenes) opts.scenes = scenes;

  console.log(`[minigame-pack] build ${platform} → build/${platform} ...`);
  try {
    await Editor.Message.request('builder', 'add-task', opts);
  } catch (e) {
    Editor.Dialog.error(`Không khởi động được build ${platform}`, { title: 'Mini-game Pack', detail: String((e && e.message) || e) });
    return;
  }

  let newId = null;
  const afterQ = ((await queryTasks()) || {}).queue || {};
  for (const id of Object.keys(afterQ)) if (!beforeIds.has(id)) { newId = id; break; }

  const poll = async () => {
    const info = await queryTasks();
    const q = (info && info.queue) || {};
    let task = newId ? q[newId] : null;
    if (!task) task = Object.values(q).filter((t) => t.options && t.options.platform === platform).pop();
    if (task && (task.state === 'processing' || task.state === 'waiting')) { setTimeout(poll, 1000); return; }
    if (task && (task.state === 'error' || task.state === 'failure')) {
      Editor.Dialog.error(`Build ${label} lỗi`, { title: 'Mini-game Pack', detail: task.message || 'Xem Console.' });
      return;
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(0);
    // Đóng gói lại ngay tại đây, không chỉ dựa vào hooks.js: build hook chỉ được
    // builder nạp khi extension có mặt lúc Editor khởi động. packSubpackages là
    // idempotent nên nếu hook đã chạy rồi thì lệnh này không làm gì.
    try {
      const res = packSubpackages(outDir);
      forcePortrait(outDir);
      if (res.moved.length) console.log(`[minigame-pack] đóng gói: ${res.moved.join(', ')}`);
    } catch (e) {
      Editor.Dialog.error('Build xong nhưng đóng gói lỗi', { title: 'Mini-game Pack', detail: String((e && e.message) || e) });
      return;
    }
    const sub = countFiles(path.join(outDir, 'subpackages'));
    const all = countFiles(outDir);
    const detail = [
      outDir,
      `Tổng: ${all.files} file / ${mb(all.bytes)}`,
      `Gói chính: ${all.files - sub.files} file / ${mb(all.bytes - sub.bytes)}`,
      `Subpackage: ${sub.files} file / ${mb(sub.bytes)}`,
    ].join('\n');
    // Log ra Console luôn: Editor.Dialog trong tiến trình extension đôi khi không
    // hiện được ("[Window] parameter error"), đừng để mất kết quả vì thế.
    console.log(`[minigame-pack] ${platform} XONG sau ${secs}s\n${detail}`);
    let r = null;
    try {
      r = await Editor.Dialog.info(`Build ${label} xong (${secs}s)`, {
        title: 'Mini-game Pack', detail, buttons: ['Mở thư mục', 'Đóng'], default: 0, cancel: 1,
      });
    } catch (e) { /* dialog optional */ }
    if (r && r.response === 0) shell.openPath(outDir);
  };
  setTimeout(poll, 1200);
}

async function packExisting() {
  const r = await dialog.showOpenDialog({
    title: 'Chọn thư mục build mini-game (chứa game.json)',
    defaultPath: path.join(projectRoot(), 'build'),
    properties: ['openDirectory'],
  });
  if (r.canceled || !r.filePaths.length) return;
  const dir = r.filePaths[0];
  if (!fs.existsSync(path.join(dir, 'game.json'))) {
    Editor.Dialog.warn('Không phải thư mục build mini-game', { title: 'Mini-game Pack', detail: `Thiếu game.json trong:\n${dir}` });
    return;
  }
  try {
    const res = packSubpackages(dir);
    forcePortrait(dir);
    console.log(`[minigame-pack] ${summary(res.stats)}`);
    Editor.Dialog.info('Đóng gói xong', {
      title: 'Mini-game Pack',
      detail: `${dir}\n\nĐã chuyển: ${res.moved.join(', ') || '(không có)'}\n${summary(res.stats)}`,
    });
  } catch (e) {
    Editor.Dialog.error('Đóng gói lỗi', { title: 'Mini-game Pack', detail: String((e && e.message) || e) });
  }
}

module.exports = {
  load() {},
  unload() {},
  methods: {
    buildWechat() { runBuild('wechatgame', 'WeChat mini-game'); },
    // id nền tảng Douyin/TikTok là 'bytedance-mini-game' (không phải 'bytedance')
    buildBytedance() { runBuild('bytedance-mini-game', 'Douyin/TikTok mini-game'); },
    packExisting,
  },
};
