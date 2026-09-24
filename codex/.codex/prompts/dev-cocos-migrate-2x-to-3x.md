---
description: Nâng project Cocos Creator 2.x có source lên 3.8.x/TypeScript — đo bản đồ thư mục, ánh xạ API, bẫy im lặng, scene/prefab qua MCP, verify A/B, API giả + quảng cáo giả + mobile
argument-hint: [thư mục project 2.x, vd "./cocos-project-2x"]
---

Dùng Skill tool với `skill: "dev-cocos-migrate-2x-to-3x"` cho project sau:

$ARGUMENTS

`$ARGUMENTS` trống thì hỏi user đường dẫn project 2.x **và** đường dẫn project
3.8.x đích (skill cần cả hai để đo bản đồ thư mục).

## Điều kiện đầu vào — kiểm trước, đừng convert bừa

- Có `assets/` + `.meta` + `project.json` → đúng là **project có source**. Chỉ có
  bản build (không `.meta`) thì dùng `/dev-cocos-port-2x` trước.
- Project 2.x **mở được trong Editor 2.4.x và chơi được**. Không chạy được thì
  không có ground truth, mọi so sánh A/B ở bước verify đều vô nghĩa — dừng và hỏi.
- Có ảnh chụp một vòng gameplay của bản 2.x để về sau so lại.

## Đo trước, đừng đoán đường dẫn

Việc đầu tiên là chạy `scripts/probe-cocos-layout.js` cho **cả hai** project. Mỗi
project Cocos xếp thư mục một kiểu (`assets/Script`, `assets/scripts`, hay chia
theo bundle) — mọi đường dẫn về sau phải lấy từ output đó, không lấy từ ví dụ
trong tài liệu.

## MCP là bắt buộc cho scene/prefab

Port của `funplay-cocos-mcp` là **per-project**, đọc từ
`funplay-cocos-mcp.config.json` ở gốc project 3.x — đừng giả định 8765. Chưa có
extension thì chạy `setup-cocos-mcp`. **Không sửa tay JSON `.scene`/`.prefab`.**

## Port script: một agent mỗi wave

`scripts/plan-port-waves.js` xếp thứ tự phụ thuộc và chia wave. Dispatch **một**
agent `cocos-port-class` cho mỗi wave, chạy lần lượt — không fan-out một agent
cho một class (tốn token, và các agent song song không thống nhất được style
export). File vendor thì copy, không port.

## Bốn thứ không được quên

1. API giả toàn bộ — bản 3.x phải chơi được khi **rút mạng**. Project 2.x đã có
   `ApiMock`/`FakeAds`/`MobileAdapter` thì convert chúng sang TS, đừng viết lại
2. Quảng cáo giả — mọi chỗ xem quảng cáo nhận thưởng hiện `MockAdOverlay` (màn đen
   đếm ngược 3 giây) rồi trao thưởng. Nhớ
   kiểm tầng thứ hai: SDK publisher hay gọi tiếp quảng cáo thật của nền tảng
3. Comment tiếng Anh, ngắn gọn; chuỗi hiển thị **giữ nguyên văn** (còn dùng để
   diff 1-1 với bản 2.x ở bước verify)
4. Tương thích Android/iOS

## Kỷ luật khi chạy

Mở `references/pitfalls.md` từ GĐ2 tới hết dự án — đó là bẫy **im lặng**: không
lỗi compile, không lỗi runtime, chỉ sai.

Không cải tiến code trong lúc convert. Mọi khác biệt hành vi ở bước này là bug
không truy được; refactor là commit riêng sau khi chạy đúng.

## Báo lại cho user

Số class đã convert / còn lại, kết quả type check sau mỗi wave, kết quả
`validate_scene` + `validate_prefab_references`, kết quả A/B với bản 2.x, và dung
lượng build so với trần của đúng nền tảng đích.
