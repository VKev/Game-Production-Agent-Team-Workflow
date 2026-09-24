// TEMPLATE — silent login của TikTok Mini Game (capability BẮT BUỘC "silent-login").
// Gọi LITERAL `login` để máy quét tĩnh của TikTok nhận ra. Không hiện popup xin quyền.
// Docs: developers.tiktok.com/doc/tiktok-minis-silent-login
//
// Trả về AuthorizationCode dùng MỘT lần, sống ~5 phút; backend đổi code lấy AccessToken + OpenID.
// Game không backend/IAP thì chỉ cần giữ code trong bộ nhớ (vẫn đủ qua gate upload).
//
// CÁCH DÙNG: gọi TikTokLogin.login() một lần lúc boot (sau khi SDK/platform init).

import { canUseTikTok, ttGame } from './TikTokApi';

export class TikTokLogin {
  /** AuthorizationCode của phiên hiện tại, rỗng khi chưa login hoặc chạy ngoài TikTok. */
  static authCode = '';

  private static done = false;

  /** Idempotent: mỗi phiên login tối đa MỘT lần; fail thì cho thử lại ở lần gọi sau. */
  static login (): void {
    if (TikTokLogin.done) return;
    if (!canUseTikTok('login')) { console.log('[TikTokLogin] login unsupported'); return; }
    TikTokLogin.done = true;
    ttGame().login({
      success: (res: any) => {
        TikTokLogin.authCode = (res && res.code) || '';
        console.log('[TikTokLogin] success, code length =', TikTokLogin.authCode.length);
        // TODO(project): có backend thì POST authCode lên server để đổi AccessToken + OpenID.
      },
      fail: (err: any) => {
        TikTokLogin.done = false; // không chặn luồng chơi, lần boot/gọi sau thử lại
        console.log('[TikTokLogin] fail', err && err.errMsg);
      },
    });
  }
}

export default TikTokLogin;
