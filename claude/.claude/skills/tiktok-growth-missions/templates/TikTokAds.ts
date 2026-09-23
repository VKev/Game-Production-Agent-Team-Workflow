// TEMPLATE — rewarded video ad của TikTok Mini Game (capability BẮT BUỘC "rewarded-ad").
// Gọi LITERAL `createRewardedVideoAd` để máy quét tĩnh của TikTok nhận ra.
// Docs: developers.tiktok.com/docs/en/tiktok-minis-in-app-ads
//
// Thưởng CHỈ cấp khi onClose trả res.isEnded === true (xem hết quảng cáo). Đóng sớm => không thưởng.
//
// ⚠ AdUnitId lấy ở Developer Portal: app > tab Operation > Monetization > In-App Ads (IAA) >
//   Add ad placement (loại Rewarded) > gạt Active > copy Placement ID. Cần business verification
//   + bật IAA trước. Chưa có ID thì isAvailable() = false => caller tự lùi về quảng cáo giả.
//
// CÁCH DÙNG: trong hàm ad trung tâm của project (vd SdkManager.showVideo):
//   if (TikTokAds.isAvailable()) { TikTokAds.show(isEnded => isEnded ? grant() : fail()); return; }
//   playFakeAd(grant);   // preview / web / chưa có ad unit

import { canUseTikTok, ttGame } from './TikTokApi';

const AdUnitId = '';   // TODO(project): dán Placement ID rewarded từ Developer Portal rồi build lại.

export class TikTokAds {
  private static ad: any = null;
  private static onFinish: ((isEnded: boolean) => void) | null = null;

  /** Có SDK, máy đủ mới, và đã cấu hình ad unit chưa. */
  static isAvailable (): boolean {
    return !!AdUnitId && canUseTikTok('createRewardedVideoAd');
  }

  /** Phát quảng cáo; onFinish(true) = xem hết, cấp thưởng. onFinish(false) = bỏ ngang hoặc lỗi. */
  static show (onFinish: (isEnded: boolean) => void): void {
    if (!this.isAvailable()) { onFinish(false); return; }
    this.onFinish = onFinish;
    this.instance().show().catch((err: any) => {
      console.log('[TikTokAds] show failed', err && (err.errMsg || err));
      this.finish(false);
    });
  }

  // Instance tạo MỘT lần rồi tái dùng (docs: đừng tạo mới mỗi lần phát).
  private static instance (): any {
    if (this.ad) return this.ad;
    this.ad = ttGame().createRewardedVideoAd({ adUnitId: AdUnitId });
    this.ad.onClose((res: any) => this.finish(!!(res && res.isEnded)));
    this.ad.onError((err: any) => {
      console.log('[TikTokAds] ad error', err && (err.errMsg || err));
      this.finish(false);
    });
    return this.ad;
  }

  // onClose và onError đều có thể nổ cho cùng một lần phát -> chỉ trả kết quả cho callback đầu tiên.
  private static finish (isEnded: boolean): void {
    const cb = this.onFinish;
    this.onFinish = null;
    cb && cb(isEnded);
  }
}

export default TikTokAds;
