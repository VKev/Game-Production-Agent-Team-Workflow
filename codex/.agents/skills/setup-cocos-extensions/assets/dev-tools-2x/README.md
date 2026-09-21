# dev-tools (Cocos Creator 2.x) — menu "Dev nhanh"

Bản Creator **2.x** của [dev-tools](../dev-tools/README.md). Cùng mục đích, khác
cách nạp: 2.x nạp extension từ `packages/<name>/` chứ không phải `extensions/`.

Cài vào: `<project>/packages/dev-tools/`.

| Mục menu | Làm gì | Cần khởi động lại Editor? |
|---|---|---|
| 📊 Xem dung lượng cache | Liệt kê `library` `temp` `build` `local` + tổng | — |
| 🧹 Xoá cache Editor | `library/` + `temp/` | **có** |
| 📦 Xoá thư mục build | `build/` | không |
| ⚙️ Xoá cấu hình cục bộ | `local/` | **có** |
| 🔥 Xoá cache Editor + cấu hình | `library` `temp` `local` — **KHÔNG đụng `build/`** | **có** |
| 💾 Xoá save game | localStorage của preview — xem bên dưới | không |
| 🎮 Bảng lệnh Dev cho Game Design | Trỏ tới `dev.*` của project | — |
| 🔄 Refresh assets | `Editor.assetdb.refresh('db://assets')` | — |
| ▶️ Mở game preview | trang preview trong trình duyệt | — |
| 📂 Mở thư mục project | Explorer/Finder | — |

Mọi thao tác xoá đều hỏi xác nhận kèm số file và dung lượng sẽ mất. Không hỏi
được thì **không xoá** (fail-closed) — xem `ask()` trong `main.js`.

## Khác gì bản 3.x

| | 3.x | 2.x (file này) |
|---|---|---|
| Thư mục cài | `extensions/<name>/` | `packages/<name>/` |
| Entry | `browser.js` | `main.js` |
| Khai báo menu | `contributions.menu` | `main-menu` trong package.json |
| Handler | `module.exports.methods` | `module.exports.messages` |
| Khoá handler | `cacheReport` | `'cache-report'` (không kèm tiền tố package) |
| Refresh asset | `Editor.Message.request('asset-db', …)` | `Editor.assetdb.refresh(url, cb)` |
| Cấu hình cục bộ | `profiles/` + `local/` | chỉ `local/` — 2.x không có `profiles/` |

Hai mục menu của bản 3.x **không có** ở đây, có lý do:

- **🌐 Mở bảng Dev** mở `preview-template/dev-tools.html`. Trang đó là tài sản
  của một project 3.x cụ thể, không phải của extension. Bản 2.x không giả vờ là
  nó tồn tại.
- Vì không có trang đó, **💾 Xoá save game** chỉ xoá được storage trong phiên
  Electron của Editor (Game view / cửa sổ preview nội bộ). localStorage của
  **trình duyệt ngoài** thuộc origin của trình duyệt — hộp thoại nói thẳng là
  phải tự xoá bằng `localStorage.clear()` trong F12, chứ không im lặng để người
  dùng tưởng đã xoá.

## ⚠ `build/` tách riêng, cố ý

"Xoá cache Editor + cấu hình" **không** gộp `build/`. `library/`+`temp/` thì
Cocos dựng lại được; `build/` thì phải build lại, và nếu asset nguồn đã hỏng thì
không build lại được nữa. Muốn xoá build thì bấm riêng mục "📦 Xoá thư mục build".

## Danh sách trắng khi xoá

`cache.js` chỉ cho phép xoá `library`, `temp`, `build`, `local`. Mọi thứ khác —
nhất là `assets/`, `settings/` (cấu hình project dùng chung, có trong git) và
`packages/` (chính các extension này) — bị từ chối và ghi vào `errors`.

Xoá thật ra làm hai nhịp: `rename` thư mục vào `.dev-tools-trash/` (thao tác
nguyên tử, ăn thư mục ra khỏi tầm nhìn Editor ngay), rồi xoá nền. Editor tắt
giữa chừng thì `load()` lần sau dọn nốt.

> `.dev-tools-trash/` nằm trong project root vì `rename` đòi cùng ổ đĩa. Nhớ để
> `.gitignore` bỏ qua nó — `setup-cocos-gitignore` làm sẵn việc này.

## Tương thích Node

Creator 2.4 nhúng Electron/Node cũ hơn 3.8 nhiều. `fs.promises.rm` chỉ có từ
Node 14.14, nên `cache.rmrf()` ưu tiên API mới rồi rơi xuống `rmdirSync
({recursive:true})` và cuối cùng là tự đệ quy. Bê thẳng `fs.promises.rm` của bản
3.x sang thì trên Editor 2.x nó `undefined` và thùng rác không bao giờ được dọn.

Bề mặt API Editor 2.4.x lệch nhau giữa các bản vá, nên `projectRoot()`,
`ask()`, `quitEditor()` đều dò nhiều tên gọi rồi mới dùng. Một menu item chết
lặng tệ hơn một dòng log nói rõ vì sao.

## Test

```
node packages/dev-tools/test.js
```

Chạy bằng node thuần, không cần mở Editor: `Editor` và `electron` được thay bằng
bản giả, mọi thao tác file diễn ra trên project giả dưới `os.tmpdir()`.

Có một nhóm test đáng chú ý: **package.json ↔ main.js**. Hợp đồng dễ vỡ nhất của
extension 2.x là menu khai báo `"dev-tools:<msg>"` còn Editor dispatch vào
`messages["<msg>"]` — lệch một chữ là menu item chết lặng, không có lỗi nào cả.
Test kiểm cả hai chiều: mọi menu item có handler, và mọi handler có menu item.
