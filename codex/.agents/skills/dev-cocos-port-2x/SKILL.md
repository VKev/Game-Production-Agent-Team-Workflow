---
name: dev-cocos-port-2x
description: >-
  Tái dựng một bản build HTML5 của Cocos Creator 2.x (đã compile, thường bị
  obfuscate, không có source) thành PROJECT Cocos Creator 2.4.x mở được trong
  Editor và chơi được. Dùng khi người dùng đưa một thư mục mirror / URL game 2.x
  và nói port, tái dựng, dựng lại project, reverse-engineer, decode bundle, hay
  "lấy source game này ra". Bao gồm: cổng thẩm định khả thi CẢNH BÁO SỚM (chấm
  obfuscation L0–L4, NO-GO khi code đã mất), recon bằng phân tích tĩnh + runtime,
  bóc asset, dựng project, và lớp runtime bắt buộc — API mock toàn bộ dữ liệu
  giả, quảng cáo giả luôn trao thưởng, tương thích Android/iOS. Bao gồm cả khâu
  ship lên nền tảng mini-game (TikTok/Douyin/WeChat): global trình duyệt mà
  runtime không có, trần dung lượng gói, dọn `ccRequire.js`, hạ ES5, và nén .zip
  đúng hình dạng — dùng khi game "chạy trên máy này mà không mở được trên máy
  kia" hoặc nền tảng báo không mở được mà không có log. KHÔNG dùng cho
  build Cocos 3.x (dùng dev-cocos-port-3x) hay để nâng project 2.x lên 3.8
  (dùng dev-cocos-migrate-2x-to-3x).
---

> `<skills-dir>` below resolves, in order, to this repository's `.agents/skills/` (Codex) or `.claude/skills/` (Claude Code), then to the user-level `~/.codex/skills/` or `~/.claude/skills/`. Use the first one that contains this skill.

# Port build Cocos 2.x → project Cocos Creator 2.4.x

Đầu vào: **một bản build đã đóng gói** — không source, không source map, thường
obfuscate. Đầu ra: **project 2.4.x mở được trong Editor, chơi được, không cần
mạng, chạy đúng trên điện thoại**.

Muốn lên 3.8.x thì chạy tiếp `/dev-cocos-migrate-2x-to-3x` **sau khi** project 2.4.x
đã được người dùng xác nhận. Không nhảy thẳng.

## Luật bắt buộc của skill này

Bốn thứ này không phải tuỳ chọn, thiếu bất kỳ cái nào là chưa xong:

1. **API giả toàn bộ.** Game có gọi API thì mọi endpoint phải chạy bằng fixture
   trong `<mirror>/api-mock/`. Project phải chơi được khi **rút mạng**.
   Endpoint nào không mock được (WebSocket, sau đăng nhập) thì **nêu tên**.
2. **Quảng cáo giả.** Mọi chỗ "xem quảng cáo nhận thưởng" phải đi qua `FakeAds`
   và **luôn trao thưởng ngay**. Không để lại lời gọi SDK thật.
3. **Comment tiếng Anh, ngắn gọn.** Một câu nói *vì sao*, không mô tả lại code.
   Comment gốc trong source (kể cả tiếng Trung) **giữ nguyên** — chúng là bằng chứng.
4. **Tương thích Android/iOS.** Resolution policy, audio cần user gesture, safe
   area, chặn scroll/zoom trang. Xem [references/shims-and-mobile.md](references/shims-and-mobile.md).

Chuỗi hiển thị (`Label.string`, popup, tên item): **giữ nguyên văn ngôn ngữ gốc,
không dịch**. Chuỗi gốc là khoá đối chiếu với bundle; dịch là dự án riêng sau khi ship.

## GĐ0 — Cổng khả thi. Cảnh báo SỚM, không phải lúc đã làm nửa chừng

Chạy trước khi viết bất kỳ dòng code nào. Mục tiêu: trong **vòng một giờ đầu**
biết được nên làm hay không.

```bash
python3 <skills-dir>/dev-cocos-port-2x/scripts/triage-scan.py --root <BUILD> --out <BUILD>/../cocos-port-triage
python3 <skills-dir>/dev-cocos-port-2x/scripts/serve-local.py --root <BUILD> --stub --watchdog --port 0
```

