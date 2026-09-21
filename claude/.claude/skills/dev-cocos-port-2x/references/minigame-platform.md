# Ship project 2.x lên nền tảng mini-game (TikTok / Douyin / WeChat)

Áp dụng khi đích đến **không phải** web-mobile mà là mini-game. Đây là môi trường
khác hẳn trình duyệt, và khác theo kiểu **im lặng**: không DOM thật, thiếu một
loạt global, có trần dung lượng cứng, và có cả một khâu đóng gói riêng.

Mọi mục dưới đây là lỗi **đã gặp thật** trong một lần port, không phải danh sách
phòng xa. Triệu chứng chung của gần hết: **màn hình đứng hoặc nền tảng báo không
mở được, KHÔNG có một dòng log nào**.

## Vì sao cả nhóm lỗi này không lộ ra sớm

| Nơi chạy | Vì sao không thấy |
|---|---|
| Preview trong Editor | Chromium thật, DOM đủ, global đủ |
| Devtools của nền tảng | cũng Chromium — adapter chỉ **điền vào chỗ thiếu**, DOM thật vẫn thắng |
| Máy thật | mới là chỗ duy nhất chạy DOM giả + engine JS trần |

Nên: **đã nhắm mini-game thì bản build phải được kiểm bằng script tĩnh**, đừng
tin "chạy ngon trong simulator". Script ở cuối trang.

---

# PHẦN 1 — Runtime mini-game không phải trình duyệt

## 1.1 Adapter dựng DOM GIẢ, và nó khác DOM thật ở chỗ chí mạng

Đọc thẳng `adapter-min.js` trong thư mục build để biết hình dạng thật. Ở bản
Cocos 2.4:

```js
document.documentElement === window     // và window KHÔNG có .style
document.head = new HTMLElement('head') // appendChild chỉ push vào childNodes
document.createElement('script')        // trả về stub, tagName = "SCRIPT"
window.location = { href: "game.js", reload: fn }   // KHÔNG search, KHÔNG host
```

**Lỗi đã gặp:** một plugin script gọi
`document.documentElement.style.setProperty('--safe-top', ...)` để set biến CSS
safe-area. Trên web chạy tốt. Trên mini-game: `window.style` là `undefined` →
TypeError → plugin script ném → callback của `boot()` không bao giờ chạy →
`cc.game.run()` không bao giờ được gọi → **đứng ở màn loading vĩnh viễn**.

Plugin script (`jsList` trong settings) chạy **trước khi engine boot**, nên ném ở
đó là chết toàn bộ, không log, không crash report.

**Luật:** mọi plugin script phải mở đầu bằng cổng thoát khi không có DOM thật.

```js
if (typeof document === 'undefined'
    || !document.documentElement
    || !document.documentElement.style
    || typeof document.documentElement.style.setProperty !== 'function') {
  return; // mini-game runtime — phần dưới là fix cho trang web thật
}
```

## 1.2 Global của TRÌNH DUYỆT mà adapter KHÔNG dựng

Đây là loại lỗi **chỉ hiện trên một hệ điều hành**, nên tốn nhiều thời gian nhất.

`URLSearchParams`, `URL`, `TextDecoder`, `Blob`, `FormData`, `AbortController`,
`fetch`, `Event`… đều là API WHATWG — **không** thuộc ECMAScript. Engine JS trần
không có sẵn, và adapter Cocos cũng không dựng. Runtime nào chạy trong ngữ cảnh
WebKit thì nhiều cái có sẵn nên vẫn chạy; runtime V8 trần thì ném.

→ **"iOS chạy ngon, Android không mở được"** (hoặc ngược lại) gần như luôn là
hạng lỗi này.

**Lỗi đã gặp:**

```js
// trong CONSTRUCTOR của AdsManager, được dựng trong onLoad của scene khởi động
var t = new URLSearchParams(window.location.search);
this.skipAds = "true" === t.get("skipAds");
```

ReferenceError → `onLoad` ném → scene khởi động không nạp xong → game không chạy.

