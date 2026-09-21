---
name: dev-cocos-migrate-2x-to-3x
description: >-
  Nâng một PROJECT Cocos Creator 2.x có source (assets/ + .meta + project.json)
  lên project Cocos Creator 3.8.x / TypeScript chạy được. Dùng khi người dùng
  nói convert, chuyển, nâng cấp, upgrade 2.4 lên 3.8, migrate project Cocos, hay
  khi vừa dựng xong bản 2.4.x bằng dev-cocos-port-2x và muốn đi tiếp lên 3.x. Bao
  gồm: đo bản đồ thư mục của chính project (skill không giả định đường dẫn nào),
  bảng ánh xạ API 2.x→3.x đầy đủ, danh sách bẫy IM LẶNG đã gây bug thật (không
  lỗi compile, không lỗi runtime, chỉ sai), port script theo wave bằng MỘT agent
  mỗi lượt, chuyển scene/prefab bằng cách lái Editor sống qua MCP funplay-cocos,
  verify A/B với bản 2.x, lớp runtime bắt buộc — API mock toàn bộ dữ liệu giả,
  quảng cáo giả luôn trao thưởng, tương thích Android/iOS — và khâu ship lên nền
  tảng mini-game. KHÔNG dùng cho bản BUILD chưa có source (dùng dev-cocos-port-2x
  / dev-cocos-port-3x trước) hay port ngược 3.x→2.x.
---

> `<skills-dir>` dưới đây trỏ tới `.agents/skills/` (Codex) hoặc `.claude/skills/`
> (Claude Code) trong project, rồi mới tới `~/.codex/skills/` / `~/.claude/skills/`.
> Dùng cái đầu tiên có chứa skill này. **Đừng** gọi `scripts/...` theo đường dẫn
> tương đối — thư mục hiện tại của bạn không phải thư mục skill.

# Convert project Cocos Creator 2.x → 3.8.x

Đầu vào: **một project 2.x có source thật** — `assets/` + `.meta` +
`project.json`, mở được trong Editor 2.4.x và **chơi được**. Đầu ra: project
3.8.x / TypeScript chạy được, chơi hết vòng lặp, chạy đúng trên điện thoại.

Chỉ có bản build (không `.meta`, không source) thì **chưa dùng skill này** — chạy
`/dev-cocos-port-2x` để dựng project 2.4.x trước.

## Luật bắt buộc của skill này

1. **Không giả định đường dẫn.** Mỗi project Cocos xếp thư mục một kiểu. Mọi
   đường dẫn trong project phải lấy từ bản đồ đo ở GĐ1
   ([references/project-layout.md](references/project-layout.md)), không lấy từ
   ví dụ trong tài liệu. Placeholder `<script-root>`, `<resources-root>`,
   `<bundle>`, `<build-dir>` là **giá trị đo được**, không phải tên thư mục.
2. **API giả toàn bộ.** Game có gọi API thì mọi endpoint chạy bằng fixture.
   Project 3.x phải chơi được khi **rút mạng**. Endpoint không mock được thì
   **nêu tên**.
3. **Quảng cáo giả.** Mọi chỗ "xem quảng cáo nhận thưởng" đi qua `FakeAds`,
   **luôn trao thưởng ngay**. Không để lại lời gọi SDK thật.
4. **Comment tiếng Anh, ngắn gọn.** Một câu nói *vì sao*. Comment gốc giữ nguyên.
5. **Tương thích Android/iOS.** Xem [references/shims-and-mobile.md](references/shims-and-mobile.md).

Chuỗi hiển thị **giữ nguyên văn**, không dịch. Tên class/method/asset/node cũng
không đổi — đổi tên là mất khả năng diff 1-1 với bản 2.x, thứ duy nhất chứng minh
được convert không làm sai gameplay.

## Bảy giai đoạn

