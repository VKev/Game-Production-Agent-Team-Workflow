# GĐ6 — Tối ưu dung lượng & phát hành

Game chạy được ≠ ship được. Mini-game có **trần dung lượng cứng**, và bản build
lộ ra một lớp bug mà preview không có.

⛔ **Cổng ra:** số đo dung lượng **thật trên bản build** ≤ trần nền tảng, và bản
build chạy đúng trên thiết bị/emulator đích.

⚠️ **GĐ6 là vòng lặp với GĐ5, không phải một chiều.** Trong 6 bước tối ưu dưới
đây chỉ ① là an toàn (nén lossless có verify từng pixel) — **5 bước còn lại đều
phá được runtime**. Làm cả 6 rồi mới verify một lần thì lúc vỡ phải bisect trên 6
thay đổi đắt.

Luật: **sau MỖI bước, chạy lại tập kiểm rẻ** —

```bash
python3 <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/cdp.py diag --serve <build-dir> --out after-step-N
```

boot không lỗi đỏ + vào được scene đầu + `visible` khớp `design`. Chỉ chạy lại
full loop win/lose của GĐ5 **một lần ở cuối**, hoặc ngay khi tập kiểm rẻ đổi màu.

---

## 1. Trần dung lượng (WeChat / Douyin mini-game)

| Phần | WeChat | TikTok / Douyin |
|---|---|---|
| Gói chính (main package) | **4 MB** | **4 MB** |
| Mỗi subpackage | **20 MB** | **4 MB** |
| Tổng | phần còn lại tải từ CDN | **30 MB** (engine không phải Unity) |

⚠ **Trần subpackage khác nhau giữa hai nền tảng** — 20 MB của WeChat không áp cho
TikTok. Tra lại trần của đúng nền tảng đích trước khi chia gói, đừng lấy bảng này
làm căn cứ cuối.

Đo bằng **kích thước thư mục build thật** (`<build-dir>` từ GĐ1), không phải kích
thước `assets/`, và không bằng `du -sh`.

## 2. Thứ tự tối ưu (theo tỉ lệ lợi ích / rủi ro)

Làm theo thứ tự này; dừng khi đã đạt trần.

### ① Nén ảnh lossless — rẻ nhất, không rủi ro
```bash
python3 <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/optimize-images.py --assets <PROJECT-3X>/<assets-root>
```
Bản tái dựng gần như luôn lưu PNG ở RGBA 32-bit dù ảnh chỉ có ≤256 màu (asset đi
qua bước crop/extract mất palette). `oxipng -o4 --strip safe` hạ color-type khi
không mất mát.

Thực đo: **689 PNG, 22,59 → 9,21 MB (−59%)**, verify **689/689 giống hệt từng
pixel**. Script có backup + tự khôi phục ảnh nào lệch. Xong nhớ `refresh_assets`.

> Benchmark hữu ích: so số lượng ảnh của bản tái dựng với bản gốc. Nếu bản gốc
> 149 PNG mà bản dựng 695 PNG thì **bloat sinh ra từ quá trình tái dựng**
> (atlas bị bung thành ảnh rời), không phải từ game. Cân nhắc đóng atlas lại.

### ② Dữ liệu lặp → format compact
Prefab/JSON sinh ra hàng loạt theo một schema đều thì nén được **hàng trăm lần**
bằng cách bỏ metadata lặp (xem `scene-prefab-mcp.md` §"khi số lượng lớn").
Thực đo: 104 MB → 0,51 MB. Đây thường là khoản lớn nhất.

### ③ Tách subpackage
Cấu hình đúng chỗ (Cocos 3.8): preset builder →
`bundleConfig.custom.<tên-preset>`, và `configs` **keyed theo NHÓM platform**
(`miniGame` / `web` / `native`), **không** phải theo từng platform, và **không**
phải bằng cách đặt `compressionType` vào file `.meta` (đặt ở `.meta` **không ăn**).

Chuyển sang CDN sau này chỉ là đổi `isRemote: true` cho nhóm `miniGame` → build
sinh `remoteBundles: [...]`; **code game không đổi**.

### ④ Cắt module engine
Cocos bật mặc định ~24 module. `dragon-bones`, `tiled-map`, `video`, `webview`,
`gfx-webgl2`, `physics-3d`… phần lớn game 2D không dùng. `cocos-js` thường chiếm
2–2,5 MB gói chính — cắt module là cách duy nhất giảm được phần này.
Rủi ro: tắt nhầm module đang dùng → lỗi runtime, phải verify lại GĐ5.

