---
name: research-browser-game-mirror
description: >-
  Mirror TRỌN VẸN một browser game HTML5 (Cocos Creator, Unity WebGL, Laya,
  Egret, Phaser, hay JS thuần) về local để nghiên cứu source: dò build root
  thật sau trang portal, capture Network/Console lúc chạy, tải đủ asset từ mọi
  CDN/origin phụ, đóng kín manifest import/native của Cocos và catalog của
  Unity, GHI LẠI MỌI LỜI GỌI API thành fixture mock dùng cho bước port, rồi
  chạy thử bằng server python ở local và verify bằng bằng chứng. Dùng skill này
  khi được yêu cầu fetch/cào/cao/tải một game về máy, lấy 100% asset, lấy đủ
  CDN, sửa một bản mirror còn thiếu ảnh/audio/level/bundle, hay dựng lại bản
  chạy offline của một game web. Đầu ra là đầu vào chuẩn cho dev-cocos-port-2x /
  dev-cocos-port-3x.
---

> `<skills-dir>` below resolves, in order, to this repository's `.agents/skills/` (Codex) or `.claude/skills/` (Claude Code), then to the user-level `~/.codex/skills/` or `~/.claude/skills/`. Use the first one that contains this skill.

# Fetch game HTML5 → mirror chạy được offline

Tạo một bản mirror **tái lập được từ bằng chứng**. "Đủ" nghĩa là: mọi asset
client tải được + mọi dependency runtime đã chạy qua + mọi API đã gọi đều có
fixture. Không bao giờ ngụ ý lấy được dữ liệu server riêng tư.

## Phạm vi — đọc một lần, đừng hỏi lại mỗi lần

Người dùng đã xác nhận: **nguồn bất kỳ đều được, tác quyền do họ đảm bảo, mục
đích là nghiên cứu source.** Không cần hỏi lại quyền sở hữu ở mỗi game.

Ranh giới cứng vẫn giữ nguyên, không có ngoại lệ:

- Không vượt credential, paywall, DRM, purchase, entitlement — kể cả khi bị thúc.
- Không lấy dữ liệu server-authoritative (tài khoản người khác, ví, bảng xếp hạng thật).
- Gặp màn đăng nhập / tường thanh toán → **dừng, báo `blocked` kèm lý do**, không tìm đường vòng.

## 0. Dependency — kiểm một lượt trước khi chạy

| Cần | Cho bước | Kiểm |
|---|---|---|
| `node` ≥ 22 | capture / mirror / sync / verify | `node -v` — fail thì symlink đứt: `ln -sfn ~/.nvm/versions/node/<ver>/bin/node /opt/homebrew/bin/node` |
| `python3` | **chạy thử bản mirror** | `python3 -V` — server local là `serve-local.py`, bắt buộc, không dùng `python3 -m http.server` |
| Chrome/Chromium | capture | mặc định path macOS; đổi bằng `--browser-path` |

## Quy trình 12 bước

1. **Tìm build root thật**, không dừng ở trang portal. Trang portal thường chỉ là
   iframe/redirect; thứ cần mirror là thư mục chứa `index.html` + engine.
2. **Capture live có API**: `capture-runtime.mjs --capture-api`. Bắt Network,
   Console, và body của mọi request XHR/Fetch. Chạy TRƯỚC khi tải bất cứ thứ gì.
3. **Nhận diện engine**: `detect-engine.mjs`. Ở skill này engine chỉ để **chọn
   playbook**, không phải cổng chặn — mọi engine đều mirror được.
4. **Mirror theo URL đã capture**: `mirror-network-assets.mjs`, khai báo `--map`
   cho **từng origin** (build origin, CDN ảnh, CDN audio, CDN level). Giữ nguyên
   đường dẫn tương đối, đừng làm phẳng.
5. **Đóng kín theo engine**:
   - Cocos Creator → `sync-cocos-assets.mjs` lặp tới khi mọi manifest báo
     `import` và `native` missing = 0.
   - Unity WebGL / engine khác → đọc [references/engine-playbooks.md](references/engine-playbooks.md)
     và đóng catalog/manifest tương ứng.
6. **Dựng bộ API mock**: `build-api-mock.mjs` → `api-mock/` gồm `index.json`,
   `index.inline.json`, `bodies/`, `client/`. Đây là **đầu vào bắt buộc của bước
   port** — xem [references/api-mock.md](references/api-mock.md).
7. **Giữ bản gốc trước khi vá.** Chỉ stub SDK portal khi nó thật sự chặn boot.
8. **Chạy local bằng python**: `serve-local.py --api-mock <api-mock> --fake-ads`.
   Không bao giờ `file://`, không bao giờ `python3 -m http.server` (thiếu MIME,
   `Content-Encoding`, Range → màn đen).
