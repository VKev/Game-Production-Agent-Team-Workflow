---
name: dev-cocos-port-3x
description: >-
  Tái dựng một bản build HTML5 của Cocos Creator 3.x (đã compile/minify, không
  có source) thành PROJECT Cocos Creator 3.8.x TypeScript mở được trong Editor
  và chơi được. Dùng khi người dùng đưa thư mục mirror / URL của một game 3.x
  và nói port, tái dựng, dựng lại project, decode bundle, hay "lấy source game
  này ra". Bao gồm: cổng thẩm định khả thi CẢNH BÁO SỚM, recon bản build 3.x
  (settings.json, import-map, chunks, config.json của bundle), bóc asset theo
  uuid về đúng đường dẫn logic, dựng scene/prefab bằng cách lái Editor sống qua
  MCP funplay-cocos (tự cài extension nếu thiếu), và lớp runtime bắt buộc — API
  mock toàn bộ dữ liệu giả, quảng cáo giả luôn trao thưởng, tương thích
  Android/iOS. KHÔNG dùng cho build 2.x (dùng dev-cocos-port-2x) hay để nâng project
  2.x lên 3.8 (dùng dev-cocos-migrate-2x-to-3x).
---

> `<skills-dir>` below resolves, in order, to this repository's `.agents/skills/` (Codex) or `.claude/skills/` (Claude Code), then to the user-level `~/.codex/skills/` or `~/.claude/skills/`. Use the first one that contains this skill.

# Port build Cocos 3.x → project Cocos Creator 3.8.x

Đầu vào: **bản build 3.x đã đóng gói**. Đầu ra: **project 3.8.x / TypeScript mở
được trong Editor, chơi được, không cần mạng, chạy đúng trên điện thoại**.

Nguồn đã là 3.x nên **không có bước tái dựng 2.x** — rẻ hơn hẳn nhánh 2.x. Nói
rõ điều này với người dùng ngay từ đầu, nó thường đảo ngược quyết định đầu tư.

## Luật bắt buộc của skill này

1. **API giả toàn bộ.** Game có gọi API thì mọi endpoint chạy bằng fixture trong
   `<mirror>/api-mock/`. Project phải chơi được khi **rút mạng**. Endpoint không
   mock được (WebSocket, sau đăng nhập) thì **nêu tên**.
2. **Quảng cáo giả.** Mọi chỗ "xem quảng cáo nhận thưởng" đi qua `FakeAds`:
   hiện `MockAdOverlay` (màn đen đếm ngược ~3 giây) rồi **luôn trao thưởng**.
   Không để lại lời gọi SDK thật. Xem mục *Màn quảng cáo giả* ở GĐ4.
3. **Comment tiếng Anh, ngắn gọn.** Một câu nói *vì sao*. Comment gốc giữ nguyên.
4. **Tương thích Android/iOS.** Xem [references/shims-and-mobile.md](references/shims-and-mobile.md).

Chuỗi hiển thị **giữ nguyên văn ngôn ngữ gốc, không dịch**.

## GĐ0 — Cổng khả thi, cảnh báo SỚM

```bash
python3 <skills-dir>/dev-cocos-port-3x/scripts/triage-scan.py --root <BUILD> --out <BUILD>/../cocos-port-triage
python3 <skills-dir>/dev-cocos-port-3x/scripts/serve-local.py --root <BUILD> --stub --watchdog --port 0
```

Chi tiết chấm điểm + 6 trục rủi ro: [references/feasibility.md](references/feasibility.md).

**Báo NO-GO ngay khi:**

- Script game nằm trong `.jsc`/wasm, không có JS đọc được → không lấy được code.
- Bản gốc không chạy được kể cả sau `--stub` SDK **và** code bị obfuscate nặng →
  không có ground truth.
- Logic quyết định nằm trên server mà phạm vi không thu về bản offline được.
- `extract-cocos3x-assets.py` báo **map rate < 50%** → cấu trúc build không khớp
  giả định, đừng port trên bộ asset sai.

⛔ **Cổng:** người dùng chơi được bản gốc ở local + quyết định GO.

## GĐ1 — Recon bản build 3.x

Đọc [references/recon-3x.md](references/recon-3x.md). Ba nguồn sự thật:

1. **Cấu hình**: `src/settings.json` (design resolution, launch scene, bundle
   list), `src/import-map.json`, `application.js`.
2. **Asset**: mỗi bundle có `assets/<bundle>/config.<hash>.json` ánh xạ uuid ↔
   đường dẫn logic ↔ kiểu. Bóc bằng:

   ```bash
   python3 <skills-dir>/dev-cocos-port-3x/scripts/extract-cocos3x-assets.py \
           --root <BUILD> --out <BUILD>/../extracted
   ```

   Script in **map rate**. Dưới 50% là fail có chủ ý — cấu trúc không khớp thì
   kết quả không dùng được, đừng nhắm mắt đi tiếp.
3. **Runtime**: chạy bản gốc rồi dán `runtime-api-export.js` vào console để lấy
   inventory class/component/state đang sống. Ở 3.x, decorator `@ccclass` đã bị
   compile mất tên trong bundle minify — **runtime là nơi tên class còn đọc được**.

⛔ **Cổng:** có `extracted/` với map rate ≥ 50% (lý tưởng > 90%) + `runtime-api.json`
+ đọc được launch scene và danh sách bundle.

## GĐ2 — Dựng project 3.8.x

1. Tạo project 3.8.x rỗng, đặt design resolution đúng như `settings.json`.
2. Import asset từ `extracted/<bundle>/` — ảnh/audio/JSON dùng thẳng được. File
   trong `_import/` là asset đã serialize: dùng làm **tham chiếu cấu trúc**, đừng
   copy thẳng vào `assets/`.
