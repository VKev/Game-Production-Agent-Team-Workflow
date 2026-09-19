---
name: dev-cocos-migrate-2x-to-3x
description: >-
  Nâng một PROJECT Cocos Creator 2.x có source (assets/ + .meta + project.json)
  lên project Cocos Creator 3.8.x / TypeScript chạy được. Dùng khi người dùng
  nói convert, chuyển, nâng cấp, upgrade 2.4 lên 3.8, migrate project Cocos, hay
  khi vừa dựng xong bản 2.4.x bằng dev-cocos-port-2x và muốn đi tiếp lên 3.x. Bao
  gồm: bảng ánh xạ API 2.x→3.x đầy đủ, danh sách bẫy IM LẶNG đã gây bug thật
  (không lỗi compile, không lỗi runtime, chỉ sai), chuyển scene/prefab bằng cách
  lái Editor sống qua MCP funplay-cocos (tự cài extension nếu thiếu), verify A/B
  với bản 2.x, và lớp runtime bắt buộc — API mock toàn bộ dữ liệu giả, quảng cáo
  giả luôn trao thưởng, tương thích Android/iOS. KHÔNG dùng cho bản BUILD chưa
  có source (dùng dev-cocos-port-2x / dev-cocos-port-3x trước) hay port ngược 3.x→2.x.
---

# Convert project Cocos Creator 2.x → 3.8.x

Đầu vào: **một project 2.x có source thật** — `assets/` + `.meta` +
`project.json`, mở được trong Editor 2.4.x và **chơi được**. Đầu ra: project
3.8.x / TypeScript chạy được, chơi hết vòng lặp, chạy đúng trên điện thoại.

Chỉ có bản build (không `.meta`, không source) thì **chưa dùng skill này** — chạy
`/dev-cocos-port-2x` để dựng project 2.4.x trước.

## Luật bắt buộc của skill này

1. **API giả toàn bộ.** Game có gọi API thì mọi endpoint chạy bằng fixture trong
   `<mirror>/api-mock/`. Project 3.x phải chơi được khi **rút mạng**. Endpoint
   không mock được thì **nêu tên**.
2. **Quảng cáo giả.** Mọi chỗ "xem quảng cáo nhận thưởng" đi qua `FakeAds`,
   **luôn trao thưởng ngay**. Không để lại lời gọi SDK thật.
3. **Comment tiếng Anh, ngắn gọn.** Một câu nói *vì sao*. Comment gốc giữ nguyên.
4. **Tương thích Android/iOS.** Xem [references/shims-and-mobile.md](references/shims-and-mobile.md).

Chuỗi hiển thị **giữ nguyên văn**, không dịch. Tên class/method/asset/node cũng
không đổi — đổi tên là mất khả năng diff 1-1 với bản 2.x, thứ duy nhất chứng minh
được convert không làm sai gameplay.

## GĐ0 — Điều kiện đầu vào

Không đủ 3 điều này thì dừng và nói rõ, đừng convert:

- Project 2.x **mở được** trong Cocos Creator 2.4.x và **chơi được** (có ảnh
  chụp từng bước của một vòng gameplay — bước verify sẽ so lại chính những ảnh đó).
- Biết design resolution + `fitWidth/fitHeight` gốc.
- MCP `funplay_cocos` kết nối được, hoặc sẵn sàng cài
  ([references/mcp-setup.md](references/mcp-setup.md)).

Cảnh báo sớm khi thấy: > 5 shader/effect riêng (format 2.x ≠ 3.x, phải viết tay
từng cái) · plugin 2.x không có bản 3.x · code dùng `jsb.*` native.

## GĐ1 — Script: `.js` (2.x) → `.ts` (3.8.x)

Đọc [references/api-map-2x-to-3x.md](references/api-map-2x-to-3x.md) **trước khi
viết dòng nào**. Fan-out từng class bằng agent `cocos-port-class` (`MODE=port`).

**Giữ nguyên mọi logic và side-effect. Chỉ đổi API + cú pháp.** Không cải tiến,
không refactor — mọi khác biệt hành vi ở bước này là bug không truy được.

Mười chỗ sai nhiều nhất:

1. `node.x/y` → `position` / `setPosition(x, y, 0)`
2. `node.width/height` → `getComponent(UITransform)`
3. `node.opacity` → component `UIOpacity`; tween **trên UIOpacity**, không trên node
4. `setScale(s)` → `setScale(s, s, s)` — luôn đủ 3 tham số
5. `node.group = "gN"` → `collider.group = 1<<N` + `collider.apply()` + collisionMatrix
6. `ctor` → class field thường (không `@property`)
7. Action rời (`cc.moveTo`…) → `tween(node).to(...)`; tween position phải gói `Vec3`
8. `cc.audioEngine` → `AudioSource` (thường phải refactor, không dịch 1-1)
9. `cc.loader.loadRes*` → `resources.load/loadDir`
10. `canvas.fitWidth/fitHeight` **không tồn tại** → `view.setDesignResolutionSize(..., ResolutionPolicy.*)`

