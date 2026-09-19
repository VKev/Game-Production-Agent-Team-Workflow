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
python3 scripts/cdp.py diag --serve build/web-mobile --out after-step-N
```

boot không lỗi đỏ + vào được scene đầu + `visible` khớp `design`. Chỉ chạy lại
full loop win/lose của GĐ5 **một lần ở cuối**, hoặc ngay khi tập kiểm rẻ đổi màu.

---

## 1. Trần dung lượng (WeChat / Douyin mini-game)

| Phần | Trần |
|---|---|
| Gói chính (main package) | **4 MB** |
| Mỗi subpackage | **20 MB** |
| Tổng (bao gồm remote/CDN) | thực tế không giới hạn nếu tải từ CDN |

Đo bằng **kích thước thư mục build thật**, không phải kích thước `assets/`.

## 2. Thứ tự tối ưu (theo tỉ lệ lợi ích / rủi ro)

Làm theo thứ tự này; dừng khi đã đạt trần.

### ① Nén ảnh lossless — rẻ nhất, không rủi ro
```bash
python3 scripts/optimize-images.py --assets <project>/assets      # mặc định LOSSLESS + verify pixel
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

Kiểm nhanh cả ba: `python3 scripts/cdp.py diag --serve build/web-mobile`.

## 4. Việc phát hành khác dễ quên

- **Ngôn ngữ hiển thị: không có việc gì ở đây.** Skill này giữ nguyên văn mọi
  chuỗi, không dịch — xem Luật vàng #7 trong `SKILL.md`. Nếu khách yêu cầu bản
  tiếng Anh/đa ngôn ngữ thì đó là **một dự án riêng sau khi ship**, quy trình +
  3 bẫy im lặng nằm ở `text-language-en.md` (phụ lục, mặc định TẮT).
- **Loại scene công cụ khỏi build** (editor-tool scene) và **chỉ định
  `startScene` bằng uuid** — builder mặc định rơi về scene index 0, rất hay là
  scene test.
- Tắt/guard mọi công cụ dev (bot, debug overlay) bằng `BUILD` từ `cc/env`.
- Chốt lại số đo cuối và ghi vào báo cáo: gói chính / subpackage / tổng file.
