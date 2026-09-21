# Lớp runtime bắt buộc — API mock, quảng cáo giả, Android/iOS (Cocos 2.4.x)

Ba thứ này quyết định project có **chạy được ngoài đời** hay chỉ mở được trong
Editor. Làm ngay khi project 2.4.x bắt đầu boot được, đừng để tới cuối.

## 1. API mock — game phải chạy khi rút mạng

### Nối vào project

```text
<mirror>/api-mock/client/api-mock-client.js  → assets/Script/vendor/
<mirror>/api-mock/client/fake-ads-client.js  → assets/Script/vendor/
<mirror>/api-mock/index.inline.json          → assets/resources/apimock/index.inline.json
templates/ApiMock.js                         → assets/Script/mock/ApiMock.js
```

Gắn `ApiMock` vào một node trong **scene đầu tiên**, rồi vào
`Project → Project Settings → Script Execution Order` kéo nó lên **trên cùng**.

Vì sao phải trên cùng: lớp chặn vá `window.fetch` và `window.XMLHttpRequest`.
Script nào gọi API trước khi vá xong thì request đó ra thẳng mạng — và khi mạng
không có, nó fail im lặng ở một callback không ai bắt.

### Kiểm đã đúng chưa

```js
__apiMockReport()   // console: bảng endpoint nào đã được phát lại
```

- Còn dòng `[api-mock] no fixture for: GET /api/...` → endpoint đó **chưa capture**.
  Quay lại bước fetch, exercise màn hình gọi nó, rồi dựng lại `api-mock/`.
- Không có dòng nào và game vẫn chạy → game này không gọi API, ghi rõ trong báo cáo.

### Giới hạn phải nêu tên, đừng giấu

| Trường hợp | Xử lý |
|---|---|
| WebSocket | fixture tĩnh không replay được. Viết mock riêng cho protocol, hoặc chốt phạm vi "bản offline không có tính năng realtime" |
| Endpoint chỉ gọi sau đăng nhập | không vượt credential → nêu tên endpoint, để `[U]` |
| Response chứa token hết hạn | mock trả lại token cũ; nếu client tự verify hạn thì phải sửa tay và **ghi vào báo cáo** |

## 2. Quảng cáo giả — mọi phần thưởng đều trao

Bản local không có ad inventory. SDK gốc hoặc 404, hoặc không bao giờ gọi
`onClose` → luồng "xem quảng cáo nhận thưởng" chết ở đó, và triệu chứng là **nút
bấm không phản hồi**, rất dễ bị chẩn đoán nhầm thành lỗi UI.

Thay mọi lời gọi SDK bằng `FakeAds`. Giữ nhánh trao thưởng, bỏ nhánh thất bại:

| Dạng gốc hay gặp | Thay bằng |
|---|---|
| `wx.createRewardedVideoAd({...}).onClose(res => { if (res.isEnded) grant() })` | `FakeAds.showRewarded('x').then(grant)` |
| `sdk.showAd('rewarded', onDone, onFail)` | `FakeAds.showRewardedCb(onDone)` |
| `gdsdk.showAd().then(grant).catch(fail)` | `FakeAds.showRewarded().then(grant)` |
| `PokiSDK.rewardedBreak().then(ok => ok && grant())` | `FakeAds.showRewarded().then(grant)` |
| banner / interstitial chỉ để lấp thời gian | xoá hẳn, hoặc `FakeAds.showInterstitial()` |

Kiểm: `__fakeAdsReport()` phải liệt kê đúng những chỗ game gọi quảng cáo. Chỗ nào
người chơi bấm "xem quảng cáo" mà bảng không có dòng mới → chỗ đó vẫn đang gọi
SDK thật, chưa thay.

**Không** để lại lời gọi SDK thật dù chỉ một chỗ: nó sẽ là request ra ngoài trong
bản build, và là chỗ treo đầu tiên khi máy không có mạng.

### 2.1 Quảng cáo thường có HAI tầng — giả một tầng là chưa đủ