Cách sửa: đọc tay, không cần global nào, và giữ đúng ngữ nghĩa
`URLSearchParams.get` (không có key → `null`, có key rỗng → `""`):

```js
function queryParam(name) {
  var search = (typeof window !== "undefined" && window.location && window.location.search) || "";
  if (!search) return null;
  var pairs = String(search).replace(/^\?/, "").split("&");
  for (var i = 0; i < pairs.length; i++) {
    if (!pairs[i]) continue;
    var eq = pairs[i].indexOf("="),
      key = eq < 0 ? pairs[i] : pairs[i].slice(0, eq);
    if (decodeURIComponent(key.replace(/\+/g, " ")) !== name) continue;
    return eq < 0 ? "" : decodeURIComponent(pairs[i].slice(eq + 1).replace(/\+/g, " "));
  }
  return null;
}
```

Tương tự với `new URL(u)` khi chỉ cần đổi hostname — tách bằng chuỗi:

```js
var m = String(u).match(/^([A-Za-z][\w+.-]*:\/\/)([^/?#]*)([\s\S]*)$/); // scheme, host, phần còn lại
```

**Chạy `check-minigame-globals.js` để quét, đừng soi tay.** Nó đọc danh sách
global adapter thật sự dựng từ chính `adapter-min.js` nên không lạc hậu.

⚠ Quét cả **bundle đã build**, không chỉ source: script trong `assets/Script/`
được gộp vào `assets/main/index.js`, nên sửa source mà quên bấm Build thì gói vẫn
mang code cũ. Đã dính đúng cái này.

## 1.3 Copy đối tượng host `tt` / `wx` là hỏng — và hỏng chỉ trên iOS

```js
window.wxapi = Object.assign({}, tt);   // ✘ SAI
window.wxapi = window.tt || {};         // ✔ giữ nguyên đối tượng thật
```

Hai đường chết, đường nào cũng đủ:

1. Method của `tt` gắn qua prototype hoặc không enumerable → **không được copy** →
   `wxapi.onHide` là `undefined`.
2. Copy được nhưng gọi qua `wxapi` thì `this` là `wxapi` chứ không phải `tt`.
   Binding host của JavaScriptCore (iOS) **ném** khi receiver sai; V8 (Android,
   devtools) thường dễ tính.

Cùng lý do: khi bọc một method của host, phải gọi lại bằng `real.call(host, opts)`
chứ không phải `real(opts)`.

## 1.4 `Event` không tồn tại

Runtime mini-game chỉ gắn `TouchEvent`, `MouseEvent`, `DeviceMotionEvent`.
`new Event('xxx')` ném ReferenceError. Và nếu lời gọi nằm trong `setTimeout` thì
**không ai thấy** — game chỉ đơn giản không bao giờ nhận được event đó.

`window.dispatchEvent` của adapter chỉ đọc `e.type`, nên object thường là đủ:

```js
var ev = typeof Event === 'function' ? new Event(type) : { type: type };
window.dispatchEvent(ev);
```

## 1.5 `<script>` inject không bao giờ chạy

Mẫu rất phổ biến trong game có SDK bên thứ ba:

```js
var s = document.createElement('script');
s.src = SDK_URL;
s.onload = function () { setupSDK(); emit(HIDE_LOADING); };
document.head.appendChild(s);
```

Trên mini-game: `document.head` CÓ tồn tại và `appendChild` CÓ tồn tại — nó chỉ
push node vào mảng `childNodes` rồi thôi. Không tải gì, **`onload` không bao giờ
nổ**, `HIDE_LOADING` không bao giờ phát → đứng ở màn loading. Không lỗi.

Cách xử lý: bẫy `head.appendChild`, nhận ra `<script>` của SDK rồi tự bắn
`onload`, sau đó bắn event "ready" ở tick kế tiếp (để listener kịp đăng ký):

