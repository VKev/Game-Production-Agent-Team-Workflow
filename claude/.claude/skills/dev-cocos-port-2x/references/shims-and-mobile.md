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