**Đã dính, mất nguyên một vòng debug trên máy thật.** Game phát hành qua một
publisher (VNG, 4399, Ohayoo…) thường có *hai* lớp quảng cáo chồng nhau:

```
nút "xem quảng cáo"
  └─ SDK của publisher            ← lớp mình đã giả, chạy ngon, log đẹp
       └─ callback THÀNH CÔNG
            └─ platform.pt.showRewardAds()   ← QUẢNG CÁO THẬT CỦA NỀN TẢNG
                 └─ cc.game.pause()
                    tt.createRewardedVideoAd({ adUnitId: "<id của game gốc>" })
```

Lớp ngoài chỉ là **cái cổng**. Log in đủ `beforeAd → adViewed → adBreakDone
{viewed} → afterAd`, trông như đã xong — rồi game đứng im. Đừng đọc log của lớp
ngoài rồi kết luận đã giả xong; **đi tiếp vào callback thành công** xem nó gọi gì.

Hai chi tiết làm nó chết hẳn chứ không chỉ "không có thưởng":

- **`cc.game.pause()` gọi TRƯỚC khi tạo quảng cáo**, còn `cc.game.resume()` chỉ
  nằm trong `onClose`/`onError`. Quảng cáo không bao giờ đóng ⇒ treo vĩnh viễn.
  Người dùng báo là "bấm quảng cáo là đứng", không phải "không được thưởng".
- **`adUnitId` là của game gốc**, không thuộc app của mình. Nền tảng từ chối và
  hiện thông báo lỗi mạng **của chính nó** — `grep` cả project không ra chuỗi
  đó, rất dễ đi nhầm hướng. Không tìm thấy chuỗi trong source ⇒ nghĩ tới UI của
  nền tảng, đừng nghĩ tới code mình.

### 2.2 Thay FACTORY của host, đừng sửa code đã recover

Với lớp nền tảng, cách gọn nhất **không phải** viết lại `ZJTDPlatform`. Thay
thẳng factory trên `tt`/`wx` trong plugin script:

```js
tt.createRewardedVideoAd = fakeRewardedVideoAd;   // định nghĩa KỂ CẢ khi host không có
tt.createBannerAd        = fakeBannerAd;
tt.createInterstitialAd  = fakeInterstitialAd;
```

Toàn bộ luồng gốc (`pause → load → show → close → resume → trao thưởng`) chạy
nguyên vẹn, không đụng một dòng code game. Hợp đồng tối thiểu:

| Thành viên | Hành vi giả |
|---|---|
| `onLoad/onClose/onError(cb)` + `offXxx` | sổ callback thường |
| `load()` | Promise resolve, **bắn `onLoad` bất đồng bộ** |
| `show()` | Promise resolve, rồi bắn `onClose({ isEnded: true, count: 1 })` |
| `destroy()` | xoá sổ callback |

Ba cái bẫy trong chính hợp đồng này:

- **Phải định nghĩa kể cả khi host thiếu.** Code gốc hay có
  `if (!this.sdk.createRewardedVideoAd) return cb(-2)` — thiếu factory thì người
  chơi cũng chẳng được gì.
- **`show()` chỉ được đóng MỘT lần.** Platform có hai nhánh cùng gọi `show()`
  (ngay trong `onLoad`, và nhánh "quảng cáo đã nạp sẵn"). Không chốt cờ là trao
  thưởng hai lần.
- **`onLoad` phải bất đồng bộ.** Bắn đồng bộ trong `load()` thì nó chạy trước
  khi platform kịp đăng ký `onClose`.

Test được chuyện này không cần máy thật: dựng `tt` giả mà factory thật **ném**
nếu bị chạm, rồi khẳng định `paused === 1 && resumed === 1` và callback nhận
`0`. Bỏ FakeAds ra thì cùng test đó phải cho `paused === 1 && resumed === 0` —
đúng trạng thái treo trên máy.

### 2.3 Global của SDK BÊN THỨ BA mà port không mang theo

Bản gốc nạp SDK đo đạc (ThinkingAnalytics, UMeng, TalkingData…) bằng `<script>`
hoặc plugin script. Bóc asset thì thứ duy nhất theo sang là **file khai báo
kiểu** (`*.d.ts` / `*.d.txt`) — trông như đã có, thực ra không có gì.

