---
name: dev-cocos-clean-3x-minigame
description: >-
  Dọn một project Cocos Creator 3.x mini-game (thường là bản vừa port/migrate) để
  CHỈ còn nền tảng thứ ba mà game thật sự ship — mặc định TikTok Minis: gỡ SDK
  publisher (VNG/choingay…), adapter các nền tảng khác (WeChat, QQ, Douyin tt,
  Kuaishou, OPPO, VIVO, Huawei, Xiaomi, Alipay, Android/iOS native), analytics
  (ThinkingData, UMeng, report server riêng), link/endpoint, định danh bên thứ ba
  (appid tt…/wx…, ad unit id, report id, secret ký API), tên riêng, comment/log
  không phải tiếng Anh và header "Recovered from…" — mà game VẪN chạy được sau mỗi
  bước. Kèm script quét tồn dư, map script ↔ scene/prefab theo uuid nén, gỡ lời gọi
  trong biểu thức dấu phẩy, template Platform TikTok+Dev và bản TikTok giả cho
  preview. Dùng khi người dùng nói clean, dọn, loại bỏ bên thứ ba, bỏ SDK, bỏ
  choingay/VNG, chỉ giữ TikTok, xoá comment tiếng Trung/tiếng Việt, xoá link, xoá tên
  riêng. KHÔNG dùng để port (dev-cocos-port-3x) hay nâng 2.x→3.x
  (dev-cocos-migrate-2x-to-3x); chạy SAU hai skill đó.
---

> `<skills-dir>` below resolves, in order, to this repository's `.agents/skills/` (Codex) or `.claude/skills/` (Claude Code), then to the user-level `~/.codex/skills/` or `~/.claude/skills/`. Use the first one that contains this skill.

# Clean Cocos 3.x mini-game — chỉ giữ bên thứ ba đang ship

Đầu vào: project Cocos 3.8 chạy được (thường vừa port, còn nguyên lớp SDK của bản gốc
và của publisher). Đầu ra: project **vẫn chạy được**, chỉ còn tích hợp nền tảng đích
(mặc định TikTok Minis), không còn endpoint/analytics lạ, comment/log tiếng Anh.

Rút từ lần clean thật `tiktokgame17` (Tiêu Diệt Hexa, Cocos 3.8.8): 141 file thay đổi,
−9.6k dòng, 42 script còn lại; bản gốc quét ra 720 điểm tồn dư (12 trong đó là appid,
ad id, report id, secret), bản sạch còn đúng các điểm giữ có chủ đích và 0 định danh.

## Luật bắt buộc

1. **Hỏi 4 quyết định TRƯỚC khi xoá gì** (dùng câu hỏi có lựa chọn, kèm khuyến nghị):
   - **Chữ hiển thị trong game** (label prefab, toast, bảng i18n): chỉ tiếng Anh, hay
     giữ đa ngôn ngữ? → Quyết định này chia đôi phạm vi. "Clean ngôn ngữ" thường chỉ
     nói về comment/log; chữ người chơi thấy là nội dung game, đừng tự dịch.
   - **Dữ liệu từng lấy từ backend của publisher** (profile, xếp hạng, level) thay bằng
     gì: tính/lưu local (khuyến nghị), bỏ tính năng, hay giữ khung API rỗng?
   - **Nền tảng khác**: xoá hẳn, chỉ còn nền tảng đích + Dev (khuyến nghị), hay giữ?
   - **Mock**: giữ lớp mock để preview chạy được (khuyến nghị: đổi sang giả nền tảng
     đích), hay giữ nguyên mock cũ? Người dùng thường muốn GIỮ mock — đừng xoá lớp
     này chỉ vì endpoint của nó không còn.
2. **Game phải chạy lại sau mỗi GĐ.** Preview → vào màn chơi → xem một quảng cáo →
   reload thấy tiến độ còn. Không gom hết rồi mới chạy.
