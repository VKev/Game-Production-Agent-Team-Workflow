---
name: research-browser-game-batch
description: >-
  Mirror MỘT DANH SÁCH game Cocos Creator trong một lượt — mỗi game một folder
  riêng dưới một folder tổng, có status per-game, resume, và report gộp. Engine
  khác (Unity WebGL, Laya, Egret, Phaser, HTML5 thuần) bị phát hiện ngay sau
  capture live và bỏ qua kèm báo cáo, TRƯỚC khi tải bất kỳ asset nào. Dùng khi
  người dùng đưa nhiều URL game, một file games.txt, hay nói fetch/cào hàng
  loạt game, nhiều game, cả danh sách game. Uỷ nhiệm việc mirror từng game cho
  skill research-browser-game-mirror và không bao giờ nới lỏng completion contract của nó.
---

# Fetch games — batch

Chạy nhiều lần mirror độc lập trên một danh sách, mỗi game một folder, tất cả
dưới một folder tổng. Skill này là **lớp điều phối**: nó không tự mirror.

**Chỉ xử lý Cocos Creator (2.x và 3.x).** Engine khác bị dừng ngay sau capture
live, **chưa mirror gì**, báo `not-cocos`. Muốn mirror engine khác thì chạy
`/research-browser-game-mirror <url>` riêng — skill đơn xử lý được mọi engine, chỉ batch mới
giới hạn Cocos.

## Ranh giới

Việc mirror MỘT game do skill `research-browser-game-mirror` đảm nhiệm. Skill này chỉ làm 5 việc:

1. Chuẩn hoá danh sách → layout folder xác định.
2. Chặn engine không phải Cocos **trước khi tải asset nào**.
3. Fan-out mỗi game vào một worker context riêng, có cap.
4. Gộp số liệu từ **artifact thật** mà script của skill đơn sinh ra.
5. Phân loại trạng thái từng game, chặn batch tự tuyên bố "xong".

Danh sách chỉ có một game thì đừng dùng skill này — gọi `/research-browser-game-mirror` trực
tiếp, ít overhead hơn.

## Layout

```text
<parent>/                      # mặc định games/<batch-name>/
  games.txt                    # danh sách input, nguồn sự thật
  plan.json                    # batch-plan.mjs sinh — path + lệnh đã resolve
  batch.jsonl                  # log append-only, dùng để resume
  BATCH-REPORT.md              # bảng tổng hợp
  <slug>/
    mirror/                    # build root SẠCH — chỉ chứa build + api-mock/
    evidence/                  # capture + runtime-verification.json
    result.json                # worker ghi, batch-collect đọc
    FETCH-REPORT.md
```

`mirror/` phải chỉ chứa build (và `api-mock/`), không lẫn evidence — để
`/dev-cocos-port-2x <parent>/<slug>/mirror` nhận đúng một build root.

## Định dạng danh sách

Một game mỗi dòng: URL rồi các `key=value` tuỳ chọn. `#` là comment.

```text
# url                                  hint
https://portal.example/game/abc        slug=abc
https://portal.example/game/xyz        slug=xyz build=https://cdn.example/xyz/ wait=45000
https://portal.example/game/def        slug=def map=https://cdn2.example/shared/=shared/ allow=api.portal.example
https://portal.example/game/paid       skip=cần đăng nhập, xử lý tay
```

Key hợp lệ: `slug`, `build`, `map` (lặp được), `referer`, `wait`, `allow` (lặp
được), `eval` (file JS cho `--eval-file`), `skip`. Game có `build=` thì worker
khỏi đi tìm build root — nhanh và ít sai hơn nhiều.

## Quy trình

1. `node scripts/batch-plan.mjs --list <games.txt> --out <parent>` → tạo layout,
   `plan.json`, seed `batch.jsonl`. Thêm `--resume` để bỏ qua game đã `complete`.
2. Đọc `plan.json`. Mỗi game là một entry độc lập, path đã resolve sẵn, kèm chuỗi
   lệnh theo đúng thứ tự phải chạy.