⛔ **Cổng:** toàn bộ `.ts` compile sạch trong 3.8.x (chưa cần chạy đúng gameplay).

**Mở [references/pitfalls.md](references/pitfalls.md) từ đây tới hết dự án.** Đó
là danh sách bẫy **im lặng** — không lỗi compile, không lỗi runtime, chỉ sai — đã
gây bug thật trong một lần convert hoàn chỉnh. Mỗi mục có triệu chứng → nguyên
nhân → cách sửa.

## GĐ2 — Scene & prefab qua MCP

**Không sửa tay JSON `.scene`/`.prefab`.** Dựng bằng cách lái Editor sống:
[references/scene-prefab-mcp.md](references/scene-prefab-mcp.md) +
[references/mcp-setup.md](references/mcp-setup.md), và nạp skill `cocos-mcp`.

Ground truth là **project 2.x đang chạy được** — đọc giá trị property thật từ đó,
đừng dựng theo trí nhớ.

⛔ **Cổng:** `validate_scene` + `validate_prefab_references` = 0 broken ref.

⚠️ **Quyết định phải chốt Ở ĐÂY, không để tới lúc ship:** dựng prefab hàng loạt
hay dùng JSON compact + builder runtime. Để muộn thì phải xoá prefab đã dựng,
viết builder, rồi làm lại cả GĐ2 lẫn GĐ3.

## GĐ3 — Lớp runtime bắt buộc

Project 2.x đã có `ApiMock.js` / `FakeAds.js` / `MobileAdapter.js` (do
`/dev-cocos-port-2x` dựng) thì **convert chúng sang TS như mọi class khác**, đừng viết
lại. Chưa có thì copy từ `templates/`:

```text
templates/ApiMock.ts        → assets/scripts/mock/ApiMock.ts
templates/FakeAds.ts        → assets/scripts/mock/FakeAds.ts
templates/MobileAdapter.ts  → assets/scripts/mock/MobileAdapter.ts
<mirror>/api-mock/client/*  → assets/scripts/vendor/
<mirror>/api-mock/index.inline.json → assets/resources/apimock/index.inline.json
```

`ApiMock` giữ `@executionOrder(-10000)`.

## GĐ4 — Verify: A/B với bản 2.x

Đọc [references/verify.md](references/verify.md). Luật: **verify = chạy thật**,
không phải đọc code.

1. Chạy song song bản 2.x và bản 3.x, cùng một kịch bản, so screenshot từng bước
   (`scripts/cdp.py`).
2. Diff `Label.string` giữa hai bản — chuỗi giữ nguyên văn nên phải khớp 1-1.
3. **Rút mạng**: bản 3.x vẫn chạy hết vòng lặp. `__apiMockReport()` không còn
   dòng `no fixture for`.
4. Chạy trên bản **BUILD** (không chỉ preview), trên điện thoại thật.

⛔ **Cổng:** full loop boot → menu → gameplay → win/lose chạy OK trên bản BUILD.

## GĐ5 — Ship

Đọc [references/ship.md](references/ship.md): dung lượng, tách subpackage,
resolution policy, nén ảnh (`scripts/optimize-images.py`, lossless + verify từng
pixel, có backup).

⛔ **Cổng:** số đo dung lượng THẬT ≤ trần nền tảng + build chạy trên thiết bị.

## Case study ≠ luật

[references/case-study.md](references/case-study.md) là nhật ký một lần convert
**đã hoàn tất** (2.4.15 → 3.8.8, 65 script, 129 prefab, 90 level, ship được).
Dùng để **ước lượng công sức** và **biết một bước thật trông ra sao**.

⚠️ Mọi con số, tên class (`Gbz*`), bất biến trong đó là của **riêng game ấy**.
Tên script trong nhật ký (`decode-whole-bundle.mjs`, `extract-all-assets.py`…) là
script tự viết của dự án đó, **không có trong skill này**. Đang tìm
`GbzGameManager` trong một game khác thì dừng lại — bạn đang áp giả định sai.

## Khi nào DỪNG và hỏi

- Project 2.x không chạy được → không có ground truth, mọi so sánh ở GĐ4 vô nghĩa.
- MCP không kết nối được sau khi đã cài extension → dừng ở GĐ2, đừng dựng scene tay.
- Shader/effect riêng nhiều → báo số lượng và ước lượng riêng cho phần đó.
- Phát hiện logic nằm trên server → chốt phạm vi (bản offline dùng API giả?) trước.
