---
description: Dọn project Cocos 3.x mini-game chỉ còn nền tảng đang ship (mặc định TikTok) — gỡ SDK publisher, nền tảng khác, analytics, link, comment không phải tiếng Anh — mà game vẫn chạy
argument-hint: [thư mục project Cocos 3.x, vd "." hoặc "D:/Repos/tiktokgame17"]
---

Dùng Skill tool với `skill: "dev-cocos-clean-3x-minigame"` cho project sau:

$ARGUMENTS

`$ARGUMENTS` trống thì lấy thư mục làm việc hiện tại, **xác nhận với user trước**.

## Trước khi xoá bất cứ gì

1. Chạy `scan-third-party.py` + `script-usage.py`, đọc các file lõi (Platform, SDK
   loader, AdsManager, ApiService, mock, save manager, boot).
2. Hỏi user 4 quyết định, mỗi câu có khuyến nghị: chữ hiển thị trong game (chỉ tiếng
   Anh / giữ đa ngôn ngữ) · dữ liệu từng lấy từ backend publisher (tính local / bỏ tính
   năng / giữ khung API) · nền tảng khác (xoá hết, chỉ còn đích + Dev) · mock (giữ,
   đổi sang giả nền tảng đích).

## Bốn thứ không được quên

1. Game chạy lại được sau MỖI giai đoạn — preview, vào màn, xem một quảng cáo, reload.
2. Lưu tiến độ qua storage của nền tảng đích (`GameStorage.ts`, skill `tiktok-growth-missions`).
3. Gỡ component khỏi scene/prefab qua MCP TRƯỚC khi xoá script; xoá kèm `.meta`.
4. Quảng cáo giả = `MockAdOverlay` (3 giây rồi thưởng) cho tới khi có AdUnitId thật.

## Báo lại cho user

Số file xoá/sửa, những gì đã thay bằng tính local, kết quả chạy thử, và từng dòng
`scan-third-party.py` còn lại kèm lý do giữ. Không commit trừ khi user yêu cầu.