| GĐ | Việc | Reference |
|---|---|---|
| 0 | Cổng đầu vào | — |
| 1 | Đo bản đồ project | [project-layout.md](references/project-layout.md) |
| 2 | Port script `.js` → `.ts` | [api-map-2x-to-3x.md](references/api-map-2x-to-3x.md) + [port-batch.md](references/port-batch.md) |
| 3 | Scene & prefab qua MCP | [scene-prefab-mcp.md](references/scene-prefab-mcp.md) + [mcp-setup.md](references/mcp-setup.md) |
| 4 | Lớp runtime bắt buộc | [shims-and-mobile.md](references/shims-and-mobile.md) |
| 5 | Verify A/B với bản 2.x | [verify.md](references/verify.md) |
| 6 | Ship | [ship.md](references/ship.md) |

**Mở [references/pitfalls.md](references/pitfalls.md) từ GĐ2 tới hết dự án.** Đó
là danh sách bẫy **im lặng** — không lỗi compile, không lỗi runtime, chỉ sai — đã
gây bug thật trong một lần convert hoàn chỉnh.

## GĐ0 — Điều kiện đầu vào

Không đủ 3 điều này thì dừng và nói rõ, đừng convert:

- Project 2.x **mở được** trong Cocos Creator 2.4.x và **chơi được** (có ảnh
  chụp từng bước của một vòng gameplay — GĐ5 sẽ so lại chính những ảnh đó).
- Biết design resolution + `fitWidth/fitHeight` gốc (GĐ1 đọc giúp từ `settings/`).
- MCP `funplay_cocos` kết nối được, hoặc sẵn sàng cài
  ([references/mcp-setup.md](references/mcp-setup.md)).

Cảnh báo sớm khi thấy: > 5 shader/effect riêng (format 2.x ≠ 3.x, phải viết tay
từng cái) · plugin 2.x không có bản 3.x · code dùng `jsb.*` native.

## GĐ1 — Đo bản đồ project

```bash
node <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/probe-cocos-layout.js <PROJECT-2X> --out <work>/layout-2x.json
node <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/probe-cocos-layout.js <PROJECT-3X> --out <work>/layout-3x.json
```

Probe in ra: Creator line + version, script root (**có thể nhiều** — code chia
theo bundle là chuyện thường), `resources/` (**có thể không có**), bundle +
`priority`, scene/prefab, design resolution, start scene, và lớp runtime đã có sẵn
hay chưa.

Đọc [references/project-layout.md](references/project-layout.md) để biết dịch
output thành placeholder, và ba quyết định phải chốt **ngay ở đây**: giữ hay dồn
cách chia bundle · nạp bằng `resources` hay bằng bundle · `<work>` đặt ở đâu (phải
**ngoài** `assets/`).

⛔ **Cổng:** hai file layout JSON đã ghi, không còn WARNING nào chưa trả lời.

## GĐ2 — Port script: `.js` (2.x) → `.ts` (3.8.x)

Đọc [references/api-map-2x-to-3x.md](references/api-map-2x-to-3x.md) **trước khi
viết dòng nào**, rồi [references/port-batch.md](references/port-batch.md) để
dispatch.

```bash
node <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/plan-port-waves.js <work>/layout-2x.json
```

**MỘT agent `cocos-port-class` cho mỗi wave, các wave chạy lần lượt** — không
fan-out một agent cho một class. Fan-out bắt mỗi agent đọc lại bảng ánh xạ 220
dòng, và hai agent song song không thể thống nhất style export với nhau (nguyên
nhân số một của lỗi import hàng loạt). File `vendor` (`jszip`, `buffer`…) thì
**copy, không port**.

**Giữ nguyên mọi logic và side-effect. Chỉ đổi API + cú pháp.** Không cải tiến,
không refactor — mọi khác biệt hành vi ở bước này là bug không truy được.

Mười hai chỗ sai nhiều nhất:

1. `node.x/y` → `position` / `setPosition(x, y, 0)`
2. `node.width/height` → `getComponent(UITransform)`
3. `node.opacity` → component `UIOpacity`; tween **trên UIOpacity**, không trên node
4. `setScale(s)` → `setScale(s, s, s)` — luôn đủ 3 tham số
5. `node.group = "gN"` → `collider.group = 1<<N` + `collider.apply()` + collisionMatrix
6. `ctor` → class field thường (không `@property`)
7. Action rời (`cc.moveTo`…) → `tween(node).to(...)`; tween position phải gói `Vec3`
8. `cc.audioEngine` → `AudioSource` (thường phải refactor, không dịch 1-1)
9. `cc.loader.loadRes*` → `resources.load/loadDir` — **chỉ khi thật có
   `resources/`**; project nạp theo bundle thì dịch sang `assetManager`
