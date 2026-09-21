# dev-tools — menu "Dev nhanh" trên thanh menu Editor

Bộ công cụ dev hay dùng, gom vào một menu ở top bar Cocos Creator, cạnh
`Build nhanh` của [minigame-pack](../minigame-pack/README.md).

| Mục menu | Làm gì | Cần khởi động lại Editor? |
|---|---|---|
| 📊 Xem dung lượng cache | Liệt kê `library` `temp` `build` `profiles` `local` + tổng | — |
| 🧹 Xoá cache Editor | `library/` + `temp/` | **có** |
| 📦 Xoá thư mục build | `build/` (chặn nếu đang build) | không |
| ⚙️ Xoá cấu hình cục bộ | `profiles/` + `local/` | **có** |
| 🔥 Xoá cache Editor + cấu hình | `library` `temp` `profiles` `local` — **KHÔNG đụng `build/`** | **có** |
| 💾 Xoá save game | localStorage của preview — xem bên dưới | không |
| 🎮 Bảng lệnh Dev cho Game Design | Hiện cheat sheet `dev.*` + mở game — xem bên dưới | — |
| 🔄 Refresh assets | `asset-db refresh-asset db://assets` | — |
| 🌐 Mở bảng Dev | `preview-template/dev-tools.html` trong trình duyệt | — |
| ▶️ Mở game preview | trang preview trong trình duyệt | — |
| 📂 Mở thư mục project | Finder | — |

Mọi thao tác xoá đều hỏi xác nhận, có kèm số file và dung lượng sẽ mất.
Không hỏi được thì **không xoá** (fail-closed) — xem `ask()` trong `browser.js`.

## ⚠ `build/` tách riêng, cố ý

"Xoá TẤT CẢ" **không còn** gộp `build/` (sửa 2026-08-01). Lý do có thật: `build/`
chứa bản serialize của mọi asset đã ship, và đã có lần nó là **nguồn khôi phục
duy nhất** khi một `.prefab` nguồn bị ghi hỏng. `library/`+`temp/` thì Cocos dựng
lại được, `build/` thì phải build lại — và nếu asset nguồn đã hỏng thì không
build lại được nữa. Muốn xoá build thì bấm riêng mục "📦 Xoá thư mục build".

## Bảng lệnh Dev cho Game Design (`dev.*`)

Định nghĩa ở [`assets/scripts/dev/DevKit.ts`](../../assets/scripts/dev/DevKit.ts),
nạp ở cuối `bootstrap.ts`. Mở game preview → **F12** → gõ `dev.help()`.

| Nhóm | Lệnh |
|---|---|
| Màn chơi | `dev.levels()` · `dev.chapter(0)` · `dev.level(0, 3)` · `dev.train()` · `dev.ball(0)` |
| Tiền & đồ | `dev.wallet()` · `dev.give(DIAMOND, 1000)` · `dev.giveInRun(GOLD, 500)` · `dev.equip("machine_gun", 5)` |
| Tiến độ | `dev.clearRun()` · `dev.skipTutorial()` · `dev.unlockStage(50)` · `dev.guide()` |
| Dữ liệu cục bộ | `dev.storage()` · `dev.clearStorage()` · `dev.clearStorage(true)` · `dev.reload()` |
| Trong trận | `dev.god()` · `dev.speed(3)` · `dev.killAll()` |

**Vì sao là lệnh Console chứ không phải nút trong Editor.** Save game đi qua
`privacy.encodeFromJson` (mã hoá + md5). Một trang ngoài như `dev-tools.html`
muốn ghi thẳng thì phải dựng lại thuật toán đó — sai một nhịp là hỏng save.
`dev.*` chạy TRONG game nên gọi đúng hàm gốc (`adventure.start`,
`net.updateData`, `chapter.add`…), dữ liệu luôn hợp lệ và đúng luật chơi.

`dev.clearRun()` là lệnh hay cần nhất: nó xoá lượt dang dở — thứ khiến game
"vừa vào đã nhảy thẳng vào trận" thay vì qua màn hình chính
(`chapter.canRecall` → `chapter.continue`).

Muốn cắt DevKit khỏi bản phát hành: xoá dòng `import './dev/DevKit';` ở cuối
`bootstrap.ts`. File chỉ gắn `globalThis.dev`, không tự chạy gì.

## Không bao giờ xoá nhầm

`cache.js` có danh sách trắng `CLEARABLE = [library, temp, build, profiles, local]`
— đúng những thứ `.gitignore` đã coi là bỏ đi được. Truyền tên khác vào `trash()`
thì ném lỗi. `assets/` và `settings/` (cấu hình project dùng chung, nằm trong git)
không có đường nào chạm tới.

## Tại sao rename chứ không xoá thẳng

