# GĐ2 — Port script bằng MỘT agent mỗi lượt, không fan-out từng class

Bản trước của skill này fan-out **một agent cho một class**. Nó tốn vô lý và cho
kết quả kém hơn:

| | Fan-out từng class | Một agent mỗi wave |
|---|---|---|
| Đọc `api-map-2x-to-3x.md` (≈220 dòng) | **mỗi class một lần** | một lần cho cả wave |
| Đọc file exemplar + layout | mỗi class một lần | một lần |
| Biết class trước đó export kiểu gì | không — phải đoán | có, tự nó vừa viết |
| Helper trùng nhau | mỗi agent tự thêm một bản | không |
| Prompt + kết quả JSON | N lần | 1 lần |

Chi phí đúng chỗ đáng chú ý là dòng thứ ba: **style export** (`export default`
vs named) là nguyên nhân số một của lỗi import hàng loạt. Hai agent chạy song
song không thể thống nhất với nhau được.

Vì vậy: **một agent `cocos-port-class` cho mỗi wave**, wave chạy lần lượt.

## Bước 1 — Lấy thứ tự

```bash
node <skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/plan-port-waves.js <work>/layout-2x.json
```

Script đọc script root từ layout (GĐ1), dựng đồ thị `require()`, xếp topo, rồi
chia thành wave vừa một context agent. Tăng `--max-files` / `--max-lines` để có
ít lượt hơn; `--max-files 0 --max-lines 0` gộp cả project vào **một** lượt duy
nhất — dùng khi project nhỏ.

Ba thứ nó in ra mà bạn phải xử lý **trước** khi dispatch:

- **`vendor`** — `jszip`, `base64-js`, `buffer`, `TsHelpers`… **copy nguyên, không
  port**. Đây là code thư viện, port lại chỉ tạo bug mới. Chúng bị loại khỏi wave
  sẵn.
- **`CYCLES`** — nhóm require vòng (rất hay gặp ở cụm gameplay: `Game` ↔ `Level`
  ↔ `Main`). Không có thứ tự đúng nào cho nhóm này ⇒ đưa **cả nhóm vào một
  wave** và nói trước với agent rằng import trong nhóm sẽ phải sửa tay một lượt
  ở cuối.
- **`external`** — require không tìm thấy file. Mỗi cái là một trong ba: thư viện
  phải copy, module đã chết (không port), hoặc **global của SDK bên thứ ba không
  theo sang** — xem `dev-cocos-port-2x/references/shims-and-mobile.md` §2.3, nó
  giết cả chuỗi khởi động bằng một `ReferenceError` trong constructor.

## Bước 2 — Brief cho agent

Một dispatch, một wave. Brief chỉ chứa **đường dẫn và luật**, không dán source
(agent tự đọc file — dán vào là trả tiền hai lần cho cùng một nội dung):

```text
MODE=port
LAYOUT=<work>/layout-2x.json  + <work>/layout-3x.json
DEST=<script-root của 3.x, lấy từ layout-3x>   # giữ đúng cách chia bundle của 2.x
CLASSES=  (danh sách của wave, ĐÚNG THỨ TỰ script in ra)
  assets/framework/Utils.js      -> assets/framework/Utils.ts
  assets/framework/Constant.js   -> assets/framework/Constant.ts
  ...
EXEMPLARS=  (1–3 file .ts đã port và đã compile sạch; wave 1 thì không có)
EXPORT_STYLES=  (bảng do wave trước trả về: class -> default|named)
CYCLE_GROUP=  (có/không, nếu có thì liệt kê)
```

Sau mỗi wave, giữ lại **bảng `exportStyles`** rồi truyền cho wave sau. Đừng
truyền lại code đã port — chỉ tên class + kiểu export là đủ để wave sau import
đúng.

## Bước 3 — Cổng kiểm, do bạn chạy, không phải agent

Agent không được tự tuyên bố xong. Sau mỗi wave:

1. **Type check**: `npx tsc --noEmit` trong project 3.x, hoặc MCP
   `run_script_diagnostics`. Wave còn lỗi thì **sửa hết trước khi dispatch wave
   sau** — lỗi tích lại sẽ biến thành hàng trăm lỗi import.
2. **Không sót method**: mỗi file đích phải có đủ method của file nguồn.
3. **Grep no-op im lặng** trên các file vừa ghi — cả bốn cái này compile sạch và
   không hề chạy (`pitfalls.md` §5, §7, §7b, §7c):

   ```bash
   grep -nE '\.(zIndex|opacity|group)\s*=|["'"'"']touch(start|move|end|cancel)["'"'"']' <file...>
   ```
4. **`setScale` đủ 3 tham số**: `grep -nE 'setScale\([^,)]+\)' <file...>`

⛔ **Cổng ra GĐ2:** toàn bộ `.ts` compile sạch, bốn lệnh grep trên **không có
hit**, và mọi file `confidence: low` đã được rà tay.

## Việc KHÔNG giao cho agent

- Sửa scene/prefab (GĐ3 qua MCP) — agent không chạm file `.scene`/`.prefab`.
- Sửa `tsconfig.json`, `package.json`, `settings/`, hay `.meta` của thư mục bundle.
- Quyết định kiến trúc: giữ prefab hay chuyển JSON compact + builder runtime
  (chốt ở GĐ3), bỏ hay port module chết, đổi mô hình nạp asset.
- Chạy build, chạy verify, đo dung lượng.

Nếu agent báo `notes` có thứ ảnh hưởng ra ngoài wave (bất biến dữ liệu, API dùng
chung, global thiếu), **bạn** xử lý, đừng giao lại cho agent tiếp theo.
