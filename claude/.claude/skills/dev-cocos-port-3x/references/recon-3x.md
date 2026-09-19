# Recon một bản build Cocos Creator 3.x

Mục tiêu: lấy đủ **ground truth** để dựng lại project mà không phải đoán. Ba
nguồn, theo thứ tự tin cậy: **cấu hình build → asset đã bóc → runtime sống**.

## 1. Bản đồ thư mục

```text
index.html
application.js                 # bootstrap: đọc settings, nạp engine, chạy launch scene
src/
  settings.json                # hoặc settings.<hash>.json — CẤU HÌNH GỐC
  import-map.json              # ánh xạ module → file thật (khi dùng system.js)
  system.bundle.js / system.js
cocos-js/
  cc.js | cc.wasm.js | *.wasm   # engine
chunks/                        # code game đã bundle (ES module, minify)
assets/
  main/                        # bundle mặc định
    config.<hash>.json         # BẢNG uuid ↔ đường dẫn logic ↔ kiểu
    import/<xx>/<uuid>.json    # asset đã serialize (prefab, scene, spriteframe…)
    native/<xx>/<uuid>.<ext>   # file gốc (png, mp3, bin)
  internal/                    # asset built-in của engine — KHÔNG cần port
  <bundle khác>/               # bundle phụ, thường tải lười
```

Thiếu `assets/` mà chỉ có `remote/` nghĩa là bundle nằm trên CDN — quay lại bước
fetch cho đủ trước, đừng port trên bản thiếu.

## 2. `settings.json` — đọc trước tiên

Những trường quyết định cách dựng project:

| Trường | Dùng để |
|---|---|
| `screen.designResolution` (+ `fitWidth`/`fitHeight`) | đặt design resolution và `ResolutionPolicy` của project mới. Sai chỗ này là UI lệch toàn bộ |
| `launch.launchScene` | scene phải dựng đầu tiên |
| `assets.preloadBundles` / `bundleVers` | danh sách bundle và thứ tự nạp |
| `plugins.jsList` | script bên thứ ba nhúng ngoài engine (SDK quảng cáo, analytics) — đây thường là **danh sách chỗ phải thay bằng FakeAds** |
| `physics` | có bật physics/collision không, group nào |

Đọc bằng `python3 -m json.tool` rồi ghi lại các con số này vào báo cáo recon — GĐ
sau sẽ đối chiếu.

## 3. Bóc asset

```bash
python3 <skills-dir>/dev-cocos-port-3x/scripts/extract-cocos3x-assets.py \
        --root <BUILD> --out <BUILD>/../extracted
```

Kết quả:

```text
extracted/
  main/<đường-dẫn-logic>.<ext>     # file gốc, đã trả về đúng chỗ
  main/_import/<đường-dẫn>.json    # bản serialize — THAM CHIẾU cấu trúc
  main/_unmapped/…                 # uuid không tra được đường dẫn
  extract-report.json
```

### Cổng kiểm — đừng bỏ

1. **Map rate ≥ 90%** là bình thường. Dưới 50% script tự fail (exit 2): cấu trúc
   build không khớp giả định, kết quả không dùng được.
2. `_unmapped/` **nhiều** = uuid của sub-asset (frame con trong atlas) hoặc build
   dùng `packs`. Mở vài file xem là gì trước khi bỏ qua.
3. `missing` trong report = config khai asset mà file không có trên đĩa → **mirror
   thiếu**, quay lại bước fetch.
4. Ảnh bóc ra phải mở được và đúng nội dung. Kích thước đúng mà nội dung là mảnh
   của texture khác là lỗi im lặng kinh điển — kiểm bằng mắt vài chục ảnh.

### `_import/` dùng thế nào

Đây là JSON đã serialize theo schema nội bộ của engine. **Đừng copy thẳng vào
`assets/`** của project mới. Dùng nó để đọc ra:

- cây node của prefab/scene (thứ tự, tên, parent)
- giá trị property thật (contentSize, anchor, color, scale)
- tham chiếu giữa asset (uuid nào trỏ tới uuid nào)

Rồi **dựng lại bằng MCP** — xem `mcp-setup.md`.

## 4. Code game

Script nằm trong `chunks/` hoặc `assets/main/index.<hash>.js`, đã bundle thành ES
module và minify. Decorator `@ccclass('Foo')` để lại **chuỗi tên class** trong
bundle — grep chuỗi đó là cách nhanh nhất định vị một class:

```bash
grep -o "ccclass('[^']*')" -r <BUILD>/chunks | sort -u | head -50
grep -rn "'GameManager'" <BUILD>/chunks | head
```

Minify thường chỉ đổi tên biến cục bộ, **không** đổi tên class/property đã
decorate (chúng phải khớp với dữ liệu scene). Đó là điểm khác lớn so với nhánh
2.x — recon 3.x thường rẻ hơn hẳn.

## 5. Runtime — nguồn cuối cùng và chắc nhất

Chạy bản gốc ở local rồi dán `runtime-api-export.js` vào console. Lấy về:

- danh sách class thật sự được đăng ký (so với danh sách trong bundle → ra **code chết**)
- component nào đang gắn trên node nào, property đang giữ giá trị gì
- scene tree đang sống

Chạy ở **nhiều thời điểm** (menu, đang chơi, màn thắng) rồi hợp nhất bằng
`split-runtime-api.mjs` — mỗi màn hình nạp một tập class khác nhau.

## 6. Kết quả recon phải có

- `extracted/` map rate ≥ 90%, đã kiểm mắt vài chục ảnh
- `runtime-api.json` (hợp nhất từ ≥ 3 thời điểm)
- bảng: design resolution, launch scene, danh sách bundle, danh sách `jsList`
- danh sách class **sống** vs **chết**, có nhãn `[R]`/`[D]`/`[S]`/`[I]`/`[U]`
