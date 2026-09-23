---
name: tiktok-growth-missions
description: "Tích hợp ĐỦ 4 capability BẮT BUỘC của TikTok Mini Game — silent-login (login), rewarded-ad (createRewardedVideoAd), home-shortcut (addShortcut/getShortcutMissionReward), profile-revisit (startEntranceMission/getEntranceMissionReward) — thiếu bất kỳ cái nào là TikTok CHẶN upload. Kèm template TTMinis wrapper portable, quy tắc entry point, reward một lần do server quản, cách lấy adUnitId, checklist grep bản build và cách test. Use when: up game TikTok bị báo thiếu capability, cần gắn revisit-from-profile / add-to-home-screen / rewarded ad / silent login, port game mới lên TikTok Minis. Triggers: tiktok mission, revisit from profile, home screen shortcut, add shortcut, rewarded ad, createRewardedVideoAd, adUnitId, silent login, TTMinis, growth capability, bị chặn upload, entrance mission, up game tiktok."
---

# TikTok Mini Game — 4 capability BẮT BUỘC

Nguồn: developers.tiktok.com/docs/en/develop-your-mini-game (bảng Required = Yes),
/docs/en/revisit-from-profile, /docs/en/home-screen-shortcut, /docs/en/tiktok-minis-in-app-ads,
/doc/tiktok-minis-silent-login (đối chiếu 2026-09-03). Đã triển khai thật ở `tiktokgame1` (grd-3880,
qua gate upload) và `tiktokgame3` (oc-vit-cang-cuc, Cocos 3.8.8) — mọi quy tắc dưới đây rút từ 2 lần chạy thật.

## Vì sao bắt buộc

TikTok **quét tĩnh gói build khi upload**: package phải chứa lời gọi LITERAL đủ các API dưới đây
+ entry point hiển thị trên first screen, nếu không **console từ chối bản up**
("Integration with this capability is mandatory for mini games"). Console gửi danh sách y hệt dạng:

```
silent-login=login; rewarded-ad=createRewardedVideoAd;
home-shortcut=addShortcut,getShortcutMissionReward;
profile-revisit=getEntranceMissionReward,startEntranceMission
```

## API contract (`TTMinis.game` là global do runtime TikTok ≥ 41.0.0 cung cấp, KHÔNG cần SDK)

| Capability | API | Lúc gọi | Trả về |
|---|---|---|---|
| (mọi cái) | `TTMinis.game.canIUse("<tên hàm>")` | TRƯỚC mọi lời gọi | boolean |
| silent-login | `TTMinis.game.login({success,fail})` | Một lần lúc boot | `success({code})` — AuthorizationCode dùng 1 lần, sống ~5 phút |
| rewarded-ad | `TTMinis.game.createRewardedVideoAd({adUnitId})` | Tạo instance MỘT lần, tái dùng | object có `show()` / `onClose()` / `onError()` |
| home-shortcut | `TTMinis.game.addShortcut({success,fail})` | User bấm nút ADD TO HOME | dialog hệ thống thêm icon |
| home-shortcut | `TTMinis.game.getShortcutMissionReward({success,fail})` | MỖI lần game mở/quay lại | `success({canReceiveReward})` |
| profile-revisit | `TTMinis.game.startEntranceMission({success,fail})` | User bấm nút REVISIT | mở trang Profile TikTok |
| profile-revisit | `TTMinis.game.getEntranceMissionReward({success,fail})` | MỖI lần game mở/quay lại | `success({canReceiveReward})` |

**Ai đánh dấu mission hoàn thành:** server TikTok. Game không track gì — chỉ hỏi; `canReceiveReward`
trả `true` đúng MỘT lần cho mỗi mission (xoá game cài lại cũng không ăn lại được).

## Các bước implement

### Bước 1 — Copy template wrapper
Copy từ `templates/` (cùng thư mục skill này) vào thư mục script chính của project (Cocos: `assets/scripts/`):