3. Port script: từng class một bằng agent `cocos-port-class` (`MODE=port`), nguồn là
   bundle đã đẹp hoá + `runtime-api.json`. Giữ nguyên tên class/method/asset.

## GĐ3 — Scene & prefab: lái Editor sống qua MCP

**Không sửa tay JSON `.scene`/`.prefab`** — đó là cách nhanh nhất để hỏng
UUID/PrefabInfo. Dựng bằng cách điều khiển Editor qua MCP `funplay_cocos`.

MCP chưa kết nối được thì **cài extension trước, đừng dựng tay**:
[references/mcp-setup.md](references/mcp-setup.md). Nạp thêm skill `cocos-mcp`
để biết luật lái Editor (read-before-write, save + validate).

⛔ **Cổng:** `validate_scene` + `validate_prefab_references` = 0 broken ref.

## GĐ4 — Lớp runtime bắt buộc

```text
templates/ApiMock.ts        → assets/scripts/mock/ApiMock.ts
templates/FakeAds.ts        → assets/scripts/mock/FakeAds.ts
templates/MockAdOverlay.ts  → assets/scripts/mock/MockAdOverlay.ts
templates/MobileAdapter.ts  → assets/scripts/mock/MobileAdapter.ts
<mirror>/api-mock/client/*  → assets/scripts/vendor/
<mirror>/api-mock/index.inline.json → assets/resources/apimock/index.inline.json
```

`ApiMock` đã có `@executionOrder(-10000)` — giữ nguyên, đừng hạ xuống. Cài lớp
chặn sau khi game gọi API lần đầu là quá muộn.

### Màn quảng cáo giả (`MockAdOverlay`)

Trao thưởng **tức thì** giấu mất chỗ game gọi quảng cáo và làm nhịp chơi khác hẳn
bản thật, nên rewarded ad giả là **màn phủ đen, chặn chạm, đếm ngược 3 giây rồi
trao thưởng**. `FakeAds.showRewarded()` đã gọi nó sẵn.

- Dựng bằng node Cocos (`Graphics` + `Label` + `BlockInputEvents`), **không DOM** —
  runtime native của mini-game (TikTok `bytedance-mini-game`, WeChat) không có `document`.
- Node phủ phải `layer = canvas.node.layer` (layer mặc định không được camera UI vẽ)
  và là con cuối của Canvas; phủ rộng gấp 3 màn hình để che cả vùng letterbox.
- Đếm bằng `setTimeout`, không bằng scheduler của engine: caller hay `game.pause()`
  lúc phát quảng cáo, scheduler dừng theo là màn phủ kẹt vĩnh viễn.
- Chặn gọi chồng: đang hiện thì lần bấm thứ hai bị bỏ qua — không thì bấm nhanh hai
  lần ăn hai lần thưởng.
- Tắt nhạc quanh nó ở caller, y như với quảng cáo thật.
- Game ship lên nền tảng có ad thật (vd TikTok, skill `tiktok-growth-missions`): khi
  ad unit còn trống thì **cả máy thật** cũng đi màn giả này, để bản test up lên vẫn
  chơi trọn vòng trước khi placement được duyệt. Có ad unit → đường ad thật.

## GĐ5 — Verify bằng chạy thật

1. Preview trong Editor → chạy hết một vòng gameplay.
2. Build web-mobile, chạy bản **BUILD** qua `serve-local.py`.
3. **Rút mạng** — game vẫn phải chạy hết vòng lặp. Đây là cách duy nhất chứng
   minh API mock đủ.
4. `__apiMockReport()` không còn dòng `no fixture for`; `__fakeAdsReport()` cho
   thấy mọi chỗ quảng cáo đều đã trao thưởng. Bấm một nút xem quảng cáo: phải thấy
   màn đen đếm 3→1 rồi thưởng về đúng một lần.
5. Điện thoại thật: xoay máy, âm thanh sau cú chạm đầu, HUD không chui vào tai thỏ.
6. So A/B với bản gốc bằng `cdp.py` (screenshot từng bước) — "code trông đúng"
   không phải bằng chứng.

⛔ **Cổng người:** người dùng chơi thử và xác nhận gameplay đúng như bản gốc.

## Script kèm theo

| Script | Việc |
|---|---|
| `triage-scan.py` | Quét build: engine+version, obfuscation, closure asset, scene/bundle, shader riêng, rủi ro → `triage.json` |
| `extract-cocos3x-assets.py` | Bóc asset 3.x theo `config.json`, giải uuid nén, trả về đường dẫn logic. In map rate, fail khi < 50% |
| `serve-local.py` | Chạy build local: MIME/encoding/Range, `--stub`, `--watchdog`, `--portrait`, `--api-mock`, `--fake-ads`, `--port 0` |
| `runtime-api-export.js` | Snippet console: inventory class/method/state đang chạy |
| `split-runtime-api.mjs` | Tách `runtime-api.json` → per-class + summary + scene state |
| `cdp.py` | Toolkit CDP: eval / screenshot / tap / diag render — chạy game thật headless |
| `optimize-images.py` | Nén PNG lossless (oxipng) + verify từng pixel, có backup |

## Khi nào DỪNG và hỏi

- Map rate của extractor thấp → báo số đo, hỏi xem có bản build khác không.
- Bundle dùng obfuscator nặng ngoài minify thường → báo rõ, đừng đoán thân method.
- MCP không kết nối được sau khi đã cài extension → dừng ở GĐ3, đừng dựng scene tay.
- Phát hiện logic nằm trên server → chốt lại phạm vi trước khi ước lượng.
