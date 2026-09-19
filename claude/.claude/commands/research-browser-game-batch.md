---
description: Fetch cả một danh sách game Cocos Creator — mỗi game một folder riêng, engine khác bị bỏ qua và báo lại, có status per-game, resume và report tổng
argument-hint: [file danh sách hoặc nhiều URL, kèm tên batch nếu muốn, vd "games.txt casual-2026-09"]
---

Dùng Skill tool với `skill: "research-browser-game-batch"` cho danh sách sau:

$ARGUMENTS

`$ARGUMENTS` trống thì hỏi user danh sách game (đường dẫn file, hoặc dán URL).

Danh sách **một game** thì đừng dùng skill batch — gọi `/research-browser-game-mirror <url>`
trực tiếp, ít overhead hơn.

Batch này **chỉ xử lý Cocos Creator**. Engine khác bị dừng ngay sau capture live
(chưa tải asset nào) và báo `not-cocos`. Đó là hành vi user đã chọn — đừng coi là
lỗi, đừng đề xuất nới cổng; game nào vẫn muốn thì mirror riêng bằng
`/research-browser-game-mirror <url>`.

## Phạm vi

User đã xác nhận nguồn bất kỳ, tác quyền do họ đảm bảo, chỉ nghiên cứu source.
Không hỏi lại. Ranh giới cứng (credential, paywall, DRM, purchase, entitlement,
dữ liệu server-authoritative) vẫn giữ nguyên.

## Mặc định khi user không nói

- Folder tổng `games/<tên-batch>`, không có thì `games/batch-<YYYY-MM-DD>`
- Cap song song **3** game cùng lúc
- Mỗi game một agent `browser-game-fetcher`; game đã có `build=` thì chạy thẳng chuỗi lệnh
  trong `plan.json`, khỏi tốn một agent đi tìm build root

## Kỷ luật khi chạy

`batch-plan.mjs` → fan-out worker → `batch-collect.mjs`. Đừng tự soạn quy trình khác.

Chỉ `batch-collect.mjs` được ghi `batch.jsonl`. Worker ghi `result.json` trong
folder game của nó. Một game fail thì rerun **đúng game đó** rồi collect lại.

## Báo lại cho user

Bảng trạng thái + việc còn lại. Các con số phải **rời nhau**:

- `complete` / `boot-only` / `failed` / `not-cocos` / `blocked` — đừng gộp thành
  "N game đã tải"
- game `not-cocos` nêu tên kèm **engine nhận diện được**, và nói rõ đã dừng trước
  khi tải asset. "Không nhận ra engine" khác với "là Unity"
- game `blocked` nêu tên kèm lý do cụ thể
- game bị `skip=` trong danh sách cũng phải hiện ra