3. Fan-out: mỗi game một agent `browser-game-fetcher`, **cap 3 game cùng lúc** (mỗi worker
   giữ 1 Chrome headless + 1 server python). Worker thi hành 12 bước của skill
   đơn, nhưng phải qua **cổng Cocos** trước:

   ```text
   capture live  →  detect-engine.mjs  →  exit 0  → mirror → sync → api-mock → serve → verify
                                          exit 3  → dừng, status not-cocos (engine khác)
                                          exit 4  → dừng, status not-cocos (không nhận ra)
   ```

   Cổng đặt **ngay sau capture live, trước mirror** — capture chỉ là một lần load
   trang, mirror mới là chỗ tốn băng thông. `detect-engine.mjs` đọc
   `live-network.json` đã có, không tải thêm gì.
4. `node scripts/batch-collect.mjs --out <parent>` → đọc artifact thật, append
   `batch.jsonl`, sinh `BATCH-REPORT.md`. Exit 2 nếu còn game chưa `complete`.
5. Game `failed`: đọc lý do trong report, sửa, chạy lại **đúng game đó** rồi
   collect lại. Không chạy lại cả batch.
6. Báo cho user: bảng trạng thái + việc còn lại.

## Trạng thái — phần quan trọng nhất của skill này

Batch fail theo kiểu im lặng bằng cách đếm game mới boot được thành game đã
mirror đủ. Nên chỉ có 5 trạng thái, và `complete` **không** phải mặc định:

| status | nghĩa |
|---|---|
| `pending` | chưa chạy, hoặc chạy chưa xong |
| `complete` | verify pass + manifest closure = 0 missing + **đã exercise lazy routes** |
| `boot-only` | verify pass, manifest 0 missing, nhưng lazy routes chưa exercise |
| `failed` | còn failedRequests / externalRequests / manifest missing / script lỗi |
| `not-cocos` | engine khác hoặc không nhận ra → dừng sau capture live, chưa mirror |
| `blocked` | login, DRM, paywall, hoặc bundle 404 phía origin — cần người |

`batch-collect.mjs` **không bao giờ tự set `complete`**. Từ artifact, mức cao nhất
nó suy ra được là `boot-only`; muốn lên `complete` thì `result.json` phải liệt kê
tên các lazy route đã exercise. Đây là chủ ý: lazy route cần tương tác, không có
artifact nào chứng minh hộ được.

`not-cocos` là **kết quả hợp lệ, không phải lỗi** — nó không làm fail cổng batch
vì đã được nêu tên kèm engine trong report. Quy tắc của cổng là **chỉ đi tiếp khi
nhận diện được là Cocos**: "không nhận ra engine" cũng xếp vào `not-cocos`, vì
batch không đoán.

Đã qua cổng Cocos mà không có `mirror-audit/cocos-assets.json` thì chỉ có một
cách hiểu: `sync-cocos-assets.mjs` chưa từng chạy → `failed`, không phải `boot-only`.

## Completion contract cấp batch

Không nói "đã fetch xong danh sách" khi chưa đủ cả 5:

- Mọi game trong danh sách có một dòng trong `batch.jsonl` với status khác `pending`.
- Số `complete` / `boot-only` / `failed` / `not-cocos` / `blocked` được báo **rời
  nhau**, không gộp thành một con số "N game đã tải".
- Mỗi game `blocked` nêu tên kèm lý do cụ thể, không phải "lỗi".
- Mỗi game `not-cocos` nêu tên kèm **engine nhận diện được** — bị bỏ vì Unity
  khác với vì không đọc ra engine, hai thứ dẫn tới hành động khác nhau.
- Game bị `skip=` trong danh sách được nêu tên — bỏ qua có chủ ý vẫn phải hiện ra.

## Kỷ luật song song

- Server local luôn `--port 0` (`serve-local.py` in ra cổng thật OS cấp trong
  dòng JSON có `"port"`). Đừng hardcode 8124 — máy này có process khác giữ nó.
- `capture-runtime.mjs` đã parallel-safe: profile Chrome tạo bằng `mkdtempSync`,
  debug port tự chọn cổng trống.
- Chỉ **một** process được ghi `batch.jsonl` — luôn là `batch-collect.mjs`. Worker
  ghi `result.json` trong folder game của nó.
- Worker chỉ chạm folder game được giao.

## Reference

Đọc [references/batch-protocol.md](references/batch-protocol.md) cho schema
`result.json`, quy tắc suy ra status từ artifact, cách resume, cách rerun một game.