Chí mạng vì lời gọi thường nằm **trong constructor của lớp platform**:

```js
initThinking() { this._ta = new ThinkingAnalyticsAPI(cfg); window.g_ta = this._ta; }
```

`ReferenceError` ném giữa `new ZJTDPlatform(...)` ⇒ chết cả chuỗi khởi động, log
dừng đúng sau dòng `[platform] …`. Trình duyệt không lộ vì `Platform.js` chọn
`DevPlatform`, không đụng lớp này.

Xử lý **cả hai đầu**:

1. Dựng bản giả trong lớp mock, bề mặt API chép đúng theo file `.d.txt` (mọi
   method no-op; getter vừa nhận callback vừa trả giá trị; `initInstance` /
   `lightInstance` trả về instance thật).
2. Chặn ngay tại chỗ gọi: `if (typeof window.XxxSDK !== 'function') return;` —
   analytics là tính năng phụ, nó không có quyền giết cả game.

Tìm sớm, trước khi lên máy: quét mọi `new <ChữHoa>(` trong `assets/` mà định
danh đó không được khai báo/`require` trong cùng file, rồi trừ built-in ra.
Danh sách rất ngắn và bắt đúng loại lỗi này.

## 3. Android / iOS — bốn lỗi chiếm gần hết số ca

Gắn `MobileAdapter` (template) vào scene đầu tiên. Nó xử lý cả bốn:

### 3.1 Resolution policy — lỗi hay gặp nhất

Build portrait mở trên màn hình khác tỉ lệ mà dùng `resizeWithBrowserSize` thì UI
phóng to gấp mấy lần, trông như game hỏng. Luật:

- màn **cao hơn** thiết kế → `FIXED_WIDTH` (giữ bề ngang, cắt bớt chiều cao)
- màn **rộng hơn** thiết kế → `FIXED_HEIGHT`

Phải gọi lại mỗi khi xoay máy hoặc thanh địa chỉ trình duyệt ẩn/hiện —
`cc.view.setResizeCallback` lo việc đó.

### 3.2 Audio cần user gesture (iOS)

Safari/WKWebView giữ AudioContext ở trạng thái `suspended` cho tới cú chạm thật
đầu tiên. Engine 2.x **không tự thử lại**: nhạc nền gọi lúc boot sẽ im vĩnh viễn.
`MobileAdapter` resume ở `touchend` đầu tiên. Đừng gọi `play()` ở `onLoad` của
scene đầu.

### 3.3 Safe area / tai thỏ

`cc.sys.getSafeAreaRect()` có từ 2.4. HUD neo sát mép trên phải đẩy xuống, nếu
không nó nằm dưới thanh trạng thái. Điền các node cần đẩy vào
`safeAreaTargets` của `MobileAdapter`.

### 3.4 Trang cuộn/zoom cướp touch

Trên mobile browser, kéo trên canvas làm trang cuộn theo, và double-tap thì zoom.
`MobileAdapter` chặn `touchmove` (passive: false) và `gesturestart`.
Ngoài ra kiểm meta viewport trong `index.html`:

```html
<meta name="viewport" content="width=device-width, initial-scale=1,
      maximum-scale=1, user-scalable=no, viewport-fit=cover">
```

`viewport-fit=cover` là thứ làm `env(safe-area-inset-*)` có giá trị thật.

### Checklist trước khi nói "đã tương thích mobile"

- [ ] Xoay máy hai chiều, UI không vỡ, không có vùng đen thừa
- [ ] Âm thanh kêu sau cú chạm đầu tiên trên **iPhone thật** (simulator không đủ)
- [ ] HUD trên cùng không bị tai thỏ che
- [ ] Kéo ngón trên canvas không làm trang cuộn
- [ ] Multi-touch: hai ngón cùng lúc không làm kẹt input
- [ ] Chạy bản **BUILD** (không phải preview) qua `serve-local.py`, mở bằng điện
      thoại cùng mạng LAN
