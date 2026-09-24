// TEMPLATE — lưu tiến độ người chơi cho TikTok Mini Game (iOS / Android).
//
// Trong app TikTok: dùng storage CHÍNH THỨC của Mini Games SDK
//   TTMinis.game.setStorageSync / getStorageSync / removeStorageSync
// Ngoài TikTok (preview Editor, web): lùi về localStorage.
//
// Vì sao không dùng thẳng localStorage:
//   - build `bytedance-mini-game` chạy trên runtime NATIVE của TikTok — không có DOM,
//     `window.localStorage` có thể không tồn tại;
//   - bản HTML runtime chạy trong WebView, iOS (WKWebView) được phép dọn localStorage
//     khi máy thiếu dung lượng; TikTok không cam kết giữ nó. API storage của SDK thì có.
//
// Giá trị luôn lưu dạng STRING để hai backend cư xử giống nhau (tự JSON.stringify ở
// tầng trên). Không import 'cc' → Node test được (scripts/test-tiktok-sdk.js).
//
// PHẢI nằm trong gói chính cùng TikTokApi.ts.

import { canUseTikTok, ttGame } from './TikTokApi';

const G = globalThis as any;

function useTikTok (): boolean {
  return canUseTikTok('setStorageSync') && canUseTikTok('getStorageSync');
}

/** localStorage nếu có, không thì bộ nhớ tạm (chỉ để không crash). */
const memory: Record<string, string> = {};
function local (): any {
  try {
    if (G.localStorage && typeof G.localStorage.getItem === 'function') return G.localStorage;
  } catch (e) { /* một số WebView ném khi đụng localStorage lúc bị chặn */ }
  return {
    getItem: (k: string) => (k in memory ? memory[k] : null),
    setItem: (k: string, v: string) => { memory[k] = String(v); },
    removeItem: (k: string) => { delete memory[k]; },
  };
}

// Cờ chép save cũ từ localStorage sang storage TikTok (chạy MỘT lần).
const MIGRATED_KEY = '__storage_migrated';

export const GameStorage = {
  getItem (key: string): string | null {
    try {
      if (useTikTok()) {
        const v = ttGame().getStorageSync(key);
        // getStorageSync trả null (hoặc '' ở vài bản) khi chưa có key.
        return v === null || v === undefined || v === '' ? null : String(v);
      }
      return local().getItem(key);
    } catch (e) {
      console.warn('[storage] getItem failed', key, e);
      return null;
    }
  },

  setItem (key: string, value: string): void {
    try {
      if (useTikTok()) ttGame().setStorageSync(key, String(value));
      else local().setItem(key, String(value));
    } catch (e) {
      console.warn('[storage] setItem failed', key, e);
    }
  },

  removeItem (key: string): void {
    try {
      if (useTikTok()) {
        const api = ttGame();
        if (typeof api.removeStorageSync === 'function') api.removeStorageSync(key);
        else api.setStorageSync(key, '');
      } else local().removeItem(key);
    } catch (e) {
      console.warn('[storage] removeItem failed', key, e);
    }
  },

  /**
   * Bản cũ lưu localStorage → chép các key bắt đầu bằng `prefix` sang storage TikTok
   * MỘT lần, không ghi đè key TikTok đã có. Gọi lúc khởi tạo save manager.
   */
  migrateFromLocalStorage (prefix: string): void {
    try {
      if (!useTikTok() || GameStorage.getItem(MIGRATED_KEY)) return;
      const ls = G.localStorage;
      if (ls && typeof ls.length === 'number' && typeof ls.key === 'function') {
        for (let i = 0; i < ls.length; i++) {
          const k = ls.key(i);
          if (!k || k.indexOf(prefix) !== 0 || GameStorage.getItem(k) !== null) continue;
          const v = ls.getItem(k);
          if (v !== null) GameStorage.setItem(k, v);
        }
      }
      GameStorage.setItem(MIGRATED_KEY, '1');
    } catch (e) {
      console.warn('[storage] migration skipped', e);
    }
  },
};

export default GameStorage;