3. **Scene/prefab sửa qua Editor (MCP), không sửa tay cấu trúc.** Chỉ được sửa tay
   giá trị chuỗi (`"_string"`) — và chỉ khi asset đó KHÔNG đang mở trong Editor.
4. **Không đụng**: extension bên thứ ba (vd `funplay-cocos-mcp`), `settings/` chung,
   tên file asset (đổi tên = đổi đường dẫn load), dữ liệu spine/atlas (tên bone
   tiếng Trung là dữ liệu, đổi là vỡ animation).
5. **Lưu tiến độ đi qua storage của nền tảng đích** — TikTok: `GameStorage.ts` của skill
   `tiktok-growth-missions` (Bước 7). Không cược save vào localStorage.
6. **Định danh và secret của bên thứ ba cũng là thứ phải clean**, không chỉ tên:
   appid nền tảng (`tt` + 18 hex của Douyin, `wx` + 16 hex của WeChat), ad unit / reward /
   banner id, report id của analytics, `API_SECRET`, salt ký request. Xoá **cả khối cấu
   hình** (vd `PROJECT_CONFIG` nhiều nền tảng), đừng chỉ để rỗng. Áp dụng cho cả **tài
   liệu/report bạn viết về lần clean** — lần clean thật đã xoá sạch code nhưng lại in
   lại appid Douyin vào `report/report.md` làm "bằng chứng nguồn gốc". Mô tả loại định
   danh ("có Douyin appid") thay vì chép giá trị.

## GĐ0 — Kiểm kê (không sửa gì)

```bash
python3 <skills-dir>/dev-cocos-clean-3x-minigame/scripts/scan-third-party.py --root <project> --keep tiktok --keep ttminis
python3 <skills-dir>/dev-cocos-clean-3x-minigame/scripts/script-usage.py --root <project>
```

- `scan-third-party.py`: theo file — tên nền tảng/publisher/analytics, host global
  (`w.tt`, `wx`, `qq`, `ks`, `qg`…), URL cứng, chữ Hán, comment tiếng Việt (có/không
  dấu), header port, và **`id`**: appid `tt…`/`wx…`, khoá cấu hình có giá trị (`appid`,
  `rewardId`, `reportId`, `adUnitId`, `secret`, `token`…), chuỗi 32 ký tự kiểu secret.
  Quét cả `settings/`, `report/`, `docs/` và `*.md` ở gốc. Chạy lại ở cuối: mục `id`
  phải về **0**; mọi dòng khác còn lại phải là thứ **cố ý giữ**.
- `script-usage.py`: mỗi script được **ai import**, **gắn vào scene/prefab nào** (theo
  uuid nén — grep tên file không thấy), và **ai `addComponent("Tên")`**. Script gắn
  trong scene/prefab phải gỡ component qua Editor TRƯỚC khi xoá file.
- Đọc đủ các file lõi trước khi quyết: Platform facade, SDK loader, AdsManager,
  ApiService, lớp mock (BootPrelude), save manager (User/Storage), Loading/boot.
- Truy xem **luồng quảng cáo thật đi đường nào**: thường là
  `platform.showRewardAds → emit SHOW_ADS → AdsManager (SDK publisher) → pt.showRewardAds`.
  Cả chục chỗ gọi quảng cáo trong game chỉ phụ thuộc hợp đồng callback của
  `platform.showRewardAds(cb)` — giữ nguyên hợp đồng đó, thay ruột.
- Để ý phát hiện nền tảng: `w.tt` là API ByteDance **nội địa**; TikTok Minis quốc tế là
  `TTMinis.game`. Ở `tiktokgame17`, nhánh ZJTD (`tt`) chưa bao giờ chạy trong TikTok
  quốc tế — game thật đang chạy trên DevPlatform.

## GĐ1 — Lưu tiến độ + Platform facade

