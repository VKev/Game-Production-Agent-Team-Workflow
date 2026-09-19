---
description: Tái dựng bản build Cocos 3.x thành project Cocos Creator 3.8.x chạy được — thẩm định, bóc asset theo uuid, dựng scene qua MCP, API giả + quảng cáo giả + mobile
argument-hint: [thư mục build/mirror, vd "./mirror-abc" hoặc "."]
---

Dùng skill `dev-cocos-port-3x` cho bản build sau:

$ARGUMENTS

`$ARGUMENTS` trống thì mặc định lấy thư mục làm việc hiện tại, **xác nhận với
user trước** khi quét.

## Trước khi làm gì khác

Xác nhận đây đúng là build **Cocos 3.x** (`src/settings.json`, `application.js`,
`cocos-js/`, `assets/<bundle>/config.<hash>.json`). Là 2.x → `/dev-cocos-port-2x`.

Hỏi user **nền tảng đích**. Nói rõ với user: nguồn 3.x **không cần bước tái dựng
2.x**, rẻ hơn hẳn nhánh 2.x — điều này thường đảo ngược quyết định đầu tư.

## MCP là bắt buộc cho scene/prefab

Kiểm `funplay_cocos` trước khi tới GĐ3: `lsof -nP -iTCP:8765 -sTCP:LISTEN`.
Không có thì cài extension `funplay-cocos-mcp-plugin` vào `<project>/extensions/`
(xem `references/mcp-setup.md`) — **đừng dựng scene tay như phương án thay thế**.

## Cảnh báo sớm

Báo NO-GO kèm số đo khi: script nằm trong `.jsc`/wasm · bản gốc không chạy được
sau khi stub SDK và code obfuscate nặng · logic quyết định nằm trên server ·
`extract-cocos3x-assets.py` báo **map rate < 50%**.

## Bốn thứ không được quên

1. API giả toàn bộ — project phải chơi được khi **rút mạng**
2. Quảng cáo giả — mọi chỗ xem quảng cáo nhận thưởng đều trao thưởng ngay
3. Comment tiếng Anh, ngắn gọn; chuỗi hiển thị giữ nguyên văn, không dịch
4. Tương thích Android/iOS: resolution policy, audio sau user gesture, safe area

## Báo lại cho user

Quyết định + map rate của extractor + số class/scene/prefab + đường dẫn báo cáo.
