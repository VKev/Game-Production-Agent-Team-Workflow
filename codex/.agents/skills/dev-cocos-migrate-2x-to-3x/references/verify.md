# GĐ5 — Verify bằng chạy thật

"Code trông đúng" và "prefab validate sạch" **không phải** bằng chứng game chạy.
Giai đoạn này biến mọi khẳng định thành số đo lấy từ một tiến trình game thật.

⛔ **Cổng ra:** full loop **boot → menu → gameplay → win/lose** chạy OK trên
**bản BUILD** (không chỉ preview trong Editor), có screenshot + dump state làm bằng.

---

## 1. Ba tầng chạy — dùng đúng tầng cho đúng câu hỏi

| Tầng | Cách chạy | Trả lời được | Không trả lời được |
|---|---|---|---|
| **Editor preview** | MCP: `run_project_preview`, `capture_preview_screenshot`, `get_runtime_state`, `get_recent_logs` | logic gameplay, UI, wiring | mọi thứ liên quan build/bundle/dung lượng |
| **Bản build + Chrome headless (CDP)** | `scripts/cdp.py` | resolution policy, camera, bundle load, thứ tự init thật | API riêng của nền tảng (`wx.*`, `tt.*`) |
| **Devtools nền tảng / thiết bị thật** | WeChat/Douyin devtools | subpackage, quyền, ad, IAP, hiệu năng thật | — |

Nguyên tắc: **bug chỉ xuất hiện ở tầng dưới thì phải bắt ở tầng dưới.** Rất
nhiều lỗi (letterbox sai, node lạc ra lề, camera clear thiếu) *không tồn tại*
trong Editor preview.

## 2. Toolkit CDP

Editor chạy preview headless qua CDP tại **localhost:7456**; bản build web chạy
qua HTTP server cục bộ (bản web Cocos **không** mở được bằng `file://`).

`cdp.py --serve` có server tích hợp, đã trả đúng MIME `.wasm` và
`Content-Encoding` cho file nén sẵn `.br`/`.gz`, nhưng **không hỗ trợ HTTP
Range**. Nếu bản build cần Range (audio seek, asset lớn) thì chạy
`serve-local.py` rồi trỏ `cdp.py --url` vào đó thay vì dùng `--serve`.

```bash
# chụp + dump chẩn đoán render của một bản build
python3 scripts/cdp.py diag --serve build/web-mobile --out diag1 --w 1600 --h 757

# chạy preview của Editor, bấm vào toạ độ, chụp lại
python3 scripts/cdp.py play --url http://localhost:7456 --tap 375,900 --wait 6 --out run1

# chạy một biểu thức JS trong game đang chạy và in kết quả
python3 scripts/cdp.py eval --url http://localhost:7456 \
        --expr "return cc.director.getScene().children.map(n=>n.name)"
```

`diag` in ra **đúng bộ số cần nhìn khi nghi ngờ layout/hiển thị**: frameSize,
designResolution, visibleSize, scaleX/Y, viewportRect, canvas px, và mọi Camera
(clearFlags, rect, ortho, priority, visibility).

## 3. Bộ kiểm tối thiểu trước khi nói "chạy được"

1. **Boot**: không lỗi đỏ trong console; scene đầu tiên đúng (không phải scene
   index 0 mặc định của builder — bẫy thật, xem `pitfalls.md` §6).
2. **Menu → vào game**: bấm THẬT (dispatch touch event), không gọi hàm trực tiếp.
   Gọi hàm trực tiếp sẽ **bỏ qua** toàn bộ lớp input — chính là chỗ hay hỏng nhất
   sau khi port (`scale.z=0`, camera rect lệch).
3. **Gameplay**: thực hiện đủ một vòng thao tác; dump state trước/sau và so.
4. **Win + Lose**: cả hai. Nhánh lose hay bị bỏ quên và thường hỏng.
5. **Chơi lại / sang màn**: kiểm memory leak thô (số node scene không tăng dần
   sau mỗi vòng).
6. **Text hiển thị**: soi screenshot xem chữ có **mất glyph** (ô trống/thiếu ký
   tự) hay **tràn khung** không. Không dịch nên rủi ro thấp, nhưng font vẫn có thể
   bị thiếu khi asset đi qua bước bóc/đóng lại — mắt người, không có script thay được.

## 4. So với bản gốc (A/B) — cách bắt sai lệch rẻ nhất

Bạn có **hai** bản 2.x chạy được để đối chiếu: bản mirror gốc (GĐ1) và **project
2.4.x đã tự dựng (GĐ2)**. Bản GĐ2 là bản so quan trọng hơn — nó cùng cấu trúc
node với bản 3.x nên diff có nghĩa từng dòng. Chạy **cùng một màn** trên cả hai,
dump cùng một bộ chỉ số, rồi diff.

```js
// dump so sánh được — chạy trên CẢ 2 bản
return (function walk(n, d) {
  return { name: n.name, children: n.children.length,
           pos: [Math.round(n.position.x), Math.round(n.position.y)],
           kids: d > 0 ? n.children.map(c => walk(c, d - 1)) : [] };
})(cc.director.getScene(), 4);
```

Chỉ số nên so: số node theo tầng, vị trí (làm tròn), số component loại chính,
kích thước, và **chữ ký sắp xếp** (sort rồi hash) — chữ ký khác nhau là có sai
lệch cấu trúc, dù ảnh chụp trông giống.

**ĐƯA `Label.string` vào diff** — vì không dịch, chuỗi hai bản phải **giống hệt
nhau**. Đây là một trong những tín hiệu rẻ và nhạy nhất: lệch một chuỗi thường
nghĩa là gán sai node, sai thứ tự khởi tạo, hoặc thiếu một nhánh set text. Thêm
`labels: n.getComponent('cc.Label')?.string` vào hàm dump ở trên rồi diff.

## 5. Bot tự chơi — khi cần quét nhiều màn

Với game nhiều level, người test tay không quét nổi. Viết một component bot
**tái dùng chính hàm logic của game** (đừng viết lại luật chơi — bot sẽ đúng
theo cách của nó chứ không theo cách của game):

- tìm nước đi hợp lệ bằng chính hàm kiểm tra của gameplay,
- tự phát hiện PASS / LOSE / STUCK,
- bấm nút "màn tiếp theo" thật.

Ba điều bắt buộc, rút từ một lần làm thật:
1. **Hotkey bật/tắt, mặc định TẮT** — bot chạy ngầm sẽ phá mọi phiên test khác.
2. **Guard `BUILD`** (`import { BUILD } from 'cc/env'`) để bot **bất hoạt hoàn
   toàn trong bản phát hành**.
3. Trong Chrome headless, game loop có thể bị pause → phải gọi `game.step()`
   thủ công; và Cocos web gắn `keydown` lên **canvas**, không phải `document` —
   dispatch phím vào đúng target.

## 6. Ghi lại bằng chứng

Mỗi lần verify để lại: `<tag>.png` (screenshot), `<tag>.json` (dump state),
`<tag>.chrome.log` (console). Khi ai đó hỏi "sửa xong chưa", câu trả lời là 3
file này, không phải một câu khẳng định.