1. Copy `GameStorage.ts` (skill `tiktok-growth-missions`) vào gói chính; thay 2 dòng
   đọc/ghi của save manager; gọi `migrateFromLocalStorage('<prefix>_')` trong
   constructor save manager.
2. Viết lại Platform theo `templates/Platform.ts`: chỉ **TikTok + Dev**. Giữ các mã
   callback mà chỗ gọi đang dùng (vd `-3` → toast "chưa có quảng cáo").
3. Hàm mà game gọi nhưng nền tảng đích không có (share record, banner…) → no-op trả
   mã thành công **như Dev đang làm**, đừng để caller nhận lỗi mới.

## GĐ2 — Gỡ SDK publisher + nền tảng khác + analytics

Thứ tự (sai thứ tự là MissingScript hoặc preview chết):

1. **Gỡ component khỏi scene/prefab qua MCP**: `remove_component` → `save_current_scene`
   → kiểm file `.scene` không còn class id nén của script đó.
2. **Xoá file kèm `.meta`**: `git rm -f X.ts X.ts.meta`.
3. **Gỡ lời gọi còn sót** trong code game bằng `strip-calls.py` (dry-run trước):

   ```bash
   python3 <skills-dir>/dev-cocos-clean-3x-minigame/scripts/strip-calls.py \
     --pattern 'report\.reportTree\(' \
     --pattern 'bms\.checkKey\("isbanner"\)\s*&&\s*platform\.showBanner\(' \
     --pattern 'platform\.hideBanner\(' assets/game/*.ts           # thêm --write khi diff ổn
   ```

   Code port nối lệnh bằng dấu phẩy (`X, report.reportTree(...), Y`) — xoá bằng sed
   theo dòng là vỡ biểu thức. Script đi tới ngoặc đóng khớp rồi bỏ đúng một dấu phẩy.
   Sau đó: xoá import thừa, xoá method rỗng (`onDisable() {}`).
4. **Tính năng dựa trên server của publisher → tính local** (vd bảng xếp hạng vùng lấy
   từ config + dữ liệu người chơi). Giữ **đúng hành vi mà bản offline/mock đang có**
   (fixture trả gì thì local trả nấy), trừ khi người dùng yêu cầu khác.
5. Tính năng chỉ tồn tại trên nền tảng đã bỏ (vd Gift/sidebar của Douyin): xoá script,
   xoá prefab popup, xoá node nút trong prefab qua MCP, bỏ enum/handler liên quan.
6. Default "tắt" của config server (vd `bms.checkKey("isbanner")` mặc định `false`)
   nghĩa là nhánh đó là **code chết** — xoá cả nhánh, đừng cố nối sang nền tảng mới.
7. **Định danh còn sót ngoài file đã xoá**: id hard-code giữa câu lệnh (vd
   `this._config.rewardId = "e7hm…"` trong một adapter), salt ký nối chuỗi
   (`i += "VuFF…", md5(i)`), comment trích lại id (`// createRewardedVideoAd({ adUnitId: "18dic…" })`)
   trong mock. `scan-third-party.py` mục `id` bắt được cả ba dạng này.
8. **Lịch sử git vẫn giữ id/secret** của commit port ban đầu. Báo người dùng commit nào
   chứa gì; **không tự viết lại lịch sử** nhánh đã push chung. Secret là của bên thứ ba
   (không phải của mình) thì không có gì để rotate — chỉ cần không dùng lại.

## GĐ3 — Lớp mock cho nền tảng đích

- Mock của publisher (fake VNGGamesSDK, ApiMock cho endpoint đã xoá, FakeAnalytics) →
  xoá; thay bằng `templates/FakeTikTok.ts` (chỉ `PREVIEW` và chỉ khi không có SDK thật —
  không bao giờ đè TikTok trên máy). Giữ `MobileAdapter` (fix WebView, không phải bên thứ ba).