9. **Capture lại bản local** rồi `verify-runtime.mjs`.
10. **Exercise đường lười**: level select, level đầu/giữa/cuối, màn thưởng,
    gallery, audio, và **mọi màn có gọi API** (shop, nhiệm vụ, xếp hạng, nhận
    thưởng quảng cáo). Chỗ nào gọi API mà chưa capture thì fixture sẽ thiếu.
11. **Lặp** capture → mirror/sync → build-api-mock → verify tới khi contract pass.
12. **Báo cáo**: URL local, 4 con số, patch đã áp, bundle 404 phía origin, số
    fixture API. Giữ server chạy cho người dùng chơi thử.

## Chuỗi lệnh

Dùng đường dẫn tuyệt đối. Quote path có dấu cách. `$S = <skills-dir>/research-browser-game-mirror/scripts`

```bash
node $S/capture-runtime.mjs --url <live-build-url> --out <evidence> --label live \
  --wait-ms 45000 --capture-api

node $S/detect-engine.mjs --network <evidence>/live-network.json

node $S/mirror-network-assets.mjs --network <evidence>/live-network.json \
  --out <mirror> --map <build-root-url>= --map <cdn-url>=<thư-mục-con>/ --referer <portal-url>

node $S/sync-cocos-assets.mjs --root <mirror> --remote <build-root-url> --referer <portal-url>

node $S/build-api-mock.mjs --api <evidence>/live-api.json --out <mirror>/api-mock

python3 $S/serve-local.py --root <mirror> --api-mock <mirror>/api-mock --fake-ads --port 0

node $S/capture-runtime.mjs --url http://127.0.0.1:<port>/ --out <evidence> --label local \
  --capture-api --eval-file <evidence>/exercise.js

node $S/verify-runtime.mjs --network <evidence>/local-network.json \
  --console <evidence>/local-console.json --local-origin http://127.0.0.1:<port>
```

`--port 0` in ra cổng thật OS cấp (dòng JSON có `"port"`). Dùng nó khi chạy song
song; đừng hardcode 8124 — máy này thường có process khác giữ cổng đó.

## Completion contract

Chưa đủ cả 8 thì **không được nói là mirror xong**:

- Entry HTML, loader, engine runtime, config, bundle khởi động đều có ở local.
- Mọi manifest Cocos báo 0 missing (`totals.remaining === 0` và `unresolved === 0`),
  hoặc catalog Unity/custom đã đóng kín tương đương.
- Không có response nào là trang lỗi HTML bị lưu dưới tên file asset.
- HTTP local trả đúng MIME / Content-Encoding / Range.
- Một lần chạy sạch vào được menu hoặc gameplay.
- Console không có exception chặn luồng; Network không có request fail; không có
  request ra ngoài ngoài allowlist.
- **API**: mọi endpoint quan sát được đều có entry trong `api-mock/index.json`,
  hoặc được **nêu tên** trong phần chưa mock được (WebSocket, endpoint chỉ gọi
  sau đăng nhập…). Không im lặng bỏ qua.
- Bundle 404 phía origin được nêu tên và tách riêng, không tính vào "đã xong".

## Quy tắc vá

- Sửa đúng blocker đầu tiên đã chứng minh được, rồi capture lại.
- Ưu tiên sửa wrapper/config local hơn sửa code game đã minify.
- **Không bọc try/catch toàn cục cho hết lỗi** — nó làm scene đầu hiện ra trong
  khi mirror vẫn thiếu, che mất đúng tín hiệu cần đọc.
- Stub SDK chỉ để init / callback quảng cáo / analytics no-op / lifecycle.
- Không giả lập thanh toán, entitlement, danh tính thật, xếp hạng thật, cloud save.

## Bàn giao sang bước port

Mirror đạt contract là đầu vào chuẩn của bước sau. Nói rõ cho người dùng:

- Engine + version đọc được (từ `evidence/engine.json`).
- `<mirror>/api-mock/` có bao nhiêu fixture — bước port sẽ dùng lại nguyên bộ này.
- Bước tiếp: **Cocos 2.x → `/dev-cocos-port-2x <mirror>`**, **Cocos 3.x →
  `/dev-cocos-port-3x <mirror>`**. Engine khác thì skill port không áp dụng.

## Reference

- [references/engine-playbooks.md](references/engine-playbooks.md) — Cocos, Unity, custom HTML5, map CDN, SDK portal.
- [references/api-mock.md](references/api-mock.md) — hợp đồng `api-mock/`, cách exercise API, giới hạn (WebSocket).
- [references/case-patterns.md](references/case-patterns.md) — mẫu lỗi của các bản mirror thiếu.