10. `node.zIndex` → `setSiblingIndex` (sort theo zIndex cũ rồi gán `0..n-1`)
11. `"touchstart"` → `Node.EventType.TOUCH_START` (3.x là `"touch-start"`, có gạch nối)
12. `canvas.fitWidth/fitHeight` **không tồn tại** → `view.setDesignResolutionSize(..., ResolutionPolicy.*)`

Bốn cái trong số đó (`opacity`, `group`, `zIndex`, tên event) **compile sạch và
không chạy**. Sau mỗi wave, grep lại chính các file vừa ghi:

```bash
grep -rnE '\.(zIndex|opacity|group)\s*=|["'"'"']touch(start|move|end|cancel)["'"'"']|setScale\([^,)]+\)' <file...>
```

⛔ **Cổng:** toàn bộ `.ts` compile sạch trong 3.8.x (`npx tsc --noEmit` hoặc MCP
`run_script_diagnostics`), lệnh grep trên không có hit, mọi file
`confidence: low` đã rà tay. Chưa cần chạy đúng gameplay.

## GĐ3 — Scene & prefab qua MCP

**Không sửa tay JSON `.scene`/`.prefab`.** Dựng bằng cách lái Editor sống:
[references/scene-prefab-mcp.md](references/scene-prefab-mcp.md) +
[references/mcp-setup.md](references/mcp-setup.md), và nạp skill `dev-cocos-mcp`.

Ground truth là **project 2.x đang chạy được** — đọc giá trị property thật từ đó,
đừng dựng theo trí nhớ.

⛔ **Cổng:** `validate_scene` + `validate_prefab_references` = 0 broken ref.

⚠️ **Quyết định phải chốt Ở ĐÂY, không để tới lúc ship:** dựng prefab hàng loạt
hay dùng JSON compact + builder runtime. Để muộn thì phải xoá prefab đã dựng,
viết builder, rồi làm lại cả GĐ3 lẫn GĐ4.

## GĐ4 — Lớp runtime bắt buộc

Project 2.x đã có `ApiMock` / `FakeAds` / `MobileAdapter` (probe ở GĐ1 báo mục
`runtime layer`) thì **port chúng sang TS như mọi class khác** ở GĐ2, đừng viết
lại. Chưa có thì copy từ `templates/` vào `<script-root>`:

```text
templates/ApiMock.ts        → <script-root>/mock/ApiMock.ts
templates/FakeAds.ts        → <script-root>/mock/FakeAds.ts
templates/MobileAdapter.ts  → <script-root>/mock/MobileAdapter.ts
<mirror>/api-mock/client/*  → <script-root>/vendor/
<mirror>/api-mock/index.inline.json → <resources-root>/apimock/index.inline.json
```

`<script-root>` phải thuộc **bundle nạp lúc boot**, và `ApiMock` giữ
`@executionOrder(-10000)` — vá `fetch` sau khi game đã gọi API lần đầu là quá
muộn. Không có `<resources-root>` thì nhúng fixture qua bundle, đừng tạo
`resources/` chỉ để cho khớp ví dụ trên.

Ba thứ trong GĐ4 hay bị làm hụt, cả ba đã mất công thật:

- **Quảng cáo thường có hai tầng** — SDK publisher gọi tiếp `showRewardAds()` của
  nền tảng. Giả tầng ngoài thì log đẹp mà game vẫn treo ở `cc.game.pause()`.
- **Global của SDK bên thứ ba** (ThinkingAnalytics, UMeng…) không theo sang khi
  port, và `ReferenceError` trong constructor platform giết cả chuỗi khởi động.
- **Thay factory của host** (`tt.createRewardedVideoAd = …`) gọn hơn viết lại lớp
  platform, và giữ nguyên luồng `pause → show → close → resume`.

Cả ba nằm ở `dev-cocos-port-2x/references/shims-and-mobile.md` §2.1–§2.3 — cơ chế
giống nhau ở 2.x và 3.x, chỉ khác cú pháp.