Chấm mức obfuscation rồi đối chiếu bảng dưới. Chi tiết + 6 trục rủi ro:
[references/feasibility.md](references/feasibility.md).

| Mức | Dấu hiệu | Lấy code ở đâu | Hệ số công | Kết luận |
|---|---|---|---|---|
| **L0** | có `.meta` + source trong `assets/` | đã có sẵn | ×1 | GO, bỏ GĐ1–2 |
| **L1** | chỉ minify, tên còn nguyên | đọc thẳng bundle | ×1,5 | GO |
| **L2** | thêm string-table (`tbl[123]`) | `decode-bundle.mjs` giải tĩnh | ×2 | GO |
| **L3** | `_0x4a1b…`, control-flow flattening | **tĩnh chết** → runtime là nguồn chính | ×3–4 | GO chỉ khi bản gốc CHẠY được |
| **L4** | `.jsc` (XXTEA), wasm, không có JS | không lấy được | — | **NO-GO cho việc port code** |

**Báo NO-GO ngay, đừng làm tiếp, khi:**

- L4 và không xin được source từ chủ sở hữu.
- Bản gốc không chạy được kể cả sau khi `--stub` SDK, **và** mức ≥ L3 → không có
  ground truth thì mọi thứ sau là phỏng đoán.
- Logic quyết định nằm trên server (kinh tế, tiến độ, PvP) mà không có backend →
  port client xong vẫn không có sản phẩm. Chốt lại phạm vi trước khi tính công.
- `manifestClosure` còn thiếu file → **mirror lại cho đủ trước**, đừng port trên
  bản thiếu asset.

Cảnh báo phải kèm **số đo**, không phải cảm nhận: mức L mấy, bao nhiêu class,
bao nhiêu prefab, thiếu bao nhiêu asset.

⛔ **Cổng:** người dùng chơi được bản gốc ở local (boot → 1 màn → thắng/thua →
quay lại menu → màn thứ 2) và quyết định là GO.

## GĐ1 — Recon: lấy ground truth

Đọc [references/recon.md](references/recon.md). Tóm tắt:

1. `decode-bundle.mjs` → `game.readable.js` (giải string-table + number-table).
2. `runtime-api-export.js` dán vào console bản chạy → inventory class/method/state.
   Chạy ở **nhiều thời điểm** (menu, đang chơi, thắng màn) rồi hợp nhất.
3. `split-runtime-api.mjs` + `split-bundle-modules.mjs` → tách theo class để fan-out.
4. `extract-cocos24-assets.py` → bóc SpriteFrame/Spine/particle/audio.
   ⚠ Bóc xong **phải qua cổng kiểm** ở recon.md §5 — sai ở bước này im lặng tuyệt
   đối: ảnh ra đúng kích thước nhưng nội dung là mảnh của texture khác.

⛔ **Cổng:** mirror chạy offline được + có `game.readable.js` + `runtime-api.json`.

## GĐ2 — Dựng project 2.4.x

Đọc [references/rebuild-2x.md](references/rebuild-2x.md). Fan-out theo class bằng
agent `cocos-port-class` với `MODE=recon` — mỗi lần một class, trả JSON có
`confidence` + `todos`.

Nguyên tắc: **tách feature sống khỏi code chết.** Gắn nhãn bằng chứng cho mọi
khẳng định — `[R]` runtime observed, `[D]` decoded source, `[S]` static asset,
`[I]` inferred, `[U]` unknown. Chỉ port cái có `[R]` hoặc `[D]`. Build thường
chứa ~30% code chết; port hết là phí đúng chừng đó công.

## GĐ3 — Lớp runtime bắt buộc (API mock + fake ads + mobile)

Copy 3 template vào project rồi gắn vào scene đầu tiên:

```text
templates/ApiMock.js        → assets/Script/mock/ApiMock.js
templates/FakeAds.js        → assets/Script/mock/FakeAds.js
templates/MobileAdapter.js  → assets/Script/mock/MobileAdapter.js
<mirror>/api-mock/client/*  → assets/Script/vendor/
<mirror>/api-mock/index.inline.json → assets/resources/apimock/index.inline.json
```

