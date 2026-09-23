// TEMPLATE — 2 growth mission của TikTok (TTMinis.game.*, cần TikTok 41.0.0+):
//   1. Revisit from Profile  — startEntranceMission / getEntranceMissionReward
//   2. Home Screen Shortcut  — addShortcut / getShortcutMissionReward
// TikTok chặn upload nếu gói build không gọi đủ 4 API này, nên phải gọi
// TRỰC TIẾP bằng tên hàm literal (cấm api[name]) để máy quét tĩnh nhận ra.
// Docs: developers.tiktok.com/docs/en/revisit-from-profile
//       developers.tiktok.com/docs/en/home-screen-shortcut
//
// Điều kiện nhận thưởng do server TikTok theo dõi (canReceiveReward) — server
// trả true đúng MỘT lần mỗi mission. Cờ done local chỉ để khỏi hỏi lại server,
// KHÔNG dùng để ẩn nút entry (docs bắt giữ entry hiển thị sau khi hoàn thành).
//
// CÁCH DÙNG:
//   - Copy kèm TikTokApi.ts (bắt buộc), TikTokAds.ts + TikTokLogin.ts (2 capability còn lại).
//   - Điền 3 khối TODO(project) bên dưới bằng hệ thống của project.
//   - Gọi TikTokMissions.setup() một lần ở onLoad màn hình home.
//   - Nút REVISIT   → TikTokMissions.startEntranceMission(onUnsupported)
//   - Nút ADD HOME  → TikTokMissions.addShortcut(onDone, onUnsupported)

import { canUseTikTok, ttGame } from './TikTokApi';
// Cocos: import { BUILD } from 'cc/env';  — engine khác thì thay bằng cờ build tương đương.
// Phải là HẰNG BIÊN DỊCH (BUILD), đừng dùng PREVIEW: hằng dynamic sẽ để code stub lọt vào bundle.
import { BUILD } from 'cc/env';

// tt.onShow là API cấp app (global `tt`), không nằm trong TTMinis.game.
const W = window as any;

const RevisitReward = 200;
const ShortcutReward = 300;   // docs: thưởng shortcut phải CAO HƠN các entry point khác
const EntranceDoneKey = 'TT_entranceMissionDone';
const ShortcutDoneKey = 'TT_shortcutMissionDone';

// ── TODO(project): thay 3 hàm này bằng storage / currency / popup của project ──

function isMissionDone (key: string): boolean {
  // vd Cocos: return sys.localStorage.getItem(key) === '1';
  try { return W.localStorage && W.localStorage.getItem(key) === '1'; } catch { return false; }
}

function markMissionDone (key: string): void {
  // vd Cocos: sys.localStorage.setItem(key, '1');
  try { W.localStorage && W.localStorage.setItem(key, '1'); } catch { /* storage bị chặn thì thôi */ }
}

function grantRewardAndShowUI (amount: number): void {
  // vd: cộng tiền tệ + refresh HUD + mở popup nhận thưởng của project.
  // Grant TRƯỚC khi mở popup (user thoát ngang không mất thưởng), nút CLAIM chỉ đóng popup.
  console.log('[TikTokMissions] TODO(project): grant reward x' + amount);
}

// ──────────────────────────────────────────────────────────────────────────────

export class TikTokMissions {
  private static hasSetup = false;

  /** Gọi một lần từ home: nhận thưởng đang chờ và nhận lại mỗi lần game onShow. */
  static setup (): void {
    if (this.hasSetup) return;
    this.hasSetup = true;
    W.tt && W.tt.onShow && W.tt.onShow(() => this.claimPendingRewards());
    this.claimPendingRewards();
  }

  /** Nút REVISIT: mở trang Profile TikTok; server ghi nhận mission khi user quay lại từ đó. */
  static startEntranceMission (onUnsupported: () => void): void {
    if (this.grantForPreviewTest(EntranceDoneKey, RevisitReward)) return;
    if (!canUseTikTok('startEntranceMission')) { onUnsupported(); return; }
    ttGame().startEntranceMission({
      success: () => console.log('[TikTokMissions] startEntranceMission success'),
      fail: (err: any) => console.log('[TikTokMissions] startEntranceMission fail', err && err.errMsg),
    });
  }

  /** Nút ADD TO HOME: bật dialog hệ thống thêm icon. */
  static addShortcut (onDone: (isAdded: boolean) => void, onUnsupported: () => void): void {
    if (this.grantForPreviewTest(ShortcutDoneKey, ShortcutReward)) return;
    if (!canUseTikTok('addShortcut')) { onUnsupported(); return; }
    ttGame().addShortcut({
      success: () => onDone(true),
      fail: (err: any) => { console.log('[TikTokMissions] addShortcut fail', err && err.errMsg); onDone(false); },
    });
  }

  static claimPendingRewards (): void {
    if (!isMissionDone(EntranceDoneKey) && canUseTikTok('getEntranceMissionReward')) {
      ttGame().getEntranceMissionReward({
        success: (res: any) => this.grantIfEligible(res, EntranceDoneKey, RevisitReward),
        fail: (err: any) => console.log('[TikTokMissions] getEntranceMissionReward fail', err && err.errMsg),
      });
    }
    if (!isMissionDone(ShortcutDoneKey) && canUseTikTok('getShortcutMissionReward')) {
      ttGame().getShortcutMissionReward({
        success: (res: any) => this.grantIfEligible(res, ShortcutDoneKey, ShortcutReward),
        fail: (err: any) => console.log('[TikTokMissions] getShortcutMissionReward fail', err && err.errMsg),
      });
    }
  }

  private static grantIfEligible (res: any, doneKey: string, amount: number): void {
    console.log('[TikTokMissions]', doneKey, 'canReceiveReward =', !!(res && res.canReceiveReward));
    if (!res || !res.canReceiveReward) return;
    markMissionDone(doneKey);
    grantRewardAndShowUI(amount);
  }

  // Editor/Preview không có TTMinis -> bấm nút là cấp thưởng để test popup + grant.
  // BẮT BUỘC chỉ MỘT lần mỗi mission: server TikTok cũng chỉ trả canReceiveReward=true một lần.
  // Stub cấp thưởng mỗi lần bấm là BUG đã dính thật, làm tưởng nhầm code production hỏng.
  // Muốn test lại: xoá 2 key TT_* trong localStorage (hoặc mở tab ẩn danh).
  // `BUILD` là hằng biên dịch nên cả nhánh này bị loại khỏi bundle phát hành.
  private static grantForPreviewTest (doneKey: string, amount: number): boolean {
    if (BUILD || ttGame()) return false;
    if (isMissionDone(doneKey)) {
      console.log('[TikTokMissions] preview stub: already claimed', doneKey);
      // TODO(project): đổi thành toast của project cho dễ thấy khi test.
      return true;
    }
    console.log('[TikTokMissions] preview stub: grant', amount, 'for', doneKey);
    markMissionDone(doneKey);
    grantRewardAndShowUI(amount);
    return true;
  }
}

export default TikTokMissions;