| File | Vai trò | Cần sửa gì |
|---|---|---|
| `TikTokApi.ts` | `ttGame()` + `canUseTikTok()` dùng chung cho 3 file dưới | không |
| `TikTokMissions.ts` | 2 mission + claim + popup thưởng | 3 điểm `TODO(project)` |
| `TikTokAds.ts` | rewarded video | dán `AdUnitId` (xem Bước 5) |
| `TikTokLogin.ts` | silent login | không (chỉ cần khi có backend/IAP thì xử lý `code`) |

`TikTokMissions.ts` có 3 điểm ADAPTER đánh dấu `TODO(project)`:
1. `grantReward()` — cộng tiền tệ bằng hệ thống của project (storage manager + event update UI).
2. `showRewardUI()` — mở popup nhận thưởng của project (grant TRƯỚC khi mở popup, nút CLAIM chỉ đóng).
3. `isMissionDone`/`markMissionDone` — 2 cờ local qua storage của project.

### Bước 2 — Entry point trên first screen (BẮT BUỘC hiển thị)
- 2 nút trên màn hình home đầu tiên: REVISIT (→ `startEntranceMission()`) và
  ADD TO HOME SCREEN (→ `addShortcut()`).
- Icon theo style game (đừng dùng icon mặc định lệch tông — reskin từ art có sẵn của game).
- **GIỮ nút hiển thị VĨNH VIỄN kể cả sau khi nhận thưởng** — docs: "the icon reminder
  remains" / "Keep the prompt even after completed". KHÔNG ẩn theo cờ done.
- **Dựng nút THẲNG TRONG PREFAB/SCENE, đừng tạo bằng code lúc runtime.** Nút dựng runtime không hiện
  trong editor nên không ai chỉnh được vị trí/art; component chỉ nên `find` node rồi bind click.
- ⚠ Cocos: node entry phải `_active: true` trong prefab — node tắt thì `start()` của
  component không bao giờ chạy, nút ẩn vĩnh viễn (bug thật đã gặp).
- ⚠ Cocos 3.x, nếu buộc phải tạo runtime: `node.layer = parent.layer` (mặc định DEFAULT → camera UI không
  render, không hit-test) và `setScale(x, y, 1)` (scale.z = 0 làm world matrix suy biến → mất click).

### Bước 3 — Claim khi quay lại game
Gọi `TikTokMissions.setup()` một lần ở onLoad màn hình home. Nó:
- claim ngay lập tức (mở lạnh), VÀ
- đăng ký `tt.onShow` để claim khi quay lại từ nền (mở nóng từ sidebar/shortcut).
`canReceiveReward === true` → grant + popup; `false` → im lặng. Cờ done local chỉ để
KHỎI hỏi server lại, không dùng để ẩn nút.

### Bước 4 — Reward design (theo docs)
- "2 or more benefits", hoặc 1 loại thì phải "medium to high quality".
- Shortcut reward phải "higher than other entry points" (cao hơn thưởng điểm danh v.v.).
  Đã dùng thật: Revisit 200 / Shortcut 300 đơn vị tiền tệ, cỡ 2–3 lần thưởng qua 1 màn chơi.
- Phase 2 (khuyến nghị, không chặn duyệt): daily reward khi vào từ shortcut/sidebar
  ("bằng nửa lần đầu"), popup hướng dẫn 3 bước có icon bàn tay.

### Bước 5 — Rewarded ad: `adUnitId` lấy ở đâu
TikTok KHÔNG phát ad sẵn, phải tự tạo placement:
Developer Portal → app mini game → tab **Operation** → **Monetization** → tab **In-App Ads (IAA)** →
bật **Ad placements** → **Add ad placement** (đặt tên, chọn **Rewarded ad**) → gạt trạng thái sang
**Active** (mặc định inactive, không gạt thì gọi lỗi) → copy **Placement ID** = `adUnitId`.
Điều kiện trước đó: **business verification** xong và **bật capability IAA** cho mini app.

