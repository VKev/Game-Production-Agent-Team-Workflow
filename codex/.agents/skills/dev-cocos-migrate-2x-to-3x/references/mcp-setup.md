# MCP funplay-cocos — cài và kiểm trước khi dựng scene

Scene và prefab của 3.x **không được sửa tay bằng JSON**. Sửa tay là cách nhanh
nhất làm hỏng UUID / `PrefabInfo`, và lỗi chỉ lộ ra khi chạy — thường ở dạng
node mất tham chiếu, component null, hoặc prefab không instantiate được.

Cách đúng: **lái Editor sống** qua MCP `funplay_cocos`, đọc trước khi ghi, xong
thì save + validate. Nạp thêm skill `cocos-mcp` để biết luật đầy đủ.

## Kiến trúc — hai nửa phải khớp

| Nửa | Là gì | Đã có sẵn? |
|---|---|---|
| **Client** | khai báo MCP server trong cấu hình Claude Code: `funplay_cocos` = `http://127.0.0.1:8765/` | đã cấu hình ở user scope — dùng chung cho mọi project |
| **Editor** | extension `funplay-cocos-mcp-plugin` nằm trong `<project>/extensions/` — chính nó mở cổng 8765 | **KHÔNG tự có.** Project mới phải tự cài |

Vì vậy `ConnectionRefused` gần như luôn có nghĩa: *Editor chưa mở*, hoặc *project
đang mở chưa cài extension*, chứ không phải cấu hình client sai.

## Cài vào một project mới

```bash
# 1. copy extension từ một project đã có (bản đang dùng: funplay-cocos-mcp 0.4.4)
cp -R /Users/lap16952/Documents/workspace/oc-vit-cang-cuc-live/cocos-project-3x/extensions/funplay-cocos-mcp-plugin \
      <PROJECT-3.8>/extensions/

# 2. mở project trong Cocos Creator 3.8.x
# 3. Extension → Extension Manager → thấy "funplay-cocos-mcp" thì Enable
#    (chưa thấy thì Developer → Reload Extensions, hoặc khởi động lại Editor)
```

Editor phải **đang mở project đó** thì cổng mới lắng nghe. Đóng Editor là mất MCP.

## Kiểm trước khi dùng

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:8765/
lsof -nP -iTCP:8765 -sTCP:LISTEN
```

Không có ai LISTEN → extension chưa chạy. Đừng chuyển sang dựng scene tay như
phương án thay thế: **dừng, cài cho xong**. Dựng tay một scene vừa lâu hơn vừa
sai âm thầm.

## Khi vẫn không kết nối được

| Triệu chứng | Nguyên nhân hay gặp | Xử lý |
|---|---|---|
| `ConnectionRefused` | Editor đóng, hoặc project chưa cài extension | mở đúng project + Enable extension |
| Có process LISTEN nhưng tool vẫn lỗi | extension bản cũ, hoặc Editor kẹt sau khi reload | Developer → Reload Extensions, hoặc khởi động lại Editor |
| Cổng 8765 bị process khác chiếm | đụng port | tắt process kia, hoặc đổi port trong cấu hình extension **và** trong cấu hình MCP client cho khớp |
| Tool chạy nhưng scene không đổi | quên `save_scene` | luôn save + `validate_scene` sau mỗi loạt mutation |

## Luật khi đã kết nối được

1. **Read-before-write**: `inspect_node` / `inspect_prefab` / `read_file` trước,
   rồi mới mutate.
2. Mutate xong: **save + validate**. `validate_scene` và
   `validate_prefab_references` phải trả **0 broken ref** — đó là cổng của GĐ này.
3. Ground truth là `_import/` đã bóc ở bước recon (giá trị property thật) chứ
   không phải trí nhớ. Prefab dựng bằng cảm giác gần như luôn sai vài pixel, và
   sai đó không báo lỗi.
4. Dựng theo lô nhỏ, validate giữa chừng — một lô 100 node hỏng thì không biết
   node nào gây ra.
