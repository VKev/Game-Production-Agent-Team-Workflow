# MCP funplay-cocos — cài và kiểm trước khi dựng scene

Scene và prefab của 3.x **không được sửa tay bằng JSON**. Sửa tay là cách nhanh
nhất làm hỏng UUID / `PrefabInfo`, và lỗi chỉ lộ ra khi chạy — thường ở dạng
node mất tham chiếu, component null, hoặc prefab không instantiate được.

Cách đúng: **lái Editor sống** qua MCP `funplay_cocos`, đọc trước khi ghi, xong
thì save + validate. Nạp skill `dev-cocos-mcp` để biết luật dùng tool đầy đủ.

## Việc cài thuộc skill khác — đừng làm tay ở đây

Cài extension, chọn port, khai báo vào client, khoá tool nguy hiểm: tất cả nằm ở
**`setup-cocos-mcp`**, và trạng thái thật do `setup-cocos-project-preflight` báo.
Chạy hai skill đó rồi quay lại; ở đây chỉ cần biết ba điều.

**1. Hai nửa phải khớp.**

| Nửa | Là gì | Đã có sẵn? |
|---|---|---|
| **Client** | khai báo MCP server `funplay_cocos` trong cấu hình của client | do `setup-cocos-mcp` ghi |
| **Editor** | extension `funplay-cocos-mcp` trong `<project>/extensions/` — chính nó mở cổng | **KHÔNG tự có.** Project mới phải cài |

Vì vậy `ConnectionRefused` gần như luôn nghĩa là: *Editor chưa mở*, hoặc *project
đang mở chưa cài/chưa Enable extension* — chứ không phải cấu hình client sai.

**2. Chỉ Creator 3.x.** Extension yêu cầu 3.8+; project 2.x dùng hệ extension
khác hẳn, nên với project 2.x thì **không có MCP** và mọi việc trên scene phải
làm bằng tay trong Editor 2.4.x.

**3. Port là per-project — đọc từ file, không hardcode.** Bản hiện tại sinh
port ổn định trong khoảng `20000–29999` và ghi vào
`funplay-cocos-mcp.config.json` ở gốc project; project cũ còn giữ `8765`. Không
có file đó nghĩa là extension chưa chạy lần nào trong project này — nhờ người
dùng mở **Funplay > MCP Server** một lần, đừng tự viết file.

## Kiểm trước khi dùng

Lấy `PORT` từ `funplay-cocos-mcp.config.json`, rồi:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:$PORT/health   # phải 200
curl -s http://127.0.0.1:$PORT/tools | head -c 400                       # danh sách tool sống
```

Editor phải **đang mở đúng project đó** thì cổng mới lắng nghe. Đóng Editor là
mất MCP — không có cách nào bù bằng cấu hình client.

Không kết nối được → **dừng, cài cho xong**. Đừng chuyển sang dựng scene tay như
phương án thay thế: vừa lâu hơn vừa sai âm thầm.

## Khi vẫn không kết nối được

| Triệu chứng | Nguyên nhân hay gặp | Xử lý |
|---|---|---|
| `ConnectionRefused` | Editor đóng, hoặc project chưa cài/chưa Enable extension | mở đúng project + Enable extension |
| Có process LISTEN nhưng tool vẫn lỗi | extension bản cũ, hoặc Editor kẹt sau khi reload | Developer → Reload Extensions, hoặc khởi động lại Editor |
| Port trong config khác port client đang gọi | project sinh port mới, client còn số cũ | chạy lại `setup-cocos-mcp` để hai bên khớp; đừng sửa một bên |
| Tool chạy nhưng scene không đổi | quên `save_current_scene` | luôn save + `validate_scene` sau mỗi loạt mutation |
| Tool `simulate_*` / `capture_desktop_screenshot` bị chặn | **đúng như thiết kế** — package set này cấm tự động hoá desktop | dùng `capture_editor_screenshot` / `capture_scene_screenshot` / `capture_game_screenshot` |

## Luật khi đã kết nối được

1. **Read-before-write**: `inspect_node` / `inspect_prefab` / `get_scene_info`
   trước, rồi mới mutate. Tool node/component tác động lên **scene đang mở**,
   không phải scene khởi động.
2. Mutate xong: **save + validate**. `validate_scene` và
   `validate_prefab_references` phải trả **0 broken ref** — đó là cổng của GĐ này.
3. Ground truth là giá trị property thật đọc từ bản gốc đang chạy được (mở trong
   Editor của chính bản đó, hoặc dump state lúc chạy), không phải trí nhớ. Prefab
   dựng bằng cảm giác gần như luôn lệch vài pixel, và lệch đó không báo lỗi.
4. Dựng theo lô nhỏ, validate giữa chừng — một lô 100 node hỏng thì không biết
   node nào gây ra.
5. Sửa `.ts` trên đĩa xong phải `refresh_assets` **và chờ** trước khi gọi tool
   nào tra uuid/class-id, nếu không `.meta` chưa tồn tại.
