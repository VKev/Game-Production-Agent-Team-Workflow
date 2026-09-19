---
description: Nâng project Cocos Creator 2.x có source lên 3.8.x/TypeScript — ánh xạ API, bẫy im lặng, scene/prefab qua MCP, verify A/B, API giả + quảng cáo giả + mobile
argument-hint: [thư mục project 2.x, vd "./cocos-project-2x"]
---

Dùng Skill tool với `skill: "dev-cocos-migrate-2x-to-3x"` cho project sau:

$ARGUMENTS

`$ARGUMENTS` trống thì hỏi user đường dẫn project 2.x.

## Điều kiện đầu vào — kiểm trước, đừng convert bừa

- Có `assets/` + `.meta` + `project.json` → đúng là **project có source**. Chỉ có
  bản build (không `.meta`) thì dùng `/dev-cocos-port-2x` trước.
- Project 2.x **mở được trong Editor 2.4.x và chơi được**. Không chạy được thì
  không có ground truth, mọi so sánh A/B ở bước verify đều vô nghĩa — dừng và hỏi.
- Có ảnh chụp một vòng gameplay của bản 2.x để về sau so lại.

## MCP là bắt buộc cho scene/prefab

Kiểm `lsof -nP -iTCP:8765 -sTCP:LISTEN`. Không có thì cài
`funplay-cocos-mcp-plugin` vào `<project-3.8>/extensions/` (xem
`references/mcp-setup.md`). **Không sửa tay JSON `.scene`/`.prefab`.**

## Bốn thứ không được quên

1. API giả toàn bộ — bản 3.x phải chơi được khi **rút mạng**. Project 2.x đã có
   `ApiMock`/`FakeAds`/`MobileAdapter` thì convert chúng sang TS, đừng viết lại
2. Quảng cáo giả — mọi chỗ xem quảng cáo nhận thưởng đều trao thưởng ngay
3. Comment tiếng Anh, ngắn gọn; chuỗi hiển thị **giữ nguyên văn** (còn dùng để
   diff 1-1 với bản 2.x ở bước verify)
4. Tương thích Android/iOS

## Kỷ luật khi chạy

Mở `references/pitfalls.md` từ GĐ1 tới hết dự án — đó là bẫy **im lặng**: không
lỗi compile, không lỗi runtime, chỉ sai.

Không cải tiến code trong lúc convert. Mọi khác biệt hành vi ở bước này là bug
không truy được; refactor là commit riêng sau khi chạy đúng.

## Báo lại cho user

Số class đã convert / còn lại, kết quả `validate_scene` + `validate_prefab_references`,
kết quả A/B với bản 2.x, và dung lượng build so với trần nền tảng.
