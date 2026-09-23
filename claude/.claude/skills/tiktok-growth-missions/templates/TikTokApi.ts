// TEMPLATE — truy cập SDK mini game của TikTok (`window.TTMinis.game`, cần TikTok ≥ 41.0.0).
// Dùng chung cho TikTokMissions / TikTokAds / TikTokLogin. Copy nguyên, không cần sửa gì.
// Ngoài app TikTok (preview / web) thì ttGame() trả null, mọi caller phải degrade êm.

const W = window as any;

/** SDK mini game, hoặc null khi không chạy trong TikTok. */
export function ttGame (): any {
  return W.TTMinis && W.TTMinis.game ? W.TTMinis.game : null;
}

/** Máy TikTok cũ thiếu hàm nào thì canIUse trả false — luôn hỏi TRƯỚC khi gọi. */
export function canUseTikTok (name: string): boolean {
  const api = ttGame();
  if (!api) return false;
  return typeof api.canIUse === 'function' ? !!api.canIUse(name) : typeof api[name] === 'function';
}
