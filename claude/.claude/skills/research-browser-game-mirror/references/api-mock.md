# API mock — hợp đồng dùng chung cho fetch và cả 3 skill port

Mirror xong là game mất backend. Mọi request còn lại hoặc fail, hoặc treo ở một
promise không bao giờ resolve — và triệu chứng thường là **màn đen không báo
lỗi**, hoặc vào được menu nhưng bấm gì cũng không phản hồi.

Bộ `api-mock/` giải quyết việc đó bằng cách **phát lại đúng response đã ghi
được lúc game còn nối mạng thật**.

## Sinh ra như thế nào

```bash
node capture-runtime.mjs --url <live> --out <evidence> --label live --capture-api
node build-api-mock.mjs --api <evidence>/live-api.json --out <mirror>/api-mock
```

`--capture-api` bắt body của mọi request loại `XHR`, `Fetch`, `EventSource`,
`WebSocket` — asset (ảnh/audio/script) bị loại ra, chúng đã do mirror lo.

Body phải lấy **ngay khi request kết thúc**; Chrome xoá buffer sau đó. Đó là lý
do việc này nằm trong capture chứ không phải một bước phân tích về sau.

## Cây file

```text
<mirror>/api-mock/
  index.json            # bản gọn — serve-local.py dùng, body nằm ở bodies/
  index.inline.json     # bản nhúng body — PROJECT ĐÃ PORT dùng, không cần URL
  bodies/<id>.<ext>     # body thật, nguyên văn
  client/
    api-mock-client.js  # lớp chặn fetch/XHR (ES5, chạy cả WebView cũ)
    fake-ads-client.js  # lớp quảng cáo giả
```

`client/` được copy vào **mirror** có chủ ý: bước port lấy code từ mirror, không
phải từ thư mục skill. Mirror tự mang đủ thứ nó cần, không phụ thuộc skill nào.

## Schema một entry

```json
{
  "id": "get_api-user_1",
  "method": "GET",
  "host": "api.example.com",
  "path": "/api/user",
  "query": "uid=1",
  "status": 200,
  "contentType": "application/json",
  "bodyFile": "bodies/get_api-user_1.json",
  "bytes": 34,
  "postData": null,
  "order": 1
}
```

`index.inline.json` có thêm `bodyText` trong mỗi entry.

## Luật khớp — cả 2 nơi dùng CHUNG một logic

1. Khớp **method + path** (bỏ qua query và host: build local hay đổi domain).
2. Trượt thì thử **khớp đuôi path** — prefix hay đổi (`/api/v1/x` → `/x`), đuôi
   thì không.
3. Cùng một endpoint gọi nhiều lần → phát lần lượt `order` 1, 2, 3… hết thì lặp
   lại bản cuối. Game poll trạng thái sẽ thấy đúng chuỗi như lúc capture.
4. Không có fixture → **đi ra mạng thật** và log cảnh báo
   `[api-mock] no fixture for: <method> <url>`. Đừng bịa response rỗng: im lặng
   trả `{}` tạo ra bug khó tìm hơn nhiều so với một request fail nhìn thấy được.

Gõ `__apiMockReport()` trong console để xem endpoint nào đã được phát lại,
endpoint nào trượt.

## Muốn đủ fixture thì phải exercise cho đủ

Capture một lần chỉ bắt được API của màn đầu. Mọi endpoint chỉ gọi khi người
chơi bấm vào đâu đó sẽ **không có trong fixture**. Cách lấy thêm:

```js
// evidence/exercise.js — chạy bằng capture-runtime.mjs --eval-file
(async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  // Ưu tiên gọi thẳng vào API của game nếu tìm được (bền hơn click toạ độ).
  window.GameApi?.fetchShop?.();
  await sleep(1500);
  window.GameApi?.fetchTasks?.();
  await sleep(1500);
  // Không có entry point thì dispatch click vào node UI qua engine.
  const scene = window.cc?.director?.getScene?.();
  scene?.getChildByName?.('ShopButton')?.emit?.('click');
  await sleep(2000);
})();
```

Chạy capture nhiều lần với nhiều `--label` rồi gộp:

```bash
node build-api-mock.mjs --api <e>/live-api.json --api <e>/shop-api.json --out <mirror>/api-mock
```

## Cái KHÔNG mock được — phải nêu tên, đừng giấu

| Trường hợp | Vì sao | Làm gì |
|---|---|---|
| WebSocket | fixture tĩnh không replay được luồng hai chiều | `build-api-mock.mjs` xếp vào `skipped`. Bước port phải viết mock riêng cho protocol đó, hoặc chốt phạm vi "bản offline" |
| Token ký / hết hạn | response chứa token chỉ đúng tại thời điểm capture | game thường vẫn chạy vì mock trả lại nguyên token cũ; nếu client tự verify hạn thì phải sửa tay và ghi vào báo cáo |
| Dữ liệu theo người dùng | fixture là của **một** tài khoản lúc capture | đủ để chạy nghiên cứu; đừng coi là dữ liệu đúng của người khác |
| Endpoint sau đăng nhập | không vượt credential | báo `blocked`, nêu tên endpoint |

## Project đã port dùng lại ra sao

1. Copy `client/*.js` vào `assets/.../vendor/`.
2. Copy `index.inline.json` vào `assets/resources/apimock/`.
3. Gắn component `ApiMock` (mẫu có sẵn trong skill port) vào scene ĐẦU TIÊN, đặt
   execution order thấp nhất — cài sau khi game đã gọi API lần đầu là quá muộn.

Chi tiết theo từng engine nằm trong `templates/ApiMock.js` (2.x) và
`templates/ApiMock.ts` (3.x).