- Quảng cáo giả = `MockAdOverlay` (skill `dev-cocos-port-3x`): màn đen đếm ngược 3 giây
  rồi trao thưởng; khi `AdUnitId` còn rỗng thì **cả máy thật** cũng đi màn này.
- Cập nhật comment của BootPrelude/MobileAdapter: bỏ mọi tham chiếu tới file đã xoá.

## GĐ4 — Dọn chữ

- Xoá header port 2 dòng (`// Recovered from the shipped … bundle` + `// Original script
  file: …`) và boilerplate lặp (`// 2.x set these in ctor; 3.x has no ctor hook…`).
  Giữ PORT NOTE tiếng Anh có giá trị kỹ thuật.
- Dịch sang tiếng Anh: comment (kể cả tiếng Việt **không dấu** — scanner bắt theo cụm
  từ), `console.log/warn/error`, `@property({ tooltip })` tiếng Trung.
- Chuỗi tiếng Trung **người chơi thấy** (label prefab, `label.string = "返 回"`) → đổi
  sang ngôn ngữ nguồn của hệ i18n + thêm key vào mọi bảng dịch. Đừng để sót: dòng chữ
  chạy trên màn Home từng hiển thị "今日… 玩家搬砖…" suốt mà không ai để ý.
- Tên riêng trong comment (tên nền tảng khác, tên người/đội) → bỏ hoặc trung tính hoá.
- Extension nội bộ (`extensions/dev-tools`, `minigame-pack`): dịch UI, bỏ `author`,
  bỏ mục build nền tảng đã bỏ (WeChat), bỏ mục trỏ tới file không tồn tại trong repo
  (vd `preview-template/dev-tools.html`). Chạy `test.js` của extension nếu có.
  **Không** tái sinh hash trong `vendor-manifest.json`: để hash cũ thì lần chạy
  `setup-cocos-extensions` sau sẽ phân loại *modified* và hỏi, thay vì âm thầm ghi đè
  bằng bản gốc chưa clean.

## GĐ5 — Đồng bộ Editor + verify

1. `refresh_assets` với **đường dẫn project-relative** `assets/<thư-mục>` cho từng thư
   mục đã sửa. Truyền `db://assets/...` thì tool trả "written outside assets" và KHÔNG
   refresh; truyền `assets` trần thì Editor sinh rác `assets/.meta` — xoá nó.
2. Preview báo `Module ".../XxxPlatform.ts" not found for cce:/internal/x/prerequisite-imports`
   = Editor chưa biết file đã xoá → refresh rồi reload. Bản dựng lại chậm (Init
   SubSystem ~30 giây) — chờ, đọc console đến khi thấy log boot của code MỚI (đặt một
   log có chữ đã đổi, vd `[i18n] vi: 61 strings`, để phân biệt bản cũ/mới).
3. `tsc --noEmit` chạy trực tiếp bằng tsc của engine
   (`<Creator>/resources/resources/3d/engine/node_modules/.bin/tsc -p tsconfig.json`),
   đọc exit code. `run_script_diagnostics` của MCP có thể trả lại kết quả cũ (cùng callId).
4. Chạy thật: boot không lỗi, log `[platform] tiktok` (preview có FakeTikTok), vào màn
   chơi, bấm một nút xem quảng cáo → màn đen đếm 3→1 → thưởng về **một** lần, reload →
   tiến độ còn (`localStorage` key `<prefix>_coin` trong preview).
5. `scan-third-party.py` lần cuối; liệt kê cho người dùng từng dòng còn lại và vì sao giữ.

⛔ **Cổng người:** người dùng chơi thử bản đã clean.

## Bẫy đã dính