`ApiMock` phải có **execution order thấp nhất** — cài lớp chặn sau khi game đã
gọi API lần đầu là quá muộn. Cách nối chi tiết + bảng thay thế lời gọi SDK quảng
cáo: [references/shims-and-mobile.md](references/shims-and-mobile.md).

## GĐ4 — Verify bằng chạy thật

1. Mở project trong Cocos Creator **2.4.14**, preview.
2. Build web-mobile rồi chạy bằng `serve-local.py` (bản BUILD, không chỉ preview).
3. **Rút mạng / tắt server API** — game vẫn phải chạy hết vòng lặp. Đây là cách
   duy nhất chứng minh API mock đã đủ.
4. Kiểm trên điện thoại thật hoặc emulator: portrait/landscape, âm thanh sau cú
   chạm đầu, HUD không chui vào tai thỏ.
5. Console: `__apiMockReport()` không còn dòng `no fixture for`;
   `__fakeAdsReport()` cho thấy mọi chỗ quảng cáo đều đã được trao thưởng.
6. Bấm **từng** chỗ có quảng cáo và xác nhận phần thưởng **vào thật**. Log đẹp
   không đủ: quảng cáo hay có hai tầng, tầng ngoài vẫn in đủ
   `adViewed → adBreakDone{viewed}` trong khi tầng trong mới là chỗ treo —
   §2.1 của [references/shims-and-mobile.md](references/shims-and-mobile.md).

⛔ **Cổng người:** người dùng chơi thử project 2.4.x và xác nhận gameplay đúng
như bản gốc. Chưa qua cổng này thì **không** chạy `/dev-cocos-migrate-2x-to-3x`.

## GĐ5 — Ship lên nền tảng mini-game (TikTok / Douyin / WeChat)

**Chỉ chạy khi đích đến không phải web-mobile.** Đọc
[references/minigame-platform.md](references/minigame-platform.md) — toàn bộ nội
dung trong đó là lỗi **đã gặp thật** trong một lần port, không phải phòng xa.

Runtime mini-game khác trình duyệt theo kiểu **im lặng**: DOM là đồ giả, thiếu
một loạt global (`URLSearchParams`, `URL`, `fetch`, `Event`…), có trần dung lượng
cứng, và có một khâu đóng gói riêng. Triệu chứng chung của gần hết nhóm này:
**màn hình đứng, hoặc nền tảng báo không mở được, KHÔNG một dòng log nào**.

Ba điều nói TRƯỚC với người dùng, để họ không mất niềm tin giữa chừng:

- **Các lỗi ở đây xếp hàng, không đứng một mình.** Một ca thật đi qua bốn lỗi
  nối đuôi nhau, mỗi lỗi chỉ lộ ra sau khi lỗi trước được sửa. Hãy hẹn nhiều
  vòng build ngay từ đầu.
- **Phải có log vConsole trên chính máy hỏng.** Không có log thì mọi kết luận
  chỉ là phỏng đoán — và trong nhóm này phỏng đoán gần như luôn sai, vì bản
  trình duyệt và giả lập IDE **không** chạy cùng nhánh code.
- **iOS chạy không có nghĩa Android chạy.** Chúng khác cả JS engine
  (JavaScriptCore vs V8) lẫn tính năng nền tảng (native physics chỉ có trên
  Android). Test riêng từng hệ, đừng suy ra.

Nguy hiểm nhất: **nó không tái hiện được trong simulator của IDE** — devtools
chạy trên Chromium thật nên adapter chỉ điền vào chỗ thiếu, DOM thật vẫn thắng.
Chỉ máy thật mới bày ra, và thường là **chỉ một hệ điều hành** (global WHATWG có
sẵn trong ngữ cảnh WebKit, không có trên V8 trần → "iOS chạy, Android không").

Nên: **kiểm bản build bằng script tĩnh, đừng tin "chạy ngon trong simulator".**

```bash
node <skills-dir>/dev-cocos-port-2x/scripts/check-minigame-package.js <build-dir>
node <skills-dir>/dev-cocos-port-2x/scripts/check-minigame-globals.js <build-dir> <assets-dir>
node <skills-dir>/dev-cocos-port-2x/scripts/zip-minigame.js <build-dir> [out.zip] [assets-dir]
```

