---
description: Tái dựng bản build Cocos 2.x thành project Cocos Creator 2.4.x chạy được — thẩm định khả thi, recon, dựng project, API giả + quảng cáo giả + mobile
argument-hint: [thư mục build/mirror, vd "./mirror-abc" hoặc "."]
---

Dùng Skill tool với `skill: "dev-cocos-port-2x"` cho bản build sau:

$ARGUMENTS

`$ARGUMENTS` trống thì mặc định lấy thư mục làm việc hiện tại làm build root,
nhưng **xác nhận với user trước** khi quét.

## Trước khi làm gì khác

Xác nhận đây đúng là build **Cocos 2.x** (`window._CCSettings`, scene `.fire`,
`ENGINE_VERSION="2.x"`). Nếu là 3.x → dùng `/dev-cocos-port-3x`, rẻ hơn hẳn, nói rõ
điều đó cho user. Nếu đã có `.meta` + source → đây là project, dùng
`/dev-cocos-migrate-2x-to-3x`.

Hỏi user **nền tảng đích** (web / WeChat / Douyin / Android / iOS) — nó chi phối
trần dung lượng và phần tương thích.

## Cảnh báo sớm là nhiệm vụ chính của GĐ0

Chạy `triage-scan.py` + `serve-local.py` rồi kết luận trong **giờ đầu**. Báo
NO-GO ngay, kèm **số đo**, khi: L4 (`.jsc`/wasm) · bản gốc không chạy được sau
khi stub SDK và mức ≥ L3 · logic quyết định nằm trên server · manifest còn thiếu
asset. Đừng để tới giữa dự án mới nói là không làm được.

Cổng người: user phải chơi được bản gốc ở local trước khi kết luận GO.

## Bốn thứ không được quên

1. API giả toàn bộ — project phải chơi được khi **rút mạng**
2. Quảng cáo giả — mọi chỗ xem quảng cáo nhận thưởng đều trao thưởng ngay
3. Comment tiếng Anh, ngắn gọn; chuỗi hiển thị giữ nguyên văn, không dịch
4. Tương thích Android/iOS: resolution policy, audio sau user gesture, safe area

## Báo lại cho user

Quyết định GO/NO-GO + 3 con số quyết định nhất (mức L, số class, số prefab) +
đường dẫn báo cáo. Đừng dán lại cả báo cáo.
