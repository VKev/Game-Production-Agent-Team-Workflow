---
description: Thẩm định source game HTML5 trước khi port sang Cocos 3.x (GO/NO-GO, chạy thử local, chấm obfuscation)
argument-hint: [thư mục build hoặc URL game, vd "./source-tank" hay "." ]
---

Dùng agent `cocos-port-triage` và `run_in_background: false`
để thẩm định bản build sau:

$ARGUMENTS

Chạy đồng bộ (không background) vì agent phải bàn giao lại **checklist chơi thử**
cho user tick — đó là cổng người, không tự vượt được.

Nếu `$ARGUMENTS` trống: mặc định lấy thư mục làm việc hiện tại làm build root,
nhưng **xác nhận với user trước** khi quét.

Kèm cho agent những gì đã biết trong hội thoại này, đặc biệt là:
- **ai sở hữu game** (thiếu thông tin này thì không kết luận GO được — hỏi user)
- **nền tảng đích** (web / WeChat / Douyin — chi phối trần dung lượng ở GĐ6)

Khi agent trả kết quả, báo lại cho user: **quyết định + 3 con số quyết định nhất
+ đường dẫn `PORT-TRIAGE.md`**. Đừng dán lại cả báo cáo.