⚠ `check-minigame-globals.js` phải chạy **SAU khi Build**: script trong
`assets/Script/` được gộp vào `assets/main/index.js`, nên sửa source mà quên bấm
Build thì gói vẫn mang code cũ. Script quét cả bundle đã build chính vì vậy.

⛔ **Cổng:** cả ba script exit 0, giải nén lại `diff -r` khớp từng byte với thư
mục build, và game chạy được khi **rút mạng**.

Khi gói đã sạch mà nền tảng vẫn không mở được: phần còn lại nằm ở console/tài
khoản (test user list, region, version đang mở) — xem PHẦN 3 của reference. Đừng
soi tiếp source, lỗi tầng host không để lại dấu vết nào trong đó.

## Luật vàng

1. **Ground truth > phỏng đoán.** Mọi giá trị property phải decode từ bundle hoặc
   đọc từ runtime sống. Dựng tay bằng trí nhớ gần như luôn sai, và sai âm thầm.
2. **Verify = chạy thật.** "Code trông đúng" không phải bằng chứng.
3. **Một class một lần**, output structured, dùng agent `cocos-port-class`.
4. **Không cải tiến code trong lúc tái dựng.** Mọi khác biệt hành vi ở bước này
   là bug không truy được. Refactor là commit riêng, sau khi chạy đúng.

## Script kèm theo

| Script | Việc |
|---|---|
| `triage-scan.py` | Quét build: engine+version, mức obfuscation (tách code game khỏi SDK), closure asset, scene/bundle, shader riêng, rủi ro → `triage.json`. Chỉ cần `python3` |
| `serve-local.py` | Chạy build ở local: MIME + `Content-Encoding` + Range, `--stub` SDK, `--watchdog` báo màn đen, `--portrait` khung dọc, `--api-mock`, `--fake-ads`, `--port 0` |
| `runtime-api-export.js` | Snippet dán vào console bản live: xuất inventory class/method/component state |
| `decode-bundle.mjs` | Inline string-table/number-table vào bundle → JS đọc được |
| `decode-methods.mjs` | Như trên nhưng cho từng method bắt từ runtime |
| `split-runtime-api.mjs` | Tách `runtime-api.json` → per-class + summary + scene state |
| `split-bundle-modules.mjs` | Tách bundle browserify 2.x thành từng module (thân giữ nguyên văn) |
| `extract-cocos24-assets.py` | Bóc asset khỏi bundle 2.4 (SpriteFrame, Spine, particle, audio) |
| `cdp.py` | Toolkit CDP: eval / screenshot / tap / diag render — chạy game thật headless |
| `check-minigame-package.js` | GĐ5. Trần dung lượng (gói chính / subpackage / tổng), `require()` chết ở tầng gói, cú pháp ES6 còn sót trong `game.js`/`main.js`/`ccRequire.js` |
| `check-minigame-globals.js` | GĐ5. Global trình duyệt mà adapter không dựng — quét **cả source lẫn bundle đã build**. Danh sách "adapter có gì" đọc thẳng từ `adapter-min.js` |
| `zip-minigame.js` | GĐ5. Chạy hai cổng trên rồi nén: nội dung ở **gốc archive**, luôn `/`, rồi đọc lại chính file vừa tạo để kiểm |

Babel đã vendor sẵn trong `scripts/node_modules` — **không cần `npm i`**.

## Khi nào DỪNG và hỏi

- Bản gốc không chạy được kể cả sau khi stub SDK → hỏi có bản build khác / tài
  khoản test không.
- Bundle dùng obfuscator khác pattern string-table/number-table → báo rõ, đừng
  đoán thân method.
- Phát hiện logic nằm trên server → chốt lại phạm vi trước khi ước lượng.
- Người dùng thúc "khỏi thẩm định, port luôn" → nêu **một lần** rằng bỏ GĐ0 nghĩa
  là ước lượng và phạm vi đều không có cơ sở; họ vẫn muốn thì làm theo và ghi lại
  là đã bỏ qua thẩm định.