```js
var realAppend = head.appendChild.bind(head);
head.appendChild = function (node) {
  if (node && node.tagName === 'SCRIPT' && /sdkname/i.test(String(node.src || ''))) {
    setTimeout(function () {
      if (typeof node.onload === 'function') node.onload();
      setTimeout(function () { fire('sdk_ready'); }, 0);
    }, 0);
    return node;
  }
  return realAppend(node);
};
```

⚠ Mẫu khớp (`/sdkname/i`) phải đối chiếu với **URL thật trong config**, và bài
test phải đọc URL từ chính file config đó. Đổi CDN sang tên miền không chứa chuỗi
đó là bẫy trượt và game đứng trở lại — không ai biết.

⚠ Stub `HTMLElement` của adapter **không có `removeAttribute`**. Canh trước khi gọi.

## 1.6 Ba tầng mạng, không phải một

Game port thường dùng cả ba, phải chặn cả ba:

| Tầng | Ai dùng | Trạng thái trên mini-game |
|---|---|---|
| `fetch` | code kiểu web hiện đại | **KHÔNG TỒN TẠI** → phải *định nghĩa*, không phải bọc |
| `XMLHttpRequest` | code framework cũ | adapter có dựng |
| `tt.request` / `wx.request` | code viết riêng cho nền tảng | có, nhưng **chặn mọi domain chưa khai báo** |

Chặn ở tầng `tt.request` thì không gói tin nào rời máy và không phải khai báo
domain nào cả.

**Phạm vi phải hẹp.** Cocos cũng tải asset qua XHR và qua `tt.request` — bọc nhầm
là hỏng giải mã ảnh/âm thanh. URL nào không khớp danh sách endpoint của game thì
**thả qua đường thật**.

## 1.7 Đường dẫn TƯƠNG ĐỐI trong XHR

```js
xhr.open('GET', 'common/is/v2/is?app_name=x');   // không scheme, không "/" đầu
```

Trên web nó ghép với origin nên vẫn tới nơi. Mini-game **không có origin để
ghép** → đi thẳng ra `tt.request` → nền tảng chặn.

Mẫu khớp của lớp mock phải nhận **cả dạng không có `/` mở đầu**:

```js
function pathRe(p) { return new RegExp('(^|/)' + p); }
```

Lỗi đã gặp: mẫu cũ viết `/\/common\/is\/is/` nên trượt đúng dạng này, và fixture
đã viết sẵn không bao giờ được dùng.

## 1.8 Fixture phải khớp với chính config của game

Không chỉ "đúng hình dạng JSON" — **giá trị** phải nằm trong tập mà game chấp nhận.

Lỗi đã gặp: fixture trả tỉnh `"Vietnam"`, nhưng `config/rank` của game dùng mã số
tỉnh. Code làm thế này:

```js
var self = list.find(function (x) { return x.country === user.country; });
item.init(self, ...);   // self là undefined → đọc .country → TypeError
```

→ **bảng xếp hạng vỡ** mỗi lần mở. Viết fixture xong phải có test đối chiếu giá
trị với file config tương ứng trong project.

---

# PHẦN 2 — Đóng gói: trần dung lượng và hình dạng gói

## 2.1 Trần dung lượng (TikTok, engine không phải Unity)

| Hạng mục | Trần |
|---|---|
| Gói chính | **4 MB** |
| Mỗi subpackage độc lập | **4 MB** |
| Tổng cả gói | **30 MB** (Unity: 60 MB) |

