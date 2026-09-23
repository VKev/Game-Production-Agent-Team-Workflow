# GĐ4 — Lớp runtime bắt buộc: API mock, quảng cáo giả, Android/iOS (Cocos 3.8.x)

Ba thứ này quyết định project có **chạy được ngoài đời** hay chỉ mở được trong
Editor. Làm ngay khi project 3.8.x bắt đầu boot được, đừng để tới cuối.

## 1. API mock — game phải chạy khi rút mạng

### Nối vào project

`<script-root>` và `<resources-root>` dưới đây là **giá trị probe đo được ở GĐ1**
([project-layout.md](project-layout.md)), không phải tên thư mục cố định:

```text
<mirror>/api-mock/client/api-mock-client.js  → <script-root>/vendor/
<mirror>/api-mock/client/fake-ads-client.js  → <script-root>/vendor/
<mirror>/api-mock/index.inline.json          → <resources-root>/apimock/index.inline.json
templates/ApiMock.ts                         → <script-root>/mock/ApiMock.ts
```

`<script-root>` phải thuộc **bundle nạp lúc boot**. Đặt lớp mock trong một
subpackage tải sau thì nó vá `fetch` sau khi game đã gọi API — lỗi hiện ra dưới
dạng "thỉnh thoảng mất mạng là đứng", không tái hiện đều.

Không có `<resources-root>` (probe báo rỗng) thì **đừng tạo `resources/` chỉ để
cho khớp ví dụ trên** — nhúng fixture vào một bundle rồi trỏ template vào đó:

```ts
ApiMock.bundle = '<bundle>';               // tên bundle, không phải đường dẫn
ApiMock.fixturePath = 'apimock/index.inline';
```

Template tự `loadBundle` nếu bundle chưa nạp.

Gắn `ApiMock` vào một node trong **scene đầu tiên**. Template đã có
`@executionOrder(-10000)` — **giữ nguyên số đó**, đừng hạ.

Vì sao: lớp chặn vá `globalThis.fetch` và `globalThis.XMLHttpRequest`. Script nào
gọi API trước khi vá xong thì request ra thẳng mạng, và khi không có mạng nó fail
im lặng trong một callback không ai bắt.

`index.inline.json` nhúng sẵn body nên **không cần base URL** — chạy được cả trên
bản native (Android/iOS) lẫn minigame, nơi asset không nằm sau một HTTP origin.

### Kiểm đã đúng chưa

```js
__apiMockReport()   // console: endpoint nào đã được phát lại
```

- Còn dòng `[api-mock] no fixture for: GET /api/...` → endpoint đó chưa capture.
  Quay lại bước fetch, exercise màn hình gọi nó, dựng lại `api-mock/`.
- Không dòng nào và game vẫn chạy → game không gọi API, ghi rõ trong báo cáo.

### Giới hạn phải nêu tên

| Trường hợp | Xử lý |
|---|---|
| WebSocket | fixture tĩnh không replay được. Viết mock riêng, hoặc chốt phạm vi "bản offline không có realtime" |
| Endpoint chỉ gọi sau đăng nhập | không vượt credential → nêu tên, để `[U]` |
| Response chứa token hết hạn | mock trả token cũ; client tự verify hạn thì phải sửa tay và **ghi vào báo cáo** |

## 2. Quảng cáo giả — mọi phần thưởng đều trao

Thay mọi lời gọi SDK bằng `FakeAds`. Giữ nhánh trao thưởng, bỏ nhánh thất bại:

| Dạng gốc hay gặp | Thay bằng |
|---|---|
| `wx.createRewardedVideoAd({...}).onClose(res => res.isEnded && grant())` | `FakeAds.showRewarded('x').then(() => grant())` |
| `sdk.showAd('rewarded', onDone, onFail)` | `FakeAds.showRewarded().then(onDone)` |
| `gdsdk.showAd().then(grant).catch(fail)` | `FakeAds.showRewarded().then(() => grant())` |
| `PokiSDK.rewardedBreak().then(ok => ok && grant())` | `FakeAds.showRewarded().then(() => grant())` |
| banner / interstitial chỉ lấp thời gian | xoá hẳn, hoặc `FakeAds.showInterstitial()` |