- Docs KHÔNG có test ad unit id → preview/web phải giữ nhánh quảng cáo GIẢ để test gameplay.
- Chỉ cấp thưởng khi `onClose` trả **`res.isEnded === true`**. Đóng sớm = không thưởng.
- Tạo instance MỘT lần rồi tái dùng, đừng `createRewardedVideoAd` mỗi lần phát.
- Chưa có ID vẫn code trước được: để hằng `AdUnitId = ''`, `isAvailable()` trả false → game tự lùi về
  ad giả. Khi có ID chỉ sửa 1 dòng rồi build lại. Cách này cho phép build thử trước khi verify xong.

### Bước 6 — Nối ad vào game port (game cũ đã có hàm ad riêng)
Game port thường đã có một hàm ad trung tâm (vd `SdkManager.showVideo(onReward, onFail, adUnit)`)
được gọi ở cả chục chỗ. **Chỉ sửa hàm đó**: có TTMinis + có ad unit → ad thật; ngược lại → ad giả.
⚠ Đọc kỹ chữ ký hàm cũ trước khi sửa: ở game 2.x tham số thứ 2 thường là **callback THẤT BẠI**
(hiện toast đỏ), KHÔNG phải `onClose`. Gọi nhầm nó sau khi thưởng → mỗi lần xem xong lại hiện toast lỗi.

## Luật CỨNG — vi phạm là hỏng gate upload

1. **Tên API phải là lời gọi LITERAL** (`api.getEntranceMissionReward({...})`), cấm
   dynamic dispatch `api[name]` — máy quét tĩnh của TikTok tìm đúng chuỗi tên hàm.
2. Wrapper phải nằm trong **gói chính** (main package), không được rơi vào lazy bundle.
3. `canIUse()` trước mọi lời gọi; máy TikTok < 41.0.0 phải degrade êm (không crash, Tip báo).
4. Entry hiển thị trên first screen, giữ sau khi hoàn thành.
5. **Stub test trong preview phải mô phỏng ĐÚNG server: mỗi mission chỉ thưởng MỘT lần** (mục dưới).

## Bẫy đã dính: stub preview cấp thưởng mỗi lần bấm

Preview/web không có `TTMinis` nên hay viết nhánh `!BUILD`: bấm nút là grant luôn để xem popup.
Nếu nhánh đó **không kiểm cờ done** thì bấm 10 lần ăn 10 lần thưởng — sai hoàn toàn so với thật
(server trả `canReceiveReward = true` đúng 1 lần), và dễ tưởng nhầm là code production hỏng.

Stub phải `markDone(key)` rồi lần sau chỉ toast báo đã nhận:

```ts
private static grantForPreviewTest(doneKey: string, amount: number): boolean {
  if (BUILD || ttGame()) return false;            // bản build hoặc đang trong TikTok -> đi đường thật
  if (this.isDone(doneKey)) {                     // BẮT BUỘC: server chỉ trả thưởng 1 lần
    Tip.show('PREVIEW: mission already claimed (server grants once)');
    return true;
  }
  this.markDone(doneKey);
  this.grantReward(amount);
  return true;
}
```

Muốn test lại: xoá 2 key `TT_*` trong localStorage (hoặc mở tab ẩn danh).

Dùng `BUILD` từ `cc/env` (hằng biên dịch → nhánh bị loại khỏi bundle phát hành), **không dùng `PREVIEW`**
(hằng dynamic → code vẫn nằm trong bundle).

## Cổng kiểm engine-free: `scripts/test-tiktok-sdk.js`

Template không import `cc`, nên Node chạy thẳng được chính các module đó với một
host TTMinis giả — kiểm được trong một giây thứ mà máy thật phải chơi tới nơi mới
thấy. `tsc --noEmit` mù hoàn toàn với lớp này: code biên dịch y hệt nhau dù hợp
đồng callback đúng hay sai.

