---
description: Mirror trọn vẹn một browser game HTML5 về local (mọi engine) — capture, đóng kín asset + CDN, ghi API thành fixture mock, chạy thử bằng python
argument-hint: [URL game, kèm thư mục đích nếu muốn, vd "https://portal.example/game/abc ./mirror-abc"]
---

Dùng skill `research-browser-game-mirror` để mirror game sau:

$ARGUMENTS

`$ARGUMENTS` trống thì hỏi user URL game. Đó là thứ duy nhất bắt buộc phải hỏi.

## Phạm vi — đừng hỏi lại

User đã xác nhận: **nguồn bất kỳ đều được, tác quyền do họ đảm bảo, chỉ nghiên
cứu source.** Không hỏi lại quyền sở hữu ở mỗi game.

Ranh giới cứng vẫn giữ: không vượt credential, paywall, DRM, purchase,
entitlement; không lấy dữ liệu server-authoritative. Gặp login/paywall thì dừng
và báo `blocked` kèm lý do, không tìm đường vòng.

## Mặc định khi user không nói

- Đích mirror `./mirror-<slug>`, evidence `./evidence-<slug>`
- Server local: `serve-local.py --port 0` (nó in cổng thật ra dòng JSON). Đừng
  hardcode 8124 — máy này có process khác đang giữ cổng đó
- Node ≥ 22 cho script `.mjs`, `python3` cho server. `node -v` fail thì symlink
  đứt: `ln -sfn ~/.nvm/versions/node/<ver>/bin/node /opt/homebrew/bin/node`

## Kỷ luật khi chạy

Thi hành đúng 12 bước trong `SKILL.md`. Ba chỗ dễ tự lừa nhất:

- **"Game chạy được" ≠ "mirror đủ"**. Vào được gameplay chỉ là mốc boot. Phải
  chạy `sync-cocos-assets.mjs` tới khi mọi manifest báo missing = 0.
- **Đừng bọc try/catch toàn cục để hết lỗi** — nó làm scene đầu hiện ra trong khi
  mirror vẫn thiếu, che mất đúng tín hiệu cần đọc.
- **API phải exercise mới có fixture**. Capture một lần chỉ bắt được API màn đầu.
  Mở shop / nhiệm vụ / xếp hạng / nhận thưởng quảng cáo rồi capture tiếp, gộp
  nhiều `--api` vào `build-api-mock.mjs`.

Dependency 404 ở cả build origin lẫn CDN → báo **origin unavailable** kèm tên
bundle, đừng đếm vào "đã xong".

## Báo lại cho user

**URL local + 5 con số + việc còn lại**:

- `manifestMissing`, `failedRequests`, `externalRequests`, số lazy route đã thử,
  **số fixture API**
- endpoint nào chưa mock được (WebSocket, sau đăng nhập) — nêu tên
- patch đã áp và lý do (đặc biệt nếu stub portal SDK)

Đừng dán lại cả `mirror-audit/runtime-assets.json`. Giữ server chạy và đưa URL.

Xong thì gợi ý bước tiếp theo engine đọc được:
`/dev-cocos-port-2x <mirror>` hoặc `/dev-cocos-port-3x <mirror>`.