### ⑤ Giảm số FILE (khác với giảm dung lượng)
Nền tảng mini-game còn giới hạn/khó chịu về **số file**. Hai đòn bẩy:
- Build với `merge_all_json` (gộp hàng nghìn json asset nhỏ thành vài file).
- Extension của Editor tự di chuyển `assets/<bundle>/` → `subpackages/<bundle>/`
  sau build + vá `game.json` và `src/settings.json`.

Thực đo: **2184 → 752 file**, dung lượng gói chính không đổi.

### ⑥ Xoá file trùng — làm CUỐI, cẩn thận
⚠️ Ảnh trong `resources/` được load **theo path lúc chạy**, nên **không được**
xoá theo kết quả quét uuid tĩnh: quét tĩnh không thấy tham chiếu nhưng runtime
vẫn gọi. Chỉ xoá khi đã grep chuỗi path trong toàn bộ `.ts`.

## 3. Bug chỉ xuất hiện ở bản build

Xem `pitfalls.md` §2–§5. Ba nhóm hay gặp nhất:

1. **Resolution policy** — `canvas.fitWidth/fitHeight` của 2.x không tồn tại ở
   3.x nên policy **không bao giờ được set**; mở trên cửa sổ ngang thì canvas
   bung full bề ngang, UI văng ra mép. Editor/preview không lộ ra vì tỉ lệ khung
   preview trùng thiết kế.
2. **Widget stretch bake offset âm** khi instantiate dưới khung rộng → layer
   phình. Phải ép lại Widget về đúng bề rộng thiết kế lúc init.
3. **Camera** — `clearFlags` thiếu bit COLOR gây vệt smear trên một số thiết bị;
   `camera.rect` không khớp `view.getViewportRect()` làm **toạ độ chạm lệch toạ
   độ vẽ** (đo được tới hàng chục đơn vị) → người chơi bấm trượt.

Kiểm nhanh cả ba: `python3 <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/cdp.py diag --serve <build-dir>`.

Đích là nền tảng mini-game thì đọc thêm
`dev-cocos-port-2x/references/minigame-platform.md` — global trình duyệt mà
runtime không dựng, hình dạng `.zip`, `subPackages` viết hoa chữ P, và `priority`
của bundle quyết định asset nằm gói nào. Ba khác biệt của bản 3.x: platform id là
**`bytedance-mini-game`** (2.x là `bytedance`), không có `ccRequire.js`, và SDK
stub nằm trong `build-templates/<platform>/`. Phần build: `dev-cocos-build-minigame`.

## 4. Việc phát hành khác dễ quên

- **Ngôn ngữ hiển thị: không có việc gì ở đây.** Skill này giữ nguyên văn mọi
  chuỗi, không dịch. Nếu khách yêu cầu bản tiếng Anh/đa ngôn ngữ thì đó là **một
  dự án riêng sau khi ship**, ngoài phạm vi skill này.
- **Loại scene công cụ khỏi build** (editor-tool scene) và **chỉ định
  `startScene` bằng uuid** — builder mặc định rơi về scene index 0, rất hay là
  scene test.
- Tắt/guard mọi công cụ dev (bot, debug overlay) bằng `BUILD` từ `cc/env`.
- Chốt lại số đo cuối và ghi vào báo cáo: gói chính / subpackage / tổng file.


---

## 5. Ba thứ của bản mini-game 3.8 hay làm vượt trần / chết build

### 5.1 `engine.json` trống ⇒ ship cả physics 3D

`settings/v2/packages/engine.json` chỉ có `{__version__}` nghĩa là **không cấu
hình module nào**, và 3.8 ship **TẤT CẢ**. Dấu hiệu tại runtime:
`[PHYSICS]: register bullet` trong một game 2D, và `Init SubSystem` mất
**4.7–10 giây** vì nạp wasm.

Đo thật trên một game 2D: `cocos-js` **4.81 MB → 2.3 MB**, `_virtual_cc`
2.92 → 1.7 MB, bullet biến mất hẳn, gói chính **5.80 → 2.84 MB**.

Audit bằng grep trước khi cắt, đừng đoán: `cc.Animation`, `WebSocket`,
`Intersection`, `RichText`, `EditBox`, `VideoPlayer`, `WebView`, `dragonBones`,
`TiledMap` thường **0 lần dùng**.

**Ba cái bẫy nối nhau ở bước này — vấp đủ cả ba mới ship được:**

1. **Sửa tay `engine.json` KHÔNG ăn.** Editor bỏ qua file viết tay. Phải ghi qua
   **`Editor.Profile.setProject`**. Lấy danh sách module ID hợp lệ từ chính Editor
   (55 feature ở 3.8), đừng đoán tên.
