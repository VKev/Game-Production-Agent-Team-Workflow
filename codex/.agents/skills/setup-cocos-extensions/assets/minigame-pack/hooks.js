'use strict';

// Build hook: sau khi build xong nền tảng mini-game, chuyển bundle đã gộp JSON
// (assets/<name>/) xuống subpackages/<name>/ và khai báo lại trong game.json +
// src/settings.json. Xem giải thích cơ chế trong pack.js.
//
// Chạy cho MỌI build wechatgame/bytedance — kể cả bấm từ panel Build của Editor —
// nên không thể quên bước đóng gói. Nếu bundle đã ở dạng subpackage sẵn (preset
// compressionType = subpackage) thì hook không tìm thấy assets/<name>/ và bỏ qua.

const { packSubpackages, forcePortrait, summary } = require('./pack');

// Các nền tảng có khái niệm 小游戏分包 (subpackage) trong Cocos 3.8.
// LƯU Ý id nền tảng: Douyin/TikTok là 'bytedance-mini-game', KHÔNG phải 'bytedance'
// (dùng sai id thì builder nhận task rồi fail "build options verification failed").
const MINIGAME_PLATFORMS = ['wechatgame', 'bytedance-mini-game'];

// Dừng build nếu đóng gói lỗi: gói chưa đóng = gói chính vượt trần 4MB, thà fail sớm.
exports.throwError = true;

exports.onAfterBuild = async function (options, result) {
    if (!MINIGAME_PLATFORMS.includes(options.platform)) return;
    const dest = result && result.dest;
    if (!dest) {
        console.warn('[minigame-pack] không lấy được result.dest, bỏ qua đóng gói');
        return;
    }
    const r = packSubpackages(dest);
    forcePortrait(dest);
    console.log(`[minigame-pack] ${options.platform}: chuyển sang subpackage → ${r.moved.join(', ') || '(không có gì để chuyển)'}`);
    console.log(`[minigame-pack] ${summary(r.stats)}`);
    if (r.stats.mainBytes > 4 * 1024 * 1024) {
        console.warn(`[minigame-pack] CẢNH BÁO: gói chính ${(r.stats.mainBytes / 1024 / 1024).toFixed(2)} MB > trần 4 MB`);
    }
};
