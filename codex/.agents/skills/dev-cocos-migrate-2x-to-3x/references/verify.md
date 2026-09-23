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
| **Bản build + Chrome headless (CDP)** | `cdp.py` (đường dẫn bên dưới) | resolution policy, camera, bundle load, thứ tự init thật | API riêng của nền tảng (`wx.*`, `tt.*`) |
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
`serve-local.py` (cùng thư mục `scripts/`) rồi trỏ `cdp.py --url` vào đó thay vì
dùng `--serve`.

`CDP=<skills-dir>/dev-cocos-migrate-2x-to-3x/scripts/cdp.py`, và `<build-dir>` là
thư mục build thật mà probe ở GĐ1 báo (`build/web-mobile`, `build/bytedance`… tuỳ
project):

```bash
# chụp + dump chẩn đoán render của một bản build
python3 $CDP diag --serve <build-dir> --out diag1 --w 1600 --h 757

# chạy preview của Editor, bấm vào toạ độ, chụp lại
python3 $CDP play --url http://localhost:7456 --tap 375,900 --wait 6 --out run1

# chạy một biểu thức JS trong game đang chạy và in kết quả
python3 $CDP eval --url http://localhost:7456 \
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

Bản so chuẩn là **chính project 2.x đầu vào** — nó cùng cấu trúc node với bản
3.x nên diff có nghĩa từng dòng. (Project đi qua `dev-cocos-port-2x` thì còn bản
mirror gốc để so thêm, nhưng bản project mới là bản đáng so.) Chạy **cùng một
màn** trên cả hai, dump cùng một bộ chỉ số, rồi diff.

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


---

## 7. Cổng kiểm tự động — chạy trước khi build, không phải sau

Chạy thật (mục 1–6 ở trên) bắt được thứ nhìn thấy được. Lớp asset-import và lớp
serialize thì **không nhìn thấy** cho tới khi ai đó tình cờ mở đúng màn hình. Bộ
script dưới đây đối chiếu dữ liệu 2.x ↔ 3.x, chạy trong vài giây, và đã bắt được
những bug mà `validate_scene` + `validate_prefab_references` + `tsc` đều báo xanh.

| Script | Bắt được gì |
|---|---|
| `check-cross-bundle.py` | import xuyên bundle; **`fatal: 0` bắt buộc** — import từ `main` sang bundle khác làm build boot ra scene rỗng |
| `verify-prefab-sizes.js` | `contentSize` từng node + vị trí root prefab |
| `verify-responsive.js` | `Widget` + `LongScreenWidgetComponent` khớp 1-1 với 2.x |
| `verify-spine.js` | binding skeleton ↔ tên animation code gọi (sai tên = luồng đứng, không lỗi) |
| `verify-i18n.js` | phủ bản dịch, nếu có localization |
| `test-module-order.js` | thứ tự eval ES module của chuỗi storage |
| `test-boot-prelude.js` | thứ tự cài lớp mock + idempotent |
| `test-api-coverage.js` | mọi endpoint có fixture; thay cho "rút mạng chơi thử" |
| `test-fake-ads.js` | quảng cáo giả luôn trao thưởng, không trao hai lần |

Bốn `test-*.js` chạy **ngoài engine**: chuỗi module liên quan không import `cc`,
nên `lib/esm-harness.js` compile sang **ESM thật** rồi eval bằng Node. Phải là
ESM — CommonJS eval theo vị trí dòng và sẽ **giấu mất** đúng bug đang tìm.

Giữ tính chất "không import `cc`" của các module đó khi thêm code, nếu không mất
luôn khả năng test.

### Tự kiểm checker: nó có fail được không?

Một checker không fail được thì không phải checker. Sau khi viết xong, **cố ý làm
hỏng** thứ nó canh rồi chạy lại:

- gỡ guard idempotent → `test-boot-prelude` phải báo `fetch identity CHANGED`;
- trả một `hostApi()` về `w.wxapi` trực tiếp → `test-module-order` phải THREW.

Đã có lần negative-check **pass nhầm** vì script sửa file khớp `\n` trong khi file
dùng **CRLF** nên không sửa được gì. Kiểm cả việc "lệnh phá hỏng có thật sự áp
dụng không".

### A/B: khử dương tính giả trước khi đọc kết quả

Bộ diff dump scene hai bên rồi so. Hai nguồn nhiễu làm báo cáo gần như vô dụng
nếu không khử:

1. **màu** — 2.x tint qua `node.color`, 3.x bỏ `node.color` và đưa màu lên
   component ⇒ mỗi node sinh **hai** finding đối xứng giả. So giá trị **hiệu
   dụng**: phía thiếu thì lấy màu của node.
2. **tên script** — bản 2.x đã minify nên mọi script báo tên `e`/`t`; 3.x báo tên
   thật ⇒ mọi node có script đều bị flag. So type engine theo tên, script dự án chỉ
   so "có script hay không".

Đo thật: 316 finding → khử còn **107**. Trong 107 đó, phần lớn là **nhiễu frame**
(hai dump ở visible size khác nhau vì trang preview khoá khung) và **tween đang
chạy**. Ép hai bên **cùng kích thước khung** trước khi dump, nếu không sẽ đuổi theo
chênh lệch không có thật.


### Bốn bug của chính bộ checker — đều suýt dẫn tới kết luận sai

Ghi lại vì cả bốn đều **báo lỗi giả hàng loạt**, và một con số lớn bất thường là
dấu hiệu checker sai chứ không phải project sai.

1. **Cocos 2.4 không có `node.components` public** — mảng thật là
   `node._components`. Đọc nhầm làm **mọi** node 2.x trông như không có component
   nào ⇒ **127 lệch "component set" hoàn toàn giả**.
2. **Tên constructor 2.x có tiền tố `cc_`** (`cc_Sprite`, `cc_Label`, `cc_Mask`)
   trong khi 3.8 dùng `Sprite`/`Label`/`Mask`. Không normalize thì mọi so sánh
   component là dương tính giả.
3. **Sibling trùng tên** đầy project (`Background`, `Text`, `1`). Không phân biệt
   `#2`/`#3` **ở CẢ HAI phía** thì ghép sai cặp node ⇒ **21 lệch giả**.
4. **`undefined` vs `0`.** 2.x serialize **sparse**: field bằng default bị bỏ qua,
   nên `_top` vắng mặt nghĩa là `0`. So `undefined` với `0` ⇒ **49 lệch giả** trên
   49 Widget.

> Quy tắc rút ra: **một con số lệch lớn bất thường là giả cho tới khi chứng minh
> ngược lại.** Kiểm tính hợp lý của con số trước khi đi sửa project.

### Mẹo giữ dump ra khỏi context

Dump scene graph cỡ 50–100 KB mỗi bên. Cho **trang tự ghi ra file** (Blob +
download, hoặc POST về một server nhỏ) rồi đọc từ đĩa — dữ liệu không đi qua
context lần nào, và bạn diff bằng script thay vì bằng mắt.