Nguồn: [TikTok Mini Games Technical Overview](https://developers.tiktok.com/docs/en/mini-games-technical-overview).
Douyin/WeChat có con số riêng, nhưng 4 MB gói chính thì giống nhau.

**Vượt trần không báo lỗi lúc build.** Nó bị từ chối lúc upload / lúc mở, và
thông báo là câu chung chung kiểu "Không thể mở… Đã xảy ra lỗi."

**Lỗi đã gặp:** subpackage `font` nặng **6,46 MB**, tất cả nằm trong một file
`.ttf`. Font đó là **SRN CookieRun** với **12.563 codepoint, trong đó 11.172 là
Hangul (tiếng Hàn)** — game tiếng Việt không dùng một chữ nào.

Cách xử lý: subset font, **bỏ theo khối Unicode chứ đừng bỏ theo "ký tự đang
dùng"** (text động, tên người chơi, số liệu sẽ thiếu glyph):

```bash
npm i subset-font          # harfbuzz wasm, không cần Python
```

Giữ mọi codepoint trừ Hangul (`U+1100–11FF`, `U+3130–318F`, `U+A960–A97F`,
`U+AC00–D7FF`) → **6.777.008 → 357.620 byte, giảm 95 %**.

**Bắt buộc kiểm chứng không mất chữ**: quét mọi chuỗi hiển thị được trong project
(`_string` trong `.prefab`/`.fire` + literal trong `.js`) rồi so với cmap của
**cả hai** font. Kết quả phải là *cùng một tập thiếu*. Lần đó: cả hai đều thiếu
đúng 227 codepoint (chữ Hán trong log của framework, font gốc vốn đã không có) →
không hề có hồi quy.

⚠ Thay file `.ttf` tại chỗ thì **giữ nguyên `.meta`** → uuid không đổi → không
prefab/scene nào đứt tham chiếu. Nhớ đồng bộ luôn bản trong `library/` phòng khi
Editor không re-import.

## 2.2 `ccRequire.js` giữ require() trỏ vào file đã bị dời

Chỉ xảy ra khi có bước hậu xử lý chuyển bundle xuống subpackage (để lách trần
4 MB). Builder 2.x sinh `ccRequire.js` với đường dẫn **literal**:

```js
'assets/framework/index.js' () { return require('assets/framework/index.js') },
```

Chuyển `assets/framework/` → `subpackages/framework/` mà không sửa file này thì
gói build mang theo `require()` tĩnh trỏ vào **file không tồn tại**. Mà
`ccRequire.js` được `require` từ `game.js` **trước `window.boot()`**, tức là ở
tầng nền tảng tự resolve, không phải shim của bundle.

Cách xử lý: **xoá hẳn mục đó** khỏi `moduleMap`. Bundle nào nằm trong
`settings.subpackages` được adapter nạp bằng `tt/wx.loadSubpackage`, **không bao
giờ** đi qua `__cocos_require__` — nên mục đó là mã chết ở mọi kịch bản.

Đừng "trỏ lại sang `subpackages/<name>/game.js`": đó là đặt một require() tĩnh từ
gói chính vào file không thuộc không gian module của gói chính.

**Bẫy trong chính bước sửa này — đã dính:** hàm dọn nhận danh sách *bundle vừa di
chuyển trong lần chạy đó* rồi `return` sớm khi danh sách rỗng. Nghĩa là nó **im
lặng không làm gì** khi:

- chạy đóng gói lần hai trên thư mục đã đóng gói (không di chuyển gì cả), hoặc
- builder ghi lại `ccRequire.js` **sau** bước đóng gói.

→ Bước dọn phải **bám vào đĩa**, không bám vào lần chạy: đọc đường dẫn trong từng
dòng `moduleMap`, xoá dòng nào có file đích không tồn tại **và** bundle đó đã nằm
dưới `subpackages/`. Điều kiện thứ hai là cần — chỉ kiểm "file không tồn tại" là
quá rộng và sẽ xoá nhầm mục còn sống.

## 2.3 `ccRequire.js` là file ES6 duy nhất trong gói

Builder 2.x sinh nó bằng `let`, method viết tắt, template literal. Engine và mọi
bundle khác đều đã biên dịch xuống ES5 — **chỉ mình nó** còn ES6.

`project.config.json` có `"es6": true`, nhưng đó là cờ của **DEVTOOLS**: nó chỉ
transpile khi upload *qua devtools*. Nén zip đẩy thẳng lên console thì không ai
transpile cả.

Hạ xuống ES5 gần như miễn phí, chỉ ba phép thay:

```js
.replace(/(^|[^\w.$])let(\s+[A-Za-z_$])/g, '$1var$2')          // let → var
.replace(/('[^']+')(\s*)\(\s*\)(\s*)\{/g, '$1: function ()$3{') // 'k' () {} → 'k': function () {}
// template literal → nối chuỗi
```

Sau khi thay **phải `new Function(text)`** để chắc còn parse được, và phải có test
chạy thật `__cocos_require__` chứ không chỉ so khớp chuỗi.

## 2.4 Hình dạng file .zip

Hai lỗi, cả hai đều làm nền tảng không thấy entry point.

**(a) Bọc thêm thư mục.** Nén bằng chuột phải trên Windows ("Send to →
Compressed folder") cho ra `build.zip` chứa `build/game.json` — **tầng 2**. Nền
tảng tìm `game.json` ở **ngay gốc archive**. Phải nén *nội dung của* thư mục,
không nén chính thư mục.

**(b) Dấu phân cách `\`.** Đặc tả ZIP bắt buộc `/`, nhưng trên Windows cả
`Compress-Archive` (PowerShell 5.1) lẫn `ZipFile.CreateFromDirectory`
(.NET Framework) đều ghi `\` vì chúng dùng `Path.DirectorySeparatorChar`. Bộ giải
nén nào đúng đặc tả sẽ hiểu `subpackages\framework\game.js` là **tên file** chứ
không phải đường dẫn → ra một gói phẳng, không có entry point ở đâu cả.

Đã đo: **271/271 entry sai**. Nên tự ghi container ZIP bằng Node (`zlib.deflateRawSync`
+ local header + central directory + EOCD) — luôn `/`, không phụ thuộc máy.
Script `zip-minigame.js` làm sẵn, và nó **tự đọc lại file vừa tạo** để kiểm.

## 2.5 `subPackages` viết hoa chữ P

Tài liệu TikTok ghi rõ: viết `subPackages` thì các file đó **bị tính vào gói
chính**, gây lỗi kiểm dung lượng và **có thể chặn upload**. Khoá đúng là
`subpackages`, viết thường toàn bộ.

## 2.6 Asset nằm nhầm trong gói chính vì `priority` của bundle

Trước khi subset hay xoá bất cứ thứ gì: **xem nó đang nằm ở bundle nào, và vì
sao**. Trong 2.x, asset được nhiều bundle tham chiếu sẽ thuộc về bundle có
`priority` **cao nhất** — mà `main` = 7, cao hơn mặc định của bundle tự tạo.

Hệ quả rất dễ chẩn đoán nhầm: `assets/font/tt.ttf` nằm trong bundle `font`,
nhưng **một** `cc.Label` trong scene khởi động trỏ `_N$file` vào nó là đủ để
6,46 MB font bị hút vào **gói chính**, còn `subpackages/font/` thì rỗng. Dấu
hiệu chắc chắn nằm trong `config.json` của bundle bị rỗng:

```json
{ "paths": {"0": ["tt", 0]}, "redirect": [0, 0], "deps": ["main"] }
```

`redirect` + `deps: ["main"]` = "asset này đã bị gói khác lấy mất".

Cách sửa thường **không** phải đổi `priority` (dễ làm scene khởi động phụ thuộc
một bundle chưa nạp), mà là **bỏ tham chiếu trực tiếp** trong scene — đặt
`_N$file: null` + `_isSystemFontUsed: true` — rồi để runtime gán lại sau khi
bundle tải xong. Ở các game Trung Quốc, `Label.onLoad` thường đã bị vá sẵn để
làm đúng việc đó; chỉ cần thêm bước gán bù cho những Label đã `onLoad` **trước**
khi font về, nếu không chúng kẹt font hệ thống suốt vòng đời scene.

Công cụ đóng gói nên **kê 5 file lớn nhất trong gói chính** khi vượt trần. Câu
hỏi tiếp theo bao giờ cũng là "tại sao", và câu trả lời gần như luôn là mục này.

## 2.7 Module engine KHÔNG dùng vẫn được `require` lúc boot

`game.js` do builder sinh ra nạp `physics-min.js` ở **dòng thứ tư**, trước cả
`__globalAdapter.adaptEngine()`:

```js
require('adapter-min.js');
__globalAdapter.init();
require('cocos/cocos2d-js-min.js');
require('physics-min.js');        // ← vô điều kiện
```

File đó là **cannon.js (3D physics)**. Game không có một `cc.Collider`/
`RigidBody` nào thì đây là 200 KB chết — nhưng tệ hơn: theo tài liệu ByteDance,
**native physics chỉ chạy trên TikTok Android** và đòi app ≥ v16.3. Tức là một
phụ thuộc **chỉ Android mới đụng tới, nằm ngay trong boot, đổi lại không được
gì** — đúng hình dạng của "iOS chạy, Android không vào nổi màn loading".

Kiểm module nào thật sự cần (bằng chứng, không phỏng đoán) — liệt kê mọi
component có trong scene/prefab:

```bash
grep -rho '"__type__": *"\(cc\|sp\|dragonBones\)\.[A-Za-z0-9_]*"' assets \
  --include=*.fire --include=*.prefab | sort | uniq -c | sort -rn
```

⚠ Component nằm **inline** trong `_components`, không phải phần tử riêng của
mảng JSON. Quét phẳng mảng gốc sẽ ra "0 component script" và dẫn tới kết luận
sai hoàn toàn (đã dính: tưởng prefab mất hết component). Phải duyệt **đệ quy**.

Rồi ghi `excluded-modules` vào `settings/project.json`, tên module lấy đúng từ
`<editor>/resources/engine/modules.json`. Danh sách an toàn cho game 2D thuần:
`3D Physics/cannon.js`, `3D Physics/Builtin`, `3D Particle`, `3D Primitive`,
`Physics`, `Collider`, `Intersection`, `TiledMap`, `VideoPlayer`, `WebView`,
`DragonBones`, `StudioComponent`, `EditBox`, `RichText`. **Đừng** cắt
`3D`/`Mesh`/`Geom Utils` — chúng cấp assembler cho Label/Sprite: rủi ro cao,
lời ít.

Sau khi build lại, kiểm `game.js` **không còn** `require('physics-min.js')`.

## 2.8 Id nền tảng ở 2.x là `bytedance`, không phải `bytedance-mini-game`

Chuỗi `bytedance-mini-game` là id của **3.x**; nó **không tồn tại ở bất kỳ đâu**
trong Editor 2.4.14 (kiểm bằng `grep -a` trên `app.asar`). Chép id 3.x vào một
extension 2.x thì móc `builder:build-finished` **bỏ qua mọi build Douyin trong
im lặng** — không log, không lỗi, chỉ là không bao giờ chạy, và người dùng cứ
phải bấm menu tay mãi mà không hiểu vì sao.

Thêm một tầng nữa: panel Build của 2.4.x lưu **hai** khoá —
`platform: "mini-game"` là *nhóm*, nền tảng thật nằm ở
`actualPlatform: "bytedance"` (xem `local/builder.json`). Hàm dò nền tảng phải:

- ưu tiên `actualPlatform` trước `platform`,
- coi `"mini-game"` là **"chưa rõ"**, không phải "không phải mini-game",
- và để chốt cuối là "thư mục có `game.json` không" — chỉ build mini-game mới có.

## 2.9 Editor cache extension lúc khởi động

Sửa code của một extension trong `packages/` (2.x) hay `extensions/` (3.x) thì
**Editor vẫn chạy bản cũ trong bộ nhớ** cho tới khi khởi động lại. Đã mất một
vòng test vì tưởng bản vá đã có hiệu lực.

→ Sau khi sửa extension: **khởi động lại Cocos Creator**, hoặc chạy bước hậu xử
lý bằng CLI (`node packages/<ext>/pack.js <build-dir>`) và kiểm lại bằng script.

---

# PHẦN 3 — Khi gói đã sạch mà vẫn không mở được

Hết phần có thể sửa từ source. Theo
[TikTok troubleshooting](https://developers.tiktok.com/docs/en/mini-games-development-troubleshooting),
phần còn lại nằm ở **console và tài khoản**:

- Tài khoản chưa được thêm vào **test user list**, hoặc đã thêm nhưng **khác tài
  khoản đang quét mã**
- **Region của tài khoản lệch với region preview**
- Tài khoản **vị thành niên** → không debug được
- Đang mở **version code cũ**, không phải bản vừa upload
- Domain chưa khai trong whitelist (request bị chặn, không phải lỗi mở gói)

Hai câu hỏi chốt được nhanh nhất khi "máy này chạy, máy kia không":

1. Hai máy mở bằng **cùng một đường** không — cùng bản đã upload, hay một bên
   qua devtools preview? Hai đường đó khác nhau hoàn toàn.
2. Hai máy có đang đăng nhập **cùng một tài khoản**, và tài khoản đó nằm trong
   test user list chưa?

Và thứ thật sự cần: **real device debug của devtools trên chính máy hỏng**. Lỗi ở
tầng host không để lại dấu vết nào trong source.

## Cách làm việc: log máy thật trước, suy luận sau

Một ca thật đi qua **bốn** lỗi nối đuôi nhau, mỗi lỗi chỉ lộ ra sau khi lỗi
trước được sửa: `documentElement.style` → `new Event()` → `Object.assign({}, tt)`
→ `new ThinkingAnalyticsAPI()` → rồi mới tới quảng cáo hai tầng. Mỗi vòng chỉ
tốn một lần build vì **mỗi lần đều có log vConsole của máy thật**.

Rút ra:

- **Đừng đoán khi chưa có log.** Ba lỗi đầu đều "hợp lý" theo nhiều giả thuyết
  khác nhau; chỉ dòng log cuối cùng trước khi đứng mới chỉ đúng chỗ. Dòng cuối
  cùng ấy là dữ kiện mạnh nhất — nhìn xem **ngay sau nó** code làm gì.
- **Đừng chữa một lỗi rồi hứa là xong.** Khi đã biết lớp này còn ba lớp nữa,
  hãy nói trước với người dùng thay vì để họ build lại bốn lần và mất niềm tin.
- **Sửa xong lỗi im lặng, đừng để nó im lặng tiếp.** Nguồn gốc của cả bốn vòng
  là `Loading.js` reject bằng `r()` — **không tham số, không log**, và promise
  bị `update()` vứt đi nên rejection biến mất. Vá ngay khi đụng tới:

  ```js
  cc.assetManager.loadBundle('framework', { maxRetryCount: 1 }, function (err) {
      err && cc.error("[loading] không nạp được bundle 'framework':", err.stack || err);
      …
  });
  this.run().catch(function (e) { cc.error('[loading] khởi động thất bại:', e); });
  ```

- **Mọi callback `loadBundle` phải kiểm null.** Code recover hay viết
  `function (err, bundle) { bundle.load(...) }`. Bundle hỏng ⇒
  `Cannot read property 'load' of null`, và nếu nó nằm trong một hàm đã đặt
  `node.opacity = 0` từ trước thì node biến mất luôn — triệu chứng trông như
  lỗi UI chứ không như lỗi mạng.
- **"Chạy trên trình duyệt" không chứng minh gì.** Devtools của nền tảng chạy
  trong Chromium thật nên adapter chỉ điền chỗ thiếu; DOM thật vẫn thắng. Bản
  web lại đi nhánh `DevPlatform` và bỏ qua toàn bộ code `(window.tt || window.ks) &&`.
  Hai môi trường đó **không** kiểm chứng được nhánh mini-game.
- **Test được phần lớn chuyện này mà không cần máy.** Dựng một sandbox `vm` mô
  phỏng đúng hình dạng DOM giả của adapter (`documentElement === window`, không
  `style`, không `Event`, không `fetch`) rồi nạp thẳng các plugin script và
  module framework vào đó. Mỗi test nên kèm **nhánh "bản cũ"** dựng lại code
  trước khi sửa và khẳng định nó **hỏng** — không có nhánh đó thì test không
  chứng minh được gì.

---

# Script kiểm tra

Chạy được độc lập, chỉ cần `node`. Không script nào sửa file — chúng chỉ báo.

| Script | Việc |
|---|---|
| `check-minigame-package.js <build-dir>` | Trần dung lượng (gói chính / từng subpackage / tổng), `require()` chết ở tầng gói, cú pháp ES6 còn sót trong `game.js`/`main.js`/`ccRequire.js` |
| `check-minigame-globals.js <build-dir> [source-dir]` | Global trình duyệt mà adapter không dựng — quét **cả source lẫn bundle đã build**. Danh sách "adapter có gì" đọc thẳng từ `adapter-min.js` |
| `zip-minigame.js <build-dir> [out.zip]` | Chạy hai cổng trên, chỉ nén khi qua. Nén nội dung ở gốc archive, luôn `/`, rồi đọc lại chính file vừa tạo để kiểm |

## Gộp thành một nút trong Cocos Creator 2.x

Ba bước này chỉ đúng khi đi liền nhau và **đúng thứ tự** — nén trước khi đóng gói
là ra gói chưa có subpackage; đóng gói xong mà nén bằng chuột phải là ra zip bọc
thêm thư mục và dùng dấu `\`. Cả hai chỉ lộ ra sau khi upload. Nên gộp vào một
mục menu của package `minigame-pack` (Cocos 2.x dùng `main-menu` trong
`package.json`, không phải `contributions` như 3.x):

```json
"main-menu": {
  "Build nhanh/🗜 Đóng gói + nén .zip để upload…": { "message": "minigame-pack:pack-and-zip" }
}
```

Handler: `packSubpackages` → `audit` + `verifyPackaged` → `zipBuild`.

**Kiểm phải CHẶN việc nén**, không phải cảnh báo rồi vẫn nén — không có lý do gì
tạo ra một file zip mà ta đã biết nền tảng sẽ từ chối.

⚠ Tự ghi container ZIP bằng `zlib.deflateRawSync` + local header + central
directory + EOCD. Editor 2.4 nhúng Node cũ và package không có `node_modules`,
nên đừng phụ thuộc thư viện ngoài. Và nhớ **đọc lại file vừa ghi** để kiểm
`game.json` ở gốc + không entry nào dùng `\`.

⚠ **Sửa code extension xong phải khởi động lại Editor** — xem §2.6.

## Checklist trước khi upload

- [ ] `check-minigame-package.js` → exit 0
- [ ] `check-minigame-globals.js` → exit 0 (**sau khi Build**, không phải trước)
- [ ] `zip-minigame.js` → exit 0, và nó in ra danh sách file ở gốc archive
- [ ] Giải nén lại rồi `diff -r` với thư mục build → khớp từng byte
- [ ] Game chạy được khi **rút mạng**
- [ ] `game.js` không `require` module engine mà game không dùng
      (`physics-min.js` — §2.7)
- [ ] `excluded-modules` đã ghi trong `settings/project.json`, dựa trên danh
      sách component **quét được từ scene/prefab**, không phải phỏng đoán
- [ ] Không còn `new <SDK>(` nào trỏ tới global mà port không mang theo (§2.3
      của `shims-and-mobile.md`)
- [ ] Bấm **từng** chỗ có quảng cáo trên máy thật → phần thưởng vào, game
      không treo (`cc.game.pause()` có `resume()` đối ứng)
- [ ] Mở scene trong Editor rồi `git diff` → **không** scene nào tự đổi
      (prototype bị vá đè đang ghi bẩn — xem `rebuild-2x.md`)
- [ ] Đã thử trên **cả Android và iOS**, cùng một bản upload, cùng một tài khoản
