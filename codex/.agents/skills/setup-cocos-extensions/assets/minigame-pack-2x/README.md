# minigame-pack (Cocos Creator 2.x) — menu "Build nhanh"

Bản Creator **2.x** của [minigame-pack](../minigame-pack/README.md): hậu xử lý
thư mục build mini-game để **giảm số file** trong gói.

Cài vào: `<project>/packages/minigame-pack/`.

## Vấn đề gốc (giống hệt 3.x)

Cocos chỉ cho chọn **một** `compressionType` cho mỗi bundle:

| Lựa chọn | Được | Mất |
|---|---|---|
| `subpackage` | bundle nằm ở `subpackages/`, lách trần 4 MB gói chính | không gộp JSON → hàng nghìn file `.json` |
| gộp JSON | còn vài file `.json` | bundle nằm trong gói chính → vỡ trần 4 MB |

Extension này build kiểu gộp JSON rồi **tự chuyển** bundle xuống subpackage:

```
assets/<name>/   →  subpackages/<name>/
index.js         →  game.js          (WeChat/Douyin yêu cầu entry tên game.js)
game.json        +  { subpackages: [{ name, root }] }
engine settings  +  subpackages: [name]
```

## Khác biệt thật sự so với bản 3.x

Đây là lý do file `pack.js` phải viết lại chứ không dùng chung được:

| | 3.x | 2.x |
|---|---|---|
| Engine settings | `src/settings.json` (JSON thuần) | `src/settings.js` — JS gán `window._CCSettings = {...};` |
| Danh sách subpackage | `settings.assets.subpackages` | `settings.subpackages` |
| Móc sau build | `contributions.builder` → `onAfterBuild(options, result)` | IPC `builder:build-finished` |

Bê nguyên bản 3.x sang 2.x thì nó không thấy `src/settings.json`, ném lỗi và
dừng. Nguy hiểm hơn là "sửa" bằng cách bỏ qua bước settings: gói build ra vẫn
chạy trên máy dev (bundle còn trong gói chính) và **chỉ chết khi lên nền tảng
thật**. Nên `readSettings()` dò cả hai hình dạng và **từ chối rõ ràng** khi
không nhận ra hình dạng nào, thay vì ghi bừa.

`pack.js` vì thế chạy được cho **cả hai** đời build — hữu ích khi một project
2.x đang được nâng dần lên 3.x.

### Dừng trước khi di chuyển file

`packSubpackages()` đọc engine settings **trước** khi `rename` bất kỳ thư mục
nào. Settings hỏng mà đã kịp chuyển nửa số bundle thì build ở trạng thái nửa
vời, không chạy mà cũng không rollback được. Có test cho đúng tình huống này.

## Móc tự động sau build

2.x **không có** `contributions.builder`. Thay vào đó package nghe IPC
`builder:build-finished` qua `messages`. Payload của event lệch nhau giữa các
bản vá 2.4, nên `resolveBuildDir()` dò `dest` / `buildPath` / `paths.buildDir` /
`options.buildPath` / `result.dest`, và chỉ nhận đường dẫn nào **thật sự có
`game.json`**. Không dò ra thì log một dòng nói rõ, không đoán.

Vì cái móc đó phụ thuộc vào một event không có hợp đồng ổn định, mục menu
**"📦 Đóng gói lại thư mục build mini-game…"** luôn tồn tại và là đường đi **chắc
chắn đúng**: nó chỉ cần một thư mục có `game.json`.

Chỉ hai nền tảng được đóng gói — `wechatgame` và `bytedance-mini-game`. Lưu ý id
Douyin/TikTok là `bytedance-mini-game`, **không phải** `bytedance`.

## `deviceOrientation`

`forcePortrait()` ghim `"portrait"` vào `game.json`. Hướng máy vốn do dropdown
của panel Build quyết định — một lựa chọn nằm trên máy người build chứ không
nằm trong repo, nên ai lỡ đổi một lần là ra bản landscape mà git không nói gì.

⚠ Phải gọi **sau** `packSubpackages()`: hàm đó ghi đè `game.json` để khai báo
subpackages, sửa trước là mất trắng. Có test cho thứ tự này.

## Chạy tay

```
node packages/minigame-pack/pack.js <thư-mục-build> [tên-bundle...]
```

Không cần mở Editor. Idempotent: chạy lại trên thư mục đã đóng gói thì bỏ qua.

## Test

```
node packages/minigame-pack/test.js
```

Phủ: parse `window._CCSettings` (JSON thuần, object literal JS, thiếu dấu chấm
phẩy, dạng lạ → ném lỗi), chọn đúng file settings theo đời engine, đóng gói
end-to-end trên build 2.x **và** 3.x, entry có md5, idempotent, từ chối an toàn
khi thiếu `game.json`/settings, và dò thư mục build từ mọi hình dạng payload.