```bash
node <tools>/test-tiktok-sdk.js      # 18 check, in PASS/FAIL
```

Nó chốt: ngoài TikTok không crash và **không tự trao thưởng**; máy < 41.0.0
(`canIUse` false) degrade thay vì ném TypeError; `login` giữ AuthorizationCode,
idempotent mỗi phiên nhưng vẫn thử lại sau khi fail; `AdUnitId` rỗng ⇒
`isAvailable()` false (đây chính là thứ cho phép build thử trước khi verify xong);
ad instance tạo **một lần** rồi tái dùng; chỉ thưởng khi `isEnded === true`; và
`onClose` + `onError` của **cùng một lần phát** chỉ trả kết quả MỘT lần — thiếu
chốt này là người chơi ăn thưởng hai lần cho một quảng cáo.

Nó tự biên dịch bản thứ hai có `AdUnitId` điền sẵn, vì `AdUnitId` là const cấp
module — cách duy nhất trung thực để test đúng cấu hình sẽ ship.

⚠ Sau khi sửa template, **phá thử đúng thứ nó canh** rồi chạy lại để chắc test biết
đỏ, sau đó khôi phục. Một checker không thể fail thì không phải checker.

## Checklist trước khi up (grep bản BUILD, không phải source)

```bash
for api in login createRewardedVideoAd addShortcut getShortcutMissionReward \
           startEntranceMission getEntranceMissionReward; do
  printf '%-26s %s\n' "$api" "$(grep -rl "$api" <build>/ | head -1)"
done
# cả 6 tên phải xuất hiện; thiếu tên nào console chặn capability đó
```

Kiểm thêm: `AdUnitId` đã điền chưa, ad placement đã **Active** chưa, entry còn hiển thị sau khi
đã nhận thưởng chưa, wrapper có nằm trong gói chính không.

## Test — biết trước giới hạn để khỏi mất thời gian

| Flow | Test được khi nào | Cách |
|---|---|---|
| Shortcut end-to-end | Bản test (chưa release) | `ttmg dev` mở debug env, quét QR giả lập mở từ shortcut |
| Revisit end-to-end | **CHỈ sau khi release** | Sidebar Profile chỉ liệt kê game ĐÃ PHÁT HÀNH — bản test không xuất hiện |
| Rewarded ad | Bản test, sau khi placement Active | Bấm nút cần ad; đóng sớm phải KHÔNG được thưởng (`isEnded=false`) |
| Silent login | Bản test | Log `[TikTokLogin] success, code length = ...` |
| Nhánh an toàn (không crash) | Preview/web | Log `... unsupported` rồi game chạy tiếp bình thường |

Popup + grant dùng CHUNG một hàm cho cả 2 mission → test được qua đường shortcut là
yên tâm cho đường revisit. Sau release: account mới, bấm REVISIT → mở lại từ sidebar
→ phải thấy popup. `canReceiveReward` mãi `false` ở bản live = capability chưa bật
trong Developer Console.

## Verify khi MCP không chụp được màn game (Cocos)

Nếu `capture_preview_screenshot` báo "Could not locate a visible 'game' panel": chạy preview browser
(localhost:7456) rồi lái bằng headless Chrome + CDP — screenshot, click toạ độ, đọc console log.
Lấy singleton runtime để gọi thẳng hàm (vd `showVideo`) mà không phải chơi tới chỗ có nút ad:

```js
// evaluate trong page preview
let sdk = null;
for (const [k] of System.entries()) {
  const ns = System.get(k); if (!ns) continue;
  for (const n of Object.keys(ns)) {
    const e = ns[n];
    if (e && e.ins && typeof e.ins.showVideo === 'function') sdk = e.ins;
  }
}
sdk.showVideo(msg => console.log('reward', msg), msg => console.log('fail', msg), 'test_unit');
```