## GĐ5 — Verify: A/B với bản 2.x

Đọc [references/verify.md](references/verify.md). Luật: **verify = chạy thật**,
không phải đọc code.

1. Chạy song song bản 2.x và bản 3.x, cùng một kịch bản, so screenshot từng bước
   (`<skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/cdp.py`).
2. Diff `Label.string` giữa hai bản — chuỗi giữ nguyên văn nên phải khớp 1-1.
3. **Rút mạng**: bản 3.x vẫn chạy hết vòng lặp. `__apiMockReport()` không còn
   dòng `no fixture for`.
4. Bấm **thật** (dispatch touch), đừng gọi hàm handler trực tiếp — gọi trực tiếp
   bỏ qua đúng lớp hay hỏng nhất sau khi port.
5. Chạy trên bản **BUILD** (không chỉ preview), trên điện thoại thật.

⛔ **Cổng:** full loop boot → menu → gameplay → win/lose chạy OK trên bản BUILD.

## GĐ6 — Ship

Đọc [references/ship.md](references/ship.md): dung lượng, tách subpackage,
resolution policy, nén ảnh (`scripts/optimize-images.py`, lossless + verify từng
pixel, có backup).

Đích là nền tảng mini-game (TikTok/Douyin/WeChat) thì đọc thêm
`dev-cocos-port-2x/references/minigame-platform.md`: global trình duyệt mà runtime
không có, trần dung lượng, hình dạng `.zip`, `subPackages` viết hoa chữ P, và
`priority` của bundle quyết định asset nằm gói nào. Ba khác biệt của bản 3.x:
platform id là **`bytedance-mini-game`** (2.x là `bytedance`), không có
`ccRequire.js`, và SDK stub nằm trong `build-templates/<platform>/`. Dùng
`dev-cocos-build-minigame` cho phần build.

⛔ **Cổng:** số đo dung lượng THẬT ≤ trần nền tảng + build chạy trên thiết bị.

## Case study ≠ luật

[references/case-study.md](references/case-study.md) là nhật ký một lần convert
**đã hoàn tất** (2.4.15 → 3.8.8, 65 script, 129 prefab, 90 level, ship được).
Dùng để **ước lượng công sức** và **biết một bước thật trông ra sao**.

⚠️ Mọi con số, tên class (`Gbz*`), đường dẫn, bất biến trong đó là của **riêng
game ấy**. Tên script trong nhật ký (`decode-whole-bundle.mjs`,
`extract-all-assets.py`…) là script tự viết của dự án đó, **không có trong skill
này**. Đang tìm `GbzGameManager` trong một game khác thì dừng lại — bạn đang áp
giả định sai.

## Script của skill

| Script | Việc |
|---|---|
| `probe-cocos-layout.js` | GĐ1. Bản đồ thư mục thật của một project (2.x hoặc 3.x): script root, bundle + priority, resources, design resolution, start scene |
| `plan-port-waves.js` | GĐ2. Đồ thị `require()` → wave theo thứ tự phụ thuộc, tách file vendor, chỉ ra nhóm require vòng |
| `cdp.py` | GĐ5. Toolkit CDP: eval / screenshot / tap / diag render — chạy game thật headless |
| `serve-local.py` | GĐ5. HTTP server có hỗ trợ Range cho bản build web |
| `optimize-images.py` | GĐ6. Nén PNG lossless, verify từng pixel, có backup |
| `api-mock-client.js` / `fake-ads-client.js` | GĐ4. Client nhúng vào project |

## Khi nào DỪNG và hỏi

- Project 2.x không chạy được → không có ground truth, mọi so sánh ở GĐ5 vô nghĩa.
- Probe không đọc được layout (không `assets/`, không manifest) → chưa phải project
  Cocos, đừng đoán thư mục.
- MCP không kết nối được sau khi đã cài extension → dừng ở GĐ3, đừng dựng scene tay.
- Shader/effect riêng nhiều → báo số lượng và ước lượng riêng cho phần đó.
- Phát hiện logic nằm trên server → chốt phạm vi (bản offline dùng API giả?) trước.