| Bẫy | Hậu quả | Cách tránh |
|---|---|---|
| Sửa `_string` trong `Main.prefab` trên đĩa rồi mở prefab trong Editor, xoá node, Save | Editor ghi đè bằng bản trong bộ nhớ → chữ Trung quay lại | Làm thao tác Editor trước, **đóng prefab** (mở lại scene chính), rồi mới sửa chuỗi trên đĩa + refresh |
| Xoá script trước khi gỡ component khỏi scene | Scene giữ MissingScript | `script-usage.py` → `remove_component` + save → rồi mới `git rm` |
| Chỉ tìm theo tên file | Bỏ sót chỗ scene/prefab gắn script (theo uuid nén) và chỗ `addComponent("Game")` | `script-usage.py` |
| Bash heredoc chứa `\\n`, `\\(` trong script Python sửa code | Chuỗi thay thế sai, assert fail giữa chừng | Viết script ra file (công cụ Write) rồi `python file.py` |
| Template/storage dùng `window` | Runtime native TikTok có thể không có `window` | `globalThis` |
| Nền tảng cũ trả mã lỗi mới cho caller | Toast đỏ/không thưởng ở chục chỗ gọi | Giữ hợp đồng callback; nhánh không hỗ trợ trả mã mà caller đã xử lý |
| Xoá mock vì "không còn endpoint" | Preview không còn chạy như TikTok, người dùng phải yêu cầu lại | Hỏi trước (Luật 1); đổi mock sang giả nền tảng đích |
| Chỉ quét tên nền tảng, không quét định danh | Code sạch tên nhưng id/secret vẫn nằm trong config, comment, report | Mục `id` của `scan-third-party.py` về 0, kể cả `report/` |
| Chạy `git add -A` ở repo có thay đổi dở của người khác | Commit lẫn việc không phải của mình | Chỉ `git add` đúng file của mình; hunk lẫn trong cùng file → `git apply --cached` bản vá riêng |

## Checklist cuối

- [ ] `scan-third-party.py` chỉ còn điểm cố ý giữ (đã báo người dùng); mục `id` = 0.
- [ ] Report/tài liệu về lần clean không chép lại appid, ad id, secret.
- [ ] Đã báo người dùng commit nào trong lịch sử git còn chứa id/secret.
- [ ] Không còn file của nền tảng/publisher/analytics; không còn import tới chúng.
- [ ] Scene/prefab: 0 MissingScript, 0 node của tính năng đã bỏ.
- [ ] Save đi qua `GameStorage`; reload giữ tiến độ.
- [ ] Mọi nút quảng cáo: màn giả 3 giây → thưởng đúng một lần (hoặc ad thật khi có AdUnitId).
- [ ] `tsc` exit 0; preview không lỗi console; build `bytedance-mini-game` boot được.
- [ ] Không commit — trừ khi người dùng yêu cầu.

## Script & template kèm theo

| File | Việc |
|---|---|
| `scripts/scan-third-party.py` | Kiểm kê tồn dư theo file: platform / host / url / han / vi-comment / header / **id** (appid, ad/report id, secret). Quét cả settings, report, docs. `--keep` nền tảng giữ lại, `--json` xuất báo cáo |
| `scripts/script-usage.py` | Mỗi script: ai import, scene/prefab nào gắn (uuid nén), ai `addComponent("Tên")`; liệt kê script mồ côi |
| `scripts/strip-calls.py` | Gỡ trọn lời gọi khỏi biểu thức dấu phẩy theo regex, đi tới ngoặc đóng khớp; dry-run mặc định |
| `templates/Platform.ts` | Platform facade chỉ TikTok + Dev, giữ hợp đồng `showRewardAds(cb)`, mute quanh quảng cáo |
| `templates/FakeTikTok.ts` | `TTMinis.game` giả cho preview (login), chỉ khi `PREVIEW` và không có SDK thật |

Liên quan: `tiktok-growth-missions` (GameStorage, TikTokAds/Login, 4 capability bắt buộc),
`dev-cocos-port-3x` (MockAdOverlay, lớp runtime), `dev-cocos-mcp` (luật lái Editor),
`dev-cocos-build-minigame` (build `bytedance-mini-game`, gói phụ).