2. **Build đầu tiên sau khi đổi module tái dùng engine cache** ⇒ dung lượng
   **không đổi** và bạn tưởng cắt hỏng. Dấu hiệu: build chỉ mất ~53s. Cách biết
   chắc: so **mtime của `_virtual_cc.js` với `game.js`** — cũ hơn nghĩa là cache cũ.
3. **Xoá cache engine để ép build lại thì HỎNG PREVIEW** cho tới khi **khởi động
   lại Cocos Creator**. Hỏng ở hai chỗ: cache engine của Editor và `temp/` của
   project. Triệu chứng: `System is not defined`, hoặc
   `ENOENT ... temp/programming/preview/systemjs/system.js`.
   `Editor.Message.request('engine','quick-compile')` chạy xong (2864 file/35 MB)
   nhưng **không** đủ để preview sống lại.

> **PREVIEW KHÔNG kiểm chứng được thay đổi này** — preview chạy engine bundle đã
> build sẵn trong `scripting/engine/bin/.cache`. Phải build thật.

### 5.2 Builder KHÔNG tự tạo subpackage

Build với `merge_dep` cho ít file nhưng **dồn hết vào gói chính**. Tách subpackage
là bước **sau build**. Thiếu một trong ba việc dưới đây là màn hình đen:

1. chuyển `assets/<bundle>/` → `subpackages/<bundle>/`;
2. đổi tên entry `index.js` → **`game.js`**;
3. vá **CẢ HAI** manifest: `game.json` khoá `subpackages` và `src/settings.json`
   khoá `assets.subpackages`.

`internal` + `main` **phải ở lại** `assets/` — `main` giữ start scene và được preload.

Script sẵn: `scripts/make-subpackages.py` (idempotent, exit khác 0 khi vượt trần).
**Giữ bước này trong tool, đừng để trong đầu ai đó** — nó từng được làm tay, phiên
sau không biết, suýt giao gói vượt trần.

### 5.3 Build qua Editor đang chạy

Khỏi phải đóng Editor để build CLI:

```js
await Editor.Message.request('builder', 'command-build', {
    platform: 'bytedance-mini-game', debug: false,
    buildPath: 'project://build', outputName: 'bytedance-mini-game',
});
```

Nhận **object**, không phải chuỗi CLI (`"platform=web-mobile;..."` sẽ ném
`Cannot create property 'platform' on string`). Message `builder - build` **không
tồn tại**; đọc `contributions.messages` của package `builder` nếu cần tên khác.

Sau khi sửa/di chuyển `.ts` **ngoài** Editor: **`refresh_assets` trước khi build**,
nếu không asset DB còn đường dẫn cũ và build fail với `ModuleNotFoundError`.

### 5.4 Đo dung lượng cho đúng

Đo **tổng byte thật**, loại trừ `subpackages/`. `du -sh` cho số khác và trần nền
tảng thì không tha:

```bash
find . -path ./subpackages -prune -o -type f -printf '%s\n' | awk '{s+=$1} END {printf "%.2f MB\n", s/1048576}'
```

Đóng gói bằng `scripts/make-minigame-zip.py`: forward slash + `game.json` ở root.
**Đừng dùng `Compress-Archive` của PowerShell** — nó ghi tên entry bằng backslash,
sai chuẩn ZIP 4.4.17.1, nền tảng từ chối hoặc giải nén sai.

Server verify build phải gửi `Cache-Control: no-store`, nếu không trình duyệt giữ
`assets/main/index.js` của lần build trước và **bug đã sửa vẫn trông như còn nguyên**.


### 5.5 Preview KHÔNG chạy được với bộ module đã cắt

Đây là hệ quả cố hữu, không phải hỏng hóc: preview chạy **engine bundle đầy đủ**
nhưng asset `internal` đã bị cắt theo cấu hình module mới ⇒

```
[Physics] PhysicsSystem initDefaultMaterial() Failed to load builtinMaterial.
```

⇒ boot treo ở `Init SubSystem` (đo được đúng `10007ms`, như một timeout). **Build
thì hoàn toàn đúng.**

Muốn có artifact mở được trong browser để verify: **build `web-mobile` với cùng bộ
module**, đừng cố chữa preview.

> Hệ quả về quy trình: sau khi cắt module, **preview không còn là đường kiểm chứng
> nữa**. Mọi verify phải chạy trên bản build.

### 5.6 Preview server cần restart sau khi rebuild asset

Khác với mục trên. Sau một đợt rebuild prefab/asset, preview có thể treo ở
`Init SubSystem` dù không cắt module gì. Restart preview server là xong — đừng đi
truy như một bug của game.