Editor đang mở thì asset-db vẫn giữ handle và vẫn ghi tiếp vào `library/`.
Xoá đệ quy nửa chừng để lại cây thư mục vỡ và Editor nổ ngay giữa lúc import.

Nên thay vì xoá, ta **đổi tên** thư mục vào `.dev-tools-trash/<tên>-<timestamp>`.
`rename` là thao tác nguyên tử, ăn thư mục ra khỏi tầm nhìn của Editor tức thì.
Xoá thật chạy ở nền sau đó; nếu Editor tắt giữa chừng thì `load()` lần mở sau
dọn nốt. Vì phải cùng ổ đĩa nên thùng rác nằm ngay trong project root
(đã thêm vào `.gitignore`).

## localStorage nằm ở HAI nơi tách biệt

Đây là chỗ hay nhầm nhất.

| Chạy preview ở đâu | localStorage nằm đâu | Xoá bằng gì |
|---|---|---|
| Trình duyệt ngoài (Preview → browser) | profile của Chrome/Safari | chỉ trang cùng origin xoá được → `dev-tools.html` |
| Game view / cửa sổ preview trong Editor | phiên Electron của Editor | `session.clearStorageData` |

Một nút bấm không với tới cả hai, nên `💾 Xoá save game` làm cả hai:
mở `dev-tools.html` bằng trình duyệt mặc định, **và** (chỉ khi chọn "Xoá sạch")
gọi `clearStorageData` cho phiên Electron.

`dev-tools.html` để trong `preview-template/` vì server preview của Cocos phục vụ
mọi file ở đó ngay tại gốc (`http://localhost:7456/dev-tools.html`) — cùng origin
với game, điều kiện duy nhất để đọc/xoá được localStorage của nó. Thư mục này chỉ
dùng cho preview, không bao giờ vào bản build (build lấy từ `build-templates/`).

### Reset tiến độ vs Xoá sạch

`Reset tiến độ` bỏ tài khoản, tiền, trang bị, chương đã qua nhưng **giữ**:

```
BGM_VOLUME  SE_VOLUME  VIBRATE  PERSONAL_ADS
DEBUG_MODE  DEBUG_MAP  DEBUG_GAME_SPEED
```

Dữ liệu người chơi nằm ở hai khoá: `userId` giữ id tài khoản cục bộ, và một khoá
nữa **mang chính id đó làm tên** chứa cả cây dữ liệu (xem `userDataMgr.getUserData`).
Trang tự tìm cặp này và gắn thẻ `tiến độ` trong bảng.

`Xoá sạch` bỏ tất cả, kể cả cài đặt và cờ debug.

Editor mở trang kèm `?auto=reset|wipe` (đã xác nhận ở hộp thoại Editor rồi).
Trang chạy xong thì `history.replaceState` bỏ query ngay, để F5 không xoá lần nữa.

### Cờ debug

Bảng Dev cho sửa thẳng `DEBUG_MODE` / `DEBUG_MAP` / `DEBUG_GAME_SPEED` —
`MenuManager.registerEvent` đọc chúng từ localStorage lúc khởi động. Đổi xong
phải tải lại game mới ăn. Lưu ý `DEBUG_MODE` phần lớn chỗ đi kèm `DEV_MODE`
bằng `&&`, nên bản build release bật cờ này cũng không mở được gì.

## Bẫy: dấu `/` trong label menu

Cocos tách `label` theo `/` để dựng menu phân cấp. Label
`"📦 Xoá thư mục build/…"` biến thành submenu `"📦 Xoá thư mục build"` chứa một
mục `"…"`, và **message không được gắn** → bấm vào không có gì xảy ra, không báo
lỗi. Đừng cho `/` vào label.

Kiểm nhanh menu đã đăng ký đúng chưa (Console của Editor):

```js
const m = await Editor.Menu.queryMain();
Object.values(m['Dev nhanh'].submenu).map(i => [i.label, i.type, i.message?.name]);
// mọi mục phải là type 'normal' và có message
```

## Test

```bash
node extensions/dev-tools/test.js     # 51 test, không cần mở Editor
node extensions/dev-tools/cache.js    # in báo cáo dung lượng cache
```

`test.js` thay `Editor` + `electron` bằng bản giả và dựng một project giả dưới
`os.tmpdir()`, nên chạy được cả khi Editor đang đóng và không đụng project thật.

## Nạp lại extension không cần restart Editor

```js
const dir = require('path').join(Editor.Project.path, 'extensions', 'dev-tools');
await Editor.Package.disable(dir);
await Editor.Package.unregister(dir);
await Editor.Package.register(dir);
await Editor.Package.enable(dir);
```

Sửa `browser.js` thì xoá cache require trước khi register lại
(`delete require.cache[require.resolve(dir + '/browser.js')]`).