Kiểm bằng `__fakeAdsReport()`. Người chơi bấm "xem quảng cáo" mà bảng không có
dòng mới → chỗ đó vẫn gọi SDK thật, chưa thay.

### Ba thứ hay bị làm hụt — cơ chế giống hệt 2.x

Cả ba đã mất công thật trên máy thật, và cơ chế không đổi giữa hai line engine,
chỉ khác cú pháp. Đọc `dev-cocos-port-2x/references/shims-and-mobile.md`:

| § ở port-2x | Bẫy |
|---|---|
| §2.1 | **Quảng cáo có HAI tầng.** SDK publisher (VNG/4399/Ohayoo) gọi tiếp `platform.showRewardAds()` của nền tảng. Giả tầng ngoài thì log in đủ `adViewed → adBreakDone{viewed}` mà game vẫn treo ở `cc.game.pause()` — `resume()` chỉ nằm trong `onClose`. Người dùng báo "bấm quảng cáo là đứng", không phải "không được thưởng" |
| §2.2 | **Thay factory của host** (`tt.createRewardedVideoAd = fake…`) thay vì viết lại lớp platform: luồng `pause → load → show → close → resume → trao thưởng` chạy nguyên vẹn. Ba bẫy trong hợp đồng: phải định nghĩa **kể cả khi host thiếu**, `show()` chỉ được đóng **một** lần, `onLoad` phải **bất đồng bộ** |
| §2.3 | **Global của SDK bên thứ ba** (ThinkingAnalytics, UMeng, TalkingData) không theo sang khi port — chỉ file `.d.ts` theo sang, trông như đã có. `ReferenceError` trong constructor lớp platform **giết cả chuỗi khởi động**, log dừng ngay sau dòng `[platform]` |

Tìm sớm, trước khi lên máy: `plan-port-waves.js` in danh sách `external` —
require không tìm thấy file. Mỗi cái là một trong ba: thư viện phải copy, module
chết, hoặc đúng cái global thứ ba này.

## 3. Android / iOS — bốn lỗi chiếm gần hết số ca

Gắn `MobileAdapter` (template) vào scene đầu tiên.

### 3.1 Resolution policy

Luật: màn **cao hơn** thiết kế → `ResolutionPolicy.FIXED_WIDTH`; màn **rộng hơn**
→ `FIXED_HEIGHT`. Phải tính lại khi xoay máy — template lắng nghe
`screen.on('window-resize')`.

Trong Editor, component `Canvas` có sẵn `Fit Width` / `Fit Height`; nếu đã bật
đúng cặp đó cho mọi Canvas thì `MobileAdapter` chỉ còn lo phần đổi hướng màn hình.
Bật cả hai (`Fit Width` + `Fit Height`) là nguồn lỗi kinh điển: UI co lại theo
cạnh ngắn và để lại viền đen.

### 3.2 Audio cần user gesture (iOS)

Safari/WKWebView giữ AudioContext `suspended` tới cú chạm thật đầu tiên. Đừng gọi
`AudioSource.play()` trong `onLoad` của scene đầu — hãy chờ input đầu tiên, hoặc
phát nhạc nền ngay sau nút "Start". `MobileAdapter` resume context ở `touchend`
đầu tiên như lưới an toàn.

### 3.3 Safe area / tai thỏ

3.x có sẵn component **`SafeArea`** — đó là cách đúng cho node có `Widget`. Gắn nó
vào container HUD trên cùng thay vì tự trừ toạ độ. Chỗ nào không dùng Widget được
thì điền node vào `safeAreaTargets` của `MobileAdapter`.

### 3.4 Trang cuộn/zoom cướp touch (bản web)

`MobileAdapter` chặn `touchmove` (passive: false) và `gesturestart`. Kiểm thêm
meta viewport trong `index.html` của bản build:

```html
<meta name="viewport" content="width=device-width, initial-scale=1,
      maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

`viewport-fit=cover` là thứ làm `env(safe-area-inset-*)` có giá trị thật.

### 3.5 Hiệu năng trên máy yếu

- `game.frameRate = 60` mặc định; máy tầm thấp hạ 30 mượt hơn là 60 giật.
- `macro.CLEANUP_IMAGE_CACHE = true` cho bản web-mobile: bỏ ảnh gốc sau khi lên
  GPU, tiết kiệm RAM đáng kể trên iOS.
- Bật `Compressed Texture` (ASTC cho iOS, ETC2 cho Android) trong Build Settings
  thay vì PNG thô — đây là nguồn tiết kiệm dung lượng lớn nhất của bản native.

### Checklist trước khi nói "đã tương thích mobile"

- [ ] Xoay máy hai chiều, UI không vỡ, không vùng đen thừa
- [ ] Âm thanh kêu sau cú chạm đầu trên **iPhone thật** (simulator không đủ)
- [ ] HUD trên cùng không bị tai thỏ che
- [ ] Kéo ngón trên canvas không làm trang cuộn (bản web)
- [ ] Multi-touch: hai ngón cùng lúc không kẹt input
- [ ] Chạy bản **BUILD** (không phải preview) trên điện thoại thật
- [ ] Rút mạng vẫn chơi được hết vòng lặp


---

## Bổ sung: ba thứ chỉ lộ trên máy thật

### A. `window` không tồn tại trong runtime mini-game

Quy ước `const w = window as any;` chạy tốt trên trình duyệt và **ném
ReferenceError** trong runtime TikTok/ByteDance/WeChat — ném ngay lúc module đang
eval, nên **cả game không khởi động**, chỉ để lại
`Unable to instantiate chunks:///_virtual/<file>.ts`.

Dùng `globalThis` ở mọi nơi (ES2020, có trong mọi runtime kể cả trình duyệt).
Chỉ đổi định danh `window` **đứng một mình**, không đụng `w.window` hay chuỗi
`'window'`. Script sẵn: `scripts/fix-window-global.js`.

Kiểm: `grep -rnw window assets --include=*.ts` — mọi hit phải là thuộc tính hoặc
chuỗi.

### B. Safe area — kiểm tra bản 2.x TRƯỚC khi coi là lỗi port

§3.3 ở trên mô tả cách làm. Nhưng trước đó phải đo bản gốc, vì trường hợp hay gặp
nhất là **bản 2.x cũng không hề có safe area**:

- file kiểu `MobileAdapter` **thoát sớm** khi không có DOM thật ⇒ không chạy trong
  bất kỳ runtime mini-game nào;
- và CSS var nó ghi (`--safe-top`…) **không ai đọc**.

Tức là trên iPhone có notch, HUD trên cùng bị che ở **cả hai** bản. Đây là **lựa
chọn sản phẩm**, không phải lỗi port ⇒ **hỏi user**: giữ parity, hay thêm safe
area thật (khác bản gốc).

Nếu thêm: đặt component ở **container**, cộng inset vào `Widget.top` của **các con
căn TOP**. Đừng gắn `cc.SafeArea` của engine lên root — nó resize cả container và
kéo vùng gameplay tụt xuống theo. Dùng `sys.getSafeAreaRect()` (đã ở hệ toạ độ
design) chứ không phải `screen.safeArea` (pixel vật lý). Nhớ nghe
`screen.on('window-resize' | 'orientation-change')` và ghi nhớ lượng đã cộng để
áp lại không bị cộng dồn.

### C. Lớp mock mất đảm bảo thứ tự khi bỏ `isPlugin`

File `isPlugin: true` của 2.x chạy **trước khi engine boot**. Ở 3.8 không có gì
tái lập điều đó: `@executionOrder(-10000)` chạy **muộn hơn** thứ nó thay thế, còn
`import './X'` lấy side-effect thì **vừa không có thứ tự vừa bị tree-shake**.

Mỗi mock export `installX()` có guard idempotent; một `BootPrelude` duy nhất giữ
thứ tự và **gọi thật**; entry point gọi `bootPrelude()` ở module scope.

Thứ tự có lý do: `FakeAnalytics` → `ApiMock` → `FakeAds` → `MobileAdapter`.
`ApiMock` bọc `fetch`/`XMLHttpRequest` nên phải bọc **bản thật**, không phải bản
của `FakeAds`. Cài hai lần còn tệ hơn không cài.

**`BootPrelude` phải nằm cùng bundle với thứ gọi nó** (thường là `main`) — xem
`pitfalls.md` §29.
